import type { Db } from '../db/sqlite-like';
import type { QcApi } from '../../shared/qc-api';
import { createEntryHandlers } from './entry-handlers';
import {
  DEFAULT_LIS_GATEWAY_SETTINGS, normalizeGatewayUrl, resultToPointInput,
  lisGatewayKey, lisMessageFingerprint, lisText,
  type LisGatewaySettings, type LisQueueRecord, type LisPointInput,
} from '../domain/lis-client';
import { type Actor, type IpcResult, nowIso, requireWrite } from './shared';
import { writeCommand, writeCommandAsync } from './write-command';
import { uid } from '../domain/text-utils';
import { listParallelColumns } from './parallel-columns';

const APP_META_KEY = 'lisGatewaySettings';
const FETCH_TIMEOUT_MS = 8000;
const ACK_RETRY_LIMIT = 20;
const QUEUE_PAGE_SIZE = 500;
const QUEUE_MAX_PAGES = 20;

interface LisImportReceipt {
  id: string; gateway_origin: string; message_id: string; point_id: string;
  record_json: string; imported_by: string; acknowledged_at: string;
}
type ImportOutcome = Extract<Awaited<ReturnType<QcApi['importLisResult']>>, { ok: true }>['data'];

function readSettings(db: Db): LisGatewaySettings {
  const row = db.prepare("SELECT value FROM app_meta WHERE key=?").get(APP_META_KEY) as { value: string } | undefined;
  if (!row) return DEFAULT_LIS_GATEWAY_SETTINGS;
  try {
    const parsed = JSON.parse(row.value);
    return {
      enabled: parsed.enabled === true,
      url: normalizeGatewayUrl(parsed.url) || DEFAULT_LIS_GATEWAY_SETTINGS.url,
      token: typeof parsed.token === 'string' ? parsed.token : '',
    };
  } catch {
    return DEFAULT_LIS_GATEWAY_SETTINGS;
  }
}

