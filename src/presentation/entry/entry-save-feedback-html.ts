type EntrySaveFeedback = { cls: string; emphasis: boolean; message: string } | null;

export function createEntrySaveFeedbackHtml(deps: { escape: (value: unknown) => string }) {
  return (feedback: EntrySaveFeedback) => {
    if (!feedback) return '';
    const message = deps.escape(feedback.message);
    return `<div class="alert ${deps.escape(feedback.cls)}">${feedback.emphasis ? `<b>${message}</b>` : message}</div>`;
  };
}
