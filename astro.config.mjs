import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

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
  // @astrojs/sitemap emits a sitemap *index* at /sitemap-index.xml, not the
  // conventional /sitemap.xml. robots.txt points crawlers at the right file,
  // but people and tools reflexively try /sitemap.xml and hit a 404. Alias it
  // so the conventional URL resolves to the real sitemap.
  '/sitemap.xml /sitemap-index.xml 301',
];

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
    }),
    icon(),
    cloudflareRedirects(),
  ],
});
