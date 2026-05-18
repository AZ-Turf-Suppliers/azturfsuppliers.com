// Cloudflare Pages Function — /api/contact
//
// Receives a submission from the website contact form, then:
//   1. Rejects honeypot-filled and Turnstile-failed requests as spam.
//   2. Upserts the submitter into Brevo as a contact (with their info on
//      the contact record so it's browsable / searchable / exportable from
//      the Brevo dashboard). If they opt in, adds them to BREVO_LIST_ID.
//   3. Appends a row to a Google Sheet (via Apps Script web app) so every
//      submission is preserved in real time as an append-only archive
//      with the full untruncated message. Optional — skipped silently
//      if SHEETS_WEBHOOK_URL isn't set.
//   4. Sends a transactional notification email with the full message to
//      BREVO_NOTIFY_EMAIL, with reply-to set to the submitter so hitting
//      reply in your inbox messages them directly.
//
// Required env vars (Cloudflare Pages → Settings → Variables and Secrets):
//   BREVO_API_KEY          — Brevo v3 API key. Secret.
//   BREVO_NOTIFY_EMAIL     — Where notification emails go (e.g. contact@…).
//   BREVO_SENDER_EMAIL     — A verified sender in Brevo (e.g. noreply@…).
//   TURNSTILE_SECRET_KEY   — Cloudflare Turnstile widget secret. Secret.
//
// Optional env vars:
//   BREVO_SENDER_NAME      — Display name on the notification email. Defaults
//                            to "AZ Turf Suppliers Website".
//   BREVO_LIST_ID          — Numeric Brevo list ID. When set, contacts who
//                            tick the opt-in checkbox join this list.
//   SHEETS_WEBHOOK_URL     — Google Apps Script web app URL. When set, every
//                            submission appends a row to the bound Sheet.
//   SHEETS_WEBHOOK_SECRET  — Shared secret sent in the body; the Apps Script
//                            rejects mismatches. Secret. Required when
//                            SHEETS_WEBHOOK_URL is set.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function appendToSheet(env, payload) {
  if (!env.SHEETS_WEBHOOK_URL) return;
  if (!env.SHEETS_WEBHOOK_SECRET) {
    console.error('SHEETS_WEBHOOK_URL set but SHEETS_WEBHOOK_SECRET missing — skipping sheet append.');
    return;
  }
  try {
    const resp = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Apps Script web apps respond via a 302 to script.googleusercontent.com;
      // letting fetch follow the redirect surfaces the JSON {ok:...} response.
      redirect: 'follow',
      body: JSON.stringify({ ...payload, secret: env.SHEETS_WEBHOOK_SECRET }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('Sheets append non-OK:', resp.status, body);
    }
  } catch (e) {
    console.error('Sheets append threw:', e);
  }
}

async function verifyTurnstile(secret, token, ip) {
  if (!secret) return true; // env not configured → skip (caller decides whether to allow)
  if (!token) return false;
  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);
  try {
    const resp = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: params },
    );
    const data = await resp.json().catch(() => ({}));
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // ─── 1. Parse body (accept both form-encoded and JSON) ─────────────
  let form;
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      form = await request.json();
    } else {
      const fd = await request.formData();
      form = Object.fromEntries(fd.entries());
    }
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid request body.' });
  }

  // ─── 2. Honeypot — bots fill this hidden field; humans never see it
  // Respond 200 OK so the bot thinks it succeeded and doesn't retry.
  if (form.website && String(form.website).trim().length > 0) {
    return jsonResponse(200, { ok: true });
  }

  // ─── 3. Normalise & validate ───────────────────────────────────────
  const firstName = String(form.firstName || '').trim().slice(0, 80);
  const lastName  = String(form.lastName  || '').trim().slice(0, 80);
  const email     = String(form.email     || '').trim().toLowerCase().slice(0, 200);
  const phone     = String(form.phone     || '').trim().slice(0, 30);
  const role      = String(form.role      || '').trim().slice(0, 80);
  const message   = String(form.message   || '').trim().slice(0, 5000);
  const optIn     = form.optIn === 'on' || form.optIn === true || form.optIn === 'true';

  // Attribution (first-touch UTMs, captured client-side in Layout.astro).
  // Empty when the visitor arrived without UTM/gclid params.
  const utmcsr   = String(form.utmcsr   || '').trim().slice(0, 200);
  const utmcmd   = String(form.utmcmd   || '').trim().slice(0, 200);
  const utmccn   = String(form.utmccn   || '').trim().slice(0, 200);
  const utmctr   = String(form.utmctr   || '').trim().slice(0, 200);
  const utmgclid = String(form.utmgclid || '').trim().slice(0, 500);
  const hasAttribution = !!(utmcsr || utmcmd || utmccn || utmctr || utmgclid);

  if (!firstName) {
    return jsonResponse(400, { ok: false, error: 'First name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(400, { ok: false, error: 'A valid email is required.' });
  }

  // ─── 4. Verify Turnstile (only if configured) ──────────────────────
  if (env.TURNSTILE_SECRET_KEY) {
    const token = form['cf-turnstile-response'] || form.turnstileToken;
    const ip = request.headers.get('cf-connecting-ip') || '';
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip);
    if (!ok) {
      return jsonResponse(400, { ok: false, error: 'Spam check failed. Please reload the page and try again.' });
    }
  }

  // ─── 5. Validate Brevo configuration ───────────────────────────────
  const apiKey       = env.BREVO_API_KEY;
  const notifyEmail  = env.BREVO_NOTIFY_EMAIL;
  const senderEmail  = env.BREVO_SENDER_EMAIL;
  const senderName   = env.BREVO_SENDER_NAME || 'AZ Turf Suppliers Website';
  if (!apiKey || !notifyEmail || !senderEmail) {
    console.error('Brevo env vars missing: BREVO_API_KEY / BREVO_NOTIFY_EMAIL / BREVO_SENDER_EMAIL');
    return jsonResponse(500, { ok: false, error: 'Email integration is not configured yet.' });
  }
  const listId = env.BREVO_LIST_ID && optIn ? Number(env.BREVO_LIST_ID) : null;

  // ─── 6. Upsert the Brevo contact ───────────────────────────────────
  // Brevo TEXT attributes are capped at 255 chars; the full message goes
  // in the notification email, with a snippet on the contact for browsing.
  const snippet = message.length > 240 ? message.slice(0, 237) + '…' : message;
  const contactBody = {
    email,
    updateEnabled: true,
    attributes: {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      PHONE: phone,
      ROLE: role,
      MESSAGE: snippet,
      LAST_SUBMITTED_AT: new Date().toISOString(),
      // Attribution attributes — only set when values are present, so contacts
      // who arrived organically don't get blank UTMs written over a prior
      // value. Create UTMCSR/UTMCMD/UTMCCN/UTMCTR/UTMGCLID as Text attributes
      // in Brevo (Contacts → Settings → Contact attributes) for these to land
      // on the contact record; until then Brevo silently ignores them.
      ...(utmcsr   && { UTMCSR:   utmcsr   }),
      ...(utmcmd   && { UTMCMD:   utmcmd   }),
      ...(utmccn   && { UTMCCN:   utmccn   }),
      ...(utmctr   && { UTMCTR:   utmctr   }),
      ...(utmgclid && { UTMGCLID: utmgclid }),
    },
  };
  if (listId) contactBody.listIds = [listId];

  try {
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(contactBody),
    });
    // 201 = created, 204 = updated. 4xx is logged but doesn't block the
    // notification email (the email is the more important half).
    if (!resp.ok && resp.status !== 204) {
      const body = await resp.text().catch(() => '');
      console.error('Brevo contact upsert non-OK:', resp.status, body);
    }
  } catch (e) {
    console.error('Brevo contact upsert threw:', e);
  }

  // ─── 7. Append a row to the Google Sheet archive (optional) ────────
  // Non-blocking: errors are logged, but never fail the form.
  const submittedAt = new Date().toISOString();
  await appendToSheet(env, {
    submittedAt,
    firstName,
    lastName,
    email,
    phone,
    role,
    optIn,
    message,
    utmcsr,
    utmcmd,
    utmccn,
    utmctr,
    utmgclid,
  });

  // ─── 8. Send the notification email ────────────────────────────────
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const subject  = `New website lead — ${fullName || email}`;

  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Phoenix',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const htmlContent = `
