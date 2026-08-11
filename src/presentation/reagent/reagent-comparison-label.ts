export type ReagentComparisonLabelTest = { reagent?: unknown; lotOld?: unknown; lotNew?: unknown };

export function reagentComparisonLabel(
  test: ReagentComparisonLabelTest | null | undefined,
  analyteLabel: (reagent: unknown) => unknown,
): string {
  let label = String(analyteLabel(test?.reagent) || test?.reagent || 'Hóa chất mới');
  if (test?.lotOld || test?.lotNew) label += ` — ${test.lotOld || '?'}→${test.lotNew || '?'}`;
  return label;
}

export const reagentComparisonLabelPresentation = Object.freeze({ label: reagentComparisonLabel });
