type EntryPointTableCardInput = { parallel: boolean; level: number; previousLot: boolean; lot: string; pointCount: number; bodyHtml: string };

export function entryPointTableCardHtml(input: EntryPointTableCardInput) {
  return `<div class="qc-table-card${input.parallel ? ' qc-parallel-card' : ''}" role="region" aria-label="Điểm QC mức ${input.level}, lô ${input.lot}${input.parallel ? ', lô chạy song song' : ''}" tabindex="0"><h4><span>Mức ${input.level} · ${input.previousLot ? 'Lô cũ' : 'Lô'} ${input.lot}${input.parallel ? ' <span class="qc-parallel-label">Song song</span>' : ''}<span class="hint qc-table-count">${input.pointCount} điểm trong khoảng</span></span></h4>${input.bodyHtml}</div>`;
}
