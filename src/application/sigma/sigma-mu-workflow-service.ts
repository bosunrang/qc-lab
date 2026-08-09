type Value = Record<string, any>;

export function createSigmaMuWorkflowService(deps: { cleanText: (value: unknown, maximumLength?: number) => string; parseDate: (value: unknown) => string }) {
  const apply = (records: Value[], periodIds: string[], rows: Value[], reviewedBy: unknown, reviewedDate: unknown) => {
    if (!(periodIds || []).length) return { applied: 0, status: 'missing-periods' };
    const by = deps.cleanText(reviewedBy, 120), date = deps.parseDate(reviewedDate) || '';
    let applied = 0;
    records.forEach(record => {
      if (!periodIds.includes(record.id)) return;
      record.lv = record.lv || {};
      rows.forEach(row => {
        const level = record.lv[row.level] = record.lv[row.level] || {}, raw = String(row.uCal ?? '').trim(), value = Number(raw);
        if (raw !== '' && Number.isFinite(value) && value >= 0) level.uCal = value; else delete level.uCal;
        const basis = deps.cleanText(row.uCalBasis, 500); if (basis) level.uCalBasis = basis; else delete level.uCalBasis;
        level.muBiasMode = row.muBiasMode === 'exclude' ? 'exclude' : 'include';
        if (by) level.muReviewedBy = by; else delete level.muReviewedBy;
        if (date) level.muReviewedDate = date; else delete level.muReviewedDate;
      });
      applied++;
    });
    return { applied, status: applied ? 'applied' : 'no-matching-periods' };
  };
  return Object.freeze({ apply });
}
export type SigmaMuWorkflowService = ReturnType<typeof createSigmaMuWorkflowService>;
