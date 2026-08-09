type AnyRecord = Record<string, any>;

export const LIS_GATEWAY_STORAGE_KEY = 'qclab_lis_gateway';
export const LIS_POLL_MS = 5 * 60 * 1000;

export type LisGatewayRuntime = {
  status: string;
  detail: string;
  lastPull: string;
  pollT: unknown;
  running: boolean;
  pending: AnyRecord[];
  unresolved: AnyRecord[];
  lastError: string;
};

export function createLisGatewayRuntime(): LisGatewayRuntime {
  return { status: 'idle', detail: 'Chưa bật', lastPull: '', pollT: null, running: false,
    pending: [], unresolved: [], lastError: '' };
}

type GatewayConfig = { enabled: boolean; url: string; token: string };
type GatewayResponse = { ok: boolean; status: number; json: () => Promise<any> };
type AbortHandle = { abort: () => void; signal: unknown };

export type LisClientDependencies = {
  runtime: LisGatewayRuntime;
  storage: { getItem: (key: string) => string | null; };
  fetch: (url: string, options: AnyRecord) => Promise<GatewayResponse>;
  makeUrl: (value: string) => { origin: string };
  createAbortController: () => AbortHandle;
  setTimeout: (callback: () => void, milliseconds: number) => unknown;
  clearTimeout: (timer: unknown) => void;
  setInterval: (callback: () => void, milliseconds: number) => unknown;
  clearInterval: (timer: unknown) => void;
  nowIso: () => string;
  formatDateTime: (value: string) => string;
  renderStatus: () => void;
  notify: (message: string, options?: AnyRecord) => Promise<unknown>;
  requireWrite: () => boolean;
  getState: () => AnyRecord;
  levelConfig: (test: AnyRecord, level: unknown) => AnyRecord;
  recordPoint: (state: AnyRecord, input: AnyRecord) => AnyRecord;
  log: (action: string, detail: string, target?: string) => void;
  save: (options: AnyRecord) => void;
  userName: () => string;
  formatNumber: (value: unknown, decimals?: number) => string;
  rerender: () => void;
};

