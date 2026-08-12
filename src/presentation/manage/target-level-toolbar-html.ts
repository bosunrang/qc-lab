export function targetLevelToolbarHtml(level: string, lotNos: unknown[], tabsHtml: string, escape: (value: unknown) => string) {
  return `<div class="target-level-toolbar"><div><b>Mức ${escape(level)}</b><span class="target-level-lot">${lotNos.map(lotNo => escape(lotNo)).join(' / ')}</span></div><div class="dayseg">${tabsHtml}</div></div>`;
}
