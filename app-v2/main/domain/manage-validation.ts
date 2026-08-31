// Validate/prepare cho module thí điểm "Cấu hình chung": máy xét nghiệm,
// xét nghiệm, mức QC. Tham khảo logic từ bản cũ
// (src/application/manage/manage-config-service.ts) nhưng viết lại thuần,
// không phụ thuộc `state` object lớn — nhận đúng dữ liệu cần qua tham số,
// vì trong app mới việc kiểm tra trùng tên chạy trên kết quả SELECT từ
// SQLite, không phải trên mảng `state.instruments` như trước.
import { cleanId, cleanText, finiteNumber, sameText } from './text-utils';

export interface InstrumentInput {
  name?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serial?: unknown;
  section?: unknown;
  active?: unknown;
}
export interface PreparedInstrument {
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  section: string;
  active: boolean;
}

export function prepareInstrument(input: InstrumentInput = {}): PreparedInstrument {
  return {
    name: cleanText(input.name).trim(),
    manufacturer: cleanText(input.manufacturer).trim(),
    model: cleanText(input.model).trim(),
    serial: cleanText(input.serial).trim(),
    section: cleanText(input.section).trim(),
    active: input.active !== false,
  };
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/** `existingNames` = tên các máy đã có (loại trừ chính bản ghi đang sửa, nếu
 * có) — caller (IPC handler) tự SELECT từ SQLite rồi truyền vào, giữ hàm này
 * thuần, dễ test không cần DB thật. */
export function validateInstrument(input: InstrumentInput, existingNames: readonly string[]): ValidationResult<PreparedInstrument> {
  const cleaned = prepareInstrument(input);
  if (!cleaned.name) return { ok: false, code: 'missing-name', message: 'Nhập tên máy.' };
  if (existingNames.some(name => sameText(name, cleaned.name))) {
    return { ok: false, code: 'duplicate-name', message: 'Tên máy xét nghiệm này đã tồn tại.' };
  }
  return { ok: true, data: cleaned };
}

export interface TestInput {
  name?: unknown;
  instrumentId?: unknown;
  unit?: unknown;
  decimalPlaces?: unknown;
  tea?: unknown;
  section?: unknown;
}
export interface PreparedTest {
  name: string;
  instrumentId: string;
  unit: string;
  decimalPlaces: number;
  tea: number;
  section: string;
}

export function prepareTest(input: TestInput = {}): PreparedTest {
  return {
    name: cleanText(input.name).trim(),
    instrumentId: cleanId(input.instrumentId),
    unit: cleanText(input.unit).trim(),
    decimalPlaces: Math.min(6, Math.max(0, Math.round(finiteNumber(input.decimalPlaces, 2)))),
    tea: Math.max(0, finiteNumber(input.tea, 0)),
    section: cleanText(input.section).trim(),
  };
}

export function validateTest(
  input: TestInput,
  knownInstrumentIds: ReadonlySet<string>,
  existingNamesOnSameInstrument: readonly string[],
): ValidationResult<PreparedTest> {
  const cleaned = prepareTest(input);
  if (!cleaned.name) return { ok: false, code: 'missing-name', message: 'Nhập tên xét nghiệm.' };
  if (!cleaned.instrumentId || !knownInstrumentIds.has(cleaned.instrumentId)) {
    return { ok: false, code: 'missing-instrument', message: 'Chọn máy xét nghiệm.' };
  }
  if (existingNamesOnSameInstrument.some(name => sameText(name, cleaned.name))) {
    return { ok: false, code: 'duplicate-name', message: 'Xét nghiệm này đã tồn tại trên máy đã chọn.' };
  }
  return { ok: true, data: cleaned };
}

export interface TestLevelInput {
  level?: unknown;
  mean?: unknown;
  sd?: unknown;
  qcLotId?: unknown;
}
export interface PreparedTestLevel {
  level: number;
  mean: number | null;
  sd: number | null;
  qcLotId: string;
}

export function prepareTestLevel(input: TestLevelInput = {}): PreparedTestLevel {
  const level = Math.round(finiteNumber(input.level, 1));
  const mean = input.mean == null || input.mean === '' ? null : finiteNumber(input.mean, NaN);
  const sd = input.sd == null || input.sd === '' ? null : finiteNumber(input.sd, NaN);
  return {
    level: Math.min(6, Math.max(1, level)),
    mean: mean != null && Number.isFinite(mean) ? mean : null,
    sd: sd != null && Number.isFinite(sd) && sd > 0 ? sd : null,
    qcLotId: cleanId(input.qcLotId),
  };
}

// saveTestLevel là UPSERT theo (testId, level) — không có khái niệm
// "trùng mức" nữa (mọi xét nghiệm luôn có sẵn Mức 1 tự tạo lúc thêm xét
// nghiệm; lưu lại đúng mức đó chỉ là cập nhật Mean/SD, không phải tạo mới).
// `existingLevels` giữ lại tham số để caller có thể truyền — hiện không
// dùng để chặn gì, chỉ còn validate mean/sd đi cùng nhau.
export function validateTestLevel(input: TestLevelInput, _existingLevels: readonly number[] = []): ValidationResult<PreparedTestLevel> {
  const cleaned = prepareTestLevel(input);
  if (cleaned.mean != null && cleaned.sd == null) {
    return { ok: false, code: 'missing-sd', message: 'Đã nhập Mean thì phải nhập SD > 0.' };
  }
  return { ok: true, data: cleaned };
}
