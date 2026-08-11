export function reagentReportItems<TComparison, TResult>(
  comparisons: readonly TComparison[] | null | undefined,
  calculate: (comparison: TComparison) => TResult,
) {
  return (comparisons || []).map(comparison => ({ ds: comparison, R: calculate(comparison) }));
}

export const reagentReportItemPresentation = Object.freeze({ items: reagentReportItems });
