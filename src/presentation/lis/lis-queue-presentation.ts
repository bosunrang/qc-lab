type Row = Record<string, any>;

export function createLisQueuePresentation(deps: {
  test: (id: unknown) => Row | null | undefined;
  formatTestValue: (test: Row, value: unknown) => string;
  format: (value: unknown, decimals: number) => string;
  escape: (value: unknown) => string;
  escapeAttribute: (value: unknown) => string;
  quoteJs: (value: unknown) => string;
  formatDateTime: (value: unknown) => string;
  testDisplayName: (test: Row | null | undefined) => string;
  button: (label: string, action: string, variant: string) => string;
  emptyState: (title: string, message: string, action: string) => string;
  modalCloseButton: (action: string) => string;
}) {
  const valueText = (record: Row): string => {
    const message = record.message || {}, resolved = record.resolved;
    const test = resolved && resolved.ok ? deps.test(resolved.qclabTestId) : null;
    const text = test ? deps.formatTestValue(test, message.value) : deps.format(message.value, 3);
    return text + (message.unit ? ' ' + deps.escape(message.unit) : '');
  };
  const onclick = (functionName: string, messageId: unknown): string => deps.escapeAttribute(`${functionName}('${deps.quoteJs(messageId)}')`);
  const rowHtml = (record: Row): string => {
    const message = record.message || {}, resolved = record.resolved;
    const when = deps.formatDateTime(message.measuredAt) || message.measuredAt || '—';
    if (resolved && resolved.ok) {
      const test = deps.test(resolved.qclabTestId);
      const name = deps.testDisplayName(test) || resolved.displayName || resolved.qclabTestId;
      return `<tr><td>${deps.escape(when)}</td><td><b>${deps.escape(name)}</b><div class="hint">M${deps.escape(resolved.level)} · Lô ${deps.escape(resolved.lot || '—')}</div></td><td class="num">${valueText(record)}</td><td>${deps.escape(message.runId || '—')}${message.operator ? ' · ' + deps.escape(message.operator) : ''}</td><td class="acts">${deps.button('Nhận', onclick('lisQueueImport', message.messageId), 'teal sm')}${deps.button('Bỏ', onclick('lisQueueReject', message.messageId), 'ghost sm')}</td></tr>`;
    }
    return `<tr><td>${deps.escape(when)}</td><td><b>${deps.escape(message.analyzerId)}/${deps.escape(message.testCode)}</b><div class="hint">${deps.escape(resolved && resolved.reason || 'Chưa khớp cấu hình')}</div></td><td class="num">${valueText(record)}</td><td>${deps.escape(message.runId || '—')}${message.operator ? ' · ' + deps.escape(message.operator) : ''}</td><td class="acts">${deps.button('Bỏ', onclick('lisQueueReject', message.messageId), 'ghost sm')}</td></tr>`;
  };
  const sectionHtml = (title: string, records: Row[], emptyText: string): string => {
    if (!records.length) return `<h4>${deps.escape(title)}</h4><div class="hint">${deps.escape(emptyText)}</div>`;
    const rows = records.map(rowHtml).join('');
    return `<h4>${deps.escape(title)} (${records.length})</h4><div class="table-wrap"><table class="lis-queue-table"><thead><tr><th>Thời gian đo</th><th>Xét nghiệm</th><th class="num">Giá trị</th><th>Lần chạy · NV</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const modalHtml = (pending: Row[], unresolved: Row[]): string => {
    const body = pending.length || unresolved.length
      ? sectionHtml('Sẵn sàng nhận', pending, '') + (unresolved.length ? `<div class="flow-panel">${sectionHtml('Chưa khớp cấu hình', unresolved, '')}</div>` : '')
      : deps.emptyState('Hàng chờ trống', 'Không có kết quả QC nào đang chờ từ LIS Gateway.', '');
    return `<div class="modal" style="width:820px"><div class="modal-h"><h3>QC chờ nhập từ LIS</h3>${deps.modalCloseButton('closeModal()')}</div><div class="modal-b" tabindex="0">${body}</div><div class="modal-f">${deps.button('Làm mới', 'lisQueueRefresh()', 'ghost')}${deps.button('Đóng', 'closeModal()', 'ghost')}</div></div>`;
  };
  return { valueText, onclick, rowHtml, sectionHtml, modalHtml };
}