async function gatewayFetch(settings: LisGatewaySettings, path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(settings.url + path, {
      method: init.method || 'GET',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(settings.token ? { authorization: `Bearer ${settings.token}` } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new Error('Token Gateway sai hoặc chưa nhập.');
      throw new Error(body && body.message ? body.message : `HTTP ${res.status}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Hàng chờ `pending` của Gateway — nguồn duy nhất của bản ghi LIS. Đọc hết
 * các trang theo `nextCursor`: bản tin chưa ánh xạ vẫn ở trạng thái chờ, nếu
 * chỉ đọc trang đầu thì chúng chiếm chỗ và che mất bản tin hợp lệ mới hơn. */
async function fetchPending(settings: LisGatewaySettings): Promise<LisQueueRecord[]> {
  const items: LisQueueRecord[] = [];
  let after = '';
  for (let page = 0; page < QUEUE_MAX_PAGES; page++) {
    const body = await gatewayFetch(settings, `/api/v1/qc-results?status=pending&limit=${QUEUE_PAGE_SIZE}${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    if (Array.isArray(body.items)) items.push(...body.items.filter((item: LisQueueRecord | null) => item && typeof item === 'object' && item.message && typeof item.message === 'object'));
    // Gateway giả lập cũ không trả `nextCursor`; khi đó chỉ có một trang.
    const next = typeof body.nextCursor === 'string' ? body.nextCursor : '';
    if (!next || next === after) break;
    after = next;
  }
  return items;
}

/** Chuỗi gửi sang Gateway: một dòng, không ký tự điều khiển, không quá `max`
 * (Gateway từ chối cả lô nếu sai, khiến điểm đã lưu không xác nhận được).
 * Người quyết định tối đa 200 ký tự như họ tên trong QC Lab. */
function gatewayText(value: unknown, max: number): string {
  let out = '';
  // Cắt theo ký tự Unicode để không tách đôi cặp surrogate; Gateway đo theo độ dài chuỗi JS.
  for (const ch of String(value || '').replace(/[\u0000-\u001f\u007f-\u009f]+/gu, ' ').replace(/\s+/gu, ' ').trim()) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out.trim();
}
const gatewayActorName = (name: string) => gatewayText(name, 200) || 'QC Lab';

export function createLisHandlers(db: Db) {
  function receiptOf(settings: LisGatewaySettings, messageId: string): LisImportReceipt | undefined {
    return db.prepare('SELECT * FROM lis_imports WHERE gateway_origin=? AND message_id=?')
      .get(lisGatewayKey(settings.url), messageId) as LisImportReceipt | undefined;
  }

  function sameSource(receipt: LisImportReceipt, record: LisQueueRecord): boolean {
    try { return lisMessageFingerprint(JSON.parse(receipt.record_json)) === lisMessageFingerprint(record); }
    catch { return false; }
  }

  /** Dấu vết đã nhận cùng bản tin GỐC (nguồn + mã của LIS) dưới một mã Gateway
   * khác. Xảy ra khi Gateway được phục hồi từ bản sao lưu cũ rồi LIS gửi lại:
   * Gateway cấp UUID mới, chỉ chống trùng theo UUID sẽ tạo thêm điểm QC. */
  function receiptOfSource(settings: LisGatewaySettings, record: LisQueueRecord): LisImportReceipt | undefined {
    const sourceId = lisText(record.source?.sourceId), sourceMessageId = lisText(record.source?.messageId);
    if (!sourceId || !sourceMessageId) return undefined;
    return db.prepare(`SELECT * FROM lis_imports WHERE gateway_origin=? AND message_id<>?
      AND CASE WHEN json_valid(record_json) THEN json_extract(record_json,'$.source.sourceId') END=?
      AND CASE WHEN json_valid(record_json) THEN json_extract(record_json,'$.source.messageId') END=? LIMIT 1`)
      .get(lisGatewayKey(settings.url), lisText(record.message.messageId), sourceId, sourceMessageId) as LisImportReceipt | undefined;
  }
  const duplicateSourceReason = (record: LisQueueRecord) => `Bản tin gốc ${record.source?.messageId} của nguồn ${record.source?.sourceId} đã được nhận thành điểm QC dưới mã Gateway khác (thường do phục hồi Gateway từ bản sao lưu). Không nhận lại; đối chiếu rồi Bỏ bản tin này.`;

  function prepareRecord(record: LisQueueRecord): IpcResult<LisPointInput> {
    const point = resultToPointInput(record);
    if (!point) return { ok: false, error: { code: 'invalid-record', message: 'Bản tin LIS thiếu hoặc sai giá trị đo, lô đã ánh xạ, đơn vị, mức QC hoặc thời điểm đo. Không tự điền giá trị 0 hay chọn lô thay thế.' } };
    const test = db.prepare('SELECT unit FROM tests WHERE id=?').get(point.testId) as { unit: string } | undefined;
    if (!test) return { ok: false, error: { code: 'missing-test', message: 'Không còn xét nghiệm được ánh xạ từ LIS.' } };
    if (!lisText(test.unit) || lisText(test.unit) !== point.unit) {
      return { ok: false, error: { code: 'lis-unit-mismatch', message: `Đơn vị LIS (${point.unit}) không khớp đơn vị xét nghiệm (${test.unit || 'chưa khai'}). Kiểm tra ánh xạ; phần mềm không tự quy đổi giá trị.` } };
    }
    const current = db.prepare(`SELECT q.lot_no FROM test_levels l JOIN qc_lots q ON q.id=l.qc_lot_id
      WHERE l.test_id=? AND l.level=?`).get(point.testId, point.level) as { lot_no: string } | undefined;
    if (current?.lot_no !== point.lotNo && !listParallelColumns(db, point.testId).some((column) => column.level === point.level && column.lot === point.lotNo)) {
      return { ok: false, error: { code: 'lis-lot-mismatch', message: `Lô LIS (${point.lotNo}) không phải lô đang dùng hoặc lô song song hợp lệ của mức QC này. Kiểm tra ánh xạ lô trước khi nhận.` } };
    }
    return { ok: true, data: point };
  }

  const confirmReceipt = writeCommand(db, 'confirmLisReceipt', 'write', (w, receipt: LisImportReceipt): IpcResult<ImportOutcome> => {
    const current = db.prepare('SELECT acknowledged_at FROM lis_imports WHERE id=?').get(receipt.id) as { acknowledged_at: string } | undefined;
    if (!current) return { ok: false, error: { code: 'missing-receipt', message: 'Không còn dấu vết bản tin LIS đã nhận.' } };
    if (current.acknowledged_at) return w.noChange({ pointId: receipt.point_id });
    w.commit((tx) => {
      db.prepare('UPDATE lis_imports SET acknowledged_at=? WHERE id=?').run(nowIso(), receipt.id);
      tx.audit('Xác nhận nhận QC với LIS', `Bản tin ${receipt.message_id}`, receipt.point_id);
      tx.changed(['lis_imports']);
    });
    return { ok: true, data: { pointId: receipt.point_id } };
  });

  function pendingAcknowledgement(receipt: LisImportReceipt, error: unknown): IpcResult<ImportOutcome> {
    return { ok: true, data: { pointId: receipt.point_id,
      gatewayWarning: `Điểm QC đã được lưu, chưa xác nhận được với Gateway (${error instanceof Error ? error.message : 'lỗi kết nối'}). Mã bản tin đã được giữ; nhận lại hoặc làm mới hàng chờ sẽ thử xác nhận lại và không tạo thêm điểm QC.` } };
  }

  async function acknowledge(settings: LisGatewaySettings, receipt: LisImportReceipt, actor: Actor): Promise<IpcResult<ImportOutcome>> {
    try {
      await gatewayFetch(settings, '/api/v1/qc-results/decide', { method: 'POST', body: { messageId: receipt.message_id, status: 'imported', by: gatewayActorName(receipt.imported_by) } });
      const confirmed = confirmReceipt(receipt, actor);
      return confirmed.ok ? confirmed : pendingAcknowledgement(receipt, new Error(confirmed.error.message));
    } catch (error) { return pendingAcknowledgement(receipt, error); }
  }

  /** Token Gateway là bí mật: chỉ quản trị viên (người cấu hình) nhận được.
   * Trước đây kênh này trả cả token mà không cần đăng nhập. */
  function getSettings(actor: Actor): LisGatewaySettings {
    const settings = readSettings(db);
    return actor.role === 'admin' ? settings : { ...settings, token: '' };
  }

  const adminOnly = (actor: Actor) => (actor.role === 'admin' ? null : { ok: false as const, error: { code: 'forbidden', message: 'Chỉ quản trị viên mới được cấu hình LIS Gateway.' } });
  const saveSettings = writeCommand(db, 'saveSettings', adminOnly, (w, input: { data: { enabled: boolean; url: string; token: string } }): IpcResult<LisGatewaySettings> => {
    const url = normalizeGatewayUrl(input.data.url);
    if (input.data.enabled && !url) {
      return { ok: false, error: { code: 'invalid-url', message: 'Địa chỉ Gateway không hợp lệ — chỉ chấp nhận http://127.0.0.1:8787 hoặc http://localhost:8787.' } };
    }
    const settings: LisGatewaySettings = { enabled: input.data.enabled === true, url: url || DEFAULT_LIS_GATEWAY_SETTINGS.url, token: String(input.data.token || '') };
    w.commit((tx) => {
      db.prepare("INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(APP_META_KEY, JSON.stringify(settings));
      tx.audit('Cấu hình LIS Gateway', settings.enabled ? `Bật, url=${settings.url}` : 'Tắt', '');
      // Trước đây thiếu lời báo này: trang đang mở không biết cấu hình LIS đã đổi.
      tx.changed(['app_meta']);
    });
    return { ok: true, data: settings };
  });

  async function pullQueue(actor: Actor): Promise<IpcResult<{ pending: LisQueueRecord[]; unresolved: LisQueueRecord[] }>> {
    const denied = requireWrite(actor);
    if (denied) return denied;
    const settings = readSettings(db);
    if (!settings.enabled) return { ok: false, error: { code: 'disabled', message: 'LIS Gateway chưa được bật.' } };
    try {
      await gatewayFetch(settings, '/health');
      const items = await fetchPending(settings);
      const completed = new Set<string>();
      // Sự cố sau commit được phục hồi ngay từ hàng chờ, kể cả sau khi mở
      // lại app. Giới hạn số yêu cầu đồng thời để không làm nghẽn Gateway.
      const retries = items.flatMap((record) => {
        const receipt = receiptOf(settings, lisText(record.message.messageId));
        return receipt && sameSource(receipt, record) ? [{ record, receipt }] : [];
      }).slice(0, ACK_RETRY_LIMIT);
      await Promise.all(retries.map(async ({ record, receipt }) => {
        const result = await acknowledge(settings, receipt, actor);
        if (result.ok && !result.data.gatewayWarning) completed.add(record.message.messageId);
      }));
      const pending: LisQueueRecord[] = [], unresolved: LisQueueRecord[] = [];
      for (const record of items) {
        if (completed.has(record.message.messageId)) continue;
        const receipt = receiptOf(settings, lisText(record.message.messageId));
        if (!receipt && receiptOfSource(settings, record)) {
          unresolved.push({ ...record, resolved: { ...record.resolved, ok: false, reason: duplicateSourceReason(record), code: 'DUPLICATE_SOURCE' } });
          continue;
        }
        if (!receipt && record.resolved?.ok !== true) { unresolved.push(record); continue; }
        const prepared = receipt ? null : prepareRecord(record);
        const reason = receipt && !sameSource(receipt, record) ? 'Mã bản tin LIS đã nhận nhưng nội dung nguồn đã thay đổi. Cần đối chiếu tại Gateway.'
          : prepared && !prepared.ok ? prepared.error.message : '';
        if (reason) unresolved.push({ ...record, resolved: { ...record.resolved, ok: false, reason, code: 'INVALID_IMPORT' } });
        else (record.resolved?.ok || receipt ? pending : unresolved).push(record);
      }
      return { ok: true, data: { pending, unresolved } };
    } catch (e) {
      return { ok: false, error: { code: 'gateway-error', message: e instanceof Error ? e.message : 'Không kết nối được LIS Gateway.' } };
    }
  }

  /** Điểm QC và dấu vết nguồn cùng commit; mọi lượt nhận lại chỉ gửi xác nhận. */
  async function importResult(input: { data: { record: LisQueueRecord } }, actor: Actor): Promise<IpcResult<ImportOutcome>> {
    const denied = requireWrite(actor);
    if (denied) return denied;
    // Không tin bản ghi client gửi lên (A10): máy trạm sửa được giá trị, ngày
    // hay xét nghiệm trước khi gửi. Chỉ lấy `messageId`, rồi đọc lại bản ghi
    // từ hàng chờ của Gateway. Bản ghi đã nhận hoặc đã bỏ ở máy khác thì không
    // còn trong hàng chờ, nên cũng không nhận trùng được.
    const messageId = lisText(input?.data?.record?.message?.messageId);
    if (!messageId || messageId.length > 200) return { ok: false, error: { code: 'invalid-record', message: 'Mã bản tin LIS phải có từ 1 đến 200 ký tự.' } };
    const settings = readSettings(db);
    if (!settings.enabled) return { ok: false, error: { code: 'disabled', message: 'LIS Gateway chưa được bật.' } };
    let receipt = receiptOf(settings, messageId);
    if (receipt?.acknowledged_at) return { ok: true, data: { pointId: receipt.point_id } };
    let record: LisQueueRecord | undefined;
    try {
      record = (await fetchPending(settings)).find((item) => item?.message?.messageId === messageId);
    } catch (e) {
      if (receipt) return pendingAcknowledgement(receipt, e);
      return { ok: false, error: { code: 'gateway-error', message: e instanceof Error ? e.message : 'Không kết nối được LIS Gateway.' } };
    }
    // Yêu cầu khác có thể đã nhận cùng bản tin trong lúc chờ mạng.
    receipt = receiptOf(settings, messageId);
    if (receipt) {
      if (record && !sameSource(receipt, record)) return { ok: false, error: { code: 'lis-message-conflict', message: 'Mã bản tin LIS đã được dùng cho nội dung đo khác. Điểm đã nhận được giữ nguyên; cần đối chiếu tại Gateway.' } };
      return acknowledge(settings, receipt, actor);
    }
    if (!record) return { ok: false, error: { code: 'not-pending', message: 'Kết quả này không còn trong hàng chờ của Gateway (có thể đã được nhận hoặc bỏ ở máy khác). Tải lại hàng chờ.' } };
    // Không có await nào từ đây tới lúc ghi điểm, nên kiểm tra này không bị chen ngang.
    if (receiptOfSource(settings, record)) return { ok: false, error: { code: 'lis-duplicate-source', message: duplicateSourceReason(record) } };
    const prepared = prepareRecord(record);
    if (!prepared.ok) return prepared;
    const pointInput = prepared.data;
    const sourceRecord = record;
    const entry = createEntryHandlers(db, { onPointAdded(pointId, tx) {
      db.prepare(`INSERT INTO lis_imports(id,gateway_origin,message_id,point_id,record_json,imported_at,imported_by)
        VALUES (?,?,?,?,?,?,?)`).run(uid(), lisGatewayKey(settings.url), messageId, pointId, JSON.stringify(sourceRecord), nowIso(), actor.name);
      tx.audit('Nhận QC từ LIS', `Bản tin ${messageId} · lô ${pointInput.lotNo} · đơn vị ${pointInput.unit}`, pointId);
      tx.changed(['lis_imports'], [pointInput.testId]);
    } });
    const saved = entry.addPoint({ data: pointInput }, actor);
    if (!saved.ok) return { ok: false, error: saved.error };
    return acknowledge(settings, receiptOf(settings, messageId)!, actor);
  }

  // Bỏ một kết quả là quyết định về dữ liệu QC: cùng mức quyền với nhận kết
  // quả. Trước đây vai trò chỉ-xem cũng bỏ được.
  const rejectResult = writeCommandAsync(db, 'rejectResult', 'write', async (w, input: { data: { messageId: string; note?: string } }): Promise<IpcResult<{ messageId: string }>> => {
    const actor = w.actor;
    const settings = readSettings(db);
    if (!settings.enabled) return { ok: false, error: { code: 'disabled', message: 'LIS Gateway chưa được bật.' } };
    if (receiptOf(settings, lisText(input?.data?.messageId))) return { ok: false, error: { code: 'already-imported', message: 'Bản tin này đã được ghi thành điểm QC. Dùng Nhận hoặc Làm mới để gửi lại xác nhận; không bỏ bản tin đã nhận.' } };
    try {
      await gatewayFetch(settings, '/api/v1/qc-results/decide', { method: 'POST', body: { messageId: input.data.messageId, status: 'rejected', by: gatewayActorName(actor.name), note: gatewayText(input.data.note, 1000) } });
    } catch (e) {
      return { ok: false, error: { code: 'gateway-error', message: e instanceof Error ? e.message : 'Không kết nối được LIS Gateway.' } };
    }
    // Dữ liệu QC không đổi (kết quả bị bỏ nằm ở Gateway); chỉ nhật ký ghi lại quyết định.
    w.commit((tx) => {
      tx.audit('Bỏ kết quả QC từ LIS', input.data.note || '', '');
      tx.changed(['activity']);
    });
    return { ok: true, data: { messageId: input.data.messageId } };
  });

  return { getSettings, saveSettings, pullQueue, importResult, rejectResult };
}

export type LisHandlers = ReturnType<typeof createLisHandlers>;


