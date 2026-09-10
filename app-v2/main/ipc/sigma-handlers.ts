// IPC handler cho trang Six Sigma. Moi ky (period) luu CV/Bias/u(cal) da
// duoc ky thuat vien REVIEW thu cong (khong tu dong suy tu diem QC - dung
// chinh sach da chot: CV/Bias la gia tri da duoc xem xet, khong phai
// trung binh tho). sigma/MU tinh SONG lai tu du lieu da luu, khong cache
// cung, de doi TEa/CV/Bias sau nay luon phan anh dung.
import type { Db } from '../db/sqlite-like';
import type { Test } from '../../shared/qc-api';
import { sigmaMetric, uncertaintyBudget, eqaRoundsStats, sigmaQualityDesign, type SigmaMetricResult, type UncertaintyBudgetResult } from '../domain/sigma-metrics';
import { buildSigmaCohorts, type SigmaCohort, type SigmaCohortPoint } from '../domain/sigma-cohort';
import { resolveTea, type SigmaTeaSourceCore, type TeaRefCore } from '../domain/sigma-tea-core';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE } from '../domain/tea-catalog';
import { isoLocalDate } from '../domain/local-date';
import { cleanId, cleanText, finiteNumber } from '../domain/text-utils';
import { type Actor, type IpcResult, writeAudit, notifyChanged, requireWrite, requireAdmin } from './shared';

const PERIOD_RE = /^\d{4}-\d{2}$/;

export interface SigmaLevelInput {
  level: number; tea?: unknown; targetMean?: unknown; cv?: unknown; biasEqa?: unknown; eqaRounds?: unknown[]; uCal?: unknown; muBiasMode?: 'include' | 'exclude';
  cvSource?: 'manual' | 'iqc-cohort'; cohortN?: unknown; sourceLot?: unknown; sourceStart?: unknown; sourceEnd?: unknown; cohortStatus?: unknown;
}
export interface SigmaPeriodInput { testId: unknown; period: unknown; tea?: unknown; teaSource?: unknown; levels: SigmaLevelInput[]; createOnly?: unknown }

/** Một vòng EQA/EQC phải giữ cả kết quả PXN và giá trị đích.  `bias` chỉ là
 * giá trị tính lại để không mất khả năng đọc các kỳ thử nghiệm cũ từng lưu
 * trực tiếp Bias%. */
export interface SigmaEqaRound { lab: number | null; target: number | null; bias: number }

export interface SigmaLevelResult {
  level: number; tea: number | null; targetMean: number | null; cv: number | null; biasEqa: number | null; eqaRounds: SigmaEqaRound[]; mixedSigns: boolean; uCal: number | null;
  cvSource: 'manual' | 'iqc-cohort'; cohortN: number | null; sourceLot: string; sourceStart: string; sourceEnd: string; cohortStatus: string;
  sigma: SigmaMetricResult | null; mu: UncertaintyBudgetResult | null; qualityDesign: ReturnType<typeof sigmaQualityDesign>;
}
export interface SigmaPeriodView { id: string; testId: string; period: string; tea: number | null; teaSource: string; levels: SigmaLevelResult[] }

interface StoredLevel { level: number; /** TEa% snapshot theo mức QC; kỳ v1 thiếu field này dùng fallback tea của kỳ. */ tea: number | null; /** Mean mục tiêu snapshot, không dùng Mean hiện tại để sửa lịch sử MU. */ targetMean: number | null; cv: number | null; biasEqa: number | null; eqaRounds: SigmaEqaRound[]; uCal: number | null; muBiasMode: 'include' | 'exclude'; cvSource?: 'manual' | 'iqc-cohort'; cohortN?: number | null; sourceLot?: string; sourceStart?: string; sourceEnd?: string; cohortStatus?: string }

