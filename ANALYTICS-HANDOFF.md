# Analytics Handoff — AZ Turf Suppliers

For the analytics consultant configuring GTM / GA4 / Google Ads conversion tracking.
Everything below is already implemented on the site; you don't need to ask the developer to push code unless you want events that aren't listed here.

---

## Site basics

| | |
|---|---|
| **Production URL** | https://www.azturfsuppliers.com |
| **Tech stack** | Astro (static SSG) on Cloudflare Pages |
| **GTM container ID** | `GTM-595K6QJW` |
| **Container install** | Standard. Bootstrap script in `<head>`, noscript iframe at top of `<body>`. Loads on all 40 pages. |

You should already have edit access to the GTM container. If not, the site owner can invite you (gtm dashboard → Admin → User Management).

## What's hardcoded on the site (no code changes needed)

### 1. Lead attribution capture

On every page load, an inline script (in the shared layout) reads URL query parameters and stores attribution in `localStorage` under the key `az_attribution`. **First-touch attribution with a 90-day window** — i.e. once we capture attribution for a visitor, it won't be overwritten by later visits until 90 days pass or they clear browser data.

**URL params accepted** (both abbreviated GA-classic and standard `utm_*` forms — whichever the ad URL uses):

| Stored under | URL params (first match wins) | Maps conceptually to |
|---|---|---|
| `utmcsr` | `utmcsr`, `utm_source` | utm_source |
| `utmcmd` | `utmcmd`, `utm_medium` | utm_medium |
| `utmccn` | `utmccn`, `utm_campaign` | utm_campaign |
| `utmctr` | `utmctr`, `utm_term` | utm_term / keyword |
| `utmgclid` | `utmgclid`, `gclid` | gclid |

Example ad URL that captures cleanly: `https://www.azturfsuppliers.com/?utmcsr=google&utmcmd=cpc&utmccn=spring_2026&utmctr=artificial%20turf&utmgclid=ABC123`

### 2. `generate_lead` dataLayer event

Fires once on `/thank-you` page load, which is where the contact form redirects on successful submission. This is your conversion event.

**dataLayer push:**

```javascript
window.dataLayer.push({
  event: 'generate_lead',
  form_name: 'contact_form',
  page_path: '/thank-you',
  // Below 5 are only present if non-empty (omitted for organic conversions):
  utmcsr:   '...',  // first-touch source
  utmcmd:   '...',  // first-touch medium
  utmccn:   '...',  // first-touch campaign
  utmctr:   '...',  // first-touch term/keyword
  utmgclid: '...',  // first-touch Google Ads click ID
});
```

The 5 attribution fields are pulled from `localStorage.az_attribution` at the moment of the push. They're omitted when empty so organic-traffic conversions stay clean — your GTM filters should expect them to be undefined sometimes.

### 3. What's NOT hardcoded (you'd need a dev push)

