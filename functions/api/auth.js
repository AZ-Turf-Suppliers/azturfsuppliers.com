// Cloudflare Pages Function — /api/auth
//
// First leg of the GitHub OAuth handshake for Sveltia CMS. The CMS opens this
// URL in a popup; we redirect to GitHub's /authorize endpoint with our
// OAuth App's Client ID and a state token. GitHub then redirects the user
// back to /api/callback once they approve.
//
// Required environment variables (set in the Cloudflare Pages dashboard):
//   GITHUB_CLIENT_ID      — from the GitHub OAuth App
//   GITHUB_CLIENT_SECRET  — only used in /api/callback; required in same env
//
// Optional:
//   GITHUB_OAUTH_SCOPE    — defaults to "repo,user"

export async function onRequestGet(context) {
  const { request, env } = context;

  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('Sveltia CMS: GITHUB_CLIENT_ID env var is not set on this Pages project.', {
      status: 500,
    });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || env.GITHUB_OAUTH_SCOPE || 'repo,user';

  // CSRF-resistant state: opaque random value bounced back through GitHub.
  // Stored as a short-lived cookie that /api/callback verifies.
  const state = crypto.randomUUID();

  const redirectUri = `${url.origin}/api/callback`;
  const ghUrl = new URL('https://github.com/login/oauth/authorize');
  ghUrl.searchParams.set('client_id', clientId);
  ghUrl.searchParams.set('redirect_uri', redirectUri);
  ghUrl.searchParams.set('scope', scope);
  ghUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: ghUrl.toString(),
      // Cookie expires in 10 minutes; SameSite=Lax so the callback can read it.
      'Set-Cookie': `sveltia_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
