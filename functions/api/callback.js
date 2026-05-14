// Cloudflare Pages Function — /api/callback
//
// Second leg of the GitHub OAuth handshake. GitHub redirects the user here
// with a one-time `code` after they approve. We exchange that code for an
// access token using the OAuth App's client_secret, then post the token
// back to the parent window (the Sveltia CMS in /admin/) via window.opener.
//
// Required env vars (same as /api/auth):
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET

function escapeJs(s) {
  return String(s).replace(/[\\'"<>&  ]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function renderResponse({ status, content, kind }) {
  // Sveltia/Decap-style postMessage protocol: parent listens for messages
  // starting with `authorization:github:`. The string is parsed as JSON.
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const safe = escapeJs(message);

  return new Response(
    `<!doctype html>
<html><body><script>
(function () {
  function send() {
    if (!window.opener) {
      document.body.textContent = 'Authentication ${status}. You can close this window.';
      return;
    }
    window.opener.postMessage('${safe}'.replace(/\\\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), '*');
  }
  window.addEventListener('message', send, false);
  send();
})();
</script></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Clear the state cookie set by /api/auth
        'Set-Cookie': 'sveltia_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
      },
    },
  );
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response('Sveltia CMS: GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET env vars missing.', {
      status: 500,
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return renderResponse({ status: 'error', content: { message: errorParam } });
  }
  if (!code || !state) {
    return renderResponse({ status: 'error', content: { message: 'Missing code or state from GitHub.' } });
  }

  // Verify CSRF state matches the cookie we set in /api/auth
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)sveltia_oauth_state=([^;]+)/);
  const cookieState = match ? match[1] : null;
  if (!cookieState || cookieState !== state) {
    return renderResponse({ status: 'error', content: { message: 'OAuth state mismatch.' } });
  }

  // Exchange the code for an access token
  let tokenResp;
  try {
    tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'sveltia-cms-cf-pages-fn',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${url.origin}/api/callback`,
      }),
    });
  } catch (e) {
    return renderResponse({ status: 'error', content: { message: 'GitHub token request failed.' } });
  }

  const tokenData = await tokenResp.json().catch(() => ({}));
  if (tokenData.error || !tokenData.access_token) {
    return renderResponse({
      status: 'error',
      content: { message: tokenData.error_description || tokenData.error || 'No access_token returned.' },
    });
  }

  return renderResponse({
    status: 'success',
    content: { token: tokenData.access_token, provider: 'github' },
  });
}
