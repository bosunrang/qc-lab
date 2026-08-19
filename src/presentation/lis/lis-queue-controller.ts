import type { LisSettingsInput, LisSettingsResult } from '../../application/lis/lis-settings-service';
import type { LisGatewayCommand } from '../../application/lis/lis-gateway-command';

type AnyRec = any;
type PullResult = { ok: boolean; pending?: number; unresolved?: number };

/**
 * Controller UI cho hàng chờ LIS Gateway — adapter DOM/dialog thuần.
 * Mọi đồng bộ/nhập dữ liệu nằm trong LISClientService/LisGatewayCommand (application),
 * mọi HTML nằm trong lis-queue-presentation (presentation). Controller chỉ đọc form,
 * mở modal/dialog và điều phối.
 */
export function createLisQueueController(deps: {
  document: Document;
  presentation: {
    valueText: (record: AnyRec) => string;
    onclick: (functionName: string, messageId: unknown) => string;
    rowHtml: (record: AnyRec) => string;
    sectionHtml: (title: string, records: AnyRec[], emptyText: string) => string;
    modalHtml: (pending: AnyRec[], unresolved: AnyRec[]) => string;
  };
  settingsService: { prepare: (input: LisSettingsInput) => LisSettingsResult };
  gatewayCommand: LisGatewayCommand;
  normalizeGatewayUrl: (value: unknown) => string;
  gatewayConfig: () => AnyRec;
  gatewayRuntime: () => AnyRec;
  gatewayPull: (opts?: AnyRec) => Promise<PullResult>;
  importResult: (messageId: unknown) => Promise<{ ok: boolean; error?: string }>;
  rejectResult: (messageId: unknown) => Promise<{ ok: boolean; error?: string }>;
  requireAdmin: (message?: string) => boolean;
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  confirmDialog: (opts: AnyRec) => Promise<boolean>;
  openModal: (html: string) => void;
}) {
  const field = (id: string) => deps.document.getElementById(id) as AnyRec;

  const lisGatewaySaveSettings = async () => {
    if (!deps.requireAdmin('Chỉ quản trị mới được cấu hình LIS Gateway.')) return;
    const enabled = !!field('lisGatewayEnabled').checked;
    const tokenEl = field('lisGatewayToken');
    const current = deps.gatewayConfig();
    const input: LisSettingsInput = { enabled, url: field('lisGatewayUrl').value, token: String((tokenEl && tokenEl.value) || ''), savedToken: current.token };
    const plan = deps.settingsService.prepare(input);
    const url = plan.ok ? plan.settings.url : deps.normalizeGatewayUrl(input.url);
    const token = plan.ok ? plan.settings.token : String(input.token).trim() || current.token;
    if ((!plan.ok && plan.error === 'invalid-url') || !url) { await deps.infoDialog('Prototype chỉ cho phép http://127.0.0.1:8787 hoặc http://localhost:8787.'); return; }
    if ((!plan.ok && plan.error === 'missing-token') || (enabled && !token)) { await deps.infoDialog('Cần dán Bearer token của Gateway. Token được in ra khi chạy npm run lis:gateway.'); return; }
    let outcome;
    try { outcome = await deps.gatewayCommand.apply(plan.ok ? plan.settings : { enabled, url, token }); }
    catch { await deps.infoDialog('Không lưu được cấu hình LIS Gateway trên máy này.'); return; }
    if (outcome.status === 'disabled') { await deps.infoDialog('Đã tắt nhận kết quả QC từ LIS trên máy này.', { type: 'success' }); return; }
    const result = outcome.result;
    if (result.ok) await deps.infoDialog(`Đã kết nối. ${result.pending} kết quả chờ nhận${result.unresolved ? `, ${result.unresolved} chưa khớp cấu hình mapping` : ''}.`, { type: 'success' });
  };

  const lisQueueValueText = (record: AnyRec) => deps.presentation.valueText(record);
  const lisOnclick = (functionName: string, messageId: unknown) => deps.presentation.onclick(functionName, messageId);
  const lisQueueRowHtml = (record: AnyRec) => deps.presentation.rowHtml(record);
  const lisQueueSectionHtml = (title: string, records: AnyRec[], emptyText: string) => deps.presentation.sectionHtml(title, records, emptyText);

  const lisRenderQueueModal = () => {
    const runtime = deps.gatewayRuntime();
    deps.openModal(deps.presentation.modalHtml(runtime.pending || [], runtime.unresolved || []));
  };

  const lisOpenQueueModal = async () => {
    if (!deps.gatewayConfig().enabled) { await deps.infoDialog('Hãy bật LIS Gateway và lưu cấu hình trước khi xem hàng chờ.', { type: 'warning' }); return; }
    const result = await deps.gatewayPull({ manual: true });
    if (!result.ok) return;
    lisRenderQueueModal();
  };

  const lisQueueRefresh = async () => { await deps.gatewayPull(); lisRenderQueueModal(); };

  const lisQueueImport = async (messageId: unknown) => { if ((await deps.importResult(messageId)).ok) lisRenderQueueModal(); };

  const lisQueueReject = async (messageId: unknown) => {
    if (!await deps.confirmDialog({ kicker: 'Hàng chờ LIS', title: 'Bỏ kết quả QC này?', message: 'Kết quả sẽ được đánh dấu đã bỏ ở Gateway và biến khỏi hàng chờ. Middleware có thể gửi lại nếu cần.', confirmLabel: 'Bỏ', cancelLabel: 'Hủy' })) return;
    if ((await deps.rejectResult(messageId)).ok) lisRenderQueueModal();
  };

  return { lisGatewaySaveSettings, lisQueueValueText, lisOnclick, lisQueueRowHtml, lisQueueSectionHtml, lisRenderQueueModal, lisOpenQueueModal, lisQueueRefresh, lisQueueImport, lisQueueReject };
}
