type PairRowInput = {
  index: number;
  row: readonly unknown[] | null | undefined;
  readOnly: boolean;
  pair: { avg: number; dif: number } | null;
  format: (value: unknown, decimals?: number) => string;
  escAttr: (value: unknown) => string;
};

export function createReagentPairRowHtml() {
  return ({ index, row, readOnly, pair, format, escAttr }: PairRowInput) => `<div class="rc-pair-row" data-rc-row="${index}"><div class="rc-idx">${index + 1}</div><input ${readOnly ? 'disabled' : ''} value="${escAttr(row?.[0])}" data-action="rcCell" data-args="[${index},0]" data-action-on="input" type="number" step="any" placeholder="–"><input ${readOnly ? 'disabled' : ''} value="${escAttr(row?.[1])}" data-action="rcCell" data-args="[${index},1]" data-action-on="input" type="number" step="any" placeholder="–"><div class="rc-calc avg">${pair ? format(pair.avg, 3) : '–'}</div><div class="rc-calc dif ${pair && pair.dif < 0 ? 'neg' : ''}">${pair ? format(pair.dif, 3) : '–'}</div>${readOnly ? '<span></span>' : `<button class="x" data-action="rcRmRow" data-args="[${index}]" title="Xóa dòng">✕</button>`}</div>`;
}