<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="color:#1a7f1f;margin:0 0 4px;">New Contact Form Submission</h2>
  <p style="color:#666;font-size:13px;margin:0 0 20px;">azturfsuppliers.com · ${escapeHtml(now)} (Phoenix)</p>
  <table style="width:100%;border-collapse:collapse;font-size:15px;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:130px;">Name</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(fullName) || '<em>(not provided)</em>'}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Email</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="mailto:${escapeHtml(email)}" style="color:#1a7f1f;">${escapeHtml(email)}</a></td></tr>
    ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="tel:${escapeHtml(phone)}" style="color:#1a7f1f;">${escapeHtml(phone)}</a></td></tr>` : ''}
    ${role ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Role</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(role)}</td></tr>` : ''}
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Newsletter</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${optIn ? 'Opted in' : 'No'}</td></tr>
  </table>
  ${message ? `<h3 style="margin:24px 0 8px;color:#1a1a1a;font-size:15px;">Message</h3>
    <div style="background:#f5f5f5;padding:16px 18px;border-radius:8px;white-space:pre-wrap;font-size:14.5px;line-height:1.55;">${escapeHtml(message)}</div>` : ''}
  ${hasAttribution ? `<h3 style="margin:24px 0 8px;color:#1a1a1a;font-size:15px;">Attribution</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14.5px;">
      ${utmcsr   ? `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;width:130px;">Source</td>   <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(utmcsr)}</td></tr>`   : ''}
      ${utmcmd   ? `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;">Medium</td>             <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(utmcmd)}</td></tr>`   : ''}
      ${utmccn   ? `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;">Campaign</td>           <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(utmccn)}</td></tr>`   : ''}
      ${utmctr   ? `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;">Keyword</td>            <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(utmctr)}</td></tr>`   : ''}
      ${utmgclid ? `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;">GCLID</td>              <td style="padding:6px 0;border-bottom:1px solid #eee;font-family:monospace;font-size:12px;word-break:break-all;">${escapeHtml(utmgclid)}</td></tr>` : ''}
    </table>` : ''}
  <p style="margin-top:28px;font-size:12.5px;color:#999;">Hit reply to message ${escapeHtml(firstName) || 'the submitter'} directly — reply-to is set to their email.</p>
</body></html>
  `.trim();

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender:  { email: senderEmail, name: senderName },
        to:      [{ email: notifyEmail }],
        replyTo: { email, name: fullName || email },
        subject,
        htmlContent,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('Brevo email send failed:', resp.status, body);
      return jsonResponse(502, { ok: false, error: 'Could not send the message. Please call us at 480-793-1800.' });
    }
  } catch (e) {
    console.error('Brevo email send threw:', e);
    return jsonResponse(502, { ok: false, error: 'Could not send the message. Please call us at 480-793-1800.' });
  }

  return jsonResponse(200, { ok: true });
}
