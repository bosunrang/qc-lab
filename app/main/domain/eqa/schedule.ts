// Lịch đợt ngoại kiểm và hạn nộp kết quả. Hàm thuần; main đọc/ghi CSDL, renderer
// chỉ trình bày.
//
// Nộp trễ hạn thì trung tâm tính đợt đó là không đạt dù máy chạy đúng, nên mỗi
// đợt cần được nhìn thấy trước hạn. Trạng thái suy ra từ dữ liệu, không lưu:
// đã có báo cáo của trung tâm > đã nộp > quá hạn > chưa nộp.
import { cleanText } from '../text-utils';
import { eqaRoundNumber } from './evaluation';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type EqaScheduleStatus = 'planned' | 'overdue' | 'submitted' | 'reported';

/** Loại mẫu của từng lịch ngoại kiểm. Danh sách cố định để lọc và thống kê;
 * lịch chưa khai loại mẫu để rỗng. */
export const EQA_SAMPLE_TYPES = ['Sinh hóa', 'Khí máu', 'Điện giải', 'Miễn dịch', 'Huyết học', 'Đông máu', 'Nước tiểu', 'Vi sinh', 'Khác'] as const;

/** Đợt sắp đến hạn được nhắc trong khoảng này (ngày). */
export const EQA_DUE_SOON_DAYS = 7;

export interface EqaScheduleInput {
  programId?: unknown; programName?: unknown; provider?: unknown;
  year?: unknown; round?: unknown;
  receiveDate?: unknown; runDate?: unknown; dueDate?: unknown;
  assignee?: unknown; note?: unknown;
  /** Loại mẫu của riêng lịch này, không sửa loại mẫu của các lịch khác. */
  sampleType?: unknown;
  /** Máy chạy mẫu của đợt; mỗi máy nộp kết quả riêng. */
  instrumentIds?: unknown;
}

export interface PreparedEqaSchedule {
  programId: string; programName: string; provider: string;
  year: number; round: string; roundNo: number;
  receiveDate: string; runDate: string; dueDate: string;
  assignee: string; note: string;
  sampleType: string; instrumentIds: string[];
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

function realDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Chương trình chọn sẵn (`programId`) hoặc tạo mới bằng tên + đơn vị tổ chức;
 * hạn nộp bắt buộc; thứ tự ngày nhận mẫu ≤ ngày chạy ≤ hạn nộp. */
export function validateEqaSchedule(input: EqaScheduleInput): ValidationResult<PreparedEqaSchedule> {
  const programId = cleanText(input.programId, 80).trim();
  const programName = cleanText(input.programName, 200).trim();
  const provider = cleanText(input.provider, 200).trim();
  if (!programId && !programName) return { ok: false, code: 'missing-program', message: 'Chọn chương trình ngoại kiểm hoặc nhập tên chương trình mới.' };
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, code: 'invalid-year', message: 'Năm không hợp lệ.' };
  const round = cleanText(input.round, 60).trim();
  const roundNo = eqaRoundNumber(round);
  if (!round || !roundNo) return { ok: false, code: 'invalid-round', message: 'Nhập đợt có số thứ tự, ví dụ "ĐỢT 11".' };
  const dates = { receiveDate: cleanText(input.receiveDate, 10).trim(), runDate: cleanText(input.runDate, 10).trim(), dueDate: cleanText(input.dueDate, 10).trim() };
  if (!realDate(dates.dueDate)) return { ok: false, code: 'invalid-due-date', message: 'Nhập hạn nộp kết quả.' };
  if (dates.receiveDate && !realDate(dates.receiveDate)) return { ok: false, code: 'invalid-receive-date', message: 'Ngày nhận mẫu không hợp lệ.' };
  if (dates.runDate && !realDate(dates.runDate)) return { ok: false, code: 'invalid-run-date', message: 'Ngày chạy mẫu không hợp lệ.' };
  if (dates.runDate && dates.runDate > dates.dueDate) return { ok: false, code: 'run-after-due', message: 'Ngày chạy mẫu phải trước hoặc bằng hạn nộp.' };
  if (dates.receiveDate && dates.receiveDate > (dates.runDate || dates.dueDate)) return { ok: false, code: 'receive-after-run', message: 'Ngày nhận mẫu phải trước ngày chạy và hạn nộp.' };
  const sampleType = cleanText(input.sampleType, 40).trim();
  if (sampleType && !(EQA_SAMPLE_TYPES as readonly string[]).includes(sampleType)) return { ok: false, code: 'invalid-sample-type', message: 'Chọn loại mẫu trong danh sách.' };
  const instrumentIds = Array.isArray(input.instrumentIds)
    ? [...new Set(input.instrumentIds.map((id) => cleanText(id, 80).trim()).filter(Boolean))]
    : [];
  return {
    ok: true,
    data: {
      programId, programName, provider, year, round, roundNo, ...dates,
      assignee: cleanText(input.assignee, 120).trim(), note: cleanText(input.note, 500).trim(),
      sampleType, instrumentIds,
    },
  };
}

/** Số ngày từ `today` tới `date` (âm = đã qua), theo lịch, không theo giờ. */
export function daysBetween(today: string, date: string): number {
  const [ay, am, ad] = today.split('-').map(Number), [by, bm, bd] = date.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function eqaScheduleStatus(row: { due_date: string; submitted_at: string; reported: boolean }, today: string): EqaScheduleStatus {
  if (row.reported) return 'reported';
  if (row.submitted_at) return 'submitted';
  return row.due_date < today ? 'overdue' : 'planned';
}

/** Đợt cần làm: chưa nộp và đã quá hạn hoặc đến hạn trong `EQA_DUE_SOON_DAYS` ngày. */
export function needsAction(row: { status: EqaScheduleStatus; days_left: number }): boolean {
  return row.status === 'overdue' || (row.status === 'planned' && row.days_left <= EQA_DUE_SOON_DAYS);
}
