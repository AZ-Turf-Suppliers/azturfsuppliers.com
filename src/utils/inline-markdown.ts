// Minimal inline-markdown renderer for CMS-edited text fields.
// Handles only what the SEO/editorial team needs inside body paragraphs:
//   [text](url)   →  <a href="url">text</a>
//   **text**      →  <strong>text</strong>
//   *text*        →  <em>text</em>
//
// Input is HTML-escaped first so editors cannot inject raw HTML through a
// JSON field. The three markdown patterns are then expanded into safe tags.
// Source is trusted (committed to the repo via the CMS); URL values are not
// sanitized beyond escaping.

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderInline(s: string | undefined | null): string {
  if (!s) return '';
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => `<a href="${url}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
