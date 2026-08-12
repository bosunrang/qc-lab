export function createActionApprovalTagHtml(deps: { escape: (value: unknown) => string }) {
  return (view: { cls: string }, label: string) => `<span class="tag ${view.cls}">${deps.escape(label)}</span>`;
}
