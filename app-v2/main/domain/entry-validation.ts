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
  /** Số lô được chọn trong worksheet. Rỗng = lô đang vận hành; giá trị khác
   * chỉ được main process chấp nhận nếu là lô song song của hồ sơ chuyển lô
   * đang active — validation thuần chỉ làm sạch, không tự tin dữ liệu này. */
  lotNo?: unknown;
  note?: unknown;
  operatorName?: unknown;
}

export interface PreparedQcPoint {
  testId: string;
  level: number;
  date: string;
  val: number;
  runId: string;
  lotNo: string;
  note: string;
  operatorName: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/** Cảnh báo dữ liệu bất thường trước khi lưu — port đúng ngưỡng app cũ:
 * chỉ cảnh báo khi |Z| > 5, còn đúng ±5SD vẫn được lưu bình thường. Đây là
 * cảnh báo có thể xác nhận "Vẫn lưu", không phải luật Westgard hay lỗi
 * validation chặn cứng. */
export function extremeQcPointDeviation(value: unknown, mean: unknown, sd: unknown): number | null {
  if (value == null || mean == null || sd == null || value === '' || mean === '' || sd === '') return null;
  const valueN = Number(value), meanN = Number(mean), sdN = Number(sd);
  if (!Number.isFinite(valueN) || !Number.isFinite(meanN) || !Number.isFinite(sdN) || sdN <= 0) return null;
  const z = (valueN - meanN) / sdN;
  return Math.abs(z) > 5 ? z : null;
}

export function validateQcPointInput(input: QcPointInput, knownLevels: readonly number[]): ValidationResult<PreparedQcPoint> {
  const testId = cleanId(input.testId);
  if (!testId) return { ok: false, code: 'missing-test', message: 'Thiếu mã xét nghiệm.' };
  const level = Math.round(finiteNumber(input.level, NaN));
  if (!knownLevels.includes(level)) return { ok: false, code: 'invalid-level', message: 'Mức QC không tồn tại cho xét nghiệm này.' };
  const date = cleanText(input.date, 20).trim();
  if (!DATE_RE.test(date)) return { ok: false, code: 'invalid-date', message: 'Ngày không hợp lệ (định dạng YYYY-MM-DD).' };
  const val = typeof input.val === 'number' ? input.val : parseFloat(String(input.val == null ? '' : input.val).trim());
  if (!Number.isFinite(val)) return { ok: false, code: 'invalid-value', message: 'Giá trị QC không hợp lệ.' };
  const runId = cleanText(input.runId, 120).trim() || `${date}-1`;
  return {
    ok: true,
    data: { testId, level, date, val, runId, lotNo: cleanText(input.lotNo, 80).trim(), note: cleanText(input.note, 1000).trim(), operatorName: cleanText(input.operatorName, 120).trim() },
  };
}

export type VoidKind = 'analytical' | 'data-entry' | 'other';
export interface VoidPointInput { pointId?: unknown; reason?: unknown; kind?: unknown; openNce?: unknown }
export interface PreparedVoid { pointId: string; reason: string; kind: VoidKind; openNce: boolean }

function cleanVoidKind(value: unknown): VoidKind {
  return value === 'analytical' || value === 'data-entry' ? value : 'other';
}

/** `entryVoidNceChoice()` bản cũ — 2 kind đầu KHOÁ cứng việc mở/không mở NCE
 * (người dùng chỉ chọn NGUYÊN NHÂN, không tự quyết định có mở hồ sơ hay
 * không), và không bắt buộc lý do (chỉ khuyến nghị) vì bản thân "kind" đã là
 * một mô tả. Chỉ `other` mới để người dùng tự bật/tắt `openNce` VÀ bắt buộc
 * gõ lý do ≥5 ký tự — đây là nhánh "cần điều tra" nên không thể để trống. */
export function voidNceChoice(kind: VoidKind): { openNce: boolean; forced: boolean; reasonRequired: boolean } {
  if (kind === 'analytical') return { openNce: true, forced: true, reasonRequired: false };
  if (kind === 'data-entry') return { openNce: false, forced: true, reasonRequired: false };
  return { openNce: false, forced: false, reasonRequired: true };
}

export function validateVoidInput(input: VoidPointInput): ValidationResult<PreparedVoid> {
  const pointId = cleanId(input.pointId);
  if (!pointId) return { ok: false, code: 'missing-point', message: 'Thiếu mã điểm QC.' };
  const kind = cleanVoidKind(input.kind);
  const choice = voidNceChoice(kind);
  const reason = cleanText(input.reason, 1000).trim();
  if (choice.reasonRequired && reason.length < 5) return { ok: false, code: 'reason-too-short', message: 'Lý do huỷ phải có ít nhất 5 ký tự.' };
  const openNce = choice.forced ? choice.openNce : !!input.openNce;
  return { ok: true, data: { pointId, reason, kind, openNce } };
}
