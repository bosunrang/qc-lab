type EntryLevelHeaderInput = {
  level: number;
  lot: string;
  parallel: boolean;
  tooltip: string;
};

type EntryLevelHeaderDependencies = { escape: (value: unknown) => string };

export function createEntryLevelHeaderHtml(deps: EntryLevelHeaderDependencies) {
  return (input: EntryLevelHeaderInput) => `<th class="qc-level-head" tabindex="0" data-qc-tooltip="${deps.escape(input.tooltip)}" aria-label="Mức ${input.level}, lô ${deps.escape(input.lot || '?')}. ${deps.escape(input.tooltip)}">Mức ${input.level} · Lô ${deps.escape(input.lot || '?')}${input.parallel ? ' <span class="qc-parallel-label">Song song</span>' : ''}</th>`;
}