export function createLisClient(deps: LisClientDependencies) {
  const { runtime } = deps;
  const allowedOrigins = ['http://127.0.0.1:8787', 'http://localhost:8787'];

  function normalizeGatewayUrl(value: unknown) {
    try {
      const url = deps.makeUrl(String(value || '').trim());
      return allowedOrigins.includes(url.origin) ? url.origin : '';
    } catch { return ''; }
  }
  function gatewayConfig(): GatewayConfig {
    try {
      const saved = JSON.parse(deps.storage.getItem(LIS_GATEWAY_STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        return { enabled: saved.enabled === true, url: normalizeGatewayUrl(saved.url) || 'http://127.0.0.1:8787', token: String(saved.token || '') };
      }
    } catch { /* cấu hình hỏng thì dùng trạng thái tắt an toàn */ }
    return { enabled: false, url: 'http://127.0.0.1:8787', token: '' };
  }
  function statusText() {
    const label: Record<string, string> = { idle: 'Chưa kiểm tra', off: 'Đang tắt', syncing: 'Đang kiểm tra', ok: 'Đã kết nối', error: 'Lỗi kết nối' };
    return (label[runtime.status] || runtime.status) + (runtime.detail ? ' · ' + runtime.detail : '')
      + (runtime.lastPull ? ' · ' + deps.formatDateTime(runtime.lastPull) : '');
  }
  function setStatus(status: string, detail?: string) {
    runtime.status = status; runtime.detail = detail || ''; deps.renderStatus();
  }
  async function gatewayFetch(path: string, options: AnyRecord = {}) {
    const config = gatewayConfig(), controller = deps.createAbortController();
    const timer = deps.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await deps.fetch(config.url + path, {
        ...options, signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(config.token ? { authorization: 'Bearer ' + config.token } : {}), ...(options.headers || {}) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 401
        ? 'Token không đúng hoặc chưa nhập. Xem token in ra khi chạy npm run lis:gateway.'
        : (body.message || `HTTP ${response.status}`));
      return body;
    } finally { deps.clearTimeout(timer); }
  }
  async function gatewayHealth() {
    const body = await gatewayFetch('/health');
    if (!body || body.ok !== true) throw new Error('Gateway không trả trạng thái hợp lệ.');
    return body;
  }
  async function pull(options: AnyRecord = {}) {
    const config = gatewayConfig(); if (!config.enabled) return { ok: false, skipped: true };
    if (runtime.running) return { ok: false, busy: true };
    runtime.running = true; setStatus('syncing', 'Đang lấy hàng chờ');
    try {
      await gatewayHealth();
      const body = await gatewayFetch('/api/v1/qc-results?status=pending&limit=500');
      const items = Array.isArray(body && body.items) ? body.items : [];
      runtime.pending = items.filter((item: AnyRecord) => item && item.resolved && item.resolved.ok);
      runtime.unresolved = items.filter((item: AnyRecord) => !(item && item.resolved && item.resolved.ok));
      runtime.lastPull = deps.nowIso(); runtime.lastError = '';
      setStatus('ok', `${runtime.pending.length} chờ nhận${runtime.unresolved.length ? ` · ${runtime.unresolved.length} chưa khớp cấu hình` : ''}`);
      return { ok: true, pending: runtime.pending.length, unresolved: runtime.unresolved.length };
    } catch (error) {
      const caught = error as { name?: string; message?: string };
      const detail = caught && caught.name === 'AbortError' ? 'Gateway không phản hồi' : (caught && caught.message || 'Lỗi không xác định');
      runtime.lastError = detail; setStatus('error', detail);
      if (options.manual) await deps.notify('Không lấy được kết quả QC từ Gateway:\n' + detail);
      return { ok: false, error: detail };
    } finally { runtime.running = false; }
  }
  function resultToPointInput(record: AnyRecord) {
    const message = record && record.message || {}, resolved = record && record.resolved || {};
    const measured = new Date(message.measuredAt || '');
    if (!Number.isFinite(measured.getTime())) return null;
    const date = `${measured.getFullYear()}-${String(measured.getMonth() + 1).padStart(2, '0')}-${String(measured.getDate()).padStart(2, '0')}`;
    return { tid: resolved.qclabTestId, level: resolved.level, date, value: message.value,
      runId: message.runId || '', staff: message.operator || '', lot: resolved.lot || '' };
  }
  async function importResult(messageId: string) {
    if (!deps.requireWrite()) return { ok: false };
    const record = (runtime.pending || []).find(item => item && item.message && item.message.messageId === messageId);
    if (!record) return { ok: false, error: 'not-found' };
    const input = resultToPointInput(record);
    if (!input || !input.tid || !input.level) return { ok: false, error: 'invalid-record' };
    const state = deps.getState(), test = (state.tests || []).find((item: AnyRecord) => item.id === input.tid);
    const saved = deps.recordPoint(state, { ...input, cfg: deps.levelConfig(test, input.level) });
    if (!saved.ok) {
      await deps.notify(saved.error === 'period-locked' ? 'Kỳ này đã chốt, không thể nhận thêm điểm QC.' : 'Không ghi được điểm QC: ' + saved.error);
      return { ok: false, error: saved.error };
    }
    deps.log('Nhận QC từ LIS', `${input.date} · M${input.level} · ${deps.formatNumber(input.value)}${input.runId ? ' · ' + input.runId : ''}`, test && test.name || '');
    deps.save({ testId: input.tid });
    try { await gatewayFetch('/api/v1/qc-results/decide', { method: 'POST', body: JSON.stringify({ messageId, status: 'imported', by: deps.userName() }) }); }
    catch (error) {
      const caught = error as { message?: string };
      await deps.notify('Đã ghi điểm QC nhưng chưa báo được về Gateway:\n' + (caught && caught.message || '') + '\nBản ghi sẽ còn trong hàng chờ, hãy kiểm tra lại trước khi nhận lần nữa.');
    }
    await pull(); deps.rerender();
    return { ok: true, point: saved.point };
  }
  async function rejectResult(messageId: string, note?: string) {
    if (!deps.requireWrite()) return { ok: false };
    try { await gatewayFetch('/api/v1/qc-results/decide', { method: 'POST', body: JSON.stringify({ messageId, status: 'rejected', by: deps.userName(), note: note || '' }) }); }
    catch (error) {
      const caught = error as { message?: string };
      await deps.notify('Không bỏ được bản ghi:\n' + (caught && caught.message || '')); return { ok: false };
    }
    deps.log('Bỏ kết quả QC từ LIS', `${messageId}${note ? ' · ' + note : ''}`, 'LIS');
    await pull(); deps.rerender();
    return { ok: true };
  }
  function start() {
    deps.clearInterval(runtime.pollT); runtime.pollT = null;
    if (!gatewayConfig().enabled) { setStatus('off', 'Chưa bật'); return; }
    void pull();
    runtime.pollT = deps.setInterval(() => { if (!runtime.running) void pull(); }, LIS_POLL_MS);
  }

  return Object.freeze({ runtime, gatewayConfig, normalizeGatewayUrl, statusText, setStatus, gatewayFetch,
    gatewayHealth, pull, resultToPointInput, importResult, rejectResult, start });
}

export type LisClientApi = ReturnType<typeof createLisClient>;