function normalizeEqaRounds(raw: unknown): { ok: true; rounds: SigmaEqaRound[] } | { ok: false } {
  if (!Array.isArray(raw)) return { ok: true, rounds: [] };
  const rounds: SigmaEqaRound[] = [];
  for (const value of raw) {
    if (value == null || String(value).trim() === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const row = value as { lab?: unknown; target?: unknown; bias?: unknown };
      const lab = finiteNumber(row.lab, NaN), target = finiteNumber(row.target, NaN);
      if (Number.isFinite(lab) && Number.isFinite(target) && target !== 0) {
        rounds.push({ lab, target, bias: (lab - target) / Math.abs(target) * 100 });
        continue;
      }
      const legacyBias = finiteNumber(row.bias, NaN);
      if (!Number.isFinite(legacyBias)) return { ok: false };
      rounds.push({ lab: null, target: null, bias: legacyBias });
      continue;
    }
    // Tương thích kỳ cũ: chỉ có Bias% đã tính, không còn cặp KQ/Target.
    const bias = finiteNumber(value, NaN);
    if (!Number.isFinite(bias)) return { ok: false };
    rounds.push({ lab: null, target: null, bias });
  }
  return { ok: true, rounds };
}

/** Chuẩn hoá JSON của kỳ cũ ở một chỗ. `tea` theo mức chỉ có từ v2.2; bản
 * ghi trước đó để null để `computeLevel()` dùng snapshot TEa cấp kỳ. */
function readStoredLevels(raw: string): StoredLevel[] {
  const parsed = JSON.parse(raw || '[]') as Array<Omit<StoredLevel, 'tea' | 'targetMean' | 'eqaRounds'> & { tea?: unknown; targetMean?: unknown; eqaRounds?: unknown }>;
  return parsed.map((level) => {
    const normalized = normalizeEqaRounds(level.eqaRounds);
    const candidateTea = finiteNumber(level.tea, NaN);
    const candidateTarget = finiteNumber(level.targetMean, NaN);
    return { ...level, tea: Number.isFinite(candidateTea) && candidateTea > 0 ? candidateTea : null, targetMean: Number.isFinite(candidateTarget) && candidateTarget !== 0 ? candidateTarget : null, eqaRounds: normalized.ok ? normalized.rounds : [] };
  });
}

/** Bias% dùng cho Sigma/MU: nếu có ≥1 vòng EQA/EQC lưu kèm, RMS của các vòng
 * LUÔN thắng giá trị `biasEqa` đơn lẻ cũ (không dùng song song 2 nguồn) —
 * `eqaRoundsStats()` cũng cho `biasRefU` (u(Cref)) feed thẳng vào
 * `uncertaintyBudget()`, thứ mà 1 con số `biasEqa` đơn lẻ không bao giờ có. */
/** Thứ tự lấy TEa của một mức, KHÔNG được đảo:
 *   1. snapshot `lv_json.tea` của chính mức đó — kỳ đã chốt thì không bị kéo
 *      lại theo Bảng TEa tham chiếu hôm nay (cùng nguyên tắc `force=false`
 *      trong `sgSetLevelTeaSnapshot()` của app cũ);
 *   2. GIẢI từ nguồn TEa đang khai, tại Mean của CHÍNH mức đó;
 *   3. mới đến `periodTea` (một con số dùng chung cho cả kỳ).
 *
 * Bước 2 trước đây KHÔNG có, và đó là lỗi nghiệp vụ thật: với tiêu chí CLIA
 * dạng TUYỆT ĐỐI (vd Sodium ±4,0000 mmol/L) thì TEa% = |giới hạn / Mean| ×
 * 100, tức mỗi mức phải ra MỘT SỐ KHÁC NHAU. Rơi thẳng về `periodTea` nghĩa
 * là dùng một TEa% dùng chung, chỉ có thể đúng tại đúng một Mean. Đo được với
 * bộ seed của gate parity: Mean 140/100 cho ra TEa 2,857%/4,000% và Sigma
 * 0,29/0,56 ở app cũ, còn app-v2 dùng 10% cho cả hai mức nên ra 2,67/1,89 —
 * một bên đọc là "chấp nhận được", một bên là "dưới 3σ, phải siết luật".
 * Bản ghi thiếu snapshot theo mức là chuyện có thật: kỳ tạo ở bản v1 (xem
 * comment của `StoredLevel.tea`), kỳ ghi qua IPC bởi caller không truyền TEa
 * theo mức, dữ liệu di trú hoặc đồng bộ về. Với nguồn dạng % (Ricos/EFLM/
 * PXN) thì bước 2 và bước 3 cho cùng kết quả nên không đổi gì. */
