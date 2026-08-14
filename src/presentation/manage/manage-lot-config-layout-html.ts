type ManageLotConfigLayoutInput = { lotAddButtonHtml: string; lotRowsHtml: string; lotEmptyHtml: string; groupAddButtonHtml: string; groupRowsHtml: string; groupEmptyHtml: string };

export function manageLotConfigLayoutHtml(input: ManageLotConfigLayoutInput) {
  const lotContent = input.lotRowsHtml ? `<table class="lot-table"><thead><tr><th>Số lô</th><th>Mức</th><th>Hạn dùng</th><th>Trạng thái</th><th class="num">Gán</th><th>Thao tác</th></tr></thead><tbody>${input.lotRowsHtml}</tbody></table>` : input.lotEmptyHtml;
  const groupContent = input.groupRowsHtml ? `<div class="lot-group-list">${input.groupRowsHtml}</div>` : input.groupEmptyHtml;
  return `<div class="lot-config-grid"><div class="panel rcfg-list lot-config-left"><div class="rcfg-panel-h"><h3>Lô QC</h3>${input.lotAddButtonHtml}</div>${lotContent}</div><div class="panel rcfg-list lot-config-right"><div class="rcfg-panel-h"><h3>Nhóm lô QC</h3>${input.groupAddButtonHtml}</div>${groupContent}</div></div>`;
}
