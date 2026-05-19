# SEO, Ads, and Analytics — What's Shipped on azturfsuppliers.com

A snapshot of the SEO / advertising-readiness / analytics work that's live as of this session. Each item is in production unless noted.

---

## SEO foundation

- **Structured data (JSON-LD).** `LocalBusiness`, `WebSite`, and `BreadcrumbList` schemas emit on every page from the shared layout. `Product` schema with price, image, description, and validity emits on all 9 turf detail pages.
- **Auto-generated sitemap** at `/sitemap-index.xml`. `/thank-you` and `/404` correctly excluded.
- **Per-page meta** — title, description, robots, canonical URL, Open Graph + Twitter Card tags, theme color, favicon, apple-touch-icon. Every page has unique title/description.
- **Performance signals search engines reward** — DNS prefetch + preconnect for fonts and YouTube; hero image preload on non-home pages; Cloudflare edge cache headers tuned (`_headers`); WebP images with content-hashed filenames, cached for 1 year; static-rendered Astro site for near-instant TTFB.
- **noindex hygiene** — `/thank-you` and `/404` noindexed via meta; `*.pages.dev` preview hostnames noindexed via `X-Robots-Tag` header so staging URLs don't pollute search results.
- **Pricing consistency.** Surfaced the official customer pricing sheet across landing cards, detail pages, JSON-LD product schema, and the turf calculator. One source of truth per product (`src/data/products/turf/<slug>.json`). Both per-sqft and bulk full-roll prices now visible to customers.

## Analytics infrastructure

- **Google Tag Manager.** Container `GTM-595K6QJW` installed sitewide via the shared layout (head bootstrap + body noscript fallback). Loads on all 40 pages.
- **Conversion event.** `generate_lead` dataLayer event fires once on `/thank-you` (the form-success page). Standard GA4 event name, mappable to any tag in GTM without further code changes.
- **Per-conversion attribution.** When attribution data is available, `utmcsr`, `utmcmd`, `utmccn`, `utmctr`, and `utmgclid` are pushed alongside the event so GA4 / Google Ads / Meta Pixel / etc. can attribute conversions to specific campaigns.

## Ads attribution

- **First-touch UTM capture.** A small inline script in the layout runs on every page load — reads URL params, stores attribution in `localStorage` for 90 days, never overwrites within the window. Accepts both abbreviated GA-classic names (`utmcsr` / `utmcmd` / `utmccn` / `utmctr` / `utmgclid`) and standard `utm_source` / `utm_medium` / `utm_campaign` / `utm_term` / `gclid` as fallbacks. Whatever the ad platform appends to the URL, we capture it.
- **Hidden form fields.** Both contact forms (homepage + `/contact`) carry 5 hidden inputs that auto-populate from the stored attribution at submit time, so attribution always travels with the lead.
- **End-to-end propagation.** Attribution lands in every downstream surface: notification email (Attribution table in the body), Brevo CRM contact attributes, Google Sheet (5 dedicated columns: Source / Medium / Campaign / Keyword / GCLID), and the GTM dataLayer event for tag-side consumption.
- **GCLID captured specifically.** Enables Google Ads enhanced conversions for leads when the consultant wires that up.

## Lead capture pipeline (supports ROI measurement on ads)

- **Migrated off Formspree** to a self-managed pipeline. Form posts to a Cloudflare Pages Function at `/api/contact`, which:
  1. Verifies Cloudflare Turnstile (free invisible CAPTCHA) + honeypot rejection
  2. Upserts a Brevo CRM contact with the form fields + 5 attribution attributes
  3. Appends a row to a Google Sheet (analyst pulls from here on his own cadence)
  4. Sends a transactional notification email to `contact@azturfsuppliers.com` with Reply-To set to the submitter (hit reply, message the lead directly)
- **Newsletter opt-in** — submitters can join a Brevo "Website Leads" list (ID #3) for future marketing.
- **Permanent archive** — Sheet preserves every submission with full untruncated message and all 13 columns, independent of Brevo and independent of any third-party automation tool.

## Handoff materials in the repo

- `ANALYTICS-HANDOFF.md` — single-page brief for the analytics consultant covering GTM container ID, the `generate_lead` event spec, recommended Data Layer Variable / trigger / GA4 tag configuration, smoke-test recipes.
- `BREVO-SETUP.md`, `SHEETS-SETUP.md`, `SHEETS-SETUP-PROMPT.md`, `SVELTIA-SETUP.md`, `CLEANUP-PROMPT.md` — infrastructure docs and Chrome-extension setup prompts.
- `SEO-ANALYTICS-REPORT.md` — this file.

## Reasonable next steps (not yet done, low effort)

- **Verify the site in Google Search Console** via Cloudflare DNS TXT record. Enables visibility into which queries surface the site in regular Search + AI Overviews, and surfaces any indexing issues. ~5 minutes.
- **Claim / verify the Google Business Profile** for the Queen Creek showroom. Powers local-pack results and local AI Overviews ("artificial turf near Queen Creek"). High-intent traffic source.
- **Add `Review` / `AggregateRating` schema** to the reviews page so the 5.0 Google rating can appear in rich results. ~30 minutes.
- **Add `FAQPage` schema** on `/warranty` and `/lead-free` if those pages have natural Q&A content. Pull-quotable by AI Overviews. Skip if it would mean inventing FAQs.
- **GTM tag wiring** — the container is loading but tags themselves still need to be built by the analytics consultant. He has everything he needs in `ANALYTICS-HANDOFF.md`.
