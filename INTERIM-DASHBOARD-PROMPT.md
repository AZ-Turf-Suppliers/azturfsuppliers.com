# Claude for Chrome — Interim Dashboard Setup Prompt

> Use this while waiting for the analytics consultant to send over the
> real Zapier webhook URL. Handles two dashboard tasks the Chrome agent
> can finish right now without analyst input:
>
> 1. **Brevo**: create the 5 UTM contact attributes so attribution
>    lands on contact records. The Cloudflare Function already sends
>    them — Brevo silently drops them until the attributes exist.
> 2. **Cloudflare Pages**: add `ZAPIER_WEBHOOK_URL` with a placeholder
>    URL, ready to be swapped to the real URL with a single edit when
>    the analyst sends it.
>
> Reference docs (in the repo):
> - `BREVO-SETUP.md` § 1c — attribute list
> - `ZAPIER-SETUP.md` — what the placeholder eventually replaces

---

I need you to finish two interim dashboard tasks for AZ Turf Suppliers while we wait for the analytics consultant to send over a real Zapier webhook URL. The site's Cloudflare Function code already supports both; these tasks just prepare the underlying services so the integration activates immediately once the real URL arrives.

**Before you start, confirm:**

1. I'm signed into https://app.brevo.com (the same account that owns `azturfsuppliers@gmail.com` from the earlier Brevo session).
2. I'm signed into https://dash.cloudflare.com.
3. Pre-approve these domains for tab access: `app.brevo.com`, `my.brevo.com`, `dash.cloudflare.com`. GitHub already approved.

Maintain this running checklist and show it after each phase:

| Item | Status |
|---|---|
| Brevo `UTMCSR` attribute | pending |
| Brevo `UTMCMD` attribute | pending |
| Brevo `UTMCCN` attribute | pending |
| Brevo `UTMCTR` attribute | pending |
| Brevo `UTMGCLID` attribute | pending |
| Cloudflare `ZAPIER_WEBHOOK_URL` (Production) | pending |
| Cloudflare `ZAPIER_WEBHOOK_URL` (Preview) | pending |

### Phase 1 — Create the 5 Brevo UTM attributes

Navigate to Brevo → **Contacts → Settings (gear icon) → Contact attributes**.

You should see four existing attributes from the earlier session: `PHONE`, `ROLE`, `MESSAGE`, `LAST_SUBMITTED_AT`. Don't touch those.

Add these five, **all type Text** (use "Add an attribute" and create them one by one):

| Attribute name | Type | What it stores |
|---|---|---|
| `UTMCSR`   | Text | First-touch source (utm_source) |
| `UTMCMD`   | Text | First-touch medium (utm_medium) |
| `UTMCCN`   | Text | First-touch campaign (utm_campaign) |
| `UTMCTR`   | Text | First-touch keyword/term (utm_term) |
| `UTMGCLID` | Text | First-touch Google Ads click ID (gclid) |

After each one, the row should appear in the attributes list. Update the checklist as you go.

**If any of the 5 already exists** (unlikely, but possible if someone else added them), skip the duplicate and note it in the checklist. Don't try to recreate or edit existing ones.

Screenshot the final attribute list with all 9 attributes visible (the 4 originals + the 5 you added) before moving on.

### Phase 2 — Add the Zapier placeholder env var

Cloudflare → **Workers & Pages → `azturfsuppliers-com` → Settings → Variables and Secrets**.

For **Production**:

| Variable | Value | Type |
|---|---|---|
| `ZAPIER_WEBHOOK_URL` | `https://hooks.zapier.com/hooks/catch/0/REPLACE-ME-WITH-REAL-URL/` | Plaintext |

Save. Then switch the "Choose Environment" dropdown to **Preview** (screenshot the dropdown showing Preview selected before continuing) and add the same variable with the same placeholder value.

**Why this exact placeholder string:**
- It looks like a real Zapier URL, so when the analyst sends the real one it'll be obvious where to paste it.
- `REPLACE-ME-WITH-REAL-URL` will trigger a clear `404`/`410` response from Zapier — the Cloudflare Function logs that as `Zapier webhook non-OK: 404` on each form submission, which is the loud signal we want until the real URL is in place.
- It does NOT silently succeed (which would let us forget about it).

**Important tradeoff to acknowledge in your final report:** with the placeholder URL active, the Cloudflare Function will log a `Zapier webhook non-OK:` line in Functions → Real-time logs on every form submission. This is **expected and harmless** — the form still succeeds, Brevo still updates, the email notification still sends. The log noise stops the moment the real URL replaces the placeholder.

Don't try to "test" the Zapier integration during this session — you'll just create a fake submission that fails, and the analyst's Zap doesn't exist yet anyway. Wait until the real URL is in.

### Phase 3 — Verify and report

Show me the final checklist with all 7 rows ✅. Also include:

- Screenshot of the Brevo Contact attributes list with all 9 attributes visible.
- Screenshot of the Cloudflare Variables and Secrets page on **Production** showing `ZAPIER_WEBHOOK_URL` with the placeholder.
- Screenshot of the same page on **Preview**.

Then summarize the remaining manual steps the site owner needs to do after the analyst sends the real URL:

1. Cloudflare → Variables and Secrets → click `ZAPIER_WEBHOOK_URL` on Production → edit the value → paste real URL → Save.
2. Switch dropdown to Preview → same edit.
3. Submit a test on https://www.azturfsuppliers.com/contact and tell the analyst to check their Zap History.

### Rules
- No secrets are involved this session — everything is public values or attribute names. You can echo them freely.
- If a 2FA / unexpected UI prompt appears, pause for me.
- If a Brevo or Cloudflare dashboard UI doesn't match this playbook (they reshuffle occasionally), describe what you see and ask before clicking.
- Do not touch any of the existing Brevo attributes (PHONE/ROLE/MESSAGE/LAST_SUBMITTED_AT) or any of the existing Cloudflare env vars (BREVO_*, TURNSTILE_*, PUBLIC_TURNSTILE_*, GITHUB_*).

Ready? Confirm: (a) you're signed into both Brevo and Cloudflare, (b) you've noted the pre-approved domain list. Then start Phase 1.
