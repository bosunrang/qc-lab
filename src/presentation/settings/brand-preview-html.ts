export function createBrandPreviewHtml(escape: (value: unknown) => string, escapeAttribute: (value: unknown) => string) {
  return (input: { logo?: unknown; markText?: unknown; title?: unknown; subtitle?: unknown }) => {
    const logo = input.logo;
    const mark = logo ? `<img src="${escapeAttribute(logo)}" alt="">` : escape(input.markText);
    return `<div class="brand-preview"><div class="brand-mark">${mark}</div><div><b>${escape(input.title)}</b><small>${escape(input.subtitle)}</small></div></div>`;
  };
}
