import type { LisMessage } from '../../shared/qc-api';

export class GatewayError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function object(input: unknown, keys: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new GatewayError(400, 'invalid-input', 'Dữ liệu phải là một đối tượng JSON.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new GatewayError(400, 'unknown-field', 'Có trường ngoài hợp đồng QC được hỗ trợ.');
  return value;
}

export function text(value: unknown, field: string, max = 120, optional = false): string {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value !== value.trim() || (!optional && !value) || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new GatewayError(400, 'invalid-field', `Trường ${field} không hợp lệ (tối đa ${max} ký tự, không có khoảng trắng thừa hoặc ký tự điều khiển).`);
  }
  return value;
}

export function sourceId(value: unknown): string {
  const id = text(value, 'sourceId', 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new GatewayError(400, 'invalid-source', 'Mã nguồn chỉ dùng chữ ASCII, số, dấu chấm, gạch ngang và gạch dưới.');
  return id;
}

/** Bắt buộc múi giờ và ngày lịch hợp lệ; không đoán múi giờ của LIS. */
function timestamp(value: unknown): string {
  const raw = text(value, 'measuredAt', 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(raw);
  if (!match) throw new GatewayError(400, 'invalid-time', 'Thời điểm đo phải có ngày, giờ và múi giờ ISO 8601.');
  const [, year, month, day, hour, minute, second, zone, , offsetHour, offsetMinute] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const offset = Number(offsetHour || 0) * 60 + Number(offsetMinute || 0);
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || (zone !== 'Z' && (Number(offsetMinute) > 59 || offset > 14 * 60)) || !Number.isFinite(Date.parse(raw))) {
    throw new GatewayError(400, 'invalid-time', 'Ngày, giờ hoặc múi giờ đo không hợp lệ.');
  }
  return new Date(raw).toISOString();
}

export function message(input: unknown): LisMessage {
  const data = object(input, ['messageId', 'analyzerId', 'testCode', 'qcLevel', 'qcLotCode', 'value', 'unit', 'measuredAt', 'runId', 'operator']);
  if (typeof data.value !== 'number' || !Number.isFinite(data.value)) throw new GatewayError(400, 'invalid-value', 'Giá trị QC phải là số hữu hạn; không nhận chuỗi rỗng, boolean hoặc null.');
  return { messageId: text(data.messageId, 'messageId', 200), analyzerId: text(data.analyzerId, 'analyzerId'),
    testCode: text(data.testCode, 'testCode'), qcLevel: text(data.qcLevel, 'qcLevel', 40), qcLotCode: text(data.qcLotCode, 'qcLotCode', 80),
    value: data.value, unit: text(data.unit, 'unit', 80), measuredAt: timestamp(data.measuredAt),
    runId: text(data.runId, 'runId', 120, true), operator: text(data.operator, 'operator', 120, true) };
}

export interface GatewayMapping {
  sourceId: string; analyzerId: string; testCode: string; qcLevel: string; qcLotCode: string;
  qclabTestId: string; level: number; lot: string; unit: string; displayName: string; active: boolean;
}

export function mapping(input: unknown): GatewayMapping {
  const data = object(input, ['sourceId', 'analyzerId', 'testCode', 'qcLevel', 'qcLotCode', 'qclabTestId', 'level', 'lot', 'unit', 'displayName', 'active']);
  if (!Number.isInteger(data.level) || Number(data.level) < 1 || Number(data.level) > 100 || (data.active !== undefined && typeof data.active !== 'boolean')) {
    throw new GatewayError(400, 'invalid-mapping', 'Mức đích phải là số nguyên từ 1 đến 100; active phải là boolean.');
  }
  return { sourceId: sourceId(data.sourceId), analyzerId: text(data.analyzerId, 'analyzerId'), testCode: text(data.testCode, 'testCode'),
    qcLevel: text(data.qcLevel, 'qcLevel', 40), qcLotCode: text(data.qcLotCode, 'qcLotCode', 80), qclabTestId: text(data.qclabTestId, 'qclabTestId'),
    level: Number(data.level), lot: text(data.lot, 'lot', 80), unit: text(data.unit, 'unit', 80),
    displayName: text(data.displayName, 'displayName', 200), active: data.active !== false };
}

export type GatewayRole = 'admin' | 'app' | 'ingest';
export function tokenDraft(input: unknown): { role: GatewayRole; sourceId: string; label: string } {
  const data = object(input, ['role', 'sourceId', 'label']);
  if (typeof data.role !== 'string' || !['admin', 'app', 'ingest'].includes(data.role)) throw new GatewayError(400, 'invalid-role', 'Vai trò token không hợp lệ.');
  const role = data.role as GatewayRole;
  if (role !== 'ingest' && data.sourceId !== undefined) throw new GatewayError(400, 'invalid-source', 'Chỉ token ingest được gắn nguồn LIS.');
  return { role, sourceId: role === 'ingest' ? sourceId(data.sourceId) : '', label: text(data.label, 'label', 120) };
}

export function decision(input: unknown): { messageId: string; status: 'imported' | 'rejected'; by: string; note: string } {
  const data = object(input, ['messageId', 'status', 'by', 'note']);
  if (data.status !== 'imported' && data.status !== 'rejected') throw new GatewayError(400, 'invalid-status', 'Chỉ nhận trạng thái imported hoặc rejected.');
  return { messageId: text(data.messageId, 'messageId', 200), status: data.status, by: text(data.by, 'by', 200), note: text(data.note, 'note', 1000, true) };
}

export function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new GatewayError(400, 'invalid-query', `Tham số ${field} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return Number(value);
}
