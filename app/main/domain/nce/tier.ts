// Phân tầng hồ sơ và nguy cơ (D-06, D-07).
//
// Nguy cơ = mức độ nghiêm trọng × khả năng xảy ra, mỗi trục 1–5 (ISO 22367:2020
// định nghĩa nguy cơ là kết hợp xác suất xảy ra tác hại và mức độ nghiêm trọng).
// Mức nguy cơ (thấp/trung bình/cao/nghiêm trọng) do người đánh giá chọn theo
// ma trận trong SOP và ghi căn cứ; app không tự đặt ngưỡng điểm vì chuẩn không
// quy định ngưỡng.
import { errorClass } from '../westgard-rules';
import type { NceDossier, NceMissing, NceRunSnapshot, NceSource } from './types';
import { textLength } from './format';

export function nceRiskScore(severity: number, probability: number): number {
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
  return valid(severity) && valid(probability) ? severity * probability : 0;
}

/** Lý do bắt buộc tầng `capa`. Rỗng thì được chọn `low` (kèm lý do). */
export function nceCapaTriggers(dossier: Pick<NceDossier, 'riskLevel' | 'patientImpacts' | 'runs' | 'causeStatus' | 'source' | 'recurrence'>): NceMissing[] {
  const triggers: NceMissing[] = [];
  if (dossier.riskLevel && dossier.riskLevel !== 'low') triggers.push({ code: 'risk', message: 'mức nguy cơ ban đầu từ trung bình trở lên' });
  if (dossier.patientImpacts.at(-1)?.outcome === 'reported_corrected') triggers.push({ code: 'patient', message: 'kết quả bệnh nhân đã trả bị ảnh hưởng' });
  if (dossier.runs.some((run) => run.role === 'repeat_reject')) triggers.push({ code: 'repeat', message: 'QC tiếp tục bị loại sau xử lý tức thời' });
  if (dossier.causeStatus === 'undetermined') triggers.push({ code: 'cause', message: 'chưa xác định được nguyên nhân' });
  if (dossier.source === 'eqa') triggers.push({ code: 'eqa', message: 'ngoại kiểm không đạt' });
  if (dossier.recurrence) triggers.push({ code: 'recurrence', message: 'sự cố tái diễn trong cửa sổ theo dõi' });
  return triggers;
}

/** Tầng đã chọn có hợp với các tiêu chí kích hoạt không. */
export function nceTierMissing(dossier: Pick<NceDossier, 'tier' | 'tierReason' | 'riskLevel' | 'patientImpacts' | 'runs' | 'causeStatus' | 'source' | 'recurrence'>): NceMissing[] {
  if (!dossier.tier) return [{ code: 'tier', message: 'Chưa phân tầng hồ sơ (xử lý nhanh hay CAPA).' }];
  if (dossier.tier === 'capa') return [];
  const triggers = nceCapaTriggers(dossier);
  if (triggers.length) return [{ code: 'tier-capa-required', message: `Hồ sơ phải xử lý theo CAPA vì ${triggers.map((t) => t.message).join('; ')}.` }];
  return textLength(dossier.tierReason) < 10 ? [{ code: 'tier-reason', message: 'Chọn xử lý nhanh phải ghi lý do không cần RCA/CAPA (ít nhất 10 ký tự).' }] : [];
}

/** Loại sai số (SE/RE) của một hồ sơ, đọc từ luật của các điểm bị LOẠI trong
 * lần chạy khởi đầu (luật cảnh báo đi kèm không quyết định loại sai số). */
export function nceErrorClass(runs: readonly { role: string; snapshot: NceRunSnapshot }[]): 'SE' | 'RE' | '' {
  const trigger = runs.find((run) => run.role === 'trigger');
  if (!trigger) return '';
  return errorClass(trigger.snapshot.points.filter((point) => point.verdict === 'rej').flatMap((point) => [...point.rules]));
}

export interface NceRecurrenceCandidate { id: string; testId: string | null; source: NceSource; errorClass: string; detectedDate: string; cancelled: boolean }

/** Có hồ sơ khác (không huỷ) cùng xét nghiệm, cùng loại sai số, phát hiện
 * trong `windowDays` ngày trước hồ sơ đang xét. Thiếu xét nghiệm hoặc loại sai
 * số thì không kết luận tái diễn (không đoán). */
export function nceIsRecurrence(current: NceRecurrenceCandidate, others: readonly NceRecurrenceCandidate[], windowDays: number): boolean {
  if (!current.testId || !current.errorClass) return false;
  const end = Date.parse(`${current.detectedDate}T00:00:00Z`);
  if (!Number.isFinite(end)) return false;
  const start = end - windowDays * 86400000;
  return others.some((other) => {
    if (other.id === current.id || other.cancelled || other.testId !== current.testId || other.errorClass !== current.errorClass) return false;
    const at = Date.parse(`${other.detectedDate}T00:00:00Z`);
    return Number.isFinite(at) && at >= start && at <= end;
  });
}
