import type { Db } from '../db/sqlite-like';
import type { Test, SigmaLevelResult as SigmaLevelResultView, SigmaPeriodView as SigmaPeriodViewContract, SigmaTeaMode } from '../../shared/qc-api';
import { sigmaMetric, uncertaintyBudget, eqaRoundBias, eqaRoundsStats, sigmaQualityDesign, type SigmaMetricResult, type UncertaintyBudgetResult } from '../domain/sigma-metrics';
import { buildSigmaCohorts, type SigmaCohort, type SigmaCohortPoint } from '../domain/sigma-cohort';
import { countOperationalLevels } from '../db/operational-levels';
import { nceResolvedPointIds } from '../db/nce-repository';
import { operationalTeaSource, resolveTea, type SigmaTeaSourceCore } from '../domain/sigma-tea-core';
import { loadTeaRefs, loadTeaTest } from '../db/operational-tea';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE } from '../domain/tea-catalog';
import { isoLocalDate } from '../domain/local-date';
import { sha256Hex } from '../domain/sha256';
import { cleanId, cleanText, finiteNumber } from '../domain/text-utils';
import { type IpcResult, requireQcConfig } from './shared';
import { writeCommand } from './write-command';
import { resolvePeriodTea } from '../domain/sigma-period-tea';
import { preserveSigmaTeaHistory } from '../db/sigma-tea-history';
import { selectSigmaEqaBias, resolveSigmaEqaWindow, SIGMA_EQA_EXCLUSION_LABEL, type SigmaEqaBiasSelection, type SigmaEqaSample } from '../domain/sigma-eqa-bias';
import { createEqaHandlers } from './eqa-handlers';
import { eqaNceSourceKey } from './eqa-corrective-reader';

const PERIOD_RE = /^\d{4}-\d{2}$/;
const TEA_SOURCES = new Set(['lab', 'eflm', 'clia', 'ricos']);

export interface SigmaLevelInput {
  refreshCohort?: boolean; cohortReviewed?: boolean; cohortFingerprint?: string;
  level: number; tea?: unknown; targetMean?: unknown; cv?: unknown; biasEqa?: unknown; eqaRounds?: unknown[]; uCref?: unknown; uCal?: unknown; muBiasMode?: 'include' | 'exclude';
  cvSource?: 'manual' | 'iqc-cohort'; cohortN?: unknown; sourceLot?: unknown; sourceStart?: unknown; sourceEnd?: unknown; cohortStatus?: unknown;
}
export interface SigmaPeriodInput { testId: unknown; period: unknown; tea?: unknown; teaSource?: unknown; levels: SigmaLevelInput[]; createOnly?: unknown; sharedEqaRounds?: unknown[]; eqaWindowMonths?: unknown }

/** Một vòng EQA/EQC lưu kết quả PXN, giá trị đích và Bias% tính từ hai số đó;
 * vòng lấy từ ngoại kiểm đã nhập mang mã kết quả và nhãn (SB-7). */
export interface SigmaEqaRound { lab: number; target: number; bias: number; eqaResultId?: string; label?: string }

export interface SigmaLevelResult {
  eqaWindowMonths?: number;
  teaConversion?: SigmaLevelResultView['teaConversion'];
  muBiasMode?: 'include' | 'exclude'; cohortReviewed?: boolean; cohortReviewBy?: string; cohortReviewAt?: string; cohortStale?: boolean; teaCriterion?: string;
  level: number; tea: number | null; teaSnapshot: number | null; targetMean: number | null; cv: number | null; biasEqa: number | null; /** Trung bình Bias có dấu từ các vòng EQA; null khi nhập Bias tay. */ biasMean: number | null; biasRms: number | null; eqaRounds: SigmaEqaRound[]; mixedSigns: boolean; biasSem: number | null; uCref: number | null; uCal: number | null;
  cvSource: 'manual' | 'iqc-cohort'; cohortN: number | null; sourceLot: string; sourceStart: string; sourceEnd: string; cohortStatus: string;
  sigma: SigmaMetricResult | null; mu: UncertaintyBudgetResult | null; qualityDesign: ReturnType<typeof sigmaQualityDesign>;
}
export interface SigmaPeriodView { id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[]; savedTea?: SigmaPeriodViewContract['savedTea'] }

interface StoredLevel { level: number; /** TEa% đã chụp theo mức QC; nếu không có, dùng TEa cấp kỳ. */ tea: number | null; /** Mean mục tiêu snapshot, không dùng Mean hiện tại để sửa lịch sử MU. */ targetMean: number | null; cv: number | null; biasEqa: number | null; eqaRounds: SigmaEqaRound[]; /** Độ không đảm bảo của GIÁ TRỊ GÁN EQA/CRM (%), do nhà cung cấp công bố — không suy từ chuỗi bias. */ uCref: number | null; uCal: number | null; muBiasMode: 'include' | 'exclude'; cvSource?: 'manual' | 'iqc-cohort'; cohortN?: number | null; sourceLot?: string; sourceStart?: string; sourceEnd?: string; cohortStatus?: string }

type TeaBasis = Pick<ReturnType<typeof resolveTea>, 'value' | 'criterion' | 'criterionDetail'> & { source: string; reference?: string; capturedAt?: string; targetMean?: number | null };
interface StoredLevel {
  /** Số tháng đã chụp khi áp dụng Bias chung; sửa CV/MU không thay khoảng này. */
  eqaWindowMonths?: number;
  /** Cờ tương thích của kỳ cũ; chỉ giữ cố định khi có snapshot số. */
  teaLocked?: boolean;
  teaBasis?: TeaBasis;
  cohortFingerprint?: string;
  cohortReview?: { by: string; at: string; fingerprint: string };
}

function teaAtMean(basis: TeaBasis, mean: number | null): number | null {
  const c = basis.criterionDetail;
  if (!c || c.rule === 'percent') return basis.value;
  if (!c.absoluteUsable || mean == null || !Number.isFinite(mean) || mean === 0 || c.absolute == null) return null;
  const absolute = Math.abs(c.absolute / mean) * 100;
  return c.rule === 'absolute' ? absolute : Math.max(c.percent ?? 0, absolute);
}

function normalizeEqaRounds(raw: unknown): { ok: true; rounds: SigmaEqaRound[] } | { ok: false } {
  if (!Array.isArray(raw)) return { ok: true, rounds: [] };
  const rounds: SigmaEqaRound[] = [];
  for (const value of raw) {
    if (value == null || String(value).trim() === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const row = value as { lab?: unknown; target?: unknown; bias?: unknown; eqaResultId?: unknown; label?: unknown };
      const lab = row.lab == null || String(row.lab).trim() === '' ? NaN : finiteNumber(row.lab, NaN);
      const target = row.target == null || String(row.target).trim() === '' ? NaN : finiteNumber(row.target, NaN);
      if (Number.isFinite(lab) && Number.isFinite(target) && target !== 0) {
        // Vòng lấy từ ngoại kiểm giữ mã kết quả và nhãn để truy vết (SB-7).
        const eqaResultId = typeof row.eqaResultId === 'string' ? cleanId(row.eqaResultId) : '';
        const label = eqaResultId ? cleanText(row.label, 160).trim() : '';
        rounds.push({ lab, target, bias: eqaRoundBias(lab, target), ...(eqaResultId ? { eqaResultId, label } : {}) });
        continue;
      }
      return { ok: false };
    }
    return { ok: false };
  }
  return { ok: true, rounds };
}

