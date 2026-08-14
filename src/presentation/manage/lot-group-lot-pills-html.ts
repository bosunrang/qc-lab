export type LotGroupLotPill = { lotNo: string; level: number };

export function lotGroupLotPillsHtml(lots: LotGroupLotPill[]) {
  return lots.map(lot=>`<span class="pill">${lot.lotNo} · M${lot.level}</span>`).join('');
}
