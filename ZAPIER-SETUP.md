# Zapier Webhook — Optional Form-Submission Fan-out

> **What this gets you**: every contact-form submission is also POSTed
> to a Zapier "Catch Hook" trigger as JSON. You can then build a Zap
> with any combination of Zapier's 6000+ Action steps — append to a
> Google Sheet, post to Slack, create a HubSpot contact, send to
> Mailchimp, etc.
>
> **Optional**: leave `ZAPIER_WEBHOOK_URL` unset and the function skips
> the Zapier POST silently. Nothing else changes.
>
> **Stacks cleanly with everything else**: this runs in parallel with
> the Google Sheets Apps Script destination. Both can be on at the
> same time, neither blocks the form response, and Brevo + email keep
> working regardless.

---

## 1. Create the Zap

Sign into https://zapier.com and click **+ Create Zap**.

### Trigger

| Field | Value |
| --- | --- |
| **App** | **Webhooks by Zapier** *(this is a free built-in app — no paid plan needed for the webhook trigger itself)* |
| **Trigger event** | **Catch Hook** |

Click **Continue** through the "Pick off a child key" step (leave blank).
Zapier generates a unique URL like:

```
https://hooks.zapier.com/hooks/catch/123456/abcd1234/
```

Copy this URL. You'll paste it into Cloudflare in step 3.

> **This URL is the only secret protecting your Zap.** Don't post it
> publicly. Anyone who knows the URL can fire your Zap and consume
> tasks from your Zapier quota. If you ever leak it, Zapier lets you
> rotate the URL from the trigger settings.

### Test the trigger

Zapier wants a sample payload to map fields against. Two options:

- **Easiest**: skip the test for now. Save the Zap as-is, add the
  webhook URL to Cloudflare (step 3), submit the live form once, then
  come back to Zapier and click **Test trigger** — your test submission
  will appear with all fields populated and ready to map.
- **Alternative**: use `curl` from any terminal to send a fake sample:
  ```sh
  curl -X POST <your-zapier-webhook-url> \
    -H "Content-Type: application/json" \
    -d '{"submittedAt":"2026-05-15T20:47:34Z","firstName":"Sample","lastName":"Lead","email":"test@example.com","phone":"480-555-0100","role":"Homeowner","optIn":true,"message":"Sample submission for Zap mapping.","utmcsr":"google","utmcmd":"cpc","utmccn":"spring","utmctr":"","utmgclid":""}'
  ```

### Payload fields available in Zapier

The Cloudflare Function sends this JSON shape on every submission:

| Field | Type | Notes |
| --- | --- | --- |
| `submittedAt` | string (ISO 8601 UTC) | e.g. `2026-05-15T20:47:34.037Z` |
| `firstName` | string | |
| `lastName` | string | May be empty (the form only requires first name) |
| `email` | string | Required |
| `phone` | string | May be empty |
| `role` | string | "Homeowner", "Contractor / Landscaper", "Pool Builder", "Other", or empty |
| `optIn` | boolean | `true` if the newsletter checkbox was ticked |
| `message` | string | Full message, untruncated (up to 5000 chars) |
| `utmcsr` | string | First-touch source. Empty on organic traffic. |
| `utmcmd` | string | First-touch medium |
| `utmccn` | string | First-touch campaign |
| `utmctr` | string | First-touch term/keyword |
| `utmgclid` | string | First-touch Google Ads click ID |

## 2. Add the Action(s)

Anything you want. Common patterns:

- **Google Sheets → Create Spreadsheet Row** — Zapier-managed
  alternative to the Apps Script setup in `SHEETS-SETUP.md`. Easier
  for non-devs to maintain (drag-drop columns). Counts as one task
  per submission.
- **Slack → Send Channel Message** — instant notification in a team
  channel. Useful for "all hands" lead alerts. One task per submission.
- **Mailchimp / HubSpot / ActiveCampaign → Create or Update Contact**
  — overlap with Brevo, but useful if you're migrating off Brevo or
  running parallel CRMs.
- **Filter by Zapier** — only continue downstream if e.g. `role` =
  "Contractor / Landscaper". Saves task quota for high-value leads.
- **Paths by Zapier** (paid) — branch based on `utmcsr` or other
  fields. E.g. Google Ads leads go to Slack; organic leads go to a
  spreadsheet only.

Each Action step you add consumes one task per submission. Watch the
math against your Zapier plan's task quota.

## 3. Add the env var in Cloudflare Pages

Cloudflare → **Workers & Pages → `azturfsuppliers-com` → Settings →
Variables and Secrets**.

Set on **Production** AND **Preview**:

| Variable | Value | Type |
| --- | --- | --- |
| `ZAPIER_WEBHOOK_URL` | The `https://hooks.zapier.com/hooks/catch/.../.../` URL from step 1. | Plaintext |

That's it — just one variable. No secret to manage. Cloudflare picks it
up on the next request; no rebuild required.

> No `ZAPIER_WEBHOOK_SECRET` is needed: the webhook URL itself is the
> shared secret (security by obscurity). If you want belt-and-suspenders
> authentication, add a **Filter by Zapier** step at the top of your
> Zap that only proceeds if e.g. `email` is non-empty, or add a custom
> token field by extending the Function payload.

## 4. Turn the Zap on

In Zapier, click **Publish** (top right). The Zap moves from Draft
to On.

## 5. Smoke test

1. Submit a test entry on https://www.azturfsuppliers.com/contact.
2. Within ~5 seconds, go to Zapier → your Zap → **Zap History** (left
   sidebar). The submission should appear as a successful run.
3. Click into it to see the full payload Zapier received and which
   Actions ran with what data.

## Failure-mode quick reference

- **Zap History shows the run but with `data: {}` or missing fields**
  → Zapier's "Catch Hook" trigger sometimes caches its sample. Click
  **Test trigger** in the Zap editor, then re-publish.
- **Nothing in Zap History** → Cloudflare → Workers & Pages →
  `azturfsuppliers-com` → Functions → Real-time logs. Look for
  `Zapier webhook non-OK:` or `Zapier webhook threw:`. If you see
  `403` or `410`, the Zap may be off — re-publish in Zapier.
- **Tasks running out** → free plan = 100 tasks/month. Check Zapier →
  Settings → Usage. Each Action step on each run counts as one task.

## Cost notes

- Zapier free tier: **100 tasks/month**, single-step Zaps only.
  Multi-step Zaps (e.g. Catch Hook + Filter + Slack) require the
  Starter plan (~$20/month at 2026 pricing).
- Webhooks by Zapier (the trigger we use) is in the free tier.
- At AZ Turf's expected lead volume (~5-50/month), free tier is
  sufficient if your Zap is single-step.

## Disabling later

Remove `ZAPIER_WEBHOOK_URL` from Cloudflare Pages env (both
environments). The Function will silently stop POSTing; everything
else keeps working.

## When to choose Zapier over Apps Script Sheets

Both can be on at once — no need to pick. But if you're choosing one
or the other for the Sheets-only use case, see the comparison in
`SHEETS-SETUP.md`. Short version: Apps Script for free-forever +
self-hosted; Zapier for easier non-developer editing + fan-out to
other tools.
