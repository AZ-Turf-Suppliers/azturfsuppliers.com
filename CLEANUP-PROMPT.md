# Claude for Chrome — Zapier Env Var Removal Prompt

> Run this FIRST, before `SHEETS-SETUP-PROMPT.md`.
>
> One quick dashboard task (~2 minutes): remove the orphaned
> `ZAPIER_WEBHOOK_URL` placeholder env var from Cloudflare on both
> environments. The site has moved on from the Zapier-as-fan-out
> approach in favor of writing leads directly to a Google Sheet.
>
> Optional shortcut: if you'd rather not bother with the Chrome agent
> for a 2-minute task, just delete the env var yourself in the
> Cloudflare dashboard and skip this prompt entirely.

---

I need you to remove an orphaned env var from Cloudflare Pages before we set up the Google Sheets lead archive. ~2 minutes.

**Context:** We previously added `ZAPIER_WEBHOOK_URL` to Cloudflare as a placeholder while waiting on the analytics consultant to send a real Zapier webhook URL. We've since decided to skip the Zapier-as-fan-out path entirely and write submissions directly to a Google Sheet (which the analyst will pull from on his own schedule). The orphaned env var is currently causing every form submission to produce a `Zapier webhook non-OK: 404` line in Cloudflare Functions logs. Removing it ends the log noise and cleans up the project.

**Before you start, confirm:**

1. I'm signed into https://dash.cloudflare.com.
2. Pre-approve `dash.cloudflare.com` for tab access (likely already approved from prior sessions).

### Phase 1 — Remove `ZAPIER_WEBHOOK_URL` on both environments

Navigate to Cloudflare → **Workers & Pages → `azturfsuppliers-com` → Settings → Variables and Secrets**.

For **Production**:

1. Find `ZAPIER_WEBHOOK_URL` in the variables list (its value is the placeholder `https://hooks.zapier.com/hooks/catch/0/REPLACE-ME-WITH-REAL-URL/`).
2. Click the row → three-dot menu → **Delete** / **Remove**.
3. Confirm the deletion.

Switch the "Choose Environment" dropdown to **Preview** (screenshot the dropdown showing Preview selected first) and repeat: find `ZAPIER_WEBHOOK_URL`, delete it.

**Do not touch any other env var.** After cleanup, both environments should still have these 8 variables:

- `BREVO_API_KEY` (Secret)
- `BREVO_LIST_ID`
- `BREVO_NOTIFY_EMAIL`
- `BREVO_SENDER_EMAIL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET` (Secret)
- `PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` (Secret)

(Plus optionally `BREVO_SENDER_NAME` if it was set previously.)

### Phase 2 — Report

Screenshot the final variables list on **both** Production and Preview, post-deletion. Confirm `ZAPIER_WEBHOOK_URL` is gone from both, and the 8 other variables are untouched.

Then I'll start the second session with `SHEETS-SETUP-PROMPT.md` to wire up the Google Sheet destination.

### Rules
- No secrets involved this session — you can echo any non-secret value freely.
- **Critical**: do NOT delete or modify any env var other than `ZAPIER_WEBHOOK_URL`. The 8 others are load-bearing.
- If a 2FA / unexpected UI prompt appears, pause for me.

Ready? Confirm: (a) signed into Cloudflare, (b) understand the "don't touch anything else" rule. Then start Phase 1.
