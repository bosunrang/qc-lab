export function reagentCreateTypedRowHtml(queryHtml: string, createAction: string): string {
  return queryHtml ? `<button class="refrow" onclick="${createAction}">+ Tạo "${queryHtml}"</button>` : `<button class="refrow" onclick="${createAction}">+ Tạo hóa chất trống</button>`;
}
