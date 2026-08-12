type Chip = { cls: string; label: string };

export function createActionSideChipsHtml(deps: { escape: (value: unknown) => string }) {
  return (chips: Chip[]) => chips.map(chip => `<span class="action-chip ${chip.cls}">${deps.escape(chip.label)}</span>`).join('');
}
