type Feedback = { cls: string; emphasis: boolean; message: string } | null;

export function createEntrySaveMessageHtml(deps: { escape: (value: unknown) => string; feedbackHtml: (feedback: Feedback) => string }) {
  return (input: { feedback: Feedback; verdict: string; tag: string; rules: readonly unknown[]; dateText: string }) => {
    if (input.feedback) return deps.feedbackHtml(input.feedback);
    if (input.verdict === 'rej') return `<div class="alert rej"><b>⚠ ${deps.escape(input.tag)} vi phạm — ${deps.escape(input.rules.filter(Boolean).join(', '))}</b></div>`;
    if (input.verdict === 'warn') return `<div class="alert warn"><b>${deps.escape(input.tag)} cảnh báo — ${deps.escape(input.rules.filter(Boolean).join(', '))}</b></div>`;
    return `<div class="alert ok">✓ Đã lưu ${deps.escape(input.tag)} ngày ${deps.escape(input.dateText)}.</div>`;
  };
}
