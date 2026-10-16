// Paths to the responsive WebP copies of public/media images that
// integrations/media-variants.mjs generates at build time.
import { VARIANT_WIDTHS } from '../../integrations/media-variants.mjs';

const MEDIA_RE = /^\/media\/([^/?#]+)\.(jpe?g|png)$/i;

/** True for images uploaded to public/media, which have generated copies. */
export function hasVariants(src: string): boolean {
  return MEDIA_RE.test(src);
}

/** The copy of a /media image at the given width, or the original path. */
export function mediaVariant(src: string, width: number): string {
  const m = src.match(MEDIA_RE);
  return m ? `/media/opt/${m[1]}-${width}.webp` : src;
}

export const SMALL_WIDTH = VARIANT_WIDTHS[0];
export const LARGE_WIDTH = VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];

/**
 * srcset for a /media image. Copies are never upscaled, so widths are capped
 * at the original's width and duplicates collapse.
 */
export function mediaSrcset(src: string, originalWidth?: number): string | undefined {
  if (!hasVariants(src)) return undefined;
  const seen = new Set<number>();
  return VARIANT_WIDTHS.map((w) => {
    const actual = originalWidth ? Math.min(w, originalWidth) : w;
    if (seen.has(actual)) return null;
    seen.add(actual);
    return `${mediaVariant(src, w)} ${actual}w`;
  })
    .filter(Boolean)
    .join(', ');
}
