// Validate cho viec them/huy diem QC - tham khao preparePointInput() cua ban
// cu (src/application/entry/entry-service.ts), rut gon cho module Entry giai
// doan dau (chua co period lock/run-id tu dong danh so - de danh cho dot
// sau khi module nay on dinh).
import { cleanId, cleanText, finiteNumber } from './text-utils';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface QcPointInput {
  testId?: unknown;
  level?: unknown;
  date?: unknown;
  val?: unknown;
  runId?: unknown;
  note?: unknown;
  operatorName?: unknown;
}

export interface PreparedQcPoint {
  testId: string;
  level: number;
  date: string;
  val: number;
  runId: string;
  note: string;
  operatorName: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function validateQcPointInput(input: QcPointInput, knownLevels: readonly number[]): ValidationResult<PreparedQcPoint> {
  const testId = cleanId(input.testId);
  if (!testId) return { ok: false, code: 'missing-test', message: 'Thieu ma xet nghiem.' };
  const level = Math.round(finiteNumber(input.level, NaN));
  if (!knownLevels.includes(level)) return { ok: false, code: 'invalid-level', message: 'Muc QC khong ton tai cho xet nghiem nay.' };
  const date = cleanText(input.date, 20).trim();
  if (!DATE_RE.test(date)) return { ok: false, code: 'invalid-date', message: 'Ngay khong hop le (dinh dang YYYY-MM-DD).' };
  const val = typeof input.val === 'number' ? input.val : parseFloat(String(input.val == null ? '' : input.val).trim());
  if (!Number.isFinite(val)) return { ok: false, code: 'invalid-value', message: 'Gia tri QC khong hop le.' };
  const runId = cleanText(input.runId, 120).trim() || `${date}-1`;
  return {
    ok: true,
    data: { testId, level, date, val, runId, note: cleanText(input.note, 1000).trim(), operatorName: cleanText(input.operatorName, 120).trim() },
  };
}

export interface VoidPointInput { pointId?: unknown; reason?: unknown }
export interface PreparedVoid { pointId: string; reason: string }

export function validateVoidInput(input: VoidPointInput): ValidationResult<PreparedVoid> {
  const pointId = cleanId(input.pointId);
  if (!pointId) return { ok: false, code: 'missing-point', message: 'Thieu ma diem QC.' };
  const reason = cleanText(input.reason, 1000).trim();
  if (reason.length < 5) return { ok: false, code: 'reason-too-short', message: 'Ly do huy phai co it nhat 5 ky tu.' };
  return { ok: true, data: { pointId, reason } };
}
