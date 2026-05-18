# Claude for Chrome — Google Sheets Archive Setup Prompt

> Paste everything between the rules below as your first message to the
> Claude Chrome extension. The agent will walk through creating the
> sheet, deploying the Apps Script, and wiring the two Cloudflare env
> vars. Mirrors the same handoff pattern as the Brevo setup.
>
> Companion reference doc: [`SHEETS-SETUP.md`](./SHEETS-SETUP.md).

---

I need you to wire up a Google Sheet archive for the AZ Turf Suppliers contact form. The Cloudflare Pages Function and reference doc are already deployed on `main` — read https://github.com/AZ-Turf-Suppliers/azturfsuppliers.com/blob/main/SHEETS-SETUP.md first if you can; the playbook below is distilled from it 1:1.

**Context:**
- The live site at https://www.azturfsuppliers.com has a contact form that POSTs to `/api/contact`, a Cloudflare Pages Function. It already writes submissions to Brevo (CRM) and sends an email notification to `contact@azturfsuppliers.com`. We're adding a Google Sheet as a third destination — append-only, preserves full message history forever (Brevo's contact attribute truncates at 240 chars and overwrites on repeat submissions; the sheet does neither).
- The function code already reads optional env vars `SHEETS_WEBHOOK_URL` and `SHEETS_WEBHOOK_SECRET`. If both are set, every submission appends a row to the bound sheet via a Google Apps Script web app. If either is missing, the sheet write is skipped silently. So this setup turns it on; it cannot break the existing form.

**Before you start, confirm with me:**
1. **Which Google account should own the sheet?** Recommended: the client's `azturfsuppliers@gmail.com` so they can browse the sheet themselves without involving anyone else. Tell me which I'm signed into in Chrome.
2. I'm signed into https://dash.cloudflare.com (likely still good from the Brevo session).
3. Pre-approve these domains for tab access in this session: `sheets.google.com`, `docs.google.com`, `drive.google.com`, `script.google.com`, `accounts.google.com`, `1password.com` (only if you use option A for secret generation in Phase 3). Cloudflare and GitHub are already approved.

Maintain this running table and show it after each phase:

| Item | Status |
|---|---|
| Sheet URL | pending |
| Apps Script web app URL | pending |
| `SHEETS_WEBHOOK_SECRET` | pending (Secret — do not echo) |
| Cloudflare Production env vars (2) | pending |
| Cloudflare Preview env vars (2) | pending |

### Phase 1 — Create the sheet

1. Open https://sheets.new in a new tab (Google creates a fresh untitled sheet on the signed-in account).
2. Rename: top-left "Untitled spreadsheet" → click → type **AZ Turf — Website Leads**.
3. *(Optional)* In row 1, type these column headers across A1–M1 in order:
   `Submitted (Phoenix)`, `First Name`, `Last Name`, `Email`, `Phone`, `Role`, `Newsletter`, `Message`, `Source`, `Medium`, `Campaign`, `Keyword`, `GCLID`. If you skip, the Apps Script auto-creates them on the first append. Both work. The last 5 columns are first-touch attribution from ad URLs (empty on organic traffic).
4. Capture the sheet URL (`docs.google.com/spreadsheets/d/<ID>/edit`) into the table.

### Phase 2 — Paste the Apps Script

1. From the sheet's menu: **Extensions → Apps Script**. A new tab opens with `Code.gs` containing an empty `myFunction()`.
2. Select all in the editor (Cmd/Ctrl+A) and delete. Paste this verbatim:

