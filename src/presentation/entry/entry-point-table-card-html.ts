type EntryPointTableCardInput = {
  level: number;
  lot: string;
  previousLot: boolean;
  parallel: boolean;
  total: number;
  cumulativeHtml: string;
  rowsHtml: string;
  rowControlHtml: string;
};

type EntryPointTableCardDependencies = { escape: (value: unknown) => string };

export function createEntryPointTableCardHtml(deps: EntryPointTableCardDependencies) {
  return (input: EntryPointTableCardInput) => `<div class="qc-table-card${input.parallel ? ' qc-parallel-card' : ''}" role="region" aria-label="Điểm QC mức ${input.level}, lô ${deps.escape(input.lot || '?')}${input.parallel ? ', lô chạy song song' : ''}" tabindex="0"><h4><span>Mức ${input.level} · ${input.previousLot ? 'Lô cũ' : 'Lô'} ${deps.escape(input.lot || '?')}${input.parallel ? ' <span class="qc-parallel-label">Song song</span>' : ''}<span class="hint qc-table-count">${input.total} điểm trong khoảng</span></span></h4>${input.cumulativeHtml}${input.rowsHtml ? `<table><thead><tr><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>${input.rowControlHtml}` : '<div class="empty qc-table-empty">Chưa có điểm nào trong khoảng này.</div>'}</div>`;
}
