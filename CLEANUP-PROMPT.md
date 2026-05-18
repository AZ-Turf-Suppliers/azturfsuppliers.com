# Claude for Chrome — Pre-Sheets Cleanup Prompt

> Run this FIRST, before `SHEETS-SETUP-PROMPT.md`. Two quick dashboard
> tasks (~5 minutes total):
>
> 1. **Cloudflare**: remove the `ZAPIER_WEBHOOK_URL` placeholder env var
>    we added earlier — we're going direct to Google Sheets instead of
>    fanning out to Zapier from the server.
> 2. **Brevo**: create the 5 UTM contact attributes so attribution
>    lands on contact records (the function already sends them; Brevo
>    silently drops them until the attributes exist).
>
> When this is done, run `SHEETS-SETUP-PROMPT.md` for the actual
> Sheets setup.

---

I need two quick dashboard cleanups before we wire up Google Sheets as the lead archive. Both are small isolated tasks. ~5 minutes total.

**Context:** We previously added a Zapier webhook placeholder env var in Cloudflare while waiting on an analyst-provided URL. We've since decided to skip the Zapier-as-fan-out path entirely and write submissions directly to a Google Sheet, which the analyst will pull from on his own schedule. So the Zapier env var is now orphaned and should be removed. Separately, we need to add 5 Brevo contact attributes we deferred earlier so UTM attribution lands on contact records going forward.

**Before you start, confirm:**

1. I'm signed into https://dash.cloudflare.com.
2. I'm signed into https://app.brevo.com (the account that owns `azturfsuppliers@gmail.com` from the earlier session).
3. Pre-approve `dash.cloudflare.com`, `app.brevo.com`, `my.brevo.com` for tab access.

Maintain this running checklist:

| Item | Status |
|---|---|
| Cloudflare `ZAPIER_WEBHOOK_URL` removed from Production | pending |
| Cloudflare `ZAPIER_WEBHOOK_URL` removed from Preview | pending |
| Brevo `UTMCSR` attribute created | pending |
| Brevo `UTMCMD` attribute created | pending |
| Brevo `UTMCCN` attribute created | pending |
| Brevo `UTMCTR` attribute created | pending |
| Brevo `UTMGCLID` attribute created | pending |

### Phase 1 — Remove the Zapier env var from Cloudflare

Cloudflare → **Workers & Pages → `azturfsuppliers-com` → Settings → Variables and Secrets**.

For **Production**:

1. Find `ZAPIER_WEBHOOK_URL` in the variables list (its value is the placeholder `https://hooks.zapier.com/hooks/catch/0/REPLACE-ME-WITH-REAL-URL/`).
2. Click the row → menu (three dots) → **Delete** / **Remove**.
3. Confirm.

Switch the "Choose Environment" dropdown to **Preview** (screenshot the dropdown showing Preview selected before continuing) and repeat: find `ZAPIER_WEBHOOK_URL`, delete it.

**Do not touch any other env var.** The Cloudflare project should still have these on both environments after you're done: `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_NOTIFY_EMAIL`, `BREVO_SENDER_EMAIL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (8 total, plus an optional `BREVO_SENDER_NAME` if it was set).

Screenshot the final variables list on both Production and Preview to confirm `ZAPIER_WEBHOOK_URL` is gone and nothing else changed.

> **What this does immediately:** stops the 404 log noise in Cloudflare Functions logs that started when we added the placeholder. The form, Brevo, and email all continue to work unchanged.

### Phase 2 — Create the 5 Brevo UTM contact attributes

Brevo → **Contacts → Settings (gear icon) → Contact attributes**.

You'll see 4 existing attributes from the earlier session: `PHONE`, `ROLE`, `MESSAGE`, `LAST_SUBMITTED_AT`. **Don't touch those.**

Add these 5 one by one (click **Add an attribute** for each), **all type Text**:

| Attribute name | What it stores |
|---|---|
| `UTMCSR`   | First-touch source (utm_source) |
| `UTMCMD`   | First-touch medium (utm_medium) |
| `UTMCCN`   | First-touch campaign (utm_campaign) |
| `UTMCTR`   | First-touch keyword/term (utm_term) |
| `UTMGCLID` | First-touch Google Ads click ID (gclid) |

After each create, the row should appear in the attributes list. Update the checklist as you go.

If any of the 5 already exists (unlikely), skip the duplicate and note it in the checklist. Don't try to recreate or modify existing ones.

When all 5 are added, screenshot the final attribute list — you should see 9 attributes total (4 originals + 5 UTMs).

### Phase 3 — Final report

Show me the completed checklist and the two screenshots:

1. Cloudflare Variables and Secrets on Production (post-deletion — no `ZAPIER_WEBHOOK_URL` row).
2. Brevo Contact attributes page showing all 9 attributes.

Then I'll start the second session with `SHEETS-SETUP-PROMPT.md` to actually wire up the Google Sheet destination.

### Rules
- No secrets involved this session — all values are public attribute names or env var keys.
- If a 2FA / unexpected UI prompt appears, pause for me.
- If a dashboard's UI doesn't match this playbook, describe what you see and ask before clicking.
- **Critical**: do NOT delete or modify any env var other than `ZAPIER_WEBHOOK_URL`, and do NOT modify any existing Brevo attribute. The four existing Brevo attributes (PHONE, ROLE, MESSAGE, LAST_SUBMITTED_AT) and the 8 non-Zapier env vars are load-bearing.

Ready? Confirm: (a) signed into both Cloudflare and Brevo, (b) noted the pre-approved domains, (c) understand the "don't touch anything else" rule. Then start Phase 1.
