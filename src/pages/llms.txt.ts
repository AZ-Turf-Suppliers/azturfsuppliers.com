import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import site from '../data/site.json';

// /llms.txt — a plain-Markdown site guide for AI assistants and crawlers,
// per the llms.txt convention (https://llmstxt.org/). AI systems that can't
// or won't crawl the whole site read this one file to learn what the
// business is, what it sells, and which pages answer which questions.
//
// Product and location entries are generated from the same JSON data files
// that render the pages themselves (see src/pages/[slug].astro), and blog
// entries from the content collection, so listings and prices here can
// never drift from what the site actually shows.

const locationModules = import.meta.glob('../data/locations/*.json', { eager: true });
const turfModules = import.meta.glob('../data/products/turf/*.json', { eager: true });

const slugOf = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');

export const GET: APIRoute = async () => {
  const base = 'https://azturfsuppliers.com';
  const url = (path: string) => `${base}${path}`;

  const turf = Object.entries(turfModules)
    .map(([path, mod]) => {
      const data = (mod as any).default ?? mod;
      const schema = data.productSchema ?? {};
      return {
        slug: slugOf(path),
        name: schema.name ?? data.meta.title,
        price: schema.price ? `$${schema.price}/sq ft` : null,
        description: schema.description ?? data.meta.description,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const cities = Object.entries(locationModules)
    .map(([path, mod]) => {
      const data = (mod as any).default ?? mod;
      return { slug: slugOf(path), name: data.name as string };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const lines = [
    `# ${site.name}`,
    '',
    '> Wholesale supplier of premium artificial turf, pavers, natural stone, and',
    '> landscape lighting in Queen Creek, Arizona. Family-run, serving homeowners',
    '> and landscape contractors across the Phoenix Metro (East Valley, Phoenix,',
    '> Scottsdale, and surrounding cities) with wholesale pricing, same-day',
    '> showroom pickup, and next-day delivery.',
    '',
    'Key facts:',
    '',
    `- Showroom: ${site.address_street}, ${site.address_city}, ${site.address_region} ${site.address_postal}`,
    `- Phone (call or text): ${site.phone}`,
    `- Email: ${site.email}`,
    `- Hours: ${site.hours_weekday}; ${site.hours_weekend}`,
    '- Every turf blend is independently lab-tested and certified lead-free,',
    '  and carries a 15-year manufacturer warranty.',
    '',
    '## Products',
    '',
    `- [All Products](${url('/products/')}): Overview of every product category.`,
    `- [Artificial Turf](${url('/artificial-turf/')}): Full turf lineup with prices, specs, and comparisons.`,
    `- [Pavers](${url('/pavers/')}): Paver styles and colors for patios, driveways, and walkways.`,
    `- [Natural Stone](${url('/natural-stone/')}): Flagstone, rip rap, and decorative stone.`,
    `- [Landscape Lighting](${url('/landscape-lighting/')}): Low-voltage landscape lighting.`,
    `- [Accessories](${url('/accessories/')}): Infill, nails, seam tape, weed barrier, and install supplies.`,
    '',
    '## Artificial turf blends (price per sq ft)',
    '',
    ...turf.map(
      (t) =>
        `- [${t.name}](${url(`/${t.slug}/`)}): ${t.price ? `${t.price} — ` : ''}${t.description}`
    ),
    '',
    '## Service areas',
    '',
    `- [All Service Areas](${url('/locations/')}): Delivery coverage across the Phoenix Metro.`,
    ...cities.map(
      (c) =>
        `- [${c.name}, AZ](${url(`/${c.slug}/`)}): Turf, pavers, stone, and lighting delivered to ${c.name}.`
    ),
    '',
    '## Guides',
    '',
    ...posts.map(
      (p) => `- [${p.data.title}](${url(`/blog/${p.slug}/`)}): ${p.data.description}`
    ),
    `- [Turf Calculator](${url('/turf-calculator/')}): Free calculator for roll layout, seams, infill, and waste.`,
    `- [FAQ](${url('/faq/')}): Common questions on pricing, delivery, warranties, and pet safety.`,
    '',
    '## Company',
    '',
    `- [About](${url('/about/')}): Who we are and how we work.`,
    `- [For Contractors](${url('/contractors/')}): Wholesale accounts, jobsite delivery, 15-minute pickup.`,
    `- [For Homeowners](${url('/homeowners/')}): Wholesale-direct buying for DIY projects.`,
    `- [Warranty](${url('/warranty/')}): 15-year manufacturer warranty details.`,
    `- [Lead-Free Certification](${url('/lead-free/')}): Independent lab certifications for every blend.`,
    `- [Reviews](${url('/reviews/')}): Google reviews from Arizona homeowners and contractors.`,
    `- [Contact](${url('/contact/')}): Quotes, directions, and showroom info.`,
    '',
    '## Optional',
    '',
    `- [Sitemap](${url('/sitemap.xml')}): Full XML sitemap of every page.`,
    `- [Photo Gallery](${url('/gallery/')}): Real customer installs across Arizona.`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