```javascript
const HEADERS = [
  'Submitted (Phoenix)',
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Role',
  'Newsletter',
  'Message',
  'Source',
  'Medium',
  'Campaign',
  'Keyword',
  'GCLID',
];

function doPost(e) {
  const expected = PropertiesService.getScriptProperties()
    .getProperty('SHARED_SECRET');
  if (!expected) {
    return json({ ok: false, error: 'SHARED_SECRET not configured' });
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'Invalid JSON' });
  }

  if (body.secret !== expected) {
    return json({ ok: false, error: 'Unauthorized' });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

  const phoenixTime = body.submittedAt
    ? Utilities.formatDate(
        new Date(body.submittedAt),
        'America/Phoenix',
        'yyyy-MM-dd HH:mm:ss',
      )
    : '';

  sheet.appendRow([
    phoenixTime,
    body.firstName || '',
    body.lastName || '',
    body.email || '',
    body.phone || '',
    body.role || '',
    body.optIn ? 'Yes' : 'No',
    body.message || '',
    body.utmcsr || '',
    body.utmcmd || '',
    body.utmccn || '',
    body.utmctr || '',
    body.utmgclid || '',
  ]);

  return json({ ok: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Rename the project: top-left "Untitled project" → click → type **AZ Turf Contact Form**.
4. Save (Cmd/Ctrl+S or the disk icon). Wait for the spinner to clear.

### Phase 3 — Generate and store the shared secret

1. Click the **gear icon (Project Settings)** in the left sidebar of the Apps Script editor.
2. Scroll to **Script properties** → click **Edit script properties** → **Add script property**.
3. Generate a strong random secret (32+ characters, mixed case + numbers + symbols). Either:
   - Open https://1password.com/password-generator/ in a new tab → length 40 → Random Password → Copy.
   - Or use any secure password generator you trust.
4. Property name: `SHARED_SECRET`. Paste the value.
5. **PAUSE — secret handoff before saving.** The secret is visible on screen. Don't echo it in chat. Tell me to switch to the Apps Script tab and copy the value directly from the Value field into my password manager. I'll reply "stored" once it's safe. Then click **Save script properties**.

### Phase 4 — Deploy as a web app

1. Top-right of the Apps Script editor: **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Description:** `AZ Turf contact form appender`
   - **Execute as:** **Me** (the sheet-owning account; should be pre-selected)
   - **Who has access:** **Anyone** ← critical. If this says "Anyone with Google account" or "Only myself", the Cloudflare Function will not be able to reach it.
4. Click **Deploy**.
5. Google will prompt for authorization:
   - Click **Authorize access**.
   - Pick the sheet-owning Google account.
   - Google shows a yellow warning: **"Google hasn't verified this app"** — this is normal for personal scripts.
   - **PAUSE** and tell me you're at the "unverified app" warning before proceeding. Wait for my "go." Then click **Advanced** → **Go to AZ Turf Contact Form (unsafe)** → **Allow**.
6. After deployment, Google shows a confirmation with a **Web app URL** like:
   `https://script.google.com/macros/s/AKfycb…long-string…/exec`
   Capture this into the table. This URL is fine to show in chat — it's secret-protected by `SHARED_SECRET`, so the URL alone can't write to the sheet.
7. Close the deployment modal but keep the Apps Script tab open.

### Phase 5 — Add Cloudflare env vars

Navigate to Cloudflare → **Workers & Pages** → `azturfsuppliers-com` → **Settings** → **Variables and Secrets**.

For **Production**, add both:

1. `SHEETS_WEBHOOK_URL` (Plaintext) = the web app URL from Phase 4 step 6.
2. `SHEETS_WEBHOOK_SECRET` (Secret) — open the Add form, fill Name + Type, leave value blank. **PAUSE.** I'll switch to the Cloudflare tab, paste from my password manager, click Save, and reply "saved."

Then **switch the "Choose Environment" dropdown to Preview** (screenshot the dropdown showing Preview selected before continuing — same pattern as the Brevo session) and repeat both variables.

After all 4 entries are saved, show me this summary table (no values for the secret):

| Variable | Environment | Type |
|---|---|---|
| `SHEETS_WEBHOOK_URL` | Production | Plaintext |
| `SHEETS_WEBHOOK_SECRET` | Production | Secret |
| `SHEETS_WEBHOOK_URL` | Preview | Plaintext |
| `SHEETS_WEBHOOK_SECRET` | Preview | Secret |