/** Chuẩn hoá dữ liệu mức đã lưu trước khi tính lại Sigma và MU. */
function readStoredLevels(raw: string): StoredLevel[] {
  const parsed = JSON.parse(raw || '[]') as Array<Omit<StoredLevel, 'tea' | 'targetMean' | 'eqaRounds'> & { tea?: unknown; targetMean?: unknown; eqaRounds?: unknown }>;
  return parsed.map((level) => {
    const normalized = normalizeEqaRounds(level.eqaRounds);
    const candidateTea = finiteNumber(level.tea, NaN);
    const candidateTarget = finiteNumber(level.targetMean, NaN);
    return { ...level, tea: Number.isFinite(candidateTea) && candidateTea > 0 ? candidateTea : null, targetMean: Number.isFinite(candidateTarget) && candidateTarget !== 0 ? candidateTarget : null, eqaRounds: normalized.ok ? normalized.rounds : [] };
  });
}

/** Bias từ vòng EQA thắng số nhập tay; SEM chỉ tham khảo, KHÔNG là u(Cref). */
/** Thứ tự lấy TEa của một mức, KHÔNG được đảo:
 *   1. snapshot `lv_json.tea` của chính mức đó — kỳ đã chốt thì không bị kéo
 *      lại theo Bảng TEa tham chiếu hiện hành;
 *   2. GIẢI từ nguồn TEa đang khai, tại Mean của CHÍNH mức đó;
 *   3. mới đến `periodTea` (một con số dùng chung cho cả kỳ).
 *
 * Giải theo mức là bắt buộc với tiêu chí CLIA
 * dạng TUYỆT ĐỐI (vd Sodium ±4,0000 mmol/L) thì TEa% = |giới hạn / Mean| ×
 * 100, tức mỗi mức phải ra MỘT SỐ KHÁC NHAU. Rơi thẳng về `periodTea` nghĩa
 * là dùng một TEa% dùng chung, chỉ có thể đúng tại một Mean. Với nguồn dạng
 * % (Ricos/EFLM/PXN), giải theo mức và TEa cấp kỳ cho cùng kết quả. */
function computeLevel(stored: StoredLevel, periodTea: number | null, resolveLevelTea?: (level: number, targetMean: number | null) => TeaBasis | undefined, levelCount?: number, resolveFallbackTea?: (level: number, targetMean: number | null) => TeaBasis | undefined): SigmaLevelResult {
  // Thứ tự: snapshot của mức → giải theo nguồn ĐÃ CHỐT của kỳ → snapshot cấp
  // kỳ → (cuối cùng) giải theo nguồn ĐANG KHAI của xét nghiệm. Bậc cuối chỉ
  // chạy khi kỳ không có snapshot nào — xem `teaChain()`.
  let resolvedBasis: TeaBasis | undefined;
  const fromSource = (resolve?: typeof resolveLevelTea): number | null => {
    const basis = resolve?.(stored.level, stored.targetMean ?? null);
    if (basis?.value == null || basis.value <= 0) return null;
    resolvedBasis = basis;
    return basis.value;
  };
  const tea = resolvePeriodTea(stored, periodTea, () => fromSource(resolveLevelTea), () => fromSource(resolveFallbackTea));
  // Metadata đi cùng chính bậc đã cung cấp TEa; snapshot không được mượn
  // Mean hiện hành để mô tả lại nồng độ lịch sử chưa từng được lưu.
  const usedBasis = stored.tea != null ? stored.teaBasis : resolvedBasis;
  const conversion = usedBasis?.source === 'clia' && usedBasis.criterionDetail?.absoluteUsable && usedBasis.criterionDetail.rule !== 'percent'
    ? { targetMean: stored.tea != null ? stored.targetMean ?? usedBasis.targetMean ?? null : usedBasis.targetMean ?? null, unit: usedBasis.criterionDetail.unit }
    : undefined;
  const roundsStats = stored.eqaRounds && stored.eqaRounds.length ? eqaRoundsStats(stored.eqaRounds.map((round) => round.bias)) : null;
  // SB-1: Sigma dùng trung bình có dấu (sai số hệ thống; phần dao động đã nằm
  // trong CV). RMS gộp cả độ phân tán nên chỉ dùng cho ngân sách MU (Nordtest).
  const biasEqa = roundsStats ? roundsStats.mean : stored.biasEqa;
  const biasRms = roundsStats ? roundsStats.rms : stored.biasEqa;
  const biasSem = roundsStats ? roundsStats.biasSem : null;
  // Bias chưa được đánh giá không đồng nghĩa Bias = 0; không suy ra Sigma
  // từ một giả định lạc quan.
  const sigma = tea != null && stored.cv != null && biasEqa != null ? sigmaMetric(tea, biasEqa, stored.cv) : null;
  const mu = stored.cv != null
    ? uncertaintyBudget({ cv: stored.cv, bias: biasRms, uCref: stored.uCref, includeBias: stored.muBiasMode !== 'exclude', uCal: stored.uCal, tea: tea ?? undefined, target: stored.targetMean ?? undefined })
    : null;
  return { level: stored.level, tea, teaSnapshot: stored.tea, ...(stored.eqaWindowMonths ? { eqaWindowMonths: stored.eqaWindowMonths } : {}), ...(conversion ? { teaConversion: conversion } : {}), targetMean: stored.targetMean, cv: stored.cv, biasEqa, biasMean: roundsStats?.mean ?? null, biasRms, eqaRounds: stored.eqaRounds || [], mixedSigns: roundsStats?.mixedSigns ?? false, biasSem, uCref: stored.uCref, uCal: stored.uCal,
    muBiasMode: stored.muBiasMode || 'include', teaCriterion: [stored.teaBasis?.criterion, stored.teaBasis?.reference].filter(Boolean).join(' · '), cohortReviewed: !!stored.cohortReview,
    cohortReviewBy: stored.cohortReview?.by || '', cohortReviewAt: stored.cohortReview?.at || '',
    cvSource: stored.cvSource === 'iqc-cohort' ? 'iqc-cohort' : 'manual', cohortN: stored.cohortN ?? null, sourceLot: stored.sourceLot || '', sourceStart: stored.sourceStart || '', sourceEnd: stored.sourceEnd || '', cohortStatus: stored.cohortStatus || '',
    sigma, mu, qualityDesign: sigmaQualityDesign(sigma?.sigma, levelCount) };
}

