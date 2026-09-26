// Thẻ khuyến nghị cải thiện khi Sigma < 4 của trang Six Sigma.
import { sigmaImprovement } from '../../../main/domain/sigma-metrics';
import { sigmaDesignEligible } from '../../lib/sigma-workflow';
import { sigmaZone } from './shared';
import type { SigmaLevelResult } from '../../../shared/qc-api';

/** Thẻ khuyến nghị cải thiện chỉ hiện khi Sigma tính được và < 4. Mục tiêu CV/
 * Bias và nhóm nguyên nhân (Quality Goal Index) do `sigmaImprovement()` của
 * main tính; thẻ này chỉ trình bày. */
const BIAS_ACTS = [
  'Hiệu chuẩn lại; kiểm tra lô/hạn dùng của calibrator.',
  'Kiểm tra giá trị đích EQA (nhóm peer cùng phương pháp/máy).',
  'Thử lô thuốc thử mới và chạy lại sau hiệu chuẩn.',
];
const CV_ACTS = [
  'Bảo trì định kỳ thiết bị (đèn, bơm, hệ quang).',
  'Kiểm tra lô thuốc thử & vật liệu QC (bảo quản, hạn dùng, độ đồng nhất).',
  'Ổn định nhiệt độ phòng/điện áp; tránh rung động.',
  'Chuẩn hóa thao tác (pipet, thời gian ủ); giảm khác biệt giữa người làm.',
];

export function ImprovementCard({ level, result, tea }: { level: number; result: SigmaLevelResult; tea: number | null }) {
  const sigma = result.sigma?.sigma;
  if (sigma == null || !Number.isFinite(sigma) || sigma >= 4) return null;
  const teaN = Number(tea ?? result.sigma?.tea ?? 0);
  const cv = Number(result.cv ?? 0);
  const bias = Math.abs(Number(result.biasEqa ?? 0));
  const fail = sigma < 3;
  const plan = sigmaImprovement(teaN, bias, cv);
  const driver = plan.driver === 'inaccuracy' ? 'độ chệch (bias) lớn' : plan.driver === 'imprecision' ? 'độ chụm (CV) lớn' : 'cả độ chệch lẫn độ chụm';
  const acts = plan.driver === 'inaccuracy' ? BIAS_ACTS : plan.driver === 'imprecision' ? CV_ACTS : [BIAS_ACTS[0], CV_ACTS[0], BIAS_ACTS[1], CV_ACTS[1]];
  const parts: string[] = [];
  if (plan.cvTarget > 0) parts.push(`giảm CV ≤ ${plan.cvTarget.toFixed(2)}% (hiện ${cv.toFixed(2)}%)`);
  if (plan.biasTarget > 0) parts.push(`giảm |Bias| ≤ ${plan.biasTarget.toFixed(2)}% (hiện ${bias.toFixed(2)}%)`);
  const zone = sigmaZone(sigma);
  return (
    <div className="alert sg-improvement-card" style={{ ['--sg-color' as never]: zone.c }}>
      <b>Khuyến nghị cải thiện — Mức {level}</b>
      {!sigmaDesignEligible(result) && <div className="sg-improvement-target">Ước tính tham khảo — dữ liệu IQC chưa đủ điều kiện hoặc chưa được xác nhận rà soát.</div>}
      <div className="sg-improvement-lead">
        {fail ? 'Phương pháp chưa đạt năng lực — cần khắc phục trước khi tin cậy kết quả.' : 'Hiệu năng cận biên — nên cải thiện để vượt 4σ.'} Nguyên nhân chủ yếu do {driver}{plan.qgi != null ? ` (QGI ${plan.qgi.toFixed(2)})` : ''}.
      </div>
      <div className="sg-improvement-target">{parts.length ? `Để đạt ≥ 4σ: ${parts.join(' hoặc ')}.` : 'Độ chệch đã vượt mức cho phép — phải giảm bias trước.'}</div>
      <ul className="sg-improvement-list">
        {acts.map((a) => <li key={a}>{a}</li>)}
        {fail && <li>Tạm thời tăng QC tối đa; nếu không cải thiện, cân nhắc đổi thuốc thử/phương pháp/thiết bị.</li>}
      </ul>
    </div>
  );
}