Cloudflare picks up server-side env vars on the next request — no rebuild required.

### Phase 6 — Smoke test

1. Open https://www.azturfsuppliers.com/contact in an incognito tab.
2. Submit a test entry:
   - First name: `Sheet`
   - Last name: `Test`
   - Email: ask me for a personal email I can check
   - Phone: `555-0101`
   - Role: `Other`
   - Message: `SHEET SMOKE TEST — verifying Google Sheets archive integration. Safe to delete this row + the Brevo contact afterward.`
   - Tick the newsletter checkbox
3. Submit → should redirect to `/thank-you`.
4. Within ~5 seconds, switch to the Google Sheet tab and **refresh** (Cmd/Ctrl+R). A new row should appear at the bottom (or row 2 if it's the first append and headers were auto-added).

Verify all of:
- ✅ Row appears in the sheet
- ✅ Submitted (Phoenix) shows ~current local time in `yyyy-MM-dd HH:mm:ss` format
- ✅ All 8 columns populated (first name, last name, email, phone, role, newsletter=`Yes`, message)
- ✅ Message column has the **full** message text, not truncated
- ✅ The existing Brevo flow is unaffected — a notification email also arrives at `contact@azturfsuppliers.com` and a contact appears in Brevo

Screenshot the sheet row and the Brevo contact for proof.

### Phase 7 — Share the Sheet with the analytics consultant

The analyst pulls leads from this Sheet on his own schedule (likely monthly via a Zapier "Schedule + Get many rows" Zap on his side). He needs read access.

1. In the Google Sheet tab, top-right → **Share**.
2. **Add people and groups** → paste the analyst's email address (ask me for it if I haven't provided it).
3. Permission: **Viewer** (read-only — he doesn't need to edit; this prevents accidental changes to the schema).
4. Untick **Notify people** if you don't want to send him an email (he probably already knows it's coming).
5. Click **Share / Send**.
6. Confirm the Sheet's general sharing setting is **"Restricted"** (only invited people) — not "Anyone with the link." We don't want public lead data.

After sharing, send me a one-liner I can forward to the analyst, e.g.: "Shared the leads sheet with you (view-only). Submissions write in real time; pull on whatever cadence works for you. Schema is in row 1 — 13 columns including 5 UTM attribution fields."

### Failure-mode quick reference

- **Row doesn't appear in sheet** → Cloudflare → Workers & Pages → `azturfsuppliers-com` → **Functions → Real-time logs**. Resubmit the form. Look for `Sheets append non-OK:` or `Sheets append threw:` lines. The status code + body tell us what failed.
- **`401 / Unauthorized` body** → `SHEETS_WEBHOOK_SECRET` in Cloudflare ≠ `SHARED_SECRET` in Apps Script. Re-check both for whitespace / mistyped characters.
- **`302` redirect to a non-Sheets URL** → web app "Who has access" wasn't set to **Anyone** in Phase 4. Redeploy: **Deploy → Manage deployments → pencil icon → Version: New version → fix Who has access → Deploy**. The URL stays the same.
- **Row appears but columns are misaligned** → row 1 of the sheet is in a different order than the script's `HEADERS` array. Either reorder row 1 or edit the script.
- **`SHARED_SECRET not configured`** → the Script property didn't save in Phase 3. Re-add it.

### Rules
- Don't echo `SHEETS_WEBHOOK_SECRET` or `SHARED_SECRET` (same value) back to chat after Phase 3. Use the copy-from-source-tab handoff pattern.
- Don't proceed past Phase 3 step 5 until I reply "stored."
- Don't click through the "Google hasn't verified this app" warning in Phase 4 step 5 without confirming with me first.
- If you see a 2FA prompt anywhere, pause for me.
- If anything in the Google or Cloudflare UI doesn't match this playbook (they reshuffle dashboards occasionally), describe what you see and ask before clicking.

Ready? Confirm: (a) which Google account is active, (b) Cloudflare is signed in, (c) you've noted the pre-approved domain list. Then start Phase 1.
