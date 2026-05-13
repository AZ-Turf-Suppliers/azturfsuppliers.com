import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://www.azturfsuppliers.com',
  integrations: [
    sitemap({
      // Keep noindex pages and form-success pages out of the sitemap.
      filter: (page) =>
        !page.includes('/thank-you') && !page.includes('/404'),
    }),
    icon(),
  ],
});
