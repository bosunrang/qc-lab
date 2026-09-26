// Chạy bộ ca thẩm định trên app thật (mã main đã build ở `app-dist/`) với một
// CSDL tạm — không đụng CSDL của người dùng. Dữ liệu đi qua ĐÚNG các hàm mà
// giao diện gọi (nhập điểm, cấu hình luật, Mean/SD, NCE, kỳ Sigma); kết quả
// đọc lại như trang Phân tích Westgard, Tổng quan và Six Sigma hiển thị.
//
// Chạy: `npm run validate` (build main rồi chạy tệp này). Kết quả in ra màn
// hình và ghi tệp Excel vào `validation-output/`.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_GROUPS, CUSUM_CASES, QGI_CASES, SIGMA_CASES, STATS_CASES, WESTGARD_CASES } from './cases.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'app-dist', 'main');
const load = (rel) => require(path.join(DIST, rel));

const ADMIN = { userId: 'tham-dinh-admin', username: 'thamdinh', name: 'Người thẩm định', role: 'admin', clientId: 'validation' };
const REVIEWER = { ...ADMIN, userId: 'tham-dinh-duyet', username: 'duyet', name: 'Người duyệt' };
const VERDICT_LABEL = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ' };
const BASE_DATE = Date.UTC(2026, 0, 5);
const NUMBER_TOLERANCE = 1e-5;

const round = (value, digits = 6) => (value == null || !Number.isFinite(value) ? value : Number(value.toFixed(digits)));
const dateOf = (index) => new Date(BASE_DATE + index * 86_400_000).toISOString().slice(0, 10);
const fmt = (value) => {
  if (value == null) return '—';
  if (typeof value === 'number') return String(round(value, 6)).replace('.', ',');
  if (Array.isArray(value)) return value.length ? value.map(fmt).join('; ') : '(không có)';
  return String(value);
};
const sameNumber = (a, b, tolerance = NUMBER_TOLERANCE) => (a == null || b == null ? a == null && b == null : Math.abs(a - b) <= tolerance);
const sameSet = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

function must(result, step) {
  if (!result?.ok) throw new Error(`${step}: ${JSON.stringify(result?.error)}`);
  return result.data;
}

/** Mỗi ca một xét nghiệm: máy, lô theo mức, nhóm lô, Mean/SD, Panel, luật. */
function createCaseTest(ctx, item) {
  const { config, westgard } = ctx;
  const test = must(config.saveTest({ data: {
    name: `${item.id} ${item.title}`.slice(0, 120), instrumentId: ctx.instrumentId, unit: 'mmol/L', decimalPlaces: 3,
    ...(item.cusum ? { cusumOn: true, cusumK: item.cusum.k, cusumH: item.cusum.h } : {}),
  } }, ADMIN), `${item.id} tạo xét nghiệm`);
  const lots = {};
  for (const level of item.levels) lots[level.level] = must(config.saveLot({ data: { lotNo: `${item.id}-M${level.level}`, level: level.level } }, ADMIN), `${item.id} lô mức ${level.level}`);
  const lotIds = Object.values(lots).map((lot) => lot.id);
  // Nhóm lô vận hành cần ít nhất hai lô; ca một mức thêm một lô dự phòng.
  if (lotIds.length < 2) lotIds.push(must(config.saveLot({ data: { lotNo: `${item.id}-DP`, level: 1 } }, ADMIN), `${item.id} lô dự phòng`).id);
  must(config.saveLotGroup({ data: { name: `Nhóm ${item.id}`, lotIds } }, ADMIN), `${item.id} nhóm lô`);
  const targets = {};
  for (const level of item.levels) {
    must(config.saveTestLevel({ testId: test.id, data: { level: level.level, mean: level.mean, sd: level.sd, qcLotId: lots[level.level].id } }, ADMIN), `${item.id} Mean/SD mức ${level.level}`);
    targets[level.level] = { mean: level.mean, sd: level.sd };
  }
  must(config.savePanel({ data: { name: `Panel ${item.id}`, instrumentId: ctx.instrumentId, testIds: [test.id] } }, ADMIN), `${item.id} Panel`);
  for (const [rule, action] of Object.entries(item.rules || {})) must(westgard.saveRuleAction(test.id, rule, action, ADMIN), `${item.id} luật ${rule}`);
  return { testId: test.id, lots, targets };
}

