type EntryChartRangeSourceInput = { applied: string };

export function entryChartRangeSourceHtml(input: EntryChartRangeSourceInput) {
  return `<span class="hint">${input.applied === 'lab' ? 'Dải PXN' : 'Dải NSX'}</span>`;
}
