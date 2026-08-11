export function entrySaveFeedback(input: { level: unknown; lotNo?: unknown; parallel?: boolean; verdict?: unknown; rules?: unknown; dateText: string }) {
  const tag = `Mức ${input.level}${input.parallel ? ` · lô song song ${input.lotNo || ''}` : ''}`;
  const rules = Array.isArray(input.rules) ? input.rules.filter(Boolean).join(', ') : '';
  if (input.verdict === 'rej') return { cls: 'rej', emphasis: true, message: `⚠ ${tag} vi phạm — ${rules}` };
  if (input.verdict === 'warn') return { cls: 'warn', emphasis: true, message: `${tag} cảnh báo — ${rules}` };
  return { cls: 'ok', emphasis: false, message: `✓ Đã lưu ${tag} ngày ${input.dateText}.` };
}