/** Nhập các lần chạy qua `addPoint`; các bước khác (đổi Mean/SD, NCE) chen giữa. */
function enterRuns(ctx, item, created, inputs) {
  const { config, entry, nce } = ctx;
  const runDates = [];
  for (const step of item.runs || []) {
    if (step.setTarget) {
      const { level, mean, sd } = step.setTarget;
      must(config.saveTestLevel({ testId: created.testId, data: { level, mean, sd, qcLotId: created.lots[level].id } }, ADMIN), `${item.id} đổi Mean/SD`);
      created.targets[level] = { mean, sd };
      continue;
    }
    if (step.nceEffective) {
      const date = runDates[step.nceEffective.completedRun - 1];
      closeNceEffective(nce, created.testId, date, `${item.id}-M1`);
      continue;
    }
    const runIndex = runDates.length;
    const date = dateOf(runIndex);
    runDates.push(date);
    const values = step.val ?? Object.fromEntries(Object.entries(step.z).map(([level, z]) => {
      const target = created.targets[level];
      return [level, round(target.mean + z * target.sd, 6)];
    }));
    for (const [level, val] of Object.entries(values)) {
      must(entry.addPoint({ data: { testId: created.testId, level: Number(level), date, runId: `${date}-1`, val } }, ADMIN), `${item.id} nhập lần chạy ${runIndex + 1} mức ${level}`);
      const target = created.targets[level];
      inputs.push({ caseId: item.id, run: runIndex + 1, date, level: Number(level), mean: target.mean, sd: target.sd, val, z: step.z ? step.z[level] : round((val - target.mean) / target.sd, 4) });
    }
  }
  return runDates;
}

/** NCE đầy đủ tới "khắc phục hiệu quả, đã duyệt" — đúng cổng mà trang Khắc phục sự cố đi qua. */
function closeNceEffective(nce, testId, date, lot) {
  const record = must(nce.create({ data: { testId, level: 1, lot, date, rule: 'CUSUM', errorType: 'SE', correction: 'Tạm dừng trả kết quả, kiểm tra hiệu chuẩn và chạy lại QC', dueDate: date } }, ADMIN), 'NCE tạo');
  must(nce.setActionCompletedDate({ data: { id: record.id, actionCompletedDate: date } }, ADMIN), 'NCE ngày hoàn thành');
  must(nce.saveProtocol({ data: { id: record.id, dueDate: date, protocol: {
    eventSource: 'iqc', processPhase: 'exam', owner: 'Người thẩm định', containmentStatus: 'none', correction: 'Tạm dừng trả kết quả, kiểm tra hiệu chuẩn và chạy lại QC',
    riskSeverity: 2, riskOccurrence: 2, riskDetectability: 2, riskLevel: 'low', riskBasis: 'Ca thẩm định',
    qcMaterialStatus: 'ok', instrumentStatus: 'ok', reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
    causeCategory: 'calibration', cause: 'Hiệu chuẩn lệch', action: 'Hiệu chuẩn lại và xác nhận bằng QC',
    patientImpact: 'none', effectivenessStatus: 'pending',
    residualSeverity: 1, residualOccurrence: 1, residualDetectability: 1, residualRiskLevel: 'low', residualRiskBasis: 'Theo dõi sau hiệu chuẩn',
  } } }, ADMIN), 'NCE hồ sơ');
  must(nce.markEffectiveness({ data: { id: record.id, status: 'effective', residualRisk: 'Rủi ro còn lại thấp', note: 'QC ổn định sau hiệu chuẩn' } }, ADMIN), 'NCE hiệu quả');
  must(nce.approve({ data: { id: record.id } }, REVIEWER), 'NCE duyệt');
}

