const HTML_ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown): string {
  return (value == null ? '' : String(value)).replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);
}

export function escapeHtmlAttr(value: unknown): string {
  return escapeHtml(value);
}
