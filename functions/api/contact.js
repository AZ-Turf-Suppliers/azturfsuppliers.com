// Cloudflare Pages Function — /api/contact
//
// Receives a submission from the website contact form, then:
//   1. Rejects honeypot-filled and Turnstile-failed requests as spam.
//   2. Upserts the submitter into Brevo as a contact (with their info on
//      the contact record so it's browsable / searchable / exportable from
//      the Brevo dashboard). If they opt in, adds them to BREVO_LIST_ID.
//   3. Sends a transactional notification email with the full message to
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

  // ─── 7. Send the notification email ────────────────────────────────
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
