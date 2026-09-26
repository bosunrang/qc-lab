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
export function parseEqaDraft(rounds: { lab: string; target: string }[]) {
  const parsedRounds: { lab: number; target: number }[] = [];
  let hasIncompleteRound = false;
  for (const row of rounds) {
    const lab = row.lab.trim(), target = row.target.trim();
    if (!lab && !target) continue;
    if (!lab || !target || !Number.isFinite(Number(lab)) || !Number.isFinite(Number(target)) || Number(target) === 0) {
      hasIncompleteRound = true; continue;
    }
    parsedRounds.push({ lab: Number(lab), target: Number(target) });
  }
  return { parsedRounds, hasIncompleteRound };
}
export function mdcRatios(level: SigmaLevelResult) {
  const tea = level.sigma?.tea;
  if (tea == null || tea <= 0 || level.cv == null || level.biasEqa == null || !Number.isFinite(level.sigma?.sigma)) return null;
  return { cvRatio: level.cv / tea * 100, biasRatio: Math.abs(level.biasEqa) / tea * 100 };
}
export function sigmaMuExport(level: SigmaLevelResult): (string | number)[] {
  const mu = level.mu;
  const date = (iso: string) => iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
  return [
    mu?.complete ? Number(mu.U.toFixed(4)) : '',
    mu?.complete && mu.absoluteU != null ? Number(mu.absoluteU.toFixed(4)) : '',
    mu?.complete && mu.teaRatio != null ? Number((mu.teaRatio * 100).toFixed(1)) : '',
    !mu ? 'Chưa có CV' : mu.complete ? 'Đủ thành phần; cần duyệt chuyên môn' : `Chưa đủ: ${mu.missing.join(', ')}`,
    mu?.includeBias === false ? 'Không cộng bias (cần chứng cứ hiệu chỉnh)' : 'Có cộng bias',
    // Cột hồ sơ ghi GIÁ TRỊ ĐÃ NHẬP, không phải phần đã vào ngân sách:
    // `mu.uCref` là null khi chưa có bias để cộng nhánh u(bias).
    level.uCref ?? '', level.uCal ?? '', level.teaCriterion || '',
    level.cvSource === 'iqc-cohort' ? `Lô ${level.sourceLot}; n=${level.cohortN}; ${date(level.sourceStart)}–${date(level.sourceEnd)}` : 'CV nhập tay',
    level.cohortStale ? 'Dữ liệu nền đã đổi; cần nạp và rà soát lại' : level.cohortReviewed ? `Đã rà soát: ${level.cohortReviewBy || ''}` : 'Chưa xác nhận rà soát IQC',
  ];
}


