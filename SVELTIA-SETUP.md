# Sveltia CMS — One-Time Setup

The CMS code is committed and ready, but it can't actually log anyone in
until you do **three things in dashboards** I can't touch:

1. Create a GitHub OAuth App.
2. Add two environment variables in Cloudflare Pages.
3. (Optional) Add CMS users.

Once those are done — *and* the production domain points at the Cloudflare
Pages project (see prerequisite below) — `https://www.azturfsuppliers.com/admin/`
is live.

---

## Prerequisite — Custom domain must be mapped to the Pages project

`/admin/` and `/api/callback` only work on hosts that actually reach the
Cloudflare Pages deployment. If `www.azturfsuppliers.com` still points at
the old GoDaddy/registrar parking host, the CMS login flow will land on a
generic 404 page even though every other piece is configured correctly.

Confirm at **Cloudflare → Workers & Pages → `azturfsuppliers-com` →
Custom domains**. You should see `www.azturfsuppliers.com` (and ideally
the apex `azturfsuppliers.com` with a redirect) listed there. If the tab
is empty, the rest of this guide will appear to work — env vars set,
OAuth App configured, build green — but Task 3 below will fail with a
parking-host 404.

If the domain isn't mapped yet, you have two options:

- **Smoke-test on the `*.pages.dev` URL first** (optional): change the
  GitHub OAuth App's callback URL to
  `https://azturfsuppliers-com.pages.dev/api/callback`, change
  `base_url` in `public/admin/config.yml` to
  `https://azturfsuppliers-com.pages.dev`, then visit
  `https://azturfsuppliers-com.pages.dev/admin/`. Revert both on launch
  day.
- **Just wait for launch** (simpler): finish the DNS cutover, then come
  back and verify `/admin/` directly on the production domain.

---

## 1. Create the GitHub OAuth App

GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**

| Field | Value |
| --- | --- |
| **Application name** | `AZ Turf Suppliers CMS` |
| **Homepage URL** | `https://www.azturfsuppliers.com` |
| **Authorization callback URL** | `https://www.azturfsuppliers.com/api/callback` |
| **Application description** | (Optional) "Sveltia CMS auth for the AZ Turf Suppliers site." |

After clicking **Register application**:

- Copy the **Client ID** (visible immediately).
- Click **Generate a new client secret** and copy it. You will only see it once.

> ⚠️ The OAuth App must be registered against an **account** or **organization**
> that owns (or has write access to) `az-turf-suppliers/azturfsuppliers.com`.
> If you create it under a personal account, anyone with write access to the
> repo can still log in — GitHub authorizes based on the user's repo access,
> not the OAuth App owner.

## 2. Add the env vars in Cloudflare Pages

Cloudflare dashboard → **Workers & Pages** → your `azturfsuppliers-com`
Pages project → **Settings** tab.

There is a **"Choose Environment"** dropdown at the top of the Settings
page (Production / Preview) and a section labelled **"Variables and Secrets"**
further down — that's the renamed home of what used to be "Environment
variables". You'll add the two variables twice: once with the dropdown on
**Production**, then again with it switched to **Preview**.

| Variable name | Value | Type |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | the Client ID from step 1 | Plaintext |
| `GITHUB_CLIENT_SECRET` | the Client Secret from step 1 | **Secret (encrypted)** |

Save. Cloudflare will redeploy automatically; once that finishes, the
`/api/auth` and `/api/callback` Pages Functions are live.

## 3. (Optional) Test the login

1. Visit `https://www.azturfsuppliers.com/admin/`.
2. Click **Login with GitHub**.
3. A popup opens to GitHub → click **Authorize**.
4. Popup closes; the CMS shows your collections (Blog, Site Configuration,
   Homepage Images, Gallery Labels).
5. Open any blog post or site setting, change a value, click **Publish**.
6. Cloudflare Pages will rebuild from the commit Sveltia just pushed and
   the change will be on the live site in 1–2 minutes.

If the login popup says "OAuth state mismatch" or "GITHUB_CLIENT_ID env var
is not set", recheck step 2.

## 4. Adding more CMS users

Sveltia uses your GitHub identity. To let a co-worker log in:

- Repo → **Settings** → **Collaborators** → **Add people** → enter their
  GitHub username → assign **Write** permission.

Each user logs in with their own GitHub account; every CMS edit shows
their name in the commit history.

---

## What's in the CMS

Open `/admin/` to see four sections:

| Section | What it edits | File on disk |
| --- | --- | --- |
| **Blog Posts** | Existing post + create new posts. Title, description, dates, hero image, body (rich-text Markdown). | `src/content/blog/*.md` |
| **Site Configuration** | Phone, address, hours, email, social URLs. Wired into the header, footer, contact section, and `LocalBusiness` JSON-LD. | `src/data/site.json` |
| **Homepage Images** | Image slots for hero, product cards, "Other Products" tiles, etc. | `src/data/homepage.json` |
| **Gallery Labels** | Optional hover title + location for each gallery photo by filename. | `src/data/gallery.json` |

## What's *not* in the CMS (intentional)

These remain code edits:

- City landing pages (`src/pages/{queen-creek,scottsdale,…}.astro`)
- Product detail pages (`src/pages/{natural-blend-75,…}.astro`)
- Section copy on the homepage, About, Contact, etc.

Those are bespoke landing-page templates, not editorial content. If a
specific page needs to become editable, we can extract its copy into a
JSON file and add it as a CMS collection — same pattern as `site.json`.

## How CMS edits become live

1. You edit something in `/admin/` and click **Publish**.
2. Sveltia commits the change to `main` via the GitHub API, using the
   access token from the OAuth handshake.
3. Cloudflare Pages auto-detects the new commit on `main` and rebuilds.
4. Live in ~1–2 minutes.

No staging server, no manual deploy steps, no DB to back up. Everything
is in Git.

## Files involved (so future devs can find them)

```
public/admin/index.html           ← loads Sveltia from unpkg CDN
public/admin/config.yml           ← collections, fields, auth backend pointer
functions/api/auth.js             ← redirects browser to GitHub /authorize
functions/api/callback.js         ← exchanges code → token, posts to opener
src/content/config.ts             ← Astro content collection schema
src/content/blog/*.md             ← blog posts (editable in CMS)
src/data/site.json                ← business info (editable in CMS)
src/data/homepage.json            ← homepage image slots (editable in CMS)
src/data/gallery.json             ← gallery hover labels (editable in CMS)
```

## Pinning the CMS version

`public/admin/index.html` loads Sveltia from
`https://unpkg.com/@sveltia/cms@^0.108.0/dist/sveltia-cms.js`. The `^0.108.0`
gets the latest patch automatically. To pin to an exact version (for
auditability), change it to e.g. `@0.108.4`.
