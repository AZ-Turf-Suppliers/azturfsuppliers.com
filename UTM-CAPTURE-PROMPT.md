# Portable UTM Capture — Prompt for Another Site

> Drop this as a task brief into whoever's working on the other site
> (dev, Claude in another window, the analytics consultant, etc.).
>
> Tech-stack agnostic — vanilla JS, works anywhere HTML loads.
>
> Mirrors the production pattern in use on azturfsuppliers.com.

---

I want to add first-touch UTM attribution capture to this site, matching the pattern we run on azturfsuppliers.com. It's a small portable client-side recipe that captures ad-click attribution and persists it across page loads so it travels with any form submission.

**What it needs to do:**

1. On every page load, read URL parameters and capture attribution (`utm_source`/`utmcsr`, `utm_medium`/`utmcmd`, `utm_campaign`/`utmccn`, `utm_term`/`utmctr`, and `gclid`/`utmgclid`).
2. Store the captured values in `localStorage` with a **90-day first-touch window** — once captured, don't overwrite until 90 days pass or the user clears browser data. This preserves attribution to the ad that originally brought the visitor in.
3. Auto-populate 5 hidden inputs on any `<form>` element on the page, so attribution always submits with the lead.
4. Accept either abbreviated GA-classic param names (`utmcsr`, `utmcmd`, …) **or** standard `utm_*` names — whatever the ad URL uses.

Backend-agnostic. Works with custom serverless functions, Formspree, Tally, HubSpot forms, Mailchimp forms, or anything else that accepts hidden inputs.

---

## Step 1 — Add the capture script

Paste this into the site's shared HTML template, as early in `<head>` as possible. Use an inline `<script>` tag, not a module bundle, so it runs before any form interaction.

- **Astro / Next.js / Nuxt:** put it in the shared layout component, inside `<head>`.
- **WordPress:** the theme's `header.php` between `<head>` tags, or a "site-wide custom HTML" plugin slot.
- **Webflow / Squarespace / Wix / Framer:** site-wide custom code (Head section).
- **Plain HTML / Eleventy:** the include partial that emits `<head>`.

```html
<script>
(function () {
  var KEY = 'attribution';
  var MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
  var MAP = {
    utmcsr:   ['utmcsr',   'utm_source'],
    utmcmd:   ['utmcmd',   'utm_medium'],
    utmccn:   ['utmccn',   'utm_campaign'],
    utmctr:   ['utmctr',   'utm_term'],
    utmgclid: ['utmgclid', 'gclid'],
  };

  function readParam(qs, names) {
    for (var i = 0; i < names.length; i++) {
      var v = qs.get(names[i]);
      if (v) return v;
    }
    return '';
  }

  function capture() {
    try {
      var qs = new URLSearchParams(window.location.search);
      var found = {};
      var any = false;
      Object.keys(MAP).forEach(function (k) {
        var v = readParam(qs, MAP[k]);
        if (v) { found[k] = v; any = true; }
      });
      if (!any) return;

      // First-touch: if a fresh (<90d) record exists, leave it.
      var existing = null;
      try { existing = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
      if (existing && existing.capturedAt && (Date.now() - existing.capturedAt) < MAX_AGE_MS) return;

      found.capturedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(found));
    } catch (e) {}
  }

  function fillForms() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!data) return;
    var names = Object.keys(MAP);
    document.querySelectorAll('form').forEach(function (form) {
      names.forEach(function (n) {
        var input = form.querySelector('input[name="' + n + '"]');
        if (input && !input.value && data[n]) input.value = data[n];
      });
    });
  }

  function run() { capture(); fillForms(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // For SPA-style frameworks. Harmless on non-SPA sites.
  document.addEventListener('astro:page-load', run);
})();
</script>
```

If this site uses a different SPA framework (Next.js router, Vue Router, etc.), also call `run()` on the framework's route-change event so attribution re-fills after client-side navigation.