function computeLevel(stored: StoredLevel, periodTea: number | null, resolveLevelTea?: (level: number, targetMean: number | null) => number | null): SigmaLevelResult {
  const tea = stored.tea ?? (resolveLevelTea ? resolveLevelTea(stored.level, stored.targetMean ?? null) : null) ?? periodTea;
  const roundsStats = stored.eqaRounds && stored.eqaRounds.length ? eqaRoundsStats(stored.eqaRounds.map((round) => round.bias)) : null;
  const biasEqa = roundsStats ? roundsStats.rms : stored.biasEqa;
  const biasRefU = roundsStats ? roundsStats.biasRefU : null;
  // Bias chưa được đánh giá không đồng nghĩa Bias = 0. Không được hiển thị
  // Sigma lạc quan từ giả định này; khớp `sgComp()` của app cũ.
  const sigma = tea != null && stored.cv != null && biasEqa != null ? sigmaMetric(tea, biasEqa, stored.cv) : null;
  const mu = stored.cv != null
    ? uncertaintyBudget({ cv: stored.cv, bias: biasEqa, biasRefU, includeBias: stored.muBiasMode !== 'exclude', uCal: stored.uCal, tea: tea ?? undefined, target: stored.targetMean ?? undefined })
    : null;
  return { level: stored.level, tea, targetMean: stored.targetMean, cv: stored.cv, biasEqa, eqaRounds: stored.eqaRounds || [], mixedSigns: roundsStats?.mixedSigns ?? false, uCal: stored.uCal,
    cvSource: stored.cvSource === 'iqc-cohort' ? 'iqc-cohort' : 'manual', cohortN: stored.cohortN ?? null, sourceLot: stored.sourceLot || '', sourceStart: stored.sourceStart || '', sourceEnd: stored.sourceEnd || '', cohortStatus: stored.cohortStatus || '',
    sigma, mu, qualityDesign: sigmaQualityDesign(sigma?.sigma) };
}

