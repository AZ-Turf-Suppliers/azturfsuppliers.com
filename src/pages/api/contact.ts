export const prerender = false;

const OWNER_EMAIL = 'contact@azturfsuppliers.com';
const OWNER_NAME = 'AZ Turf Suppliers';

export async function POST({ request }: { request: Request }) {
  const apiKey = (import.meta.env as Record<string, string>).BREVO_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const firstName = String(data.get('firstName') ?? '').trim();
  const lastName  = String(data.get('lastName')  ?? '').trim();
  const email     = String(data.get('email')      ?? '').trim();
  const phone     = String(data.get('phone')      ?? '').trim();
  const role      = String(data.get('role')       ?? '').trim();
  const message   = String(data.get('message')    ?? '').trim();

  if (!email || !firstName) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    'api-key': apiKey,
    'Content-Type': 'application/json',
  };

  // 1 — Add/update contact in Brevo
  try {
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes: {
          FIRSTNAME: firstName,
          LASTNAME: lastName,
          SMS: phone,
        },
        listIds: [2],
        updateEnabled: true,
      }),
    });
  } catch {
    // Non-fatal — still send the notification email
  }

  // 2 — Send notification email to the owner
  const notifyRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sender: { name: `${firstName} ${lastName}`, email: OWNER_EMAIL },
      to: [{ email: OWNER_EMAIL, name: OWNER_NAME }],
      replyTo: { email, name: `${firstName} ${lastName}` },
      subject: `New website inquiry from ${firstName} ${lastName}`,
      htmlContent: `
        <h2 style="font-family:sans-serif;">New Contact Form Submission</h2>
        <table style="font-family:sans-serif;border-collapse:collapse;width:100%;max-width:560px;">
          <tr><td style="padding:8px;font-weight:bold;width:130px;">Name</td><td style="padding:8px;">${firstName} ${lastName}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Phone</td><td style="padding:8px;">${phone || '—'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">I am a...</td><td style="padding:8px;">${role || '—'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;vertical-align:top;">Message</td><td style="padding:8px;">${message.replace(/\n/g, '<br>')}</td></tr>
        </table>
      `,
    }),
  });

  if (!notifyRes.ok) {
    const err = await notifyRes.text();
    console.error('Brevo error:', err);
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
