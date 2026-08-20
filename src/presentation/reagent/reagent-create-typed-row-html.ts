export function reagentCreateTypedRowHtml(queryHtml: string, actionAttrs: string): string {
  return queryHtml ? `<button class="refrow" ${actionAttrs}>+ Tạo "${queryHtml}"</button>` : `<button class="refrow" ${actionAttrs}>+ Tạo hóa chất trống</button>`;
}
