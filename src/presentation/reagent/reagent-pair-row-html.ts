type PairRowInput = {
  index: number;
  row: readonly unknown[] | null | undefined;
  readOnly: boolean;
  pair: { avg: number; dif: number } | null;
  format: (value: unknown, decimals?: number) => string;
  escAttr: (value: unknown) => string;
};

export function createReagentPairRowHtml() {
  return ({ index, row, readOnly, pair, format, escAttr }: PairRowInput) => `<div class="rc-pair-row" data-rc-row="${index}"><div class="rc-idx">${index + 1}</div><input ${readOnly ? 'disabled' : ''} value="${escAttr(row?.[0])}" oninput="rcCell(${index},0,this.value)" type="number" step="any" placeholder="–"><input ${readOnly ? 'disabled' : ''} value="${escAttr(row?.[1])}" oninput="rcCell(${index},1,this.value)" type="number" step="any" placeholder="–"><div class="rc-calc avg">${pair ? format(pair.avg, 3) : '–'}</div><div class="rc-calc dif ${pair && pair.dif < 0 ? 'neg' : ''}">${pair ? format(pair.dif, 3) : '–'}</div>${readOnly ? '<span></span>' : `<button class="x" onclick="rcRmRow(${index})" title="Xóa dòng">✕</button>`}</div>`;
}
