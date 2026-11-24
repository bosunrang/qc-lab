// Dòng thời gian của hồ sơ NCE dựng từ dữ liệu app đã lưu (đánh giá giao diện
// 10/11/2026): lần chạy bị loại, huỷ điểm, phát hiện, lập hồ sơ, lần chạy lại,
// các quyết định và hành động đã xong. Chuẩn yêu cầu hồ sơ CÓ mốc thời gian,
// không yêu cầu người dùng gõ lại các mốc app đã ghi — ô "Ghi thêm về diễn
// biến" chỉ còn để ghi điều app không biết (ví dụ nhật ký máy).
import { isoLocalDate } from '../local-date';
import type { NceRunKey } from './types';

export interface NceTimelineEntry {
  /** `YYYY-MM-DD` khi chỉ biết ngày (lần chạy QC), ISO đầy đủ khi biết giờ. */
  at: string;
  dateOnly: boolean;
  label: string;
  detail: string;
  /** Lần chạy QC của mốc (bị loại, chạy lại) để giao diện mở bảng điểm ngay
   * trên dòng này; `null` với mốc không gắn lần chạy. */
  run: NceRunKey | null;
}

export interface NceTimelineInput {
  detectedAt: string; createdAt: string; reportedBy: string;
  onset: NceRunKey | null; onsetRules: readonly string[];
  trigger: NceRunKey | null;
  /** Các lần bị loại thêm đã gắn hồ sơ (vai trò `repeat_reject`). */
  repeats?: readonly NceRunKey[];
  voids: readonly { level: number; at: string; by: string }[];
  rerun: NceRunKey | null;
  decisions: readonly { type: string; at: string; actor: string }[];
  actionsDone: readonly { description: string; at: string; by: string }[];
}

const DECISION_LABEL: Record<string, string> = {
  technical_assessment: 'Ghi xác minh kỹ thuật',
  patient_impact: 'Ghi quyết định ảnh hưởng bệnh nhân',
  release: 'Cho phép hoạt động trở lại',
  submit: 'Nộp duyệt',
  return: 'Trả lại hồ sơ',
  approve: 'Duyệt đóng hồ sơ',
  cancel: 'Huỷ hồ sơ',
  effectiveness: 'Đánh giá hiệu lực',
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const sameRun = (a: NceRunKey, b: NceRunKey) => a.date === b.date && a.runId === b.runId;
/** Cột thời gian đã có ngày, chi tiết chỉ ghi mã lần chạy. */
const runText = (run: NceRunKey) => run.runId ? `lần ${run.runId}` : '';

/** Khoá sắp xếp theo giờ địa phương; mốc chỉ có ngày đứng đầu ngày đó. */
function sortKey(entry: NceTimelineEntry): string {
  if (entry.dateOnly) return `${entry.at}T00:00:00`;
  const at = new Date(entry.at);
  if (Number.isNaN(at.getTime())) return entry.at;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${isoLocalDate(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

export function nceTimeline(input: NceTimelineInput): NceTimelineEntry[] {
  const entries: NceTimelineEntry[] = [];
  const day = (at: string, label: string, detail = '', run: NceRunKey | null = null) => { if (isDate(at)) entries.push({ at, dateOnly: true, label, detail, run }); };
  const time = (at: string, label: string, detail = '') => { if (at) entries.push({ at, dateOnly: false, label, detail, run: null }); };
  const runDay = (run: NceRunKey, label: string, extra = '') => day(run.date, label, [runText(run), extra].filter(Boolean).join(' · '), run);
  // Thứ tự chèn là thứ tự logic, giữ nguyên khi hai mốc trùng khoá (sort ổn định).
  if (input.onset && (!input.trigger || !sameRun(input.onset, input.trigger))) {
    runDay(input.onset, 'Bắt đầu chuỗi vi phạm', input.onsetRules.length ? `luật ${input.onsetRules.join(', ')}` : '');
  }
  if (input.trigger) runDay(input.trigger, 'Lần chạy QC bị loại');
  for (const run of input.repeats ?? []) runDay(run, 'Lần chạy bị loại thêm');
  for (const item of input.voids) time(item.at, `Huỷ điểm QC mức ${item.level}`, item.by);
  day(input.detectedAt, 'Phát hiện sự cố');
  time(input.createdAt, 'Lập hồ sơ', input.reportedBy);
  if (input.rerun) runDay(input.rerun, 'Chạy lại QC');
  for (const decision of input.decisions) {
    const label = DECISION_LABEL[decision.type];
    if (label) time(decision.at, label, decision.actor);
  }
  for (const action of input.actionsDone) time(action.at, 'Hoàn thành hành động', [action.description, action.by].filter(Boolean).join(' · '));
  return entries
    .map((entry, index) => ({ entry, index, key: sortKey(entry) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index)
    .map(({ entry }) => entry);
}
