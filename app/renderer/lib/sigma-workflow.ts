import type { SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';

/** Mức có đủ điều kiện dùng cho thiết kế QC hay không — đọc kết quả của main,
 * không dò lại điều kiện. `listPeriods()` chỉ để `qualityDesign` khác `null`
 * khi CV lấy từ IQC theo lô, cohort `eligible`, đã rà soát, dữ liệu nền chưa
 * đổi và Sigma tính được (xem `docs/SIGMA-REVIEW-2026-09-22-lan2.md`). Trước
 * 2026-09-26 hàm này chép lại từng điều kiện đó ở renderer (kế hoạch F.4). */
export function sigmaDesignEligible(level: SigmaLevelResult): boolean {
  return level.qualityDesign != null;
}
export function governingSigmaLevel(period: SigmaPeriodView | undefined): SigmaLevelResult | undefined {
  if (!period?.levels.length || !period.levels.every(sigmaDesignEligible)) return undefined;
  return [...period.levels].sort((a, b) => a.sigma!.sigma - b.sigma!.sigma)[0];
}
/** Dòng nháp của hộp thoại Bias; dòng lấy từ ngoại kiểm giữ mã kết quả và nhãn (SB-7). */
export interface EqaDraftRow { lab: string; target: string; eqaResultId?: string; label?: string }

export function parseEqaDraft(rounds: EqaDraftRow[]) {
  const parsedRounds: { lab: number; target: number; eqaResultId?: string; label?: string }[] = [];
  let hasIncompleteRound = false;
  for (const row of rounds) {
    const lab = row.lab.trim(), target = row.target.trim();
    if (!lab && !target) continue;
    if (!lab || !target || !Number.isFinite(Number(lab)) || !Number.isFinite(Number(target)) || Number(target) === 0) {
      hasIncompleteRound = true; continue;
    }
    parsedRounds.push({ lab: Number(lab), target: Number(target), ...(row.eqaResultId ? { eqaResultId: row.eqaResultId, label: row.label ?? '' } : {}) });
  }
  return { parsedRounds, hasIncompleteRound };
}
export function mdcRatios(level: SigmaLevelResult) {
  const tea = level.sigma?.tea;
  if (tea == null || tea <= 0 || level.cv == null || level.biasEqa == null || !Number.isFinite(level.sigma?.sigma)) return null;
  return { cvRatio: level.cv / tea * 100, biasRatio: Math.abs(level.biasEqa) / tea * 100 };
}
