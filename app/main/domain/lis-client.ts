export const LIS_GATEWAY_ALLOWED_ORIGINS = ['http://127.0.0.1:8787', 'http://localhost:8787'];

import type { LisGatewaySettings, LisQueueRecord } from '../../shared/qc-api';
import { parseQcValue } from './entry-validation';

export type { LisGatewaySettings, LisQueueRecord } from '../../shared/qc-api';

export const DEFAULT_LIS_GATEWAY_SETTINGS: LisGatewaySettings = { enabled: false, url: 'http://127.0.0.1:8787', token: '' };


export function normalizeGatewayUrl(value: unknown): string {
  try {
    const url = new URL(String(value || ''));
    return LIS_GATEWAY_ALLOWED_ORIGINS.includes(url.origin) ? url.origin : '';
  } catch {
    return '';
  }
}

export interface LisPointInput { testId: string; level: number; date: string; val: number; runId: string; operatorName: string; lotNo: string; unit: string }

/** Chỉ bỏ khoảng trắng ngoài cùng; không tự đổi đơn vị hoặc đoán mã lô. */
export function lisText(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }

/** Hai tên loopback trỏ cùng Gateway, đổi cách viết địa chỉ không tạo nguồn mới. */
export function lisGatewayKey(url: string): string { return url.replace('://localhost:', '://127.0.0.1:'); }

/** Chụp nội dung nguồn ổn định; cấu hình ánh xạ có thể đổi sau khi đã nhận,
 * nhưng cùng messageId không được mang một phép đo khác. */
export function lisMessageFingerprint(record: LisQueueRecord): string {
  const message = record.message;
  return JSON.stringify([message.analyzerId, message.testCode, message.qcLevel, message.qcLotCode ?? '',
    message.value, message.unit ?? '', message.measuredAt, message.runId ?? '']);
}

/** Ánh xạ 1 bản ghi ĐÃ KHỚP CẤU HÌNH (`resolved.ok===true`) của gateway sang
 * input cho `EntryService`/`addPoint()` — trả `null` nếu thiếu dữ liệu bắt
 * buộc hoặc `measuredAt` không parse được (KHÔNG fallback về "hôm nay"). */
export function resultToPointInput(record: LisQueueRecord): LisPointInput | null {
  const message = record?.message, resolved = record?.resolved;
  if (!message || !resolved || resolved.ok !== true || !lisText(resolved.qclabTestId)
    || !Number.isInteger(resolved.level) || Number(resolved.level) < 1) return null;
  const lotNo = lisText(resolved.lot), unit = lisText(message.unit);
  const runId = lisText(message.runId);
  if (!lotNo || lotNo.length > 80 || !unit || unit.length > 80 || runId.length > 120) return null;
  // Không dùng Number() trực tiếp: null, chuỗi rỗng và boolean không phải
  // kết quả đo; chỉ số hoặc chuỗi số hợp lệ mới qua được cổng ghi chung.
  if (typeof message.value !== 'number' && typeof message.value !== 'string') return null;
  const val = parseQcValue(message.value);
  if (!Number.isFinite(val)) return null;
  const measured = new Date(lisText(message.measuredAt));
  if (!Number.isFinite(measured.getTime())) return null;
  const date = `${measured.getFullYear()}-${String(measured.getMonth() + 1).padStart(2, '0')}-${String(measured.getDate()).padStart(2, '0')}`;
  return {
    testId: lisText(resolved.qclabTestId), level: Number(resolved.level), date, val, lotNo, unit,
    runId, operatorName: lisText(message.operator),
  };
}


