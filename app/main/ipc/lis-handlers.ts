import type { Db } from '../db/sqlite-like';
import { createEntryHandlers } from './entry-handlers';
import {
  DEFAULT_LIS_GATEWAY_SETTINGS, normalizeGatewayUrl, resultToPointInput,
  type LisGatewaySettings, type LisQueueRecord,
} from '../domain/lis-client';
import { type Actor, type IpcResult, writeAudit } from './shared';

const APP_META_KEY = 'lisGatewaySettings';
const FETCH_TIMEOUT_MS = 8000;

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

export function createLisHandlers(db: Db) {
  const entry = createEntryHandlers(db);

  function getSettings(): LisGatewaySettings {
    return readSettings(db);
  }

  function saveSettings(input: { data: { enabled: boolean; url: string; token: string } }, actor: Actor): IpcResult<LisGatewaySettings> {
    if (actor.role !== 'admin') return { ok: false, error: { code: 'forbidden', message: 'Chỉ quản trị viên mới được cấu hình LIS Gateway.' } };
    const url = normalizeGatewayUrl(input.data.url);
    if (input.data.enabled && !url) {
      return { ok: false, error: { code: 'invalid-url', message: 'Địa chỉ Gateway không hợp lệ — chỉ chấp nhận http://127.0.0.1:8787 hoặc http://localhost:8787.' } };
    }
    const settings: LisGatewaySettings = { enabled: input.data.enabled === true, url: url || DEFAULT_LIS_GATEWAY_SETTINGS.url, token: String(input.data.token || '') };
    db.prepare("INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(APP_META_KEY, JSON.stringify(settings));
    writeAudit(db, actor, 'Cấu hình LIS Gateway', settings.enabled ? `Bật, url=${settings.url}` : 'Tắt', '');
    return { ok: true, data: settings };
  }

  async function pullQueue(): Promise<IpcResult<{ pending: LisQueueRecord[]; unresolved: LisQueueRecord[] }>> {
    const settings = readSettings(db);
    if (!settings.enabled) return { ok: false, error: { code: 'disabled', message: 'LIS Gateway chưa được bật.' } };
    try {
      await gatewayFetch(settings, '/health');
      const body = await gatewayFetch(settings, '/api/v1/qc-results?status=pending&limit=500');
      const items: LisQueueRecord[] = Array.isArray(body.items) ? body.items : [];
      const pending = items.filter((it) => it.resolved && it.resolved.ok);
      const unresolved = items.filter((it) => !it.resolved || !it.resolved.ok);
      return { ok: true, data: { pending, unresolved } };
    } catch (e) {
      return { ok: false, error: { code: 'gateway-error', message: e instanceof Error ? e.message : 'Không kết nối được LIS Gateway.' } };
    }
  }

  /** Ghi điểm QC cục bộ TRƯỚC, chỉ báo gateway 'imported' SAU KHI ghi thành
   * công — nếu ghi thất bại (vd kỳ đã khoá) thì KHÔNG được gọi gateway, bản
   * ghi vẫn còn 'pending' trong hàng chờ (không mất, không báo sai). Nếu ghi
   * thành công nhưng gọi gateway thất bại, điểm QC VẪN GIỮ NGUYÊN (không
   * rollback) — chỉ báo lỗi để người dùng biết chưa cập nhật gateway, tránh
   * nhận trùng lần sau. */
  async function importResult(input: { data: { record: LisQueueRecord } }, actor: Actor): Promise<IpcResult<{ pointId: string; gatewayWarning?: string }>> {
    const record = input.data.record;
    const pointInput = resultToPointInput(record);
    if (!pointInput) return { ok: false, error: { code: 'invalid-record', message: 'Bản ghi LIS thiếu dữ liệu hợp lệ (chưa khớp cấu hình hoặc measuredAt sai).' } };
    const saved = entry.addPoint({ data: pointInput }, actor);
    if (!saved.ok) return { ok: false, error: saved.error };
    // Điểm QC đã ghi thành công — từ đây trở đi LUÔN trả ok:true (không được
    // "hoàn tác"/báo thất bại chỉ vì bước báo gateway lỗi); nếu gọi gateway
    // thất bại chỉ đính kèm cảnh báo để renderer hiện cho người dùng, đồng
    // thời bản ghi vẫn còn 'pending' phía gateway (chưa được báo 'imported')
    // — người dùng cần biết để không vô tình nhận lại gây trùng điểm.
    const settings = readSettings(db);
    try {
      await gatewayFetch(settings, '/api/v1/qc-results/decide', { method: 'POST', body: { messageId: record.message.messageId, status: 'imported', by: actor.name } });
    } catch (e) {
      return {
        ok: true,
        data: {
          pointId: saved.data.id,
          gatewayWarning: `Đã ghi điểm QC nhưng chưa báo được về Gateway (${e instanceof Error ? e.message : 'lỗi mạng'}). Bản ghi sẽ còn trong hàng chờ — kiểm tra kỹ trước khi nhận lại lần sau, tránh trùng điểm.`,
        },
      };
    }
    return { ok: true, data: { pointId: saved.data.id } };
  }

  async function rejectResult(input: { data: { messageId: string; note?: string } }, actor: Actor): Promise<IpcResult<{ messageId: string }>> {
    const settings = readSettings(db);
    try {
      await gatewayFetch(settings, '/api/v1/qc-results/decide', { method: 'POST', body: { messageId: input.data.messageId, status: 'rejected', by: actor.name, note: input.data.note || '' } });
    } catch (e) {
      return { ok: false, error: { code: 'gateway-error', message: e instanceof Error ? e.message : 'Không kết nối được LIS Gateway.' } };
    }
    writeAudit(db, actor, 'Bỏ kết quả QC từ LIS', input.data.note || '', '');
    return { ok: true, data: { messageId: input.data.messageId } };
  }

  return { getSettings, saveSettings, pullQueue, importResult, rejectResult };
}

export type LisHandlers = ReturnType<typeof createLisHandlers>;


