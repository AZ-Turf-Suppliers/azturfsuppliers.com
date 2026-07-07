import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Last-modified dates for the sitemap. Google uses <lastmod> to prioritize
// recrawling, which matters most right after a migration when a lot of pages
// need to be reindexed. We derive each date from the source file's last git
// commit rather than build time, so a page that didn't change doesn't claim to
// have changed on every deploy (build-time stamps are uniform noise Google
// learns to ignore). Each sitemap URL is mapped to the source file that owns
// its content: static pages to their .astro file, city/turf pages to their
// JSON data file, blog posts to their Markdown.
//
// Safety: if git history isn't available at build time — e.g. a shallow CI
// clone collapses every file to a single commit — the dates lose their spread
// and we ship NO lastmod at all rather than stamp every page with the same
// misleading date.
function gitCommitDate(file) {
  try {
    return execSync(`git log -1 --format=%cI -- "${file}"`, {
      encoding: 'utf-8',
    }).trim() || null;
  } catch {
    return null;
  }
}

function buildLastmodMap() {
  const map = {};
  const add = (urlPath, file) => {
    const date = gitCommitDate(file);
    if (date) map[urlPath] = date;
  };

  // Static top-level pages. Dynamic routes ([slug]) are covered via their data
  // files below; 404 and thank-you are excluded from the sitemap entirely.
  for (const f of readdirSync('./src/pages')) {
    if (!f.endsWith('.astro') || f.startsWith('[')) continue;
    const name = f.replace(/\.astro$/, '');
    if (name === '404' || name === 'thank-you') continue;
    add(name === 'index' ? '/' : `/${name}/`, `./src/pages/${f}`);
  }

  // Blog index + posts.
  add('/blog/', './src/pages/blog/index.astro');
  for (const f of readdirSync('./src/content/blog')) {
    if (!/\.mdx?$/.test(f)) continue;
    add(`/blog/${f.replace(/\.mdx?$/, '')}/`, `./src/content/blog/${f}`);
  }

  // Data-driven city + turf product pages served by src/pages/[slug].astro.
  for (const f of readdirSync('./src/data/locations')) {
    if (f.endsWith('.json')) add(`/${f.replace(/\.json$/, '')}/`, `./src/data/locations/${f}`);
  }
  for (const f of readdirSync('./src/data/products/turf')) {
    if (f.endsWith('.json')) add(`/${f.replace(/\.json$/, '')}/`, `./src/data/products/turf/${f}`);
  }

  // Need a real spread of dates or the signal is unreliable — bail to empty.
  if (new Set(Object.values(map)).size < 2) return {};
  return map;
}

const LASTMOD_BY_PATH = buildLastmodMap();

// Cloudflare Pages reads /_redirects at the deploy root. We generate it from
// src/data/redirects.json so the CMS can manage redirects through a friendly
// form widget instead of editing raw redirect syntax. Note this overwrites
// anything copied from public/ — every redirect must ship through this hook.
//
// Infrastructure rules live here, not in redirects.json, so CMS editors
// can't remove them. They are emitted first: the pages.dev rule must win
// before any path rule fires, or a pages.dev request hitting a CMS redirect
// would hop within pages.dev before reaching the custom domain. `301!`
// forces the redirect even though a static asset exists at the same path.
const INFRA_REDIRECTS = [
  'https://azturfsuppliers-com.pages.dev/* https://azturfsuppliers.com/:splat 301!',
];

// @astrojs/sitemap always emits the sitemap index as /sitemap-index.xml and
// gives no option to rename it. Everyone — humans and tools alike — reaches
// for /sitemap.xml, so serve the real index there directly (a 200, not a
// redirect to a less-common filename). We copy rather than move so the
// original /sitemap-index.xml keeps working too and nothing that already
// references it breaks. Runs after the sitemap integration's own build:done
// hook because this integration is registered after it.
function canonicalSitemap() {
  return {
    name: 'canonical-sitemap',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const src = join(fileURLToPath(dir), 'sitemap-index.xml');
        const dest = join(fileURLToPath(dir), 'sitemap.xml');
        if (!existsSync(src)) {
          logger.warn('sitemap-index.xml not found; skipping /sitemap.xml copy.');
          return;
        }
        copyFileSync(src, dest);
        logger.info('Copied sitemap-index.xml to sitemap.xml');
      },
    },
  };
}

function cloudflareRedirects() {
  return {
    name: 'cloudflare-redirects',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        let data;
        try {
          data = JSON.parse(readFileSync('./src/data/redirects.json', 'utf-8'));
        } catch (err) {
          logger.warn(`Could not read redirects.json (${err.message}). Skipping _redirects.`);
          return;
        }
        const lines = (data?.entries ?? [])
          .filter((r) => r && r.from && r.to)
          .map((r) => `${r.from} ${r.to} ${r.status || 301}`);
        const all = [...INFRA_REDIRECTS, ...lines];
        const body = all.length ? all.join('\n') + '\n' : '';
        writeFileSync(join(fileURLToPath(dir), '_redirects'), body);
        logger.info(`Wrote ${all.length} redirect(s) to _redirects`);
      },
    },
  };
}

export default defineConfig({
  // Canonical host is the apex domain — www 301s to it at the edge, so the
  // sitemap, canonicals, and JSON-LD must all be generated without www.
  site: 'https://azturfsuppliers.com',
  // Cloudflare Pages serves directory-format output and 308s bare paths to
  // the trailing-slash version, so internal links must always carry the
  // trailing slash to avoid shipping a redirect hop.
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Keep noindex pages and form-success pages out of the sitemap.
      filter: (page) =>
        !page.includes('/thank-you') && !page.includes('/404'),
      // Stamp each URL with its source file's last-commit date (see
      // buildLastmodMap). Pages with no mapped date are left without a
      // lastmod, which is valid — the tag is optional per URL.
      serialize(item) {
        const lastmod = LASTMOD_BY_PATH[new URL(item.url).pathname];
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
    // Must come after sitemap() so the generated index exists when it runs.
    canonicalSitemap(),
    icon(),
    cloudflareRedirects(),
  ],
});
