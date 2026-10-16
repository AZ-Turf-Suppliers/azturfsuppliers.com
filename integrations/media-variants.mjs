// Responsive WebP copies of the images in public/media.
//
// Editors upload photos through the CMS straight into public/media, so they
// bypass Astro's image pipeline and ship at full camera size (often 2000px,
// 500–900 KB). This integration writes compressed WebP copies at a phone and a
// desktop width to public/media/opt/<name>-<width>.webp before every dev or
// build run, so any image the CMS adds later gets them too. Pages reference
// them through src/utils/media.ts; the originals are left untouched.
//
// public/media/opt/ is git-ignored and regenerated on each fresh build.
// Unchanged images are skipped (output newer than source), so local
// re-runs are fast.

import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, parse } from 'node:path';
import { cpus } from 'node:os';

export const MEDIA_DIR = 'public/media';
export const VARIANT_DIR = 'public/media/opt';
export const VARIANT_WIDTHS = [960, 1600];
const QUALITY = 65;

const SOURCE_RE = /\.(jpe?g|png)$/i;

async function generate(logger) {
  mkdirSync(VARIANT_DIR, { recursive: true });
  const sources = readdirSync(MEDIA_DIR).filter((f) => SOURCE_RE.test(f));

  const jobs = [];
  const expected = new Set();
  for (const file of sources) {
    const srcPath = join(MEDIA_DIR, file);
    const srcTime = statSync(srcPath).mtimeMs;
    for (const width of VARIANT_WIDTHS) {
      const outName = `${parse(file).name}-${width}.webp`;
      expected.add(outName);
      const outPath = join(VARIANT_DIR, outName);
      if (existsSync(outPath) && statSync(outPath).mtimeMs >= srcTime) continue;
      jobs.push({ srcPath, outPath, width });
    }
  }

  // Drop copies whose original was deleted or renamed.
  for (const f of readdirSync(VARIANT_DIR)) {
    if (!expected.has(f)) unlinkSync(join(VARIANT_DIR, f));
  }

  if (jobs.length === 0) return;
  const start = Date.now();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { srcPath, outPath, width } = jobs[next++];
      await sharp(srcPath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(outPath);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, cpus().length)) }, worker));
  logger.info(`Generated ${jobs.length} WebP media variants in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

export default function mediaVariants() {
  return {
    name: 'media-variants',
    hooks: {
      // Runs before public/ is copied into dist, and before the dev server
      // starts, so the copies exist wherever pages reference them. A failure
      // fails the build rather than shipping pages that point at missing files.
      'astro:config:setup': async ({ logger }) => {
        await generate(logger);
      },
    },
  };
}