- No `page_view` events beyond GTM's default trigger.
- No phone-click events (`tel:` links exist throughout the site but aren't instrumented).
- No scroll-depth or engagement events.
- No `view_item` / ecommerce events on product pages.
- No outbound-link tracking.
- No 404 tracking.

If you want any of these, tell the site owner — most are doable as small additions to the layout or as pure GTM tags (e.g. phone clicks can be a "Click - Just Links" trigger in GTM with no code change).

## Recommended GTM configuration

### Step 1 — Data Layer Variables (5 new)

For each of the 5 attribution fields, create a Data Layer Variable:

| Variable Name | Data Layer Variable Name | Default Value |
|---|---|---|
| `DLV - utmcsr`   | `utmcsr`   | (empty) |
| `DLV - utmcmd`   | `utmcmd`   | (empty) |
| `DLV - utmccn`   | `utmccn`   | (empty) |
| `DLV - utmctr`   | `utmctr`   | (empty) |
| `DLV - utmgclid` | `utmgclid` | (empty) |

### Step 2 — Custom Event trigger

| | |
|---|---|
| **Type** | Custom Event |
| **Event name** | `generate_lead` |
| **Fires on** | All custom events |

### Step 3 — GA4 Event tag (assuming GA4 is the destination)

| | |
|---|---|
| **Tag type** | Google Analytics: GA4 event |
| **Configuration tag** | (your existing GA4 config tag) |
| **Event name** | `generate_lead` |
| **Trigger** | the Custom Event trigger from Step 2 |
| **Event parameters** | `source` = `{{DLV - utmcsr}}`, `medium` = `{{DLV - utmcmd}}`, `campaign` = `{{DLV - utmccn}}`, `term` = `{{DLV - utmctr}}`, `gclid` = `{{DLV - utmgclid}}` |

Then mark `generate_lead` as a **Key Event** in GA4 (Admin → Events → toggle "Mark as key event").

### Step 4 — Google Ads conversion (if running Google Ads)

Since `gclid` is captured per-lead, you can do **enhanced conversions for leads** with first-party data (email/phone) or just the standard conversion tag. Either way:

| | |
|---|---|
| **Tag type** | Google Ads Conversion Tracking |
| **Conversion ID / Label** | (from your Google Ads conversion action) |
| **Trigger** | the Custom Event trigger from Step 2 |

The `utmgclid` DLV is useful as a debugging signal but Google Ads matches conversions by its own `gclid` cookie, not from the dataLayer.

### Step 5 — Optional: pass attribution to other ad platforms

If you're running Meta / TikTok / Microsoft ads in parallel, you can fire their pixels on the same trigger with the same DLVs as custom data. The site doesn't yet capture `fbclid` or `msclkid`, but if you need them, ask the dev — it's a one-line addition to the capture script (same pattern as `gclid`).

## Testing & verification

### Quick smoke test (incognito recommended — first-touch attribution will ignore new UTMs in a tab that already captured a record)

1. Open in incognito: `https://www.azturfsuppliers.com/?utmcsr=test&utmcmd=cpc&utmccn=spring_2026&utmctr=fake+keyword&utmgclid=ABC123XYZ`
2. DevTools → Application → Local Storage → look for `az_attribution`. Should show the 5 captured fields.
3. Navigate to `/contact` in the same tab. Submit the form with any email you can check (e.g. `analytics-test@yourcompany.com`).
4. On `/thank-you`, DevTools → Console → run `window.dataLayer` — you'll see the `generate_lead` event with all 5 UTM fields populated.

### GTM Preview mode

1. GTM → Preview → enter the same UTM-tagged URL above → Connect.
2. Follow the same path through the form.
3. On `/thank-you`, the Preview pane left timeline shows a **`generate_lead`** custom event. Click it → Data Layer tab to confirm the 5 fields. The Tags Fired panel shows any GA4/Ads tags you've wired.

### GA4 DebugView

After publishing GTM and submitting a form (with the GA4 debug cookie or `?gtm_debug=x` URL param), check GA4 → Admin → DebugView. The `generate_lead` event should appear with all 5 parameters.

## What the form actually does server-side (FYI, not your problem)

When someone submits the contact form, the page POSTs to a Cloudflare Pages Function at `/api/contact`. That function:

1. Verifies Cloudflare Turnstile + a honeypot field.
2. Upserts a contact in Brevo (CRM) with the form fields + 5 attribution attributes (UTMCSR, UTMCMD, UTMCCN, UTMCTR, UTMGCLID).
3. POSTs the submission to optional downstream destinations (Google Sheet, Zapier — both env-var-gated).
4. Sends a transactional notification email with full message + attribution table.
5. Returns 200 → page JS redirects to `/thank-you` → `generate_lead` event fires.

So attribution is captured in three places independent of GTM: Brevo contact record, optional Sheet/Zapier, and the notification email. You're focused on the GTM/GA4 layer; the rest is downstream of your work.

## Questions / contact

For dev-side changes (additional events, new fields on the form, etc.), contact the site owner. For analytics-only changes (GTM tags, GA4 config, ad platform conversions), you have everything you need.