export function createSigmaHandlers(db: Db) {
  function listPeriods(testId: string): SigmaPeriodView[] {
    const rows = db.prepare('SELECT * FROM sigma_data WHERE test_id=? ORDER BY period ASC').all(testId) as {
      id: string; test_id: string; period: string; tea: number | null; tea_source: string; lv_json: string;
    }[];
    const resolveLevelTea = makeLevelTeaResolver(testId);
    return rows.map(r => {
      const stored = readStoredLevels(r.lv_json);
      const resolve = (level: number, targetMean: number | null) => resolveLevelTea(r.tea_source, level, targetMean);
      return { id: r.id, testId: r.test_id, period: r.period, tea: r.tea, teaSource: r.tea_source, levels: stored.map(s => computeLevel(s, r.tea, resolve)) };
    });
  }

  /** Bộ giải TEa theo mức cho MỘT xét nghiệm: đọc một lượt cấu hình xét
   * nghiệm, lớp phủ hồ sơ TEa của phòng xét nghiệm và Mean hiện hành của từng
   * mức, rồi trả về hàm thuần. Mean ưu tiên snapshot của kỳ
   * (`stored.targetMean`, truyền vào từ ngoài) rồi mới tới Mean hiện hành —
   * đúng `sgLevelTarget()` của app cũ. */
  function makeLevelTeaResolver(testId: string): (source: string, level: number, targetMean: number | null) => number | null {
    // Phải đọc cả 4 cột truy vết EFLM: cổng `hasTrace` của `resolveTea()`
    // đọc chúng, thiếu thì mọi xét nghiệm có `tea` đều được coi là "TEa EFLM
    // đã truy vết".
    const test = db.prepare('SELECT name,tea_ref_key,unit,tea,tea_source,eflm_analyte,eflm_ref,eflm_lookup_date FROM tests WHERE id=?').get(testId) as
      { name: string; tea_ref_key: string; unit: string; tea: number | null; tea_source: string; eflm_analyte: string; eflm_ref: string; eflm_lookup_date: string } | undefined;
    if (!test) return () => null;
    const refs = db.prepare('SELECT name,analyte_id,aliases_json,lab,lab_source,clia,ricos,clia_rule,clia_absolute,clia_absolute_unit FROM tea_refs').all() as TeaRefCore[];
    const means = new Map<number, number | null>(
      (db.prepare('SELECT level,mean FROM test_levels WHERE test_id=?').all(testId) as { level: number; mean: number | null }[])
        .map((row) => [row.level, row.mean]),
    );
    const shape = {
      name: test.name || '', tea_ref_key: test.tea_ref_key || '', unit: test.unit || '', tea: Number(test.tea) || 0,
      tea_source: test.tea_source || '', eflm_analyte: test.eflm_analyte || '', eflm_ref: test.eflm_ref || '', eflm_lookup_date: test.eflm_lookup_date || '',
    };
    return (source, level, targetMean) => {
      if (source !== 'lab' && source !== 'eflm' && source !== 'clia' && source !== 'ricos') return null;
      const mean = targetMean ?? means.get(level) ?? null;
      const value = resolveTea(shape, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE, source as SigmaTeaSourceCore, mean).value;
      return value != null && value > 0 ? value : null;
    };
  }

  function listCohorts(testId: string, period: string, levels: number[]): SigmaCohort[] {
    if (!PERIOD_RE.test(period)) return [];
    const normalizedLevels = [...new Set(levels.map((level) => Math.round(Number(level))))];
    const safeLevels = normalizedLevels.filter((level) => Number.isInteger(level) && level > 0);
    if (!safeLevels.length) return [];
    const rows = db.prepare('SELECT level,date,lot,val,voided,qc_mean,qc_sd FROM qc_points WHERE test_id=? ORDER BY level,date,run_id').all(testId) as unknown as SigmaCohortPoint[];
    return buildSigmaCohorts(rows, period, safeLevels, isoLocalDate());
  }

  /** Thêm/bỏ khỏi Sigma chỉ đổi danh sách theo dõi, không xóa danh mục hay
   * dữ liệu QC của xét nghiệm — đúng ý nghĩa nút "Xóa" app cũ. */
  function setTracking(input: { testId?: unknown; tracked?: unknown }, actor: Actor): IpcResult<{ testId: string; tracked: boolean }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const testId = cleanId(input?.testId), tracked = input?.tracked === true;
    const test = db.prepare('SELECT id,name,sigma_tracked FROM tests WHERE id=?').get(testId) as { id: string; name: string; sigma_tracked: number } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if ((test.sigma_tracked === 1) === tracked) return { ok: true, data: { testId, tracked } };
    db.prepare('UPDATE tests SET sigma_tracked=? WHERE id=?').run(tracked ? 1 : 0, testId);
    writeAudit(db, actor, tracked ? 'Theo dõi Six Sigma' : 'Bỏ theo dõi Six Sigma', `Xét nghiệm "${test.name}"`, test.name);
    notifyChanged(['tests'], [testId]);
    return { ok: true, data: { testId, tracked } };
  }

  function saveTeaConfig(input: { testId?: unknown; source?: unknown; tea?: unknown; eflmAnalyte?: unknown; eflmAps?: unknown; eflmLookupDate?: unknown; eflmRef?: unknown }, actor: Actor): IpcResult<Test> {
    const denied = requireWrite(actor); if (denied) return denied;
    const testId = cleanId(input?.testId), source = cleanText(input?.source, 20).trim();
    if (!['lab', 'eflm', 'clia', 'ricos'].includes(source)) return { ok: false, error: { code: 'invalid-tea-source', message: 'Nguồn TEa không hợp lệ.' } };
    const test = db.prepare('SELECT * FROM tests WHERE id=?').get(testId) as {
      id: string; name: string; tea: number; eflm_analyte: string; eflm_aps: string; eflm_lookup_date: string; eflm_ref: string;
    } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const tea = input?.tea == null || input.tea === '' ? Number(test.tea || 0) : finiteNumber(input.tea, NaN);
    if (source === 'eflm' && input?.tea != null && input.tea !== '' && (!Number.isFinite(tea) || tea <= 0)) return { ok: false, error: { code: 'invalid-tea', message: 'TEa EFLM phải là số dương.' } };
    const eflmAps = input?.eflmAps == null ? test.eflm_aps : cleanText(input.eflmAps, 20).trim();
    if (!['minimum', 'desirable', 'optimum'].includes(eflmAps || 'desirable')) return { ok: false, error: { code: 'invalid-eflm-aps', message: 'Mức APS EFLM không hợp lệ.' } };
    // API vá từng trường: đổi nguồn không được làm mất thông tin EFLM đã nhập
    // trước đó, kể cả khi lời gọi đến từ một màn hình khác trong tương lai.
    db.prepare('UPDATE tests SET tea_source=?,tea=?,eflm_analyte=?,eflm_aps=?,eflm_lookup_date=?,eflm_ref=? WHERE id=?').run(
      source, Number.isFinite(tea) ? tea : 0,
      input?.eflmAnalyte == null ? test.eflm_analyte : cleanText(input.eflmAnalyte, 160).trim(),
      eflmAps || 'desirable',
      input?.eflmLookupDate == null ? test.eflm_lookup_date : cleanText(input.eflmLookupDate, 10).trim(),
      input?.eflmRef == null ? test.eflm_ref : cleanText(input.eflmRef, 500).trim(), testId,
    );
    writeAudit(db, actor, 'Cập nhật TEa Six Sigma', `Nguồn ${source} cho xét nghiệm "${test.name}"`, test.name);
    notifyChanged(['tests'], [testId]);
    return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(testId) as Test };
  }

  function savePeriod(input: SigmaPeriodInput, actor: Actor): IpcResult<SigmaPeriodView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const testId = cleanId(input.testId);
    const test = db.prepare('SELECT id, name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const period = cleanText(input.period, 7).trim();
    if (!PERIOD_RE.test(period) || Number(period.slice(5)) < 1 || Number(period.slice(5)) > 12) return { ok: false, error: { code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM hợp lệ.' } };
    if (!Array.isArray(input.levels) || !input.levels.length) return { ok: false, error: { code: 'missing-levels', message: 'Cần ít nhất 1 mức dữ liệu.' } };
    const tea = input.tea == null || input.tea === '' ? null : finiteNumber(input.tea, NaN);
    if (tea != null && (!Number.isFinite(tea) || tea <= 0)) return { ok: false, error: { code: 'invalid-tea', message: 'TEa phải là số dương.' } };
    for (const inputLevel of input.levels) {
      if (!normalizeEqaRounds(inputLevel.eqaRounds).ok) return { ok: false, error: { code: 'invalid-eqa-round', message: 'Mỗi vòng EQA/EQC cần đủ KQ PXN và Target EQA hợp lệ (Target khác 0).' } };
    }
    const stored: StoredLevel[] = input.levels.map(lv => ({
      level: Math.round(finiteNumber(lv.level, NaN)),
      tea: lv.tea == null || lv.tea === '' ? null : finiteNumber(lv.tea, NaN),
      targetMean: lv.targetMean == null || lv.targetMean === '' ? null : finiteNumber(lv.targetMean, NaN),
      cv: lv.cv == null || lv.cv === '' ? null : finiteNumber(lv.cv, NaN),
      biasEqa: lv.biasEqa == null || lv.biasEqa === '' ? null : finiteNumber(lv.biasEqa, NaN),
      eqaRounds: (() => { const normalized = normalizeEqaRounds(lv.eqaRounds); return normalized.ok ? normalized.rounds : []; })(),
      uCal: lv.uCal == null || lv.uCal === '' ? null : finiteNumber(lv.uCal, NaN),
      muBiasMode: lv.muBiasMode === 'exclude' ? 'exclude' : 'include',
      cvSource: lv.cvSource === 'iqc-cohort' ? 'iqc-cohort' : 'manual',
      cohortN: lv.cohortN == null ? null : finiteNumber(lv.cohortN, NaN),
      sourceLot: cleanText(lv.sourceLot, 120).trim(), sourceStart: cleanText(lv.sourceStart, 10).trim(), sourceEnd: cleanText(lv.sourceEnd, 10).trim(), cohortStatus: cleanText(lv.cohortStatus, 30).trim(),
    }));
    for (const level of stored) {
      if (!Number.isInteger(level.level) || level.level < 1) return { ok: false, error: { code: 'invalid-level', message: 'Mức QC không hợp lệ.' } };
      if (level.tea != null && (!Number.isFinite(level.tea) || level.tea <= 0)) return { ok: false, error: { code: 'invalid-level-tea', message: 'TEa của mức QC phải là số dương.' } };
      if (level.targetMean != null && (!Number.isFinite(level.targetMean) || level.targetMean === 0)) return { ok: false, error: { code: 'invalid-target-mean', message: 'Mean mục tiêu của mức QC phải là số khác 0.' } };
      if (level.cv != null && (!Number.isFinite(level.cv) || level.cv <= 0)) return { ok: false, error: { code: 'invalid-cv', message: 'CV IQC phải là số dương.' } };
      if (level.biasEqa != null && !Number.isFinite(level.biasEqa)) return { ok: false, error: { code: 'invalid-bias', message: 'Bias EQA/EQC phải là một số hợp lệ.' } };
      if (level.uCal != null && (!Number.isFinite(level.uCal) || level.uCal < 0)) return { ok: false, error: { code: 'invalid-u-cal', message: 'u(cal) phải là số không âm.' } };
      if (level.cohortN != null && (!Number.isInteger(level.cohortN) || level.cohortN < 0)) return { ok: false, error: { code: 'invalid-cohort', message: 'Số điểm IQC của lô không hợp lệ.' } };
    }
    if (new Set(stored.map((level) => level.level)).size !== stored.length) return { ok: false, error: { code: 'duplicate-level', message: 'Mỗi mức QC chỉ được có một bộ số liệu trong một kỳ.' } };
    const teaSource = cleanText(input.teaSource, 200).trim();
    const id = `${testId}:${period}`;
    const existing = db.prepare('SELECT id FROM sigma_data WHERE id=?').get(id);
    // Nút "+ Thêm kỳ" của app cũ chỉ tạo kỳ hiện tại, tuyệt đối không ghi đè
    // bản đã có. Cổng lưu chung vẫn cho phép cập nhật CV/Bias/MU của kỳ cũ.
    if (existing && input.createOnly === true) return { ok: false, error: { code: 'duplicate-period', message: `Đã có kỳ Sigma ${period}. Hãy cập nhật kỳ hiện có.` } };
    if (existing) {
      db.prepare('UPDATE sigma_data SET tea=?, tea_source=?, lv_json=? WHERE id=?').run(tea, teaSource, JSON.stringify(stored), id);
    } else {
      db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)').run(id, testId, period, tea, teaSource, JSON.stringify(stored));
    }
    writeAudit(db, actor, existing ? 'Sửa kỳ Six Sigma' : 'Thêm kỳ Six Sigma', `Kỳ ${period} của xét nghiệm "${test.name}"`, test.name);
    notifyChanged(['sigma_data'], [testId]);
    const resolveSaved = makeLevelTeaResolver(testId);
    return { ok: true, data: { id, testId, period, tea, teaSource, levels: stored.map(s => computeLevel(s, tea, (level, targetMean) => resolveSaved(teaSource, level, targetMean))) } };
  }

  /** Đổi kỳ phải là một giao dịch duy nhất. Không dùng "lưu mới rồi xoá cũ"
   * vì KTV được sửa Sigma nhưng không có quyền xóa kỳ, dễ để lại hai bản ghi. */
  function renamePeriod(input: { id?: unknown; period?: unknown }, actor: Actor): IpcResult<SigmaPeriodView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const id = cleanText(input?.id, 200).trim();
    const period = cleanText(input?.period, 7).trim();
    if (!PERIOD_RE.test(period) || Number(period.slice(5)) < 1 || Number(period.slice(5)) > 12) return { ok: false, error: { code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM hợp lệ.' } };
    const row = db.prepare('SELECT * FROM sigma_data WHERE id=?').get(id) as { id: string; test_id: string; period: string; tea: number | null; tea_source: string; lv_json: string } | undefined;
    if (!row) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy kỳ Six Sigma.' } };
    if (row.period === period) {
      const stored = readStoredLevels(row.lv_json);
      const resolveSame = makeLevelTeaResolver(row.test_id);
      return { ok: true, data: { id: row.id, testId: row.test_id, period: row.period, tea: row.tea, teaSource: row.tea_source, levels: stored.map((level) => computeLevel(level, row.tea, (lv, targetMean) => resolveSame(row.tea_source, lv, targetMean))) } };
    }
    const nextId = `${row.test_id}:${period}`;
    if (db.prepare('SELECT 1 FROM sigma_data WHERE id=?').get(nextId)) return { ok: false, error: { code: 'duplicate-period', message: `Đã có kỳ Sigma ${period}. Hãy cập nhật kỳ hiện có.` } };
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE sigma_data SET id=?, period=? WHERE id=?').run(nextId, period, row.id);
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* giao dịch đã đóng */ }
      throw error;
    }
    const test = db.prepare('SELECT name FROM tests WHERE id=?').get(row.test_id) as { name: string } | undefined;
    writeAudit(db, actor, 'Đổi kỳ Six Sigma', `Đổi kỳ ${row.period} thành ${period} của xét nghiệm "${test?.name || ''}"`, test?.name || '');
    notifyChanged(['sigma_data'], [row.test_id]);
    const stored = readStoredLevels(row.lv_json);
    const resolveRenamed = makeLevelTeaResolver(row.test_id);
    return { ok: true, data: { id: nextId, testId: row.test_id, period, tea: row.tea, teaSource: row.tea_source, levels: stored.map((level) => computeLevel(level, row.tea, (lv, targetMean) => resolveRenamed(row.tea_source, lv, targetMean))) } };
  }

  /** Xoá 1 kỳ Sigma — chỉ admin, khớp `sgDelPeriod` app cũ. */
  function removePeriod(input: { data: { id: string } }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = cleanText(input.data?.id, 200).trim();
    const row = db.prepare('SELECT id, test_id, period FROM sigma_data WHERE id=?').get(id) as { id: string; test_id: string; period: string } | undefined;
    if (!row) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy kỳ Six Sigma.' } };
    const test = db.prepare('SELECT name FROM tests WHERE id=?').get(row.test_id) as { name: string } | undefined;
    db.prepare('DELETE FROM sigma_data WHERE id=?').run(id);
    writeAudit(db, actor, 'Xoá kỳ Six Sigma', `Kỳ ${row.period} của xét nghiệm "${test ? test.name : ''}"`, test ? test.name : '');
    notifyChanged(['sigma_data'], [row.test_id]);
    return { ok: true, data: { id } };
  }

  return { listPeriods, listCohorts, setTracking, saveTeaConfig, savePeriod, renamePeriod, removePeriod };
}

export type SigmaHandlers = ReturnType<typeof createSigmaHandlers>;
