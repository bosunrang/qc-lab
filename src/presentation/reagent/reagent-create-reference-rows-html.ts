type ReagentCreateReferenceCategory = { nameHtml: string; rowsHtml: string };

export function reagentCreateReferenceRowsHtml(categories: ReagentCreateReferenceCategory[], emptyHtml: string): string {
  return categories.length ? categories.map(category => `<div class="refcat">${category.nameHtml}</div>${category.rowsHtml}`).join('') : emptyHtml;
}
