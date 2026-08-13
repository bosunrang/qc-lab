export function entrySaveAuditDetail(input: { dateText: string; level: unknown; parallel: boolean; lotNo?: unknown; valueText: string }) {
  return `Ngày ${input.dateText}, M${input.level}${input.parallel ? ` · lô song song ${input.lotNo || ''}` : ''}, giá trị ${input.valueText}`;
}