/** Điểm của mọi mức theo `lần chạy/mức`, đọc như trang Phân tích Westgard. */
function analyze(ctx, item, created, runDates) {
  const byKey = new Map();
  const analyses = {};
  for (const level of item.levels) {
    const analysis = ctx.westgard.analyzeLevel(created.testId, level.level);
    analyses[level.level] = analysis;
    for (const point of analysis.points) byKey.set(`${runDates.indexOf(point.date) + 1}/${level.level}`, point);
  }
  return { byKey, analyses };
}

function westgardChecks(item, byKey) {
  const checks = [];
  const expected = item.expect.points || {};
  const rejectedRuns = new Set(Object.entries(expected).filter(([, e]) => e.verdict === 'rej').map(([key]) => key.split('/')[0]));
  for (const [key, point] of [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    const want = expected[key] || { verdict: 'ok', rules: [] };
    const wantAccepted = !rejectedRuns.has(key.split('/')[0]);
    const [run, level] = key.split('/');
    const where = `Lần chạy ${run}, mức ${level}`;
    checks.push({ check: `${where}: kết luận`, expected: VERDICT_LABEL[want.verdict], actual: VERDICT_LABEL[point.verdict] || point.verdict, pass: point.verdict === want.verdict });
    checks.push({ check: `${where}: luật`, expected: fmt(want.rules), actual: fmt(point.rules), pass: sameSet(point.rules, want.rules) });
    checks.push({ check: `${where}: vào thống kê`, expected: wantAccepted ? 'Có' : 'Không', actual: point.accepted ? 'Có' : 'Không', pass: point.accepted === wantAccepted });
    if (want.z != null) checks.push({ check: `${where}: Z-score`, expected: fmt(want.z), actual: fmt(point.z), pass: sameNumber(point.z, want.z) });
  }
  for (const key of Object.keys(expected)) if (!byKey.has(key)) checks.push({ check: `Lần chạy/mức ${key}`, expected: 'có điểm', actual: 'không có', pass: false });
  return checks;
}

function statsChecks(ctx, item, created, byKey, analyses) {
  const { observedStats } = ctx.domain;
  const checks = [];
  for (const [key, z] of Object.entries(item.expect.z || {})) {
    const point = byKey.get(key);
    checks.push({ check: `Lần chạy/mức ${key}: Z-score`, expected: fmt(z), actual: fmt(point?.z), pass: sameNumber(point?.z, z) });
  }
  const summary = ctx.westgard.listTestSummaries().find((row) => row.testId === created.testId);
  for (const [level, want] of Object.entries(item.expect.stats || {})) {
    // Trang Phân tích Westgard tính thống kê trên các điểm main đánh dấu `accepted`.
    const got = observedStats(analyses[level].points.filter((point) => point.accepted));
    checks.push({ check: `Mức ${level}: số điểm được chấp nhận (n)`, expected: fmt(want.n), actual: fmt(got.n), pass: got.n === want.n });
    checks.push({ check: `Mức ${level}: Mean quan sát`, expected: fmt(want.mean), actual: fmt(got.mean), pass: sameNumber(got.mean, want.mean) });
    checks.push({ check: `Mức ${level}: SD quan sát`, expected: fmt(want.sd), actual: fmt(got.sd), pass: sameNumber(got.sd, want.sd) });
    checks.push({ check: `Mức ${level}: CV% quan sát`, expected: fmt(want.cv), actual: fmt(got.cv), pass: sameNumber(got.cv, want.cv) });
    checks.push({ check: `Mức ${level}: thống kê "tạm thời"`, expected: want.provisional ? 'Có' : 'Không', actual: got.provisional ? 'Có' : 'Không', pass: got.provisional === want.provisional });
    // CV ở Tổng quan do main tính riêng — phải trùng.
    const summaryCv = summary?.levels.find((row) => row.level === Number(level))?.cv ?? null;
    checks.push({ check: `Mức ${level}: CV% ở Tổng quan`, expected: fmt(want.cv), actual: fmt(summaryCv), pass: sameNumber(summaryCv, want.cv) });
  }
  return checks;
}

function sigmaChecks(ctx, item, created) {
  const cohort = item.cohort;
  const period = cohort ? cohort.period : '2026-01';
  let levels;
  if (cohort) {
    // Như hộp thoại "Lấy CV từ IQC" của trang Six Sigma: nạp nhóm IQC của lô,
    // người phụ trách xác nhận đã rà soát (kèm dấu vân tay dữ liệu).
    levels = ctx.sigma.listCohorts(created.testId, period, [1]).map((found) => ({
      level: found.level, cvSource: 'iqc-cohort', sourceLot: found.lot, refreshCohort: true,
      cohortFingerprint: found.fingerprint, cohortReviewed: true, biasEqa: cohort.biasEqa, tea: cohort.tea,
    }));
    if (!levels.length) throw new Error('Không có nhóm IQC nào cho kỳ ' + period);
  } else {
    // TEa ghi ngay ở mức (ưu tiên cao nhất), để kết quả không phụ thuộc danh mục TEa.
    levels = item.sigma.levels.map((level) => ({ ...level, tea: item.sigma.tea }));
  }
  must(ctx.sigma.savePeriod({ testId: created.testId, period, tea: cohort ? cohort.tea : item.sigma.tea, levels }, ADMIN), `${item.id} lưu kỳ Sigma`);
  // Trang Six Sigma nạp lại kỳ bằng `listSigmaPeriods` sau khi lưu.
  const view = ctx.sigma.listPeriods(created.testId).find((row) => row.period === period);
  const checks = [];
  for (const [level, want] of Object.entries(item.expect)) {
    const got = view?.levels.find((row) => row.level === Number(level));
    const sigma = got?.sigma?.sigma ?? null;
    // Trọn đường thì đọc gợi ý trang Sigma hiển thị; CV nhập tay thì trang
    // không hiện gợi ý, nên kiểm bảng bằng chính hàm main dùng.
    const design = cohort ? got?.qualityDesign : (sigma == null ? null : ctx.domain.sigmaQualityDesign(sigma, item.levels.length));
    const designSource = cohort ? '' : ' (bảng Westgard Sigma Rules)';
    const add = (label, expected, actual, pass) => checks.push({ check: `Mức ${level}: ${label}`, expected, actual, pass });
    if ('cohortN' in want) add('Số điểm IQC của nhóm', fmt(want.cohortN), fmt(got?.cohortN), got?.cohortN === want.cohortN);
    if ('cohortStatus' in want) add('Trạng thái nhóm IQC', want.cohortStatus, got?.cohortStatus || '—', got?.cohortStatus === want.cohortStatus);
    if ('cv' in want) add('CV% dùng cho Sigma', fmt(want.cv), fmt(got?.cv), sameNumber(got?.cv, want.cv));
    if ('sigma' in want) add('Sigma', fmt(want.sigma), fmt(sigma), sameNumber(sigma, want.sigma));
    if ('dpmo' in want) {
      const dpmo = got?.sigma?.dpmo ?? null;
      add('DPMO', fmt(want.dpmo), fmt(round(dpmo, 3)), dpmo != null && Math.abs(dpmo - want.dpmo) <= Math.max(0.5, want.dpmo * 1e-3));
    }
    if ('biasEqa' in want) add('Bias% dùng cho Sigma', fmt(want.biasEqa), fmt(got?.biasEqa), sameNumber(got?.biasEqa, want.biasEqa));
    if ('biasMean' in want) add('Bias% trung bình có dấu (tham khảo)', fmt(want.biasMean), fmt(got?.biasMean), sameNumber(got?.biasMean, want.biasMean));
    if ('mixedSigns' in want) add('Cảnh báo vòng EQA trái dấu', want.mixedSigns ? 'Có' : 'Không', got?.mixedSigns ? 'Có' : 'Không', got?.mixedSigns === want.mixedSigns);
    if ('tier' in want) add(`Bậc Sigma${designSource}`, want.tier, design?.tier ?? '—', design?.tier === want.tier);
    if ('capable' in want) add(`Đủ năng lực${designSource}`, want.capable ? 'Có' : 'Không', design ? (design.capable ? 'Có' : 'Không') : '—', design?.capable === want.capable);
    if ('rules' in want) add(`Bộ luật gợi ý${designSource}`, fmt(want.rules), fmt(design?.rules ?? []), sameSet(design?.rules ?? [], want.rules));
    if ('n' in want) add(`Số phép đo QC mỗi lần chạy (N)${designSource}`, fmt(want.n), fmt(design?.n ?? null), design?.n === want.n);
    if ('r' in want) add(`Số lần chạy (R)${designSource}`, fmt(want.r), fmt(design?.r ?? null), design?.r === want.r);
    const shown = !!got?.qualityDesign;
    const wantShown = want.designShown === true;
    add('Trang Sigma hiện gợi ý thiết kế', wantShown ? 'Có' : 'Không (CV nhập tay, chưa từ nhóm IQC đã rà soát)', shown ? 'Có' : 'Không', shown === wantShown);
  }
  return checks;
}

function qgiChecks(ctx, item) {
  const got = ctx.domain.sigmaImprovement(item.tea, item.bias, item.cv);
  const DRIVER = { imprecision: 'Độ chụm (CV)', inaccuracy: 'Độ chệch (Bias)', both: 'Cả hai' };
  return [
    { check: 'QGI', expected: fmt(item.expect.qgi), actual: fmt(got.qgi), pass: sameNumber(got.qgi, item.expect.qgi) },
    { check: 'Nguyên nhân chính', expected: DRIVER[item.expect.driver], actual: DRIVER[got.driver] || got.driver, pass: got.driver === item.expect.driver },
  ];
}

function cusumChecks(item, analyses) {
  const analysis = analyses[1];
  const checks = [];
  for (const [field, label] of [['cPos', 'C+'], ['cNeg', 'C−']]) {
    const want = item.expect[field];
    if (!want) continue;
    const got = analysis.cusum[field].map((value) => round(value, 6));
    checks.push({ check: `${label} từng lần chạy`, expected: fmt(want), actual: fmt(got), pass: got.length === want.length && got.every((value, i) => sameNumber(value, want[i])) });
  }
  const signalRuns = analysis.points.map((point, index) => (point.cusumSignal ? index + 1 : null)).filter(Boolean);
  checks.push({ check: 'Lần chạy có tín hiệu CUSUM', expected: fmt(item.expect.signalRuns), actual: fmt(signalRuns), pass: sameSet(signalRuns.map(String), item.expect.signalRuns.map(String)) });
  if (item.expect.signal) {
    const labels = [...new Set(analysis.points.map((point) => point.cusumSignal).filter(Boolean))];
    checks.push({ check: 'Loại tín hiệu', expected: item.expect.signal, actual: fmt(labels), pass: labels.length === 1 && labels[0] === item.expect.signal });
  }
  checks.push({ check: 'CUSUM không tự loại điểm', expected: 'Mọi điểm Đạt, vào thống kê', actual: analysis.points.every((p) => p.verdict === 'ok' && p.accepted) ? 'Mọi điểm Đạt, vào thống kê' : 'Có điểm bị loại', pass: analysis.points.every((p) => p.verdict === 'ok' && p.accepted) });
  checks.push({ check: 'k, h theo cấu hình', expected: `k=${fmt(item.cusum.k)}; h=${fmt(item.cusum.h)}`, actual: `k=${fmt(analysis.cusum.k)}; h=${fmt(analysis.cusum.h)}`, pass: analysis.cusum.k === item.cusum.k && analysis.cusum.h === item.cusum.h });
  return checks;
}

function describeInput(item) {
  if (item.cohort) return `30 điểm IQC mức 1 (Mean/SD 100/2), kỳ ${item.cohort.period}; TEa ${fmt(item.cohort.tea)}%, Bias ${fmt(item.cohort.biasEqa)}%; CV lấy từ nhóm IQC, người phụ trách xác nhận đã rà soát`;
  if (item.sigma) return `TEa ${fmt(item.sigma.tea)}%; ` + item.sigma.levels.map((l) => `mức ${l.level}: CV ${fmt(l.cv)}%` + (l.biasEqa != null ? `, Bias ${fmt(l.biasEqa)}%` : l.eqaRounds ? `, EQA ${l.eqaRounds.map((r) => `${fmt(r.lab)}/${fmt(r.target)}`).join(', ')}` : ', chưa có Bias')).join('; ');
  if ('bias' in item && 'cv' in item) return `TEa ${fmt(item.tea)}%, Bias ${fmt(item.bias)}%, CV ${fmt(item.cv)}%`;
  const levels = item.levels.map((l) => `M${l.level} ${fmt(l.mean)}/${fmt(l.sd)}`).join(', ');
  const steps = (item.runs || []).map((step) => {
    if (step.setTarget) return `[đổi Mean/SD M${step.setTarget.level} → ${fmt(step.setTarget.mean)}/${fmt(step.setTarget.sd)}]`;
    if (step.nceEffective) return '[NCE khắc phục hiệu quả]';
    if (step.z) return Object.values(step.z).map((z) => (z > 0 ? '+' : '') + fmt(z)).join('|');
    return Object.values(step.val).map(fmt).join('|');
  });
  const rules = Object.entries(item.rules || {}).map(([rule, action]) => `${rule}=${action}`).join(', ');
  const kind = item.runs?.some((step) => step.z) ? 'Z' : 'giá trị';
  return `Mean/SD ${levels}; ${kind} theo lần chạy: ${steps.join('  ')}${rules ? `; luật riêng: ${rules}` : ''}${item.cusum ? `; CUSUM k=${fmt(item.cusum.k)}, h=${fmt(item.cusum.h)}` : ''}`;
}

export function runValidation() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-tham-dinh-'));
  const { openDatabase } = load('db/open-database.js');
  const db = openDatabase(path.join(dir, 'qclab.sqlite'));
  const ctx = {
    config: load('ipc/config-handlers.js').createConfigHandlers(db),
    entry: load('ipc/entry-handlers.js').createEntryHandlers(db),
    westgard: load('ipc/westgard-handlers.js').createWestgardHandlers(db),
    nce: load('ipc/nce-handlers.js').createNceHandlers(db),
    sigma: load('ipc/sigma-handlers.js').createSigmaHandlers(db),
    domain: { ...load('domain/observed-stats.js'), ...load('domain/sigma-metrics.js') },
  };
  const results = [];
  const inputs = [];
  try {
    ctx.instrumentId = must(ctx.config.saveInstrument({ data: { name: 'Máy thẩm định' } }, ADMIN), 'máy').id;
    for (const group of ALL_GROUPS) {
      for (const item of group.cases) {
        let checks;
        try {
          if (QGI_CASES.includes(item)) {
            checks = qgiChecks(ctx, item);
          } else {
            const created = createCaseTest(ctx, item);
            if (SIGMA_CASES.includes(item)) {
              if (item.runs) enterRuns(ctx, item, created, inputs);
              checks = sigmaChecks(ctx, item, created);
            } else {
              const runDates = enterRuns(ctx, item, created, inputs);
              const { byKey, analyses } = analyze(ctx, item, created, runDates);
              checks = [];
              if (WESTGARD_CASES.includes(item) || item.expect.points) checks.push(...westgardChecks(item, byKey));
              if (STATS_CASES.includes(item)) checks.push(...statsChecks(ctx, item, created, byKey, analyses));
              if (CUSUM_CASES.includes(item)) checks.push(...cusumChecks(item, analyses));
            }
          }
        } catch (error) {
          checks = [{ check: 'Chạy ca', expected: 'chạy được', actual: `Lỗi: ${error instanceof Error ? error.message : String(error)}`, pass: false }];
        }
        results.push({ group: group.label, id: item.id, title: item.title, basis: item.basis, input: describeInput(item), checks, pass: checks.every((c) => c.pass) });
      }
    }
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
  return { results, inputs };
}

function appInfo() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  let commit = '';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* không có git */ }
  let dirty = false;
  try { dirty = execSync('git status --porcelain -- app', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== ''; } catch { /* không có git */ }
  return { version: pkg.version, commit: commit ? `${commit}${dirty ? ' (có sửa chưa commit)' : ''}` : 'không rõ' };
}

