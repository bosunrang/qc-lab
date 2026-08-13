export function entryVoidAuditDetail(input: { dateText: string; level: unknown; valueText: string; reason: string }) {
  return `Ngày ${input.dateText}, M${input.level}, giá trị ${input.valueText} · ${input.reason}`;
}
