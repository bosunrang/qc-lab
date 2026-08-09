type SigmaReadiness = { status: string; label: string; classifiable: boolean; qcpEligible: boolean };

export function sigmaZone(value: unknown) {
  const sigma = Number(value);
  if (sigma >= 6) return { c: '#13603f', label: 'Đẳng cấp thế giới' };
  if (sigma >= 5) return { c: '#2c7d5c', label: 'Xuất sắc' };
  if (sigma >= 4) return { c: '#3f9a55', label: 'Tốt' };
  if (sigma >= 3) return { c: '#dd8b1f', label: 'Cận biên' };
  return { c: '#c0362c', label: 'Không đạt' };
}

export function sigmaRunPlan(value: unknown) {
  const sigma = Number(value);
  if (!Number.isFinite(sigma)) return null;
  if (sigma >= 6) return { risk: 'Thấp', plan: 'Thiết kế QC theo đánh giá nguy cơ; không tự động giảm tần suất.' };
  if (sigma >= 5) return { risk: 'Thấp–trung bình', plan: 'Xác nhận bằng dữ liệu ổn định và SOP trước khi đơn giản hóa QC.' };
  if (sigma >= 4) return { risk: 'Trung bình', plan: 'Cân nhắc đa quy tắc và tăng giám sát theo nguy cơ.' };
  if (sigma >= 3) return { risk: 'Cao', plan: 'Tăng cường QC và ưu tiên cải thiện phương pháp.' };
  return { risk: 'Rất cao', plan: 'Không dùng Sigma để hợp thức hóa vận hành; cần khắc phục phương pháp.' };
}

export function formatSigmaDpmo(value: unknown): string {
  const dpmo = Number(value);
  return !Number.isFinite(dpmo) ? '—' : dpmo < 10 ? dpmo.toFixed(2) : dpmo < 1000 ? dpmo.toFixed(0) : Math.round(dpmo).toLocaleString('en-US');
}

export function sigmaReadiness(level: Record<string, any> | null | undefined): SigmaReadiness {
  if (!level || !['iqc-period', 'iqc-cohort'].includes(level.cvSource)) return { status: 'manual', label: 'CV nhập tay — chưa xác nhận bằng nhóm dữ liệu IQC cùng lô/mức', classifiable: true, qcpEligible: false };
  const status = ['insufficient', 'provisional', 'eligible', 'unstable'].includes(level.cohortStatus) ? level.cohortStatus : Number(level.n) < 20 ? 'insufficient' : Number(level.n) < 30 ? 'provisional' : 'eligible';
  if (status === 'insufficient') return { status, label: 'Chưa đủ 20 điểm QC', classifiable: false, qcpEligible: false };
  if (status === 'unstable') return { status, label: 'Nhóm dữ liệu IQC không ổn định', classifiable: false, qcpEligible: false };
  if (status === 'provisional') return { status, label: 'Kết quả tạm thời (20–29 điểm)', classifiable: true, qcpEligible: false };
  return { status: 'eligible', label: 'Đủ điều kiện dữ liệu', classifiable: true, qcpEligible: true };
}

export const sigmaPresentation = Object.freeze({ sigmaZone, sigmaRunPlan, formatSigmaDpmo, sigmaReadiness });
export type SigmaPresentation = typeof sigmaPresentation;