export async function writeWorkbook({ results, inputs }, file) {
  const { default: ExcelJS } = await import('exceljs');
  const info = appInfo();
  const now = new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QC Lab — bộ thẩm định';
  const header = (sheet, columns) => {
    sheet.columns = columns;
    const row = sheet.getRow(1);
    row.font = { bold: true };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF2' } }; });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  };
  const passFill = (cell, pass) => { cell.font = { bold: true, color: { argb: pass ? 'FF1B7A3A' : 'FFB42318' } }; };

  const summary = workbook.addWorksheet('Tổng hợp');
  summary.columns = [{ width: 34 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }];
  const totalChecks = results.reduce((n, r) => n + r.checks.length, 0);
  const failedCases = results.filter((r) => !r.pass);
  const lines = [
    ['BIÊN BẢN THẨM ĐỊNH PHẦN MỀM QC LAB — PHẦN TÍNH TOÁN NỘI KIỂM'],
    [],
    ['Phiên bản phần mềm', info.version],
    ['Mã nguồn (commit)', info.commit],
    ['Ngày giờ chạy', now.toLocaleString('vi-VN')],
    ['Môi trường', `Node ${process.versions.node} · ${os.type()} ${os.release()}`],
    ['Phương pháp', 'Ca dựng sẵn có đáp án theo định nghĩa; nạp qua đúng các hàm giao diện dùng, trên CSDL tạm'],
    [],
    ['Nhóm', 'Số ca', 'Đạt', 'Không đạt', 'Số phép kiểm'],
    ...[...new Set(results.map((r) => r.group))].map((group) => {
      const rows = results.filter((r) => r.group === group);
      return [group, rows.length, rows.filter((r) => r.pass).length, rows.filter((r) => !r.pass).length, rows.reduce((n, r) => n + r.checks.length, 0)];
    }),
    ['Tổng', results.length, results.length - failedCases.length, failedCases.length, totalChecks],
    [],
    ['Kết quả chung', failedCases.length ? `KHÔNG ĐẠT — ${failedCases.length} ca: ${failedCases.map((r) => r.id).join(', ')}` : 'ĐẠT — mọi ca khớp đáp án'],
    [],
    ['Giới hạn', 'Bộ ca kiểm phần tính toán và kết luận của app, không kiểm giao diện, in ấn, LIS hay dữ liệu thật của phòng xét nghiệm. Phòng xét nghiệm cần xem xét đáp án và căn cứ của từng ca trước khi chấp nhận.'],
    [],
    ['Người thực hiện', '', 'Ký tên', '', 'Ngày'],
    ['Người xem xét', '', 'Ký tên', '', 'Ngày'],
    ['Kết luận của phòng xét nghiệm', '☐ Chấp nhận   ☐ Không chấp nhận   ☐ Chấp nhận có điều kiện'],
  ];
  lines.forEach((line) => summary.addRow(line));
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.getRow(9).font = { bold: true };
  const verdictRow = summary.getRow(9 + [...new Set(results.map((r) => r.group))].length + 3);
  passFill(verdictRow.getCell(2), !failedCases.length);
  summary.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; }));

  const cases = workbook.addWorksheet('Ca thẩm định');
  header(cases, [
    { header: 'Mã ca', key: 'id', width: 9 }, { header: 'Nhóm', key: 'group', width: 18 }, { header: 'Nội dung', key: 'title', width: 46 },
    { header: 'Dữ liệu vào', key: 'input', width: 60 }, { header: 'Căn cứ đáp án', key: 'basis', width: 60 },
    { header: 'Số phép kiểm', key: 'checks', width: 10 }, { header: 'Kết luận', key: 'result', width: 12 },
  ]);
  for (const r of results) {
    const row = cases.addRow({ id: r.id, group: r.group, title: r.title, input: r.input, basis: r.basis, checks: r.checks.length, result: r.pass ? 'Đạt' : 'Không đạt' });
    row.alignment = { vertical: 'top', wrapText: true };
    passFill(row.getCell('result'), r.pass);
  }

  const detail = workbook.addWorksheet('Chi tiết phép kiểm');
  header(detail, [
    { header: 'Mã ca', key: 'id', width: 9 }, { header: 'Phép kiểm', key: 'check', width: 38 },
    { header: 'Đáp án', key: 'expected', width: 34 }, { header: 'Kết quả của app', key: 'actual', width: 34 }, { header: 'Kết luận', key: 'result', width: 12 },
  ]);
  for (const r of results) for (const c of r.checks) {
    const row = detail.addRow({ id: r.id, check: c.check, expected: c.expected, actual: c.actual, result: c.pass ? 'Đạt' : 'Không đạt' });
    row.alignment = { vertical: 'top', wrapText: true };
    passFill(row.getCell('result'), c.pass);
  }

  const data = workbook.addWorksheet('Dữ liệu vào');
  header(data, [
    { header: 'Mã ca', key: 'caseId', width: 9 }, { header: 'Lần chạy', key: 'run', width: 9 }, { header: 'Ngày', key: 'date', width: 12 },
    { header: 'Mức', key: 'level', width: 6 }, { header: 'Mean đích', key: 'mean', width: 10 }, { header: 'SD đích', key: 'sd', width: 9 },
    { header: 'Giá trị nhập', key: 'val', width: 12 }, { header: 'Z thiết kế', key: 'z', width: 10 },
  ]);
  inputs.forEach((row) => data.addRow(row));

  mkdirSync(path.dirname(file), { recursive: true });
  await workbook.xlsx.writeFile(file);
  return file;
}

// Chạy trực tiếp: in tóm tắt, ghi Excel, trả mã thoát 1 nếu có ca không đạt.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outcome = runValidation();
  const failed = outcome.results.filter((r) => !r.pass);
  for (const r of outcome.results) {
    console.log(`${r.pass ? 'ĐẠT     ' : 'KHÔNG ĐẠT'} ${r.id}  ${r.title}`);
    for (const c of r.checks.filter((c) => !c.pass)) console.log(`          ↳ ${c.check}: đáp án ${c.expected}, app ${c.actual}`);
  }
  const info = appInfo();
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(ROOT, 'validation-output', `QC-Lab-tham-dinh-${info.version}-${stamp}.xlsx`);
  await writeWorkbook(outcome, file);
  console.log(`\n${outcome.results.length - failed.length}/${outcome.results.length} ca đạt · ${outcome.results.reduce((n, r) => n + r.checks.length, 0)} phép kiểm`);
  console.log(`Biên bản: ${path.relative(ROOT, file)}`);
  process.exitCode = failed.length ? 1 : 0;
}
