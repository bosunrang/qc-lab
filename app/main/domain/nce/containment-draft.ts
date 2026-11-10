// Bản nháp "Phạm vi kiểm soát và thông báo" từ dữ liệu app biết (đánh giá
// giao diện 10/11/2026): xét nghiệm, máy, lô QC từng mức và khoảng nghi ngờ.
// Phần chỉ người làm mới biết (giữ kết quả từ lúc nào, đã báo cho ai) để chỗ
// trống `[cần ghi]`; cổng cho hoạt động trở lại chặn khi còn chỗ trống này.
import { runLabel } from './format';
import type { NceRunKey } from './types';

/** Chỗ trống trong bản nháp; còn trong ghi chú thì chưa qua cổng. */
export const NCE_DRAFT_BLANK = '[cần ghi]';

export interface NceContainmentDraftInput {
  testName: string; instrumentName: string;
  lots: readonly { level: number; lot: string }[];
  lastAccepted: NceRunKey | null; onset: NceRunKey | null; trigger: NceRunKey;
}

export function nceContainmentDraft(input: NceContainmentDraftInput): string {
  const lots = [...input.lots].sort((a, b) => a.level - b.level).map((item) => `M${item.level} ${item.lot || '(không ghi lô)'}`).join(', ');
  const scope = [`Xét nghiệm ${input.testName || '(không tên)'}`, input.instrumentName ? `trên máy ${input.instrumentName}` : ''].filter(Boolean).join(' ');
  const from = input.onset ?? input.trigger;
  const range = from.date === input.trigger.date && from.runId === input.trigger.runId
    ? `lần chạy ${runLabel(input.trigger)}`
    : `từ lần chạy ${runLabel(from)} đến lần chạy ${runLabel(input.trigger)}`;
  return [
    `${scope}${lots ? `; lô QC: ${lots}` : ''}.`,
    `Khoảng nghi ngờ: ${range}${input.lastAccepted ? ` (lần chạy đạt gần nhất trước đó: ${runLabel(input.lastAccepted)})` : ''}.`,
    `Đã giữ kết quả từ: ${NCE_DRAFT_BLANK}`,
    `Đã báo cho: ${NCE_DRAFT_BLANK}`,
  ].join('\n');
}
