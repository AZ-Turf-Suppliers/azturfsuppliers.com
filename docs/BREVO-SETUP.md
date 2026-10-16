# Brevo Contact Form — One-Time Setup

> **⚠️ The contact forms on this site post to `/api/contact`, a Cloudflare
> Pages Function that talks to Brevo. Until the steps below are done,
> form submissions will return a 500 and visitors will see "Email
> integration is not configured yet." Do not merge this change to `main`
> until Brevo + Turnstile are configured.**

What this gets you, for free:

- A searchable, exportable list of every form submitter in Brevo's
  **Contacts** dashboard (the "backend" for browsing leads).
- A transactional notification email to your inbox for each submission,
  with the visitor's full message and `Reply-To` set to them — hit reply
  to message them back directly.
- An opt-in **"Website Leads"** list for sending occasional newsletters
  or seasonal offers later.
- Cloudflare Turnstile invisible CAPTCHA + honeypot field for spam
  rejection.

Free tier covers it easily: Brevo allows 300 transactional emails/day
and unlimited contacts. Turnstile is unlimited free.

There are four dashboards to touch — none of it is in code:

1. **Brevo** — create the API key, sender, custom attributes, and the list.
2. **Cloudflare Turnstile** — create a site key + secret.
3. **Cloudflare Pages → Variables and Secrets** — paste those into env vars.
4. (DNS, optional) — verify the sender domain in Brevo so notification
   emails come from `noreply@azturfsuppliers.com` instead of Brevo's
   shared sender (better deliverability, no "via brevo.com" tag).

---

## 1. Set up Brevo

### 1a. Create the account

Sign up at https://www.brevo.com (free plan, no credit card required).
You'll need to confirm your business email.

### 1b. Create the API key

**Brevo dashboard → top-right profile menu → SMTP & API → API Keys → Generate a new API key**

| Field | Value |
| --- | --- |
| **Name** | `AZ Turf Website` |

Copy the key starting with `xkeysib-…`. You will not be able to see it
again. Save it somewhere safe — you'll paste it into Cloudflare in step 3.

### 1c. Create custom contact attributes

The /api/contact function writes 4 custom attributes onto each contact so
you can browse submissions at a glance. Brevo only auto-creates
`FIRSTNAME` and `LASTNAME`; the rest need to be added once.

**Contacts → Settings (gear icon) → Contact attributes → Add an attribute**

Add these nine — all type **Text**:

| Attribute name | Purpose | Type |
| --- | --- | --- |
| `PHONE` | Submitter phone | Text |
| `ROLE` | Homeowner / Contractor / etc. from the form's role select | Text |
| `MESSAGE` | The first ~240 chars of their message (full text lives in the notification email and Sheet) | Text |
| `LAST_SUBMITTED_AT` | ISO timestamp of their most recent submission | Text *(or Date — Text is simpler since we already pass an ISO string)* |
| `UTMCSR` | First-touch attribution: `utm_source` / `utmcsr` from the landing URL | Text |
| `UTMCMD` | First-touch attribution: `utm_medium` / `utmcmd` | Text |
| `UTMCCN` | First-touch attribution: `utm_campaign` / `utmccn` | Text |
| `UTMCTR` | First-touch attribution: `utm_term` (keyword) / `utmctr` | Text |
| `UTMGCLID` | First-touch Google Ads click ID (`gclid` / `utmgclid`) | Text |

> Why not the built-in `SMS` attribute for phone? Brevo's SMS field
> requires E.164 (`+14807931800`) and rejects anything else. Keeping
> phone in a plain text attribute avoids that validation friction.

> The five attribution attributes are populated automatically by the
> Cloudflare Function when a submitter arrived from a tagged URL like
> `?utmcsr=google&utmcmd=cpc&utmccn=spring2026`. If the attributes
> don't exist in Brevo yet, the Function still works — Brevo silently
> ignores unknown attributes, so attribution just doesn't land on the
> contact record (it still appears in the notification email and the
> Google Sheet). Create them when you're ready to use them.

### 1d. Create the "Website Leads" list

**Contacts → Lists → Create a new list**

| Field | Value |
| --- | --- |
| **Name** | `Website Leads` |

After saving, the URL will look like
`https://app.brevo.com/contact/list-listing/list/<ID>` — note the
numeric ID (e.g. `3`). You'll paste it into Cloudflare as
`BREVO_LIST_ID` in step 3.

Only visitors who tick the "send me updates" checkbox on the form get
added to this list. Everyone else still becomes a contact, just not list
members — which keeps you compliant with CAN-SPAM / CASL.

### 1e. Add and verify a sender

**Senders, Domains & Dedicated IPs → Senders → Add a sender**

