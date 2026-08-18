export function createRangeActionsHtml(deps: { button: (label: string, action: string, cls?: string, title?: string) => string; canWrite: () => boolean }) {
  return (tid: string, level: number, eligible: boolean, applied?: string) => {
    let h = '';
    if (eligible) h += deps.button('Workflow dải QC', `openRangeWorkflow('${tid}',${level})`, 'teal sm', 'Xem điều kiện, dải đề xuất và phê duyệt');
    if (applied === 'lab' && deps.canWrite()) h += deps.button('↶', `revertRange('${tid}',${level})`, 'ghost icon', 'Về dải nhà sản xuất');
    return h ? `<div style="margin:8px 14px 0;display:flex;gap:6px;flex-wrap:wrap">${h}</div>` : '';
  };
}
