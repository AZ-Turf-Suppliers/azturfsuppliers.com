# Google Sheet Archive — Optional Form-Submission Mirror

> **What this gets you**: every contact-form submission appears as a new
> row in a Google Sheet, with the full untruncated message preserved.
> Acts as a permanent append-only archive that complements (does not
> replace) the Brevo contact list.
>
> **Why both?** Brevo's contact record is keyed by email — repeat
> submissions from the same person overwrite the previous `MESSAGE`
> snippet (and truncate at 240 chars). The sheet preserves every
> submission as its own row with the full message.
>
> **Optional**: leave `SHEETS_WEBHOOK_URL` unset and the function skips
> the sheet append silently. Nothing else changes.

The integration is a Google Apps Script web app bound to the sheet —
**no Google Cloud project, no service account, no API key**. Free,
generous quotas, ~10 minutes of setup.

---

## 1. Create the sheet

Go to https://sheets.new and create a fresh sheet. Name it something
like **AZ Turf — Website Leads** and decide which Google account owns
it (probably the client's, not the developer's — so they can browse it
without involving anyone else).

Optionally pre-populate row 1 with header labels (the Apps Script will
auto-add them on the first append if the sheet is empty, so this step
is just cosmetic):

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Submitted (Phoenix) | First Name | Last Name | Email | Phone | Role | Newsletter | Message |

You can rename / reorder headers later — the Apps Script writes columns
in this order regardless of what's in row 1.

## 2. Open Apps Script

In the sheet: **Extensions → Apps Script**. A new tab opens with an
empty `Code.gs` file. Delete whatever's in there and paste this:

```javascript
// AZ Turf Suppliers — website contact form → sheet appender.
// Receives JSON from the Cloudflare Pages Function at /api/contact.

const HEADERS = [
  'Submitted (Phoenix)',
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Role',
  'Newsletter',
  'Message',
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
  ]);

  return json({ ok: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Save (Ctrl/Cmd+S). Project name: `AZ Turf Contact Form`.

## 3. Set the shared secret as a script property

The web app will be deployed as "Anyone (even anonymous)" — meaning the
URL is technically callable by anyone who learns it. A shared secret
in the request body prevents random callers from polluting the sheet.

In the Apps Script editor: **gear icon (Project Settings)** in the left
sidebar → scroll to **Script properties** → **Add script property**.

| Property | Value |
| --- | --- |
| `SHARED_SECRET` | A long random string. Generate at https://1password.com/password-generator/ — 32+ characters, mixed case + numbers + symbols. Save it; you'll paste it into Cloudflare in step 5. |

Click **Save script properties**.

## 4. Deploy as a web app

**Top right → Deploy → New deployment**

| Field | Value |
| --- | --- |
| **Select type** (gear icon) | **Web app** |
| **Description** | `AZ Turf contact form appender` |
| **Execute as** | **Me** (`<the account that owns the sheet>`) |
| **Who has access** | **Anyone** |

Click **Deploy**.

Google will prompt for authorization the first time — click **Authorize
access**, pick the sheet-owning account, click **Advanced → Go to AZ
Turf Contact Form (unsafe)** (the "unsafe" warning is because the
script is unverified — that's normal for personal scripts), and click
**Allow**.

After deploy, Google shows a **Web app URL** like:

```
https://script.google.com/macros/s/AKfycb…long-string…/exec
```

Copy that URL. You'll paste it into Cloudflare in step 5.

> **If you ever edit the script**, you must **Deploy → Manage
> deployments → pencil icon → Version: New version → Deploy** to push
> the changes to the live URL. The URL stays the same across versions.

## 5. Add the two env vars in Cloudflare Pages

Cloudflare dashboard → **Workers & Pages** → `azturfsuppliers-com` →
**Settings** → **Variables and Secrets**.

Set both on **Production** AND **Preview** (4 entries total):

| Variable name | Value | Type |
| --- | --- | --- |
| `SHEETS_WEBHOOK_URL` | The `https://script.google.com/macros/s/…/exec` URL from step 4. | Plaintext |
| `SHEETS_WEBHOOK_SECRET` | The same long random string you set as `SHARED_SECRET` in step 3. | **Secret (encrypted)** |

Save. Cloudflare redeploys. The function picks up the new env vars on
the next request — no rebuild needed (these are server-side only).

## 6. Smoke test

Submit a test entry on https://www.azturfsuppliers.com/contact (or the
preview URL). Within ~1 second of clicking Send, a new row should
appear at the bottom of the sheet.

If nothing appears:

- **Open Cloudflare → Workers & Pages → `azturfsuppliers-com` →
  Functions → Real-time logs** and resubmit. Look for any
  `Sheets append non-OK:` or `Sheets append threw:` line. The status
  code and body will tell you what failed.
- **401 / "Unauthorized"** → `SHEETS_WEBHOOK_SECRET` in Cloudflare
  doesn't match `SHARED_SECRET` in Apps Script. Regenerate or copy more
  carefully.
- **302 → some non-Sheets URL** → web app's "Who has access" wasn't set
  to **Anyone**. Redeploy with the correct setting.
- **Row appears but columns are misaligned** → header row in row 1 is
  in a different order than the script. Either reorder your row 1 to
  match `HEADERS` in the script, or edit `HEADERS` in the script and
  redeploy.

## Files involved

```
functions/api/contact.js   ← reads SHEETS_WEBHOOK_URL/SECRET, POSTs to script
SHEETS-SETUP.md            ← this file
```

The Apps Script itself lives in Google's cloud, bound to the sheet —
not in the repo. To version it, copy-paste the script body into a file
in the repo if desired (Apps Script also supports `clasp` for git-based
sync, but that's overkill for a 50-line script).

## Cost & limits

Free. Apps Script web apps on a personal Google account have a quota of
**~20,000 URL fetch calls per day** and unlimited triggers — orders of
magnitude more than this site will ever see.

## Disabling later

Remove `SHEETS_WEBHOOK_URL` from Cloudflare Pages env (both
environments). The function will silently stop appending; everything
else keeps working.
