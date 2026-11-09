// Thẻ khuyến nghị cải thiện khi Sigma < 4 của trang Six Sigma.
import { sigmaImprovement } from '../../../main/domain/sigma-metrics';
import { sigmaDesignEligible } from '../../lib/sigma-workflow';
import { sigmaZone } from './shared';
import type { SigmaLevelResult } from '../../../shared/qc-api';

/** Khuyến nghị cải thiện chỉ áp cho mức có Sigma tính được và < 4. Mục tiêu
 * CV/Bias và nhóm nguyên nhân (Quality Goal Index) do `sigmaImprovement()` của
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
  'Chuẩn hoá thao tác (pipet, thời gian ủ); giảm khác biệt giữa người làm.',
];
const FAIL_ACT = 'Tạm thời tăng QC tối đa; nếu không cải thiện, cân nhắc đổi thuốc thử/phương pháp/thiết bị.';

interface LevelImprovement { level: number; sigma: number; fail: boolean; estimate: boolean; status: string; cause: string; target: string; acts: string[] }

const ESTIMATE_NOTE = 'Ước tính tham khảo — dữ liệu IQC chưa đủ điều kiện hoặc chưa được xác nhận rà soát.';

function levelImprovement(level: number, result: SigmaLevelResult, tea: number | null): LevelImprovement | null {
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
  return {
    level, sigma, fail, estimate: !sigmaDesignEligible(result),
    status: fail ? 'Phương pháp chưa đạt năng lực — cần khắc phục trước khi tin cậy kết quả.' : 'Hiệu năng cận biên — nên cải thiện để vượt 4σ.',
    cause: `Nguyên nhân chủ yếu do ${driver}${plan.qgi != null ? ` (QGI ${plan.qgi.toFixed(2)})` : ''}.`,
    target: parts.length ? `Để đạt ≥ 4σ: ${parts.join(' hoặc ')}.` : 'Độ chệch đã vượt mức cho phép — phải giảm bias trước.',
    acts,
  };
}

/** MỘT thẻ cho cả kỳ (đánh giá giao diện 09/11/2026): trước đây mỗi mức một
 * thẻ lặp lại gần như nguyên văn cùng danh sách hành động, làm cột Tình trạng
 * rất dài. Nay mỗi mức một đoạn chẩn đoán và mục tiêu riêng, danh sách hành
 * động gộp các mức và chỉ in một lần. Màu viền theo mức có Sigma thấp nhất. */
export function ImprovementCard({ levels }: { levels: readonly { level: number; result: SigmaLevelResult; tea: number | null }[] }) {
  const items = levels.map(({ level, result, tea }) => levelImprovement(level, result, tea)).filter((item): item is LevelImprovement => !!item);
  if (!items.length) return null;
  const worst = items.reduce((low, item) => (item.sigma < low.sigma ? item : low));
  const acts = [...new Set(items.flatMap((item) => item.acts))];
  if (items.some((item) => item.fail)) acts.push(FAIL_ACT);
  // Câu chung của mọi mức (ước tính tham khảo, chưa đạt/cận biên) in một lần
  // ở đầu thẻ; mỗi mức chỉ còn phần riêng: nguyên nhân và mục tiêu.
  const sharedEstimate = items.every((item) => item.estimate);
  const sharedStatus = items.every((item) => item.status === items[0].status) ? items[0].status : null;
  return (
    <div className="alert sg-improvement-card" style={{ ['--sg-color' as never]: sigmaZone(worst.sigma).c }}>
      <b>Khuyến nghị cải thiện{items.length === 1 ? ` — Mức ${items[0].level}` : ''}</b>
      {sharedEstimate && <div className="sg-improvement-target">{ESTIMATE_NOTE}</div>}
      {sharedStatus && <div className="sg-improvement-lead">{sharedStatus}</div>}
      {items.map((item) => (
        <div className="sg-improvement-level" key={item.level}>
          {items.length > 1 && <b className="sg-improvement-level-name">Mức {item.level}</b>}
          {item.estimate && !sharedEstimate && <div className="sg-improvement-target">{ESTIMATE_NOTE}</div>}
          <div className="sg-improvement-lead">{sharedStatus ? item.cause : `${item.status} ${item.cause}`}</div>
          <div className="sg-improvement-target">{item.target}</div>
        </div>
      ))}
      <ul className="sg-improvement-list">
        {acts.map((act) => <li key={act}>{act}</li>)}
      </ul>
    </div>
  );
}