export function createSigmaHandlers(db: Db) {
  const eqa = createEqaHandlers(db);
  /** Dấu vân tay của ĐÚNG những gì `buildSigmaCohorts()` đọc, không hơn:
   * các điểm QC của (xét nghiệm, mức, lô) tới hết kỳ, và tập điểm đã có hồ sơ
   * khắc phục duyệt xong + hiệu quả (`resolvedPointIds`).
   *
   * CỐ Ý KHÔNG băm cấu hình luật Westgard (`tests.rule_*_json`,
   * `app_meta.westgardRules`): cổng duy nhất của cohort là
   * |z| > 3 tính từ snapshot của chính điểm, nó KHÔNG đọc bảng luật. Hệ quả
   * Thay đổi luật không làm thay đổi dữ liệu của cohort. Ảnh hưởng THẬT của
   * việc đổi luật (điểm bị loại → có người mở NCE) đi vào đây qua tập điểm
   * đã được hồ sơ NCE xử lý trọn vẹn (D-11, `nceResolvedPointIds()`): hồ sơ
   * không gắn lần chạy QC không đổi được kết luận của nhóm. */
  function resolvedActionsDigest(testId: string): string {
    return JSON.stringify(nceResolvedPointIds(db, testId));
  }
  /** `actionsDigest` truyền vào để một lượt đọc nhiều kỳ/nhiều mức chỉ truy
   * vấn bảng `actions` MỘT lần: `listPeriods()` gọi hàm này cho từng mức của
   * từng kỳ (24 kỳ × 3 mức = 72 lần). */
  function cohortFingerprint(testId: string, period: string, level: number, lot: string, actionsDigest = resolvedActionsDigest(testId)): string {
    const rows = db.prepare('SELECT id,date,run_id,val,voided,qc_mean,qc_sd FROM qc_points WHERE test_id=? AND level=? AND lot=? AND date<=? ORDER BY id')
      .all(testId, level, lot, `${period}-31`);
    return sha256Hex(JSON.stringify([rows, actionsDigest]));
  }
  /** SỐ MỨC QC dùng để chọn bảng Westgard Sigma Rules (Westgard công bố hai
   * bảng khác hẳn nhau cho 2 mức và 3 mức, khác cả bộ luật lẫn N/R).
   *
   * Phải là THIẾT KẾ QC ĐANG VẬN HÀNH (`countOperationalLevels()`, nguồn dùng
   * chung với Nhập QC và Phân tích Westgard), KHÔNG phải số dòng người dùng đã
   * tạo trong kỳ. Một phòng chạy 3 mức nhưng kỳ đó chỉ nhập 2 dòng phải dùng
   * bảng 3 mức, không được suy thành thiết kế 2 mức.
   *
   * Ba bậc, KHÔNG được đảo: mức đang vận hành → mức đã khai trong
   * `test_levels` (nhóm lô đã dừng thì thiết kế QC vẫn là ngần ấy mức) → số
   * mức có trong chính kỳ đó (bậc cuối chỉ để kỳ lịch sử của một xét nghiệm
   * đã bị xoá sạch cấu hình vẫn đọc được). */
  function designLevelCount(testId: string, stored: readonly StoredLevel[]): number {
    const declared = db.prepare('SELECT COUNT(*) AS n FROM test_levels WHERE test_id=?').get(testId) as { n: number } | undefined;
    return countOperationalLevels(db, testId) || (declared?.n ?? 0) || new Set(stored.map(level => level.level)).size;
  }

  function listPeriods(testId: string, teaMode: SigmaTeaMode = 'stored'): SigmaPeriodView[] {
    const rows = db.prepare('SELECT * FROM sigma_data WHERE test_id=? ORDER BY period ASC').all(testId) as {
      id: string; test_id: string; period: string; tea: number | null; tea_source: string; lv_json: string;
    }[];
    const teaResolver = makeLevelTeaResolver(testId);
    const operational = teaMode === 'operational';
    const operatingSource = teaResolver.currentSource || 'lab';
    const actionsDigest = resolvedActionsDigest(testId);
    return rows.map(r => {
      const stored = readStoredLevels(r.lv_json);
      const chain = teaChain(teaResolver, r.tea_source);
      const levelCount = designLevelCount(testId, stored);
      return { id: r.id, testId: r.test_id, period: r.period,
        tea: operational ? null : r.tea, teaSource: operational ? operatingSource : r.tea_source,
        ...(operational ? { savedTea: { tea: r.tea, source: r.tea_source } } : {}), levels: stored.map(s => {
        // Màn phân tích tính lại bằng nguồn vận hành nhưng giữ CV/Bias, lô,
        // Mean và căn cứ rà soát của kỳ. Chỉ đọc, không sửa snapshot trong DB.
        const activeBasis = operational ? teaResolver.basis(operatingSource, s.level, s.targetMean ?? s.teaBasis?.targetMean ?? null) : undefined;
        const result = operational
          ? computeLevel({ ...s, tea: null, teaBasis: undefined, teaLocked: false }, null, () => activeBasis, levelCount)
          : computeLevel(s, r.tea, chain.bySource, levelCount, chain.fallback);
        if (operational) {
          result.teaSnapshot = s.tea;
          result.teaCriterion = [activeBasis?.criterion, activeBasis?.reference].filter(Boolean).join(' · ');
        }
        if (s.cvSource === 'iqc-cohort') {
          const current = cohortFingerprint(testId, r.period, s.level, s.sourceLot || '', actionsDigest);
          result.cohortStale = s.cohortFingerprint !== current;
          result.cohortReviewed = !result.cohortStale && s.cohortReview?.fingerprint === current;
          if (!result.cohortReviewed || result.cohortStatus !== 'eligible') result.qualityDesign = null;
        } else result.qualityDesign = null;
        return result;
      }) };
    });
  }

  /** Bộ giải TEa theo mức cho MỘT xét nghiệm: đọc một lượt cấu hình xét
   * nghiệm, lớp phủ hồ sơ TEa của phòng xét nghiệm và Mean hiện hành của từng
   * mức, rồi trả về hàm thuần. Mean ưu tiên snapshot của kỳ
   * (`stored.targetMean`, truyền vào từ ngoài) rồi mới tới Mean hiện hành —
   * để giữ báo cáo đã chốt ổn định khi cấu hình thay đổi. */
  function makeLevelTeaResolver(testId: string) {
    const shape = loadTeaTest(db, testId);
    if (!shape) return { bySource: () => null, basis: (): TeaBasis | undefined => undefined, currentSource: '' };
    const refs = loadTeaRefs(db);
    const means = new Map<number, number | null>(
      (db.prepare('SELECT level,mean FROM test_levels WHERE test_id=?').all(testId) as { level: number; mean: number | null }[])
        .map((row) => [row.level, row.mean]),
    );
    const basis = (rawSource: string, level: number, targetMean: number | null): TeaBasis | undefined => {
      const source = rawSource.toLowerCase();
      if (!TEA_SOURCES.has(source)) return undefined;
      const mean = targetMean ?? means.get(level) ?? null;
      const { value, criterion, criterionDetail } = resolveTea(shape, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE, source as SigmaTeaSourceCore, mean, level);
      const reference = source === 'eflm' ? [shape.eflm_analyte, shape.eflm_ref, shape.eflm_lookup_date].filter(Boolean).join(' · ') : '';
      return { value, criterion, criterionDetail, source, reference, capturedAt: new Date().toISOString(), targetMean: mean };
    };
    // Nguồn vận hành chung của danh mục và Sigma; dữ liệu cũ chưa chọn riêng
    // vẫn ưu tiên hồ sơ PXN rồi nguồn Sigma đã khai.
    const currentSource = operationalTeaSource(shape, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE);
    return { basis, currentSource };
  }

  /** Hai bậc giải TEa cho một kỳ: theo nguồn ĐÃ CHỐT của kỳ, và — chỉ khi kỳ
   * không có snapshot nào — theo nguồn ĐANG KHAI của xét nghiệm.
   *
   * Vì sao cần bậc thứ hai: kỳ được tạo lúc nguồn TEa còn chưa giải được (vd
   * chọn "TEa chuẩn hoá của PXN" mà chưa có hồ sơ) sẽ chốt `tea = null`. Một
   * snapshot NULL không phải lịch sử cần bảo vệ — nó có nghĩa "chưa bao giờ
   * giải được". Nếu vẫn ghim vào nó thì kỳ đó vĩnh viễn không tính được Sigma
   * kể cả sau khi phòng xét nghiệm đã khai nguồn TEa, và người dùng không có
   * cách nào biết phải xoá kỳ rồi tạo lại. Mọi snapshot THẬT (một con số) vẫn
   * thắng bậc này, nên kỳ lịch sử không bị kéo lại theo cấu hình hôm nay. */
  function teaChain(resolver: ReturnType<typeof makeLevelTeaResolver>, periodSource: string) {
    return {
      bySource: (level: number, targetMean: number | null) => resolver.basis(periodSource, level, targetMean),
      fallback: (level: number, targetMean: number | null) => (resolver.currentSource && resolver.currentSource !== periodSource
        ? resolver.basis(resolver.currentSource, level, targetMean)
        : undefined),
    };
  }

  function listCohorts(testId: string, period: string, levels: number[]): (SigmaCohort & { fingerprint: string })[] {
    if (!PERIOD_RE.test(period)) return [];
    const normalizedLevels = [...new Set(levels.map((level) => Math.round(Number(level))))];
    const safeLevels = normalizedLevels.filter((level) => Number.isInteger(level) && level > 0);
    if (!safeLevels.length) return [];
    const rows = db.prepare('SELECT id,level,date,lot,val,voided,qc_mean,qc_sd FROM qc_points WHERE test_id=? ORDER BY level,date,run_id').all(testId) as unknown as SigmaCohortPoint[];
    // Điểm mất kiểm soát ĐÃ được xử lý trọn vẹn (hồ sơ NCE đã đóng và xử lý
    // xong — D-11) thì không còn chặn nhóm — đúng tinh thần ISO/TS 20914:
    // dữ liệu IQC phải đại diện cho hoạt động thường quy SAU khi quản lý QC.
    // Hồ sơ đang mở, chờ duyệt hoặc đã huỷ đều KHÔNG tính là đã xử lý.
    const resolved = new Set(nceResolvedPointIds(db, testId));
    const actionsDigest = resolvedActionsDigest(testId);
    return buildSigmaCohorts(rows, period, safeLevels, isoLocalDate(), resolved).map(cohort => ({
      ...cohort, fingerprint: cohortFingerprint(testId, period, cohort.level, cohort.lot, actionsDigest),
    }));
  }

  /** TEa là tiêu chí chất lượng của xét nghiệm (Sigma, thiết kế QC, cổng Bias
   * khi đổi dải) nên cần quyền `qc.config`, không phải mọi tài khoản ghi. */
  const saveTeaConfig = writeCommand(db, 'saveTeaConfig', requireQcConfig(db), (w, input: { testId?: unknown; source?: unknown; tea?: unknown; eflmAnalyte?: unknown; eflmAps?: unknown; eflmLookupDate?: unknown; eflmRef?: unknown }): IpcResult<Test> => {
    const testId = cleanId(input?.testId), source = cleanText(input?.source, 20).trim();
    if (!TEA_SOURCES.has(source)) return { ok: false, error: { code: 'invalid-tea-source', message: 'Nguồn TEa không hợp lệ.' } };
    const test = db.prepare('SELECT * FROM tests WHERE id=?').get(testId) as {
      id: string; name: string; tea_source: string; operational_tea_source: string; tea: number; eflm_tea: number | null; eflm_analyte: string; eflm_aps: string; eflm_lookup_date: string; eflm_ref: string;
    } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const tea = input?.tea == null || input.tea === '' ? Number(source === 'eflm' ? test.eflm_tea ?? test.tea ?? 0 : test.tea || 0) : finiteNumber(input.tea, NaN);
    if (source === 'eflm' && input?.tea != null && input.tea !== '' && (!Number.isFinite(tea) || tea <= 0)) return { ok: false, error: { code: 'invalid-tea', message: 'TEa EFLM phải là số dương.' } };
    const eflmAps = input?.eflmAps == null ? test.eflm_aps : cleanText(input.eflmAps, 20).trim();
    if (!['minimum', 'desirable', 'optimum'].includes(eflmAps || 'desirable')) return { ok: false, error: { code: 'invalid-eflm-aps', message: 'Mức APS EFLM không hợp lệ.' } };
    // API vá từng trường: đổi nguồn không được làm mất thông tin EFLM đã nhập
    // trước đó, kể cả khi lời gọi đến từ một màn hình khác trong tương lai.
    const next = [
      source, Number.isFinite(tea) ? tea : 0,
      input?.eflmAnalyte == null ? test.eflm_analyte : cleanText(input.eflmAnalyte, 160).trim(),
      eflmAps || 'desirable',
      input?.eflmLookupDate == null ? test.eflm_lookup_date : cleanText(input.eflmLookupDate, 10).trim(),
      input?.eflmRef == null ? test.eflm_ref : cleanText(input.eflmRef, 500).trim(),
      source === 'eflm' && input.tea != null && input.tea !== '' ? tea : test.eflm_tea,
      source,
    ] as const;
    const current = [test.tea_source, test.tea, test.eflm_analyte, test.eflm_aps, test.eflm_lookup_date, test.eflm_ref, test.eflm_tea, test.operational_tea_source];
    if (next.every((value, i) => value === current[i])) return w.noChange(test as unknown as Test);
    // Ghi trước → sau của đúng những trường đổi, để truy được TEa đã dùng ở
    // từng thời điểm (trước đây chỉ ghi "Nguồn eflm").
    const fieldLabels = ['nguồn', 'TEa', 'xét nghiệm EFLM', 'mức APS', 'ngày tra EFLM', 'tài liệu EFLM', 'TEa EFLM', 'nguồn vận hành'];
    const changes = next.flatMap((value, i) => value === current[i] ? [] : [`${fieldLabels[i]}: ${current[i] || current[i] === 0 ? current[i] : '—'} → ${value || value === 0 ? value : '—'}`]);
    w.commit((tx) => {
      const preserved = preserveSigmaTeaHistory(db, testId);
      db.prepare('UPDATE tests SET tea_source=?,tea=?,eflm_analyte=?,eflm_aps=?,eflm_lookup_date=?,eflm_ref=?,eflm_tea=?,operational_tea_source=? WHERE id=?').run(...next, testId);
      tx.audit('Cập nhật TEa Six Sigma', `Xét nghiệm "${test.name}": ${changes.join('; ')}${preserved ? `; giữ TEa của ${preserved} kỳ cũ` : ''}`, test.name);
      tx.changed(preserved ? ['tests', 'sigma_data'] : ['tests'], [testId]);
    });
    return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(testId) as Test };
  });

  const savePeriod = writeCommand(db, 'savePeriod', 'write', (w, input: SigmaPeriodInput): IpcResult<SigmaPeriodView> => {
    const actor = w.actor;
    const testId = cleanId(input.testId);
    const test = db.prepare('SELECT id, name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const period = cleanText(input.period, 7).trim();
    if (!PERIOD_RE.test(period) || Number(period.slice(5)) < 1 || Number(period.slice(5)) > 12) return { ok: false, error: { code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM hợp lệ.' } };
    let windowMonths: number;
    try { windowMonths = resolveSigmaEqaWindow(period, input.eqaWindowMonths).windowMonths; }
    catch { return { ok: false, error: { code: 'invalid-eqa-window', message: 'Số tháng lấy ngoại kiểm phải là số nguyên từ 1 trở lên và nằm trong phạm vi lịch hợp lệ.' } }; }
    if (!Array.isArray(input.levels) || !input.levels.length) return { ok: false, error: { code: 'missing-levels', message: 'Cần ít nhất 1 mức dữ liệu.' } };
    const id = `${testId}:${period}`;
    const existing = db.prepare('SELECT id,lv_json,tea_source FROM sigma_data WHERE id=?').get(id) as { id: string; lv_json: string; tea_source: string } | undefined;
    if (existing && input.createOnly === true) return { ok: false, error: { code: 'duplicate-period', message: `Đã có kỳ Sigma ${period}. Hãy cập nhật kỳ hiện có.` } };
    const prior = existing ? readStoredLevels(existing.lv_json) : [];
    // Chỉ thao tác áp dụng Bias chung mới thay các mức; sửa CV/MU giữ căn cứ cũ.
    let sharedRounds: SigmaEqaRound[] | undefined;
    if (input.sharedEqaRounds !== undefined) {
      const checked = normalizeEqaRounds(input.sharedEqaRounds);
      if (!Array.isArray(input.sharedEqaRounds) || !checked.ok || !checked.rounds.length) return { ok: false, error: { code: 'invalid-eqa-round', message: 'Bias chung cần ít nhất một mẫu có đủ kết quả và giá trị ấn định hợp lệ.' } };
      // SB-4b: Bias chung chỉ lấy từ ngoại kiểm và dùng đủ mọi mẫu hợp lệ; không
      // trộn vòng nhập tay để chọn riêng mẫu có lợi.
      if (checked.rounds.some(round => !round.eqaResultId)) return { ok: false, error: { code: 'eqa-mixed', message: 'Bias chung chỉ lấy từ ngoại kiểm. Vòng nhập tay lưu riêng cho từng mức, không trộn với mẫu ngoại kiểm.' } };
      sharedRounds = checked.rounds;
    }
    const teaSource = cleanText(input.teaSource, 200).trim().toLowerCase();
    if (teaSource && !TEA_SOURCES.has(teaSource)) return { ok: false, error: { code: 'invalid-tea-source', message: 'Nguồn TEa không hợp lệ.' } };
    const resolver = makeLevelTeaResolver(testId);
    const tea = input.tea == null || input.tea === '' ? null : finiteNumber(input.tea, NaN);
    if (tea != null && (!Number.isFinite(tea) || tea <= 0)) return { ok: false, error: { code: 'invalid-tea', message: 'TEa phải là số dương.' } };
    for (const inputLevel of input.levels) {
      const normalized = normalizeEqaRounds(inputLevel.eqaRounds);
      if (!normalized.ok) return { ok: false, error: { code: 'invalid-eqa-round', message: 'Mỗi vòng EQA/EQC cần đủ KQ PXN và Target EQA hợp lệ (Target khác 0).' } };
    }
    const stored: StoredLevel[] = input.levels.map(lv => ({
      level: finiteNumber(lv.level, NaN),
      eqaWindowMonths: prior.find(p => p.level === finiteNumber(lv.level, NaN))?.eqaWindowMonths,
      tea: lv.tea == null || lv.tea === '' ? null : finiteNumber(lv.tea, NaN),
      targetMean: lv.targetMean == null || lv.targetMean === '' ? null : finiteNumber(lv.targetMean, NaN),
      cv: lv.cv == null || lv.cv === '' ? null : finiteNumber(lv.cv, NaN),
      biasEqa: lv.biasEqa == null || lv.biasEqa === '' ? null : finiteNumber(lv.biasEqa, NaN),
      eqaRounds: (() => { const normalized = normalizeEqaRounds(lv.eqaRounds); return normalized.ok ? normalized.rounds : []; })(),
      uCref: lv.uCref == null || lv.uCref === '' ? null : finiteNumber(lv.uCref, NaN),
      uCal: lv.uCal == null || lv.uCal === '' ? null : finiteNumber(lv.uCal, NaN),
      muBiasMode: lv.muBiasMode === 'exclude' ? 'exclude' : 'include',
      cvSource: lv.cvSource === 'iqc-cohort' ? 'iqc-cohort' : 'manual',
      cohortN: lv.cohortN == null ? null : finiteNumber(lv.cohortN, NaN),
      sourceLot: cleanText(lv.sourceLot, 120).trim(), sourceStart: cleanText(lv.sourceStart, 10).trim(), sourceEnd: cleanText(lv.sourceEnd, 10).trim(), cohortStatus: cleanText(lv.cohortStatus, 30).trim(),
    }));
    if (sharedRounds) for (const level of stored) {
      level.eqaRounds = sharedRounds.map(round => ({ ...round }));
      level.biasEqa = null;
      level.eqaWindowMonths = windowMonths;
    }
    if (sharedRounds && prior.some(p => !stored.some(l => l.level === p.level))) return { ok: false, error: { code: 'shared-bias-levels', message: 'Cần giữ đủ các mức QC đã có khi áp dụng Bias chung. Tải lại kỳ trước khi lưu.' } };
    for (const level of stored) {
      if (!Number.isInteger(level.level) || level.level < 1) return { ok: false, error: { code: 'invalid-level', message: 'Mức QC không hợp lệ.' } };
      if (level.tea != null && (!Number.isFinite(level.tea) || level.tea <= 0)) return { ok: false, error: { code: 'invalid-level-tea', message: 'TEa của mức QC phải là số dương.' } };
      if (level.targetMean != null && (!Number.isFinite(level.targetMean) || level.targetMean === 0)) return { ok: false, error: { code: 'invalid-target-mean', message: 'Mean mục tiêu của mức QC phải là số khác 0.' } };
      if (level.cv != null && (!Number.isFinite(level.cv) || level.cv <= 0)) return { ok: false, error: { code: 'invalid-cv', message: 'CV IQC phải là số dương.' } };
      if (level.biasEqa != null && !Number.isFinite(level.biasEqa)) return { ok: false, error: { code: 'invalid-bias', message: 'Bias EQA/EQC phải là một số hợp lệ.' } };
      if (level.uCref != null && (!Number.isFinite(level.uCref) || level.uCref < 0)) return { ok: false, error: { code: 'invalid-u-cref', message: 'u(Cref) phải là số không âm.' } };
      if (level.uCal != null && (!Number.isFinite(level.uCal) || level.uCal < 0)) return { ok: false, error: { code: 'invalid-u-cal', message: 'u(cal) phải là số không âm.' } };
      if (level.cohortN != null && (!Number.isInteger(level.cohortN) || level.cohortN < 0)) return { ok: false, error: { code: 'invalid-cohort', message: 'Số điểm IQC của lô không hợp lệ.' } };
    }
    if (new Set(stored.map((level) => level.level)).size !== stored.length) return { ok: false, error: { code: 'duplicate-level', message: 'Mỗi mức QC chỉ được có một bộ số liệu trong một kỳ.' } };
    // Mức phải thật sự được khai cho xét nghiệm. Cổng này không chỉ kiểm số
    // nguyên ≥ 1, nên gọi thẳng IPC với `level: 7` cho một xét nghiệm 1 mức là
    // lưu được, và dòng ma đó cũng tính vào số mức chọn bảng Sigma Rules.
    // Chỉ chặn mức chưa từng có trong kỳ: mức đã chốt nhưng sau đó bị gỡ khỏi
    // cấu hình vẫn cần sửa được CV/Bias/MU để hồ sơ không bị khoá cứng.
    const declaredLevels = new Set((db.prepare('SELECT level FROM test_levels WHERE test_id=?').all(testId) as { level: number }[]).map((row) => row.level));
    const priorLevels = new Set(prior.map((level) => level.level));
    const unknown = stored.filter((level) => !declaredLevels.has(level.level) && !priorLevels.has(level.level)).map((level) => level.level);
    if (unknown.length) return { ok: false, error: { code: 'unknown-level', message: `Mức ${unknown.join(', ')} chưa được khai báo cho xét nghiệm này. Hãy thêm mức ở Cấu hình chung trước.` } };
    // KHÔNG tin kết luận cohort do renderer gửi lên. `cohortStatus` quyết
    // định một mức có được dùng cho gợi ý thiết kế QC hay không
    // (`SigmaPage.tsx` lọc theo `cohortStatus === 'eligible'`), mà app
    // Electron có F12 nên gọi thẳng
    // `window.qcApi.saveSigmaPeriod({ ... cohortStatus: 'eligible' })` là
    // qua được — mã nguồn chỉ nhận một trong các giá trị được công bố.
    //
    // Người dùng CHỌN lô (`sourceLot`); mọi con số mô tả nhóm đó thì main tự
    // dựng lại từ chính `qc_points` qua `listCohorts()`. Đường dùng thật
    // không đổi giá trị: `SigmaPage` vốn gán `cv`/`cohortN`/`sourceStart`/
    // `sourceEnd`/`cohortStatus` từ đúng cohort đó.
    const fromCohort = stored.filter((level) => level.cvSource === 'iqc-cohort');
    if (fromCohort.length) {
      const cohorts = listCohorts(testId, period, fromCohort.map((level) => level.level));
      for (const level of fromCohort) {
        const previousLevel = prior.find(item => item.level === level.level);
        const draft = input.levels.find(item => item.level === level.level)!;
        if (previousLevel?.cvSource === 'iqc-cohort' && previousLevel.sourceLot === level.sourceLot && draft.refreshCohort !== true) {
          Object.assign(level, { cv: previousLevel.cv, targetMean: previousLevel.targetMean, tea: previousLevel.tea, teaBasis: previousLevel.teaBasis,
            cohortN: previousLevel.cohortN, sourceStart: previousLevel.sourceStart, sourceEnd: previousLevel.sourceEnd, cohortStatus: previousLevel.cohortStatus,
            cohortFingerprint: previousLevel.cohortFingerprint, cohortReview: previousLevel.cohortReview });
          continue;
        }
        const found = cohorts.find((c) => c.level === level.level && c.lot === level.sourceLot);
        if (!found) return { ok: false, error: { code: 'cohort-not-found', message: `Không tìm thấy nhóm IQC của lô "${level.sourceLot || '—'}" ở mức ${level.level} trong kỳ ${period}.` } };
        level.cv = found.cv;
        level.cohortN = found.n;
        level.sourceStart = found.start;
        level.sourceEnd = found.end;
        level.cohortStatus = found.status;
        level.targetMean = found.targetMean;
        if (previousLevel && previousLevel.tea != null && !previousLevel.teaBasis && previousLevel.targetMean !== found.targetMean) {
          return { ok: false, error: { code: 'cohort-tea-unresolved', message: 'Snapshot thiếu tiêu chí TEa để đổi nồng độ. Hãy tạo đánh giá mới với nguồn TEa đã xác nhận; không suy lại hồ sơ đã chốt từ cấu hình hiện tại.' } };
        }
        // Khi đổi lô, tái dùng tiêu chí đã chốt thay vì TEa% của nồng độ trước.
        const basis = previousLevel?.teaBasis ?? resolver.basis(teaSource, level.level, found.targetMean);
        if (previousLevel && previousLevel.tea != null && !previousLevel.teaBasis) {
          level.tea = previousLevel.tea;
        } else if (basis && (basis.value != null || basis.criterionDetail?.absoluteUsable)) {
          level.teaBasis = basis;
          level.tea = teaAtMean(basis, found.targetMean);
          if (level.tea == null) return { ok: false, error: { code: 'cohort-tea-unresolved', message: 'Chưa xác định được TEa tại Mean của lô đã chọn. Kiểm tra Mean, đơn vị và nguồn TEa.' } };
        } else if (previousLevel && previousLevel.targetMean !== found.targetMean) {
          return { ok: false, error: { code: 'cohort-tea-unresolved', message: 'Snapshot thiếu tiêu chí TEa để đổi nồng độ. Hãy tạo đánh giá mới với nguồn TEa đã xác nhận.' } };
        }
        level.cohortFingerprint = cohortFingerprint(testId, period, level.level, level.sourceLot || '');
        // Xác nhận rà soát là dấu vết thao tác của người dùng, không phải kết
        // luận rằng cohort đã đủ điều kiện dùng để thiết kế QC. Vì vậy vẫn
        // lưu xác nhận cho nhóm n còn ít; `listPeriods()` độc lập chặn
        // `qualityDesign` cho tới khi cohort đạt `eligible`.
        if (draft.cohortReviewed === true) {
          if (draft.cohortFingerprint !== level.cohortFingerprint) return { ok: false, error: { code: 'cohort-changed', message: 'Dữ liệu IQC đã thay đổi hoặc chưa có dấu vết rà soát. Đóng hộp thoại, nạp lại lô và kiểm tra trước khi xác nhận.' } };
          level.cohortReview = { by: actor.name || actor.username, at: new Date().toISOString(), fingerprint: level.cohortFingerprint };
        }
      }
    }
    // Mọi mức dùng cùng cửa sổ và bộ lọc mẫu; không lọc theo nồng độ QC.
    // Mỗi vòng cũ được giữ đúng một lần, kể cả dữ liệu cũ từng có vòng trùng;
    // không sửa lịch sử và cũng không cho nhân thêm số lần dùng một mẫu.
    let currentEqaSamples: SigmaEqaSample[] | undefined;
    for (const level of stored) {
      const previous = prior.find(p => p.level === level.level);
      const remaining = [...(previous?.eqaRounds ?? [])];
      const seen = new Set<string>();
      let selection: SigmaEqaBiasSelection | undefined;
      for (let i = 0; i < level.eqaRounds.length; i++) {
        const round = level.eqaRounds[i], resultId = round.eqaResultId;
        if (!resultId) continue;
        const oldIndex = remaining.findIndex(p => p.eqaResultId === resultId && p.lab === round.lab && p.target === round.target);
        if (!sharedRounds && oldIndex >= 0) {
          level.eqaRounds[i] = { ...remaining.splice(oldIndex, 1)[0] };
          seen.add(resultId);
          continue;
        }
        if (seen.has(resultId)) return { ok: false, error: { code: 'duplicate-eqa-source', message: 'Một mẫu ngoại kiểm chỉ được dùng một lần trong mỗi mức QC.' } };
        // Mẫu ngoại kiểm mới chỉ vào qua "Lấy từ ngoại kiểm" (áp dụng chung, đủ mẫu).
        if (!sharedRounds) return { ok: false, error: { code: 'eqa-shared-only', message: 'Mẫu ngoại kiểm mới chỉ được áp dụng qua Lấy từ ngoại kiểm, chung cho mọi mức. Tải lại kỳ rồi thử lại.' } };
        seen.add(resultId);
        currentEqaSamples ??= eqaSamples(testId);
        const source = currentEqaSamples.find(s => s.resultId === resultId);
        if (!source || source.result !== round.lab || source.assigned !== round.target) return { ok: false, error: { code: 'invalid-eqa-source', message: 'Kết quả ngoại kiểm đã thay đổi hoặc không thuộc xét nghiệm này. Lấy lại Bias từ ngoại kiểm.' } };
        selection ??= selectSigmaEqaBias(currentEqaSamples, { period, windowMonths });
        const excluded = selection.excluded.find(s => s.resultId === resultId);
        if (excluded) return { ok: false, error: { code: 'invalid-eqa-selection', message: `${source.label}: ${SIGMA_EQA_EXCLUSION_LABEL[excluded.reason]}. Lấy lại Bias từ ngoại kiểm trước khi áp dụng.` } };
        round.label = source.label;
      }
    }
    // Một mức không trộn mẫu ngoại kiểm với vòng nhập tay (SB-4b).
    for (const level of stored) {
      if (level.eqaRounds.some(r => r.eqaResultId) && level.eqaRounds.some(r => !r.eqaResultId)) return { ok: false, error: { code: 'eqa-mixed', message: `Mức ${level.level}: không trộn mẫu ngoại kiểm với vòng nhập tay. Lấy lại từ ngoại kiểm hoặc chuyển hẳn sang nhập tay.` } };
      if (!level.eqaRounds.some(r => r.eqaResultId)) level.eqaWindowMonths = undefined;
    }
    // Bias chung: kiểm cả mẫu mới xuất hiện sau lúc xem trước, phải dùng đủ mọi mẫu hợp lệ.
    if (sharedRounds) {
      const included = selectSigmaEqaBias(currentEqaSamples ?? eqaSamples(testId), { period, windowMonths }).included;
      const ids = new Set(sharedRounds.map(round => round.eqaResultId));
      if (included.length !== ids.size || included.some(s => !ids.has(s.resultId))) return { ok: false, error: { code: 'eqa-selection-changed', message: `Danh sách ngoại kiểm hợp lệ trong ${windowMonths} tháng đã thay đổi. Lấy lại Bias từ ngoại kiểm để dùng đầy đủ các mẫu.` } };
    }
    // CV nhập tay thì KHÔNG được mang theo mô tả nhóm IQC — nếu không, một
    // bản ghi có thể vừa nói "CV nhập tay" vừa khoe `cohortStatus: eligible`.
    for (const level of stored) if (level.cvSource !== 'iqc-cohort') {
      level.cohortN = null; level.sourceLot = ''; level.sourceStart = ''; level.sourceEnd = ''; level.cohortStatus = '';
    }
    for (const level of stored) {
      const previousLevel = prior.find(item => item.level === level.level);
      if (previousLevel?.teaLocked && previousLevel.tea != null && !level.teaBasis) {
        level.tea ??= previousLevel.tea;
        level.teaBasis = previousLevel.teaBasis;
        level.teaLocked = true;
        continue;
      }
      if (!level.teaBasis && (!previousLevel || previousLevel.teaBasis || previousLevel.tea == null)) {
        const basis = previousLevel?.teaBasis ?? resolver.basis(teaSource, level.level, level.targetMean);
        // Không tự tạo nguồn gốc cho một giá trị nhập tay đang mâu thuẫn.
        if (basis?.value != null && (level.tea == null || Math.abs(level.tea - basis.value) < 1e-10)) {
          level.teaBasis = basis;
          level.tea ??= basis.value;
        }
      }
    }
    // Mã nguồn được chuẩn hoá riêng, mô tả tiêu chí nằm trong snapshot mức.
    // Luồng "+ Thêm kỳ" chọn trực tiếp tháng/năm nhưng tuyệt đối không ghi đè
    // bản đã có. Cổng lưu chung vẫn cho phép cập nhật CV/Bias/MU của kỳ đã chốt.
    w.commit((tx) => {
      if (existing) {
        db.prepare('UPDATE sigma_data SET tea=?, tea_source=?, lv_json=? WHERE id=?').run(tea, teaSource, JSON.stringify(stored), id);
      } else {
        db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)').run(id, testId, period, tea, teaSource, JSON.stringify(stored));
      }
      const reviewed = stored.filter(level => level.cohortReview).map(level => `M${level.level}: ${level.sourceLot}, n=${level.cohortN}, rà soát ${level.cohortReview!.by}`).join('; ');
      tx.audit(existing ? 'Sửa kỳ Six Sigma' : 'Thêm kỳ Six Sigma', `Kỳ ${period} của xét nghiệm "${test.name}"${reviewed ? `; ${reviewed}` : ''}`, test.name);
      tx.changed(['sigma_data'], [testId]);
    });
    return { ok: true, data: listPeriods(testId).find(item => item.id === id)! };
  });

  /** Đổi kỳ phải là một giao dịch duy nhất. Không dùng "lưu mới rồi xoá bản trước"
   * vì KTV được sửa Sigma nhưng không có quyền xoá kỳ, dễ để lại hai bản ghi. */
  const renamePeriod = writeCommand(db, 'renamePeriod', 'write', (w, input: { id?: unknown; period?: unknown }): IpcResult<SigmaPeriodView> => {
    const id = cleanText(input?.id, 200).trim();
    const period = cleanText(input?.period, 7).trim();
    if (!PERIOD_RE.test(period) || Number(period.slice(5)) < 1 || Number(period.slice(5)) > 12) return { ok: false, error: { code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM hợp lệ.' } };
    const row = db.prepare('SELECT * FROM sigma_data WHERE id=?').get(id) as { id: string; test_id: string; period: string; tea: number | null; tea_source: string; lv_json: string } | undefined;
    if (!row) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy kỳ Six Sigma.' } };
    if (row.period === period) {
      const stored = readStoredLevels(row.lv_json);
      const sameChain = teaChain(makeLevelTeaResolver(row.test_id), row.tea_source);
      return w.noChange({ id: row.id, testId: row.test_id, period: row.period, tea: row.tea, teaSource: row.tea_source, levels: stored.map((level) => computeLevel(level, row.tea, sameChain.bySource, designLevelCount(row.test_id, stored), sameChain.fallback)) });
    }
    if (readStoredLevels(row.lv_json).some(level => level.cvSource === 'iqc-cohort')) return { ok: false, error: { code: 'cohort-period-fixed', message: 'Kỳ có snapshot IQC không được đổi tháng. Hãy tạo kỳ mới và nạp lại dữ liệu đúng kỳ.' } };
    const nextId = `${row.test_id}:${period}`;
    if (db.prepare('SELECT 1 FROM sigma_data WHERE id=?').get(nextId)) return { ok: false, error: { code: 'duplicate-period', message: `Đã có kỳ Sigma ${period}. Hãy cập nhật kỳ hiện có.` } };
    w.commit((tx) => {
      db.prepare('UPDATE sigma_data SET id=?, period=? WHERE id=?').run(nextId, period, row.id);
      const test = db.prepare('SELECT name FROM tests WHERE id=?').get(row.test_id) as { name: string } | undefined;
      tx.audit('Đổi kỳ Six Sigma', `Đổi kỳ ${row.period} thành ${period} của xét nghiệm "${test?.name || ''}"`, test?.name || '');
      tx.changed(['sigma_data'], [row.test_id]);
    });
    const stored = readStoredLevels(row.lv_json);
    const renamedChain = teaChain(makeLevelTeaResolver(row.test_id), row.tea_source);
    return { ok: true, data: { id: nextId, testId: row.test_id, period, tea: row.tea, teaSource: row.tea_source, levels: stored.map((level) => computeLevel(level, row.tea, renamedChain.bySource, designLevelCount(row.test_id, stored), renamedChain.fallback)) } };
  });

  /** Xoá một kỳ Sigma — chỉ quản trị viên. */
  const removePeriod = writeCommand(db, 'removePeriod', 'admin', (w, input: { data: { id: string } }): IpcResult<{ id: string }> => {
    const id = cleanText(input.data?.id, 200).trim();
    const row = db.prepare('SELECT id, test_id, period FROM sigma_data WHERE id=?').get(id) as { id: string; test_id: string; period: string } | undefined;
    if (!row) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy kỳ Six Sigma.' } };
    const test = db.prepare('SELECT name FROM tests WHERE id=?').get(row.test_id) as { name: string } | undefined;
    w.commit((tx) => {
      db.prepare('DELETE FROM sigma_data WHERE id=?').run(id);
      tx.audit('Xoá kỳ Six Sigma', `Kỳ ${row.period} của xét nghiệm "${test ? test.name : ''}"`, test ? test.name : '');
      tx.changed(['sigma_data'], [row.test_id]);
    });
    return { ok: true, data: { id } };
  });

  /** Dùng cùng nguồn và khoá nội dung với Khắc phục, tránh gán NCE cũ sang báo cáo sửa số.
   * Chỉ loại khi hồ sơ đã kết luận (xác định hoặc nghi ngờ) nguyên nhân hành chính hoặc
   * chương trình/mẫu: "chưa xác định" giữ nhóm cũ trong CSDL nhưng không phải kết luận (N-11). */
  function eqaSamples(testId: string): SigmaEqaSample[] {
    const excludedSources = new Map((db.prepare(`SELECT eqa_source_key, cause_category FROM nce_records
      WHERE source='eqa' AND status<>'cancelled' AND eqa_source_key<>'' AND cause_category IN ('eqa_administrative','eqa_program')
        AND cause_status IN ('identified','suspected')`)
      .all() as { eqa_source_key: string; cause_category: string }[]).map(r => [r.eqa_source_key, r.cause_category]));
    const rounds = db.prepare(`SELECT DISTINCT r.id FROM eqa_rounds r JOIN eqa_results e ON e.round_id=r.id AND e.version=r.version
      WHERE e.test_id=? AND r.status='open'`).all(testId) as { id: string }[];
    return rounds.flatMap(({ id }) => {
      const view = eqa.getEqaRound(id);
      if (!view) return [];
      return view.results.filter(r => r.test_id === testId).map(result => ({
        resultId: result.id, label: `${view.round.program_name} · ${view.round.round}/${view.round.year}${result.sample ? ` · mẫu ${result.sample}` : ''}`,
        reportDate: view.round.report_date || view.round.created_at.slice(0, 10), result: result.result, assigned: result.assigned,
        assignedUncertain: !!result.assigned_check?.uncertain,
        ncCauseCategory: excludedSources.get(eqaNceSourceKey({ round: view.round, result })) ?? '',
      }));
    });
  }

  /** Mẫu ngoại kiểm đề xuất làm Bias cho một mức QC của kỳ Sigma (SIGMA-REVIEW-2026-11-17
   * SB-2..SB-6). Chỉ đọc; người phụ trách xem rồi bấm áp dụng mới lưu. */
  function eqaBias(testIdRaw: unknown, periodRaw: unknown, levelRaw: unknown, windowMonthsRaw?: unknown): (SigmaEqaBiasSelection & { targetMean: number | null }) | null {
    const testId = cleanId(testIdRaw), period = cleanText(periodRaw, 7).trim(), level = finiteNumber(levelRaw, NaN);
    if (!testId || !PERIOD_RE.test(period) || Number(period.slice(5)) < 1 || Number(period.slice(5)) > 12 || !Number.isInteger(level) || level < 1) return null;
    let windowMonths: number;
    try { windowMonths = resolveSigmaEqaWindow(period, windowMonthsRaw).windowMonths; } catch { return null; }
    // Giữ tham số mức và targetMean=null để tương thích IPC cũ; nguồn Bias nay chung.
    return { ...selectSigmaEqaBias(eqaSamples(testId), { period, windowMonths }), targetMean: null };
  }

  return { listPeriods, listCohorts, saveTeaConfig, savePeriod, renamePeriod, removePeriod, eqaBias };
}
