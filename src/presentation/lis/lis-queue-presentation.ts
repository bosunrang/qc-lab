type Row = Record<string, any>;

export function createLisQueuePresentation(deps: {
  test: (id: unknown) => Row | null | undefined;
  formatTestValue: (test: Row, value: unknown) => string;
  format: (value: unknown, decimals: number) => string;
  escape: (value: unknown) => string;
  formatDateTime: (value: unknown) => string;
  testDisplayName: (test: Row | null | undefined) => string;
  button: (label: string, action: string | { action: string; args?: unknown[] } | null, variant: string) => string;
  emptyState: (title: string, message: string, action: string) => string;
  modalCloseButton: (action?: string | { action: string; args?: unknown[] }) => string;
}) {
  const valueText = (record: Row): string => {
    const message = record.message || {}, resolved = record.resolved;
    const test = resolved && resolved.ok ? deps.test(resolved.qclabTestId) : null;
    const text = test ? deps.formatTestValue(test, message.value) : deps.format(message.value, 3);
    return text + (message.unit ? ' ' + deps.escape(message.unit) : '');
  };
  const onclick = (functionName: string, messageId: unknown): { action: string; args?: unknown[] } => ({ action: functionName, args: [messageId] });
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
    return `<div class="modal" style="width:820px"><div class="modal-h"><h3>QC chờ nhập từ LIS</h3>${deps.modalCloseButton({ action: 'closeModal' })}</div><div class="modal-b" tabindex="0">${body}</div><div class="modal-f">${deps.button('Làm mới', { action: 'lisQueueRefresh' }, 'ghost')}${deps.button('Đóng', { action: 'closeModal' }, 'ghost')}</div></div>`;
  };
  /* rowModel(): bản dữ liệu thuần của rowHtml() cho modal React (Giai đoạn 3,
     src/react/modals/LisQueueModal.tsx) — cùng logic phân nhánh resolved/chưa khớp,
     trả object thay vì chuỗi HTML. rowHtml/sectionHtml/modalHtml GIỮ NGUYÊN (không xóa):
     vẫn là nguồn duy nhất cho 3 hàm HTML gốc, dùng chung logic qua valueText(). */
  const rowModel = (record: Row) => {
    const message = record.message || {}, resolved = record.resolved;
    const when = deps.formatDateTime(message.measuredAt) || message.measuredAt || '—';
    const value = valueText(record);
    const runId = message.runId || '—';
    const operator = message.operator || '';
    const messageId = message.messageId;
    if (resolved && resolved.ok) {
      const test = deps.test(resolved.qclabTestId);
      const name = deps.testDisplayName(test) || resolved.displayName || resolved.qclabTestId;
      return { resolved: true as const, when, name, level: resolved.level, lot: resolved.lot || '—', value, runId, operator, messageId };
    }
    return { resolved: false as const, when, analyzerId: message.analyzerId, testCode: message.testCode, reason: (resolved && resolved.reason) || 'Chưa khớp cấu hình', value, runId, operator, messageId };
  };
  return { valueText, onclick, rowHtml, sectionHtml, modalHtml, rowModel };
}
