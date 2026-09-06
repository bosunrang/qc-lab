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
  instrumentIds?: unknown;
  assignmentIds?: unknown;
  analyteId?: unknown;
  preserveExistingAssignments?: unknown;
  unit?: unknown;
  decimalPlaces?: unknown;
  tea?: unknown;
  section?: unknown;
  teaSource?: unknown;
  teaRefKey?: unknown;
  method?: unknown;
  reagent?: unknown;
  cusumOn?: unknown;
  cusumK?: unknown;
  cusumH?: unknown;
  active?: unknown;
  ruleActions?: unknown;
  ruleScopes?: unknown;
}
export interface PreparedTest {
  name: string;
  instrumentId: string;
  unit: string;
  decimalPlaces: number;
  tea: number;
  section: string;
  teaSource: string;
  teaRefKey: string;
  method: string;
  reagent: string;
  cusumOn: boolean;
  cusumK: number;
  cusumH: number;
  active: boolean;
}

/** k/h không hợp lệ (không phải số, hoặc ≤0) rơi về ĐÚNG mặc định lúc tạo
 * xét nghiệm mới (0.5/4 — xem `test-configuration-normalization.ts` app cũ:
 * `test.cusum={on:false,k:0.5,h:4}`), KHÔNG phải clamp về 0 — clamp về 0 sẽ
 * biến CUSUM thành vô nghĩa (k=0/h=0) mà không báo gì, khác hẳn "âm thầm
 * quay về mặc định hợp lý" của app cũ. */
