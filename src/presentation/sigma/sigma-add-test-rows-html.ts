export type SigmaAddTestRow = { id: string; tracked: boolean; current: boolean; name: string; meta: string; action: string; label: string };

export function sigmaAddTestRowsHtml(rows: SigmaAddTestRow[]) {
  return rows.map(row=>`<button class="refrow sg-add-test-row${row.tracked?' is-tracked':''}${row.current?' is-current':''}" ${row.current?'aria-current="true"':''} onclick="${row.action}"><span><b>${row.name}</b><span class="meta">${row.meta}</span></span><span class="tag ${row.tracked?'ok':'none'}">${row.label}</span></button>`).join('');
}