| Field | Value |
| --- | --- |
| **From name** | `AZ Turf Suppliers Website` |
| **From email** | `noreply@azturfsuppliers.com` *(or any inbox you control)* |

Brevo sends a one-time verification email to that address; click the
link to verify. Until verified, the API will refuse to send.

> **Highly recommended — verify the whole domain instead.** Same screen
> → **Domains → Authenticate a domain**. Brevo gives you 3 DNS records
> (DKIM, Brevo-code, DMARC-friendly SPF) to add at your DNS host. Once
> green, deliverability is much better and Gmail/Outlook stop showing
> the "via brevo.com" tag.

---

## 2. Set up Cloudflare Turnstile

Cloudflare dashboard → **Turnstile** (left sidebar) → **Add site**

| Field | Value |
| --- | --- |
| **Site name** | `azturfsuppliers.com` |
| **Hostnames** | `azturfsuppliers.com`, `www.azturfsuppliers.com`, `azturfsuppliers-com.pages.dev` |
| **Widget mode** | **Managed** (recommended — invisible to most humans) |

After creating, you'll see two values:

- **Site key** (public, starts `0x4AAAAAAA…`) → goes into `PUBLIC_TURNSTILE_SITE_KEY`
- **Secret key** (private, starts `0x4AAAAAAA…`) → goes into `TURNSTILE_SECRET_KEY`

---

## 3. Add the env vars in Cloudflare Pages

Cloudflare dashboard → **Workers & Pages** → `azturfsuppliers-com` →
**Settings** → **Variables and Secrets**.

Set each one twice — once with the **Choose Environment** dropdown on
**Production**, then again on **Preview** — so the staging deploys also
work.

| Variable name | Value | Type |
| --- | --- | --- |
| `BREVO_API_KEY` | The `xkeysib-…` key from step 1b. | **Secret (encrypted)** |
| `BREVO_NOTIFY_EMAIL` | Where notification emails go, e.g. `contact@azturfsuppliers.com`. | Plaintext |
| `BREVO_SENDER_EMAIL` | The verified sender from step 1e, e.g. `noreply@azturfsuppliers.com`. | Plaintext |
| `BREVO_SENDER_NAME` | *(optional)* Display name on the notification email. Defaults to "AZ Turf Suppliers Website". | Plaintext |
| `BREVO_LIST_ID` | The numeric ID from step 1d, e.g. `3`. | Plaintext |
| `PUBLIC_TURNSTILE_SITE_KEY` | Site key from step 2. The `PUBLIC_` prefix exposes it to the browser at build time. | Plaintext |
| `TURNSTILE_SECRET_KEY` | Secret key from step 2. | **Secret (encrypted)** |

Save. Cloudflare will redeploy automatically. The new env vars take
effect immediately for the function (`BREVO_*`, `TURNSTILE_SECRET_KEY`)
and on the next build for the public site key (it's baked into the
client bundle at build time).

> If you change `PUBLIC_TURNSTILE_SITE_KEY` later, you must trigger a
> rebuild (e.g. retry the latest deploy) for the new value to reach the
> browser.

---

## 4. Test it end-to-end

1. Visit `https://www.azturfsuppliers.com/contact`.
2. Fill out the form (use a real email you can check). Tick the opt-in
   checkbox.
3. Submit. You should land on `/thank-you`.
4. Within ~30 seconds, the notification email should arrive at
   `BREVO_NOTIFY_EMAIL`. Hit reply — it should compose to the email you
   entered in the form, not Brevo.
5. In Brevo: **Contacts → All contacts**. The new contact should be
   there with FIRSTNAME, LASTNAME, PHONE, ROLE, MESSAGE filled in, and
   listed under **Lists → Website Leads**.

If something fails, check Cloudflare → Workers & Pages →
`azturfsuppliers-com` → **Functions → Real-time logs**. The function
logs `console.error(...)` lines for failed Brevo calls.

---

## What's in the integration

```
src/pages/contact.astro          ← form posts to /api/contact (FormData)
src/pages/index.astro            ← homepage form, same handler
functions/api/contact.js         ← Cloudflare Pages Function: validates,
                                   verifies Turnstile, upserts the Brevo
                                   contact, sends the notification email.
```

Honeypot field name is `website` — handled silently (returns 200 OK so
the bot doesn't retry).

## What happens to existing Formspree submissions

The old Formspree endpoint (`mdabkzde`) is no longer referenced in the
codebase. You can leave the Formspree project as-is for historical
record (free plan retains submissions indefinitely), or delete it from
the Formspree dashboard. Either way, no new submissions will arrive.

## If you ever want to disable Turnstile temporarily

Remove `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` from
Cloudflare and trigger a rebuild. The form will render without the
widget, and the function will skip verification. The honeypot stays
active.