## Step 2 — Add 5 hidden inputs to every lead-capture form

Inside every `<form>` you want to track, add these 5 inputs anywhere within the form tag:

```html
<input type="hidden" name="utmcsr">
<input type="hidden" name="utmcmd">
<input type="hidden" name="utmccn">
<input type="hidden" name="utmctr">
<input type="hidden" name="utmgclid">
```

The script auto-fills these from `localStorage` on every page load (and on form-page navigation in SPAs). No additional JS wiring needed at the form level — they just show up in the submission like any other field.

## Step 3 — Make sure the backend forwards them

Wherever form submissions are received (custom backend, Formspree, Tally, HubSpot, etc.), the 5 hidden fields will arrive alongside the visible form data. Forward them to wherever the lead ultimately lands:

- **Formspree / Tally:** they automatically appear as fields in the dashboard. Map them to your CRM via Formspree's Brevo / HubSpot / Mailchimp integrations.
- **HubSpot forms:** create matching contact properties (`utmcsr`, etc.) — HubSpot will auto-populate them from hidden form fields with the same name.
- **Custom backend:** parse the request body as you would any other field. Forward to your CRM as contact attributes or a sheet column.

## Step 4 — Verify

1. Open the site in **incognito** at a tagged URL:
   ```
   https://YOUR-SITE.com/?utmcsr=test&utmcmd=cpc&utmccn=demo&utmctr=fake+keyword&utmgclid=ABC123XYZ
   ```
2. **DevTools → Application → Local Storage** → look for the `attribution` key. JSON value should contain all 5 fields + a `capturedAt` timestamp.
3. Navigate to a form page in the **same tab** (not a fresh tab — localStorage is per-origin, persists across navigations).
4. **DevTools → Console** → paste:
   ```js
   Array.from(document.querySelectorAll('input[name^="utm"]')).map(i => `${i.name}=${i.value}`)
   ```
   Should return all 5 populated:
   ```
   ['utmcsr=test', 'utmcmd=cpc', 'utmccn=demo', 'utmctr=fake keyword', 'utmgclid=ABC123XYZ']
   ```
5. Submit the form. Verify the 5 fields show up in whatever destination receives submissions (Formspree dashboard, backend log, CRM contact record).

If any of those steps fails, debug from the top — script not loaded? localStorage blocked by browser settings? Form using a non-standard submit handler that strips hidden fields? CRM not receiving the field names you sent? Each is independently checkable.

---

## URL parameter reference

| Stored under | URL param accepted (first match wins) | What it represents |
|---|---|---|
| `utmcsr`   | `utmcsr`, `utm_source` | Source: google, facebook, newsletter, direct, etc. |
| `utmcmd`   | `utmcmd`, `utm_medium` | Medium: cpc, organic, email, social, referral, etc. |
| `utmccn`   | `utmccn`, `utm_campaign` | Campaign name (your choice — e.g. `spring_2026_promo`) |
| `utmctr`   | `utmctr`, `utm_term` | Keyword / search term that triggered the click |
| `utmgclid` | `utmgclid`, `gclid` | Google Ads click ID. Enables enhanced conversions for leads. |

## First-touch vs. last-touch attribution

This script does **first-touch attribution** — the first ad that brought a visitor in within a 90-day window gets credit, even if they return organically before converting.

To switch to **last-touch attribution** (every new tagged visit overwrites the stored record), edit the `capture()` function: remove the block that returns early when a fresh record exists. Simple one-line change.

## Notes

- The `KEY` constant is `'attribution'` — change if you want to namespace it per project (e.g. `'siteX_attribution'`).
- The 90-day window matches Google Ads' default attribution lookback. Adjust `MAX_AGE_MS` if needed.
- The script is ~70 lines, no dependencies, no build step. Total payload < 2KB.
- Compatible with all browsers from IE11+ (uses `var` and function declarations on purpose for safety).
