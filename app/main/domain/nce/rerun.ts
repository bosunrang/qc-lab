// Kiểm lần chạy rerun làm bằng chứng cho phép hoạt động trở lại (D-04).
//
// Hàm thuần nhận SNAPSHOT đã dựng sẵn. Người gọi (main) phải đánh giá Westgard
// cho lần chạy ứng viên TRONG GIAI ĐOẠN MỚI — tức là coi chính lần chạy đó là
// mốc cắt (D-03) — rồi mới truyền verdict vào đây. Đánh giá trong giai đoạn cũ
// sẽ để chuỗi trước khắc phục (4-1s, 10x…) loại oan lần rerun.
import type { NceMissing, NceRunKey, NceRunPoint, NceRunSnapshot } from './types';
import { compareRun, runLabel, textLength } from './format';

export interface NceRerunInput {
  trigger: NceRunSnapshot;
  /** Các lần chạy bị loại đã gắn thêm vào hồ sơ trước khi cho chạy lại. */
  repeatRejects: readonly NceRunSnapshot[];
  candidate: NceRunSnapshot;
  /** Giải thích khi lần rerun dùng lô QC khác lần chạy khởi đầu. */
  lotChangeNote: string;
}

export interface NceRerunResult {
  ok: boolean;
  problems: NceMissing[];
  /** Các mức dùng lô khác lần chạy khởi đầu. */
  lotChangedLevels: number[];
}

function activePoints(snapshot: NceRunSnapshot): NceRunPoint[] { return snapshot.points.filter((point) => !point.voided); }

export function checkNceRerun(input: NceRerunInput): NceRerunResult {
  const { trigger, repeatRejects, candidate } = input;
  const problems: NceMissing[] = [];
  const add = (code: string, message: string) => problems.push({ code, message });

  if (candidate.testId !== trigger.testId) add('rerun-wrong-test', 'Lần chạy rerun phải cùng xét nghiệm với sự cố.');

  // Phải chạy SAU mọi lần chạy bị loại của hồ sơ, so theo ngày + mã run (không
  // chỉ theo ngày), nên rerun cùng ngày nhưng trước lần hỏng cuối bị từ chối.
  const latestFailure = [trigger, ...repeatRejects].reduce<NceRunKey>((latest, run) => compareRun(run, latest) > 0 ? run : latest, trigger);
  if (compareRun(candidate, latestFailure) <= 0) {
    add('rerun-too-early', `Lần chạy rerun phải sau lần chạy bị loại gần nhất của hồ sơ (${runLabel(latestFailure)}).`);
  }

  const failurePointIds = new Set([trigger, ...repeatRejects].flatMap((run) => run.points.map((point) => point.pointId)));
  if (candidate.points.some((point) => failurePointIds.has(point.pointId))) add('rerun-is-failure', 'Không dùng điểm QC gây sự cố làm bằng chứng rerun.');

  const active = activePoints(candidate);
  const byLevel = new Map(active.map((point) => [point.level, point]));
  // Đủ mọi mức có mặt trong lần chạy khởi đầu, kể cả điểm sau đó bị hủy: mức
  // đó đã được chạy khi sự cố xảy ra nên phải được chạy lại.
  const requiredLevels = [...new Set(trigger.points.map((point) => point.level))].sort((a, b) => a - b);
  const missingLevels = requiredLevels.filter((level) => !byLevel.has(level));
  if (missingLevels.length) add('rerun-missing-level', `Lần chạy rerun thiếu mức ${missingLevels.map((l) => `M${l}`).join(', ')} (điểm chưa nhập hoặc đã hủy).`);

  const rejected = active.filter((point) => point.verdict === 'rej').map((point) => point.level);
  if (rejected.length) add('rerun-rejected', `Lần chạy rerun vẫn bị loại ở mức ${rejected.map((l) => `M${l}`).join(', ')}.`);
  const unassessed = active.filter((point) => point.verdict === 'none').map((point) => point.level);
  if (unassessed.length) add('rerun-unassessed', `Mức ${unassessed.map((l) => `M${l}`).join(', ')} chưa có Mean/SD hợp lệ nên không đánh giá được lần rerun.`);

  const triggerLot = new Map(trigger.points.map((point) => [point.level, point.lot]));
  const lotChangedLevels = active.filter((point) => triggerLot.has(point.level) && triggerLot.get(point.level) !== point.lot).map((point) => point.level);
  if (lotChangedLevels.length && textLength(input.lotChangeNote) < 10) {
    add('rerun-lot-change', `Lần rerun dùng lô QC khác ở mức ${lotChangedLevels.map((l) => `M${l}`).join(', ')}; phải giải thích (ít nhất 10 ký tự).`);
  }

  return { ok: !problems.length, problems, lotChangedLevels };
}

/** Lần chạy khởi đầu phải thật sự bị loại (D-14: cảnh báo không mở NCE). */
export function nceTriggerMissing(snapshot: NceRunSnapshot): NceMissing[] {
  if (!snapshot.points.length) return [{ code: 'trigger-empty', message: 'Không tìm thấy điểm QC nào trong lần chạy đã chọn.' }];
  return snapshot.points.some((point) => point.verdict === 'rej') ? []
    : [{ code: 'trigger-not-rejected', message: 'Lần chạy này không bị loại; cảnh báo không cần lập hồ sơ NCE.' }];
}