function cusumParam(value: unknown, fallback: number): number {
  const n = finiteNumber(value, NaN);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function prepareTest(input: TestInput = {}): PreparedTest {
  return {
    name: cleanText(input.name).trim(),
    instrumentId: cleanId(input.instrumentId),
    unit: cleanText(input.unit).trim(),
    decimalPlaces: Math.min(6, Math.max(0, Math.round(finiteNumber(input.decimalPlaces, 2)))),
    // TEa KHÔNG bị clamp về 0 ở đây — giá trị âm phải rơi qua validateTest()
    // để báo lỗi rõ ràng ('invalid-tea'), đúng app cũ (`validateAssay()`:
    // "TEa không được âm."), thay vì âm thầm ép về 0 như trước.
    tea: finiteNumber(input.tea, 0),
    section: cleanText(input.section).trim(),
    teaSource: cleanText(input.teaSource, 200).trim(),
    teaRefKey: cleanText(input.teaRefKey, 80).trim(),
    method: cleanText(input.method, 200).trim(),
    reagent: cleanText(input.reagent, 200).trim(),
    // CUSUM (Xu hướng CUSUM, tham khảo tests/cusum.test.js bản cũ) — mặc định
    // k=0.5, h=4, chỉ là tham số biểu đồ trend, KHÔNG ảnh hưởng verdict
    // Westgard (xem CLAUDE.md "Confirmed business-logic decisions").
    cusumOn: input.cusumOn === true,
    cusumK: cusumParam(input.cusumK, 0.5),
    cusumH: cusumParam(input.cusumH, 4),
    active: input.active !== false,
  };
}

export function validateTest(
  input: TestInput,
  knownInstrumentIds: ReadonlySet<string>,
  existingNamesOnSameInstrument: readonly string[],
  existingTeaRefKeysOnSameInstrument: readonly string[] = [],
): ValidationResult<PreparedTest> {
  const cleaned = prepareTest(input);
  if (!cleaned.name) return { ok: false, code: 'missing-name', message: 'Nhập tên xét nghiệm.' };
  if (!cleaned.instrumentId || !knownInstrumentIds.has(cleaned.instrumentId)) {
    return { ok: false, code: 'missing-instrument', message: 'Chọn máy xét nghiệm.' };
  }
  if (cleaned.tea < 0) return { ok: false, code: 'invalid-tea', message: 'TEa không được âm.' };
  // App cũ chặn trùng trên CÙNG máy theo `analyteId` HOẶC tên. V2 dùng
  // `teaRefKey` làm khoá analyte của danh mục TEa; nhờ đó "Glucose" và
  // "GLU" không thể thành hai cấu hình của cùng analyte trên một máy, còn
  // cùng analyte trên hai máy khác nhau vẫn là hai cấu hình QC độc lập.
  if (existingNamesOnSameInstrument.some(name => sameText(name, cleaned.name))
    || !!cleaned.teaRefKey && existingTeaRefKeysOnSameInstrument.includes(cleaned.teaRefKey)) {
    return { ok: false, code: 'duplicate-name', message: 'Xét nghiệm này đã tồn tại trên máy đã chọn.' };
  }
  return { ok: true, data: cleaned };
}

export interface TestLevelInput {
  level?: unknown;
  mean?: unknown;
  sd?: unknown;
  low?: unknown;
  high?: unknown;
  qcLotId?: unknown;
}
export interface PreparedTestLevel {
  level: number;
  mean: number | null;
  sd: number | null;
  low: number | null;
  high: number | null;
  qcLotId: string;
}

export function prepareTestLevel(input: TestLevelInput = {}): PreparedTestLevel {
  const level = Math.round(finiteNumber(input.level, 1));
  const mean = input.mean == null || input.mean === '' ? null : finiteNumber(input.mean, NaN);
  const sd = input.sd == null || input.sd === '' ? null : finiteNumber(input.sd, NaN);
  const low = input.low == null || input.low === '' ? null : finiteNumber(input.low, NaN);
  const high = input.high == null || input.high === '' ? null : finiteNumber(input.high, NaN);
  return {
    level: Math.min(6, Math.max(1, level)),
    mean: mean != null && Number.isFinite(mean) ? mean : null,
    sd: sd != null && Number.isFinite(sd) && sd > 0 ? sd : null,
    // Giới hạn dưới/trên ĐÃ PHÊ DUYỆT (khác dải hiển thị suy từ Mean±k·SD) —
    // bug thật tìm được khi audit: bảng Mean/SD (`TargetsTab.tsx`) tính ra
    // 2 giá trị này qua `normalizeTargetPick()` nhưng KHÔNG gửi kèm khi lưu,
    // nên `test_levels.low/high` luôn NULL sau khi lưu qua tab này — tab
    // "Lịch sử dữ liệu" đọc thẳng 2 cột này (không suy từ Mean±k·SD) nên
    // luôn hiện "—" dù đã nhập đủ giới hạn.
    low: low != null && Number.isFinite(low) ? low : null,
    high: high != null && Number.isFinite(high) ? high : null,
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
  const present = (value: unknown) => value != null && String(value).trim() !== '';
  const hasMean = present(input.mean), hasSd = present(input.sd);
  const hasLow = present(input.low), hasHigh = present(input.high);
  if (hasMean && cleaned.mean == null) {
    return { ok: false, code: 'invalid-mean', message: 'Trung bình mục tiêu phải là số hợp lệ.' };
  }
  if (hasSd && cleaned.sd == null) {
    return { ok: false, code: 'invalid-sd', message: 'Độ lệch chuẩn phải là số lớn hơn 0.' };
  }
  if ((hasLow && cleaned.low == null) || (hasHigh && cleaned.high == null)) {
    return { ok: false, code: 'invalid-limits', message: 'Giới hạn dưới/trên phải là số hợp lệ.' };
  }
  if (hasLow !== hasHigh || hasLow && hasHigh && cleaned.high! <= cleaned.low!) {
    return { ok: false, code: 'invalid-range', message: 'Nếu nhập giới hạn, cần nhập đủ giới hạn dưới và trên; giới hạn trên phải lớn hơn giới hạn dưới.' };
  }
  if (cleaned.mean != null && cleaned.sd == null) {
    return { ok: false, code: 'missing-sd', message: 'Đã nhập Mean thì phải nhập SD > 0.' };
  }
  if (cleaned.mean == null && cleaned.sd != null) {
    return { ok: false, code: 'missing-mean', message: 'Đã nhập SD thì phải nhập Mean hợp lệ.' };
  }
  if (cleaned.qcLotId && (cleaned.mean == null || cleaned.sd == null)) {
    return { ok: false, code: 'missing-target', message: 'Phải nhập đủ Mean/SD trước khi gán lô QC.' };
  }
  return { ok: true, data: cleaned };
}

export interface MeanSdHistoryEntry {
  at: string; mean: number | null; sd: number | null; qcLotId: string;
  /** Ảnh chụp nghiệp vụ của chính mốc cũ. Các trường tùy chọn giữ khả năng
   * đọc dữ liệu V2 đã tạo trước khi lịch sử được làm đầy đủ. */
  lot?: string; low?: number | null; high?: number | null;
  effectiveFrom?: string; effectiveTo?: string; source?: 'mfg' | 'lab';
}

/** Trang "Lịch sử dữ liệu" đọc lại đây — mỗi lần Mean/SD của 1 mức THẬT SỰ
 * đổi (không phải lưu lại y hệt giá trị cũ) thì chốt giá trị TRƯỚC khi ghi
 * đè vào lịch sử, có mốc thời gian. Tham khảo nguyên tắc "giữ lịch sử thay
 * đổi target" của bản cũ, không phải chỉ ghi đè im lặng. */
export function appendMeanSdHistory(
  historyJson: string | null | undefined,
  previous: Omit<MeanSdHistoryEntry, 'at'> | null,
  at: string,
): string {
  let history: MeanSdHistoryEntry[];
  try { history = JSON.parse(historyJson || '[]'); if (!Array.isArray(history)) history = []; } catch { history = []; }
  if (!previous || (previous.mean == null && previous.sd == null)) return JSON.stringify(history);
  history.push({ at, ...previous });
  return JSON.stringify(history);
}

export interface LotInput {
  groupId?: unknown; lotNo?: unknown; level?: unknown; description?: unknown; supplier?: unknown;
  program?: unknown; exp?: unknown; opened?: unknown; active?: unknown; depleted?: unknown; note?: unknown;
}
export interface PreparedLot {
  groupId: string; lotNo: string; level: number; description: string; supplier: string;
  program: string; exp: string; opened: string; active: boolean; depleted: boolean; note: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function prepareLot(input: LotInput = {}): PreparedLot {
  const exp = cleanText(input.exp, 10).trim();
  const opened = cleanText(input.opened, 10).trim();
  return {
    groupId: cleanId(input.groupId),
    lotNo: cleanText(input.lotNo, 80).trim(),
    level: Math.min(6, Math.max(1, Math.round(finiteNumber(input.level, 1)))),
    description: cleanText(input.description, 200).trim(),
    supplier: cleanText(input.supplier, 200).trim(),
    program: cleanText(input.program, 200).trim(),
    exp: DATE_RE.test(exp) ? exp : '',
    opened: DATE_RE.test(opened) ? opened : '',
    active: input.active !== false,
    depleted: input.depleted === true,
    note: cleanText(input.note, 500).trim(),
  };
}

export function validateLot(input: LotInput): ValidationResult<PreparedLot> {
  const cleaned = prepareLot(input);
  if (!cleaned.lotNo) return { ok: false, code: 'missing-lot-no', message: 'Nhập số lô.' };
  return { ok: true, data: cleaned };
}

export interface LotGroupInput {
  name?: unknown; manufacturer?: unknown; material?: unknown; catalog?: unknown; note?: unknown;
  active?: unknown; status?: unknown; lotIds?: unknown;
}
export interface PreparedLotGroup {
  name: string; manufacturer: string; material: string; catalog: string; note: string;
  active: boolean; status: '' | 'stopped' | 'planned'; lotIds: string[];
}

// KHÔNG có 'active' — port đúng app cũ (`lot-group-status.ts`/
// `qcLotGroupOperational()`): "Đang hoạt động" không phải một trạng thái
// lưu cứng, nó được SUY từ việc lô của nhóm có đang gán vào xét nghiệm nào
// không (`inUse`, xem config-handlers.ts's `listLotGroups()`). Chỉ
// 'stopped' (tự tay Dừng)/'planned' (dự kiến, chưa dùng đến ở app-v2) là
// trạng thái tự đặt thật; mọi giá trị khác (kể cả rỗng) đều là "không có gì
// tự đặt", để `inUse` quyết định nhãn hiển thị.
const GROUP_STATUSES = ['stopped', 'planned'] as const;

export function prepareLotGroup(input: LotGroupInput = {}): PreparedLotGroup {
  const status = GROUP_STATUSES.includes(input.status as never) ? (input.status as PreparedLotGroup['status']) : '';
  const lotIds = Array.isArray(input.lotIds) ? input.lotIds.map(cleanId).filter(Boolean) : [];
  return {
    name: cleanText(input.name, 200).trim(),
    manufacturer: cleanText(input.manufacturer, 200).trim(),
    material: cleanText(input.material, 200).trim(),
    catalog: cleanText(input.catalog, 200).trim(),
    note: cleanText(input.note, 500).trim(),
    active: input.active !== false,
    status,
    lotIds: Array.from(new Set(lotIds)),
  };
}

/** Nhóm lô QC phải gồm ÍT NHẤT 2 lô — tham khảo nguyên tắc bản cũ (một nhóm
 * chỉ có ý nghĩa khi so sánh/chuyển tiếp giữa các lô với nhau; 1 lô đơn lẻ
 * không cần nhóm). */
export function validateLotGroup(input: LotGroupInput, fallbackName = ''): ValidationResult<PreparedLotGroup> {
  const cleaned = prepareLotGroup(input);
  if (!cleaned.name) cleaned.name = cleanText(fallbackName, 200).trim();
  // App cũ kiểm đủ 2 lô trước; tên để trống được tự sinh từ số lô đã chọn.
  if (cleaned.lotIds.length < 2) return { ok: false, code: 'not-enough-lots', message: 'Nhóm lô QC cần ít nhất 2 lô.' };
  if (!cleaned.name) return { ok: false, code: 'missing-name', message: 'Nhập tên nhóm lô.' };
  return { ok: true, data: cleaned };
}

export interface PanelInput { name?: unknown; instrumentId?: unknown; note?: unknown; active?: unknown; testIds?: unknown }
export interface PreparedPanel { name: string; instrumentId: string; note: string; active: boolean; testIds: string[] }

export function preparePanel(input: PanelInput = {}): PreparedPanel {
  const testIds = Array.isArray(input.testIds) ? input.testIds.map(cleanId).filter(Boolean) : [];
  return {
    name: cleanText(input.name, 200).trim(),
    instrumentId: cleanId(input.instrumentId),
    note: cleanText(input.note, 500).trim(),
    active: input.active !== false,
    testIds: Array.from(new Set(testIds)),
  };
}

export function validatePanel(input: PanelInput, knownInstrumentIds: ReadonlySet<string>): ValidationResult<PreparedPanel> {
  const cleaned = preparePanel(input);
  if (!cleaned.name) return { ok: false, code: 'missing-name', message: 'Nhập tên Panel QC.' };
  if (!cleaned.instrumentId || !knownInstrumentIds.has(cleaned.instrumentId)) {
    return { ok: false, code: 'missing-instrument', message: 'Chọn máy xét nghiệm cho Panel QC.' };
  }
  return { ok: true, data: cleaned };
}

export interface LotTransitionInput {
  panelId?: unknown; fromLotId?: unknown; toLotId?: unknown; startDate?: unknown; note?: unknown; status?: unknown;
}
export interface PreparedLotTransition {
  panelId: string; fromLotId: string; toLotId: string; startDate: string; note: string;
  status: 'planned' | 'active' | 'accepted' | 'rejected';
}

const LOT_TRANSITION_STATUSES = ['planned', 'active', 'accepted', 'rejected'] as const;

export function prepareLotTransition(input: LotTransitionInput = {}): PreparedLotTransition {
  const startDate = cleanText(input.startDate, 10).trim();
  const status = LOT_TRANSITION_STATUSES.includes(input.status as never) ? (input.status as PreparedLotTransition['status']) : 'planned';
  return {
    panelId: cleanId(input.panelId),
    fromLotId: cleanId(input.fromLotId),
    toLotId: cleanId(input.toLotId),
    startDate: DATE_RE.test(startDate) ? startDate : '',
    note: cleanText(input.note, 500).trim(),
    status,
  };
}

export function validateLotTransition(input: LotTransitionInput): ValidationResult<PreparedLotTransition> {
  const cleaned = prepareLotTransition(input);
  if (!cleaned.panelId) return { ok: false, code: 'missing-panel', message: 'Chọn Panel QC.' };
  if (!cleaned.fromLotId || !cleaned.toLotId) return { ok: false, code: 'missing-lots', message: 'Chọn đủ lô cũ và lô mới.' };
  if (cleaned.fromLotId === cleaned.toLotId) return { ok: false, code: 'same-lot', message: 'Lô cũ và lô mới phải khác nhau.' };
  return { ok: true, data: cleaned };
}
