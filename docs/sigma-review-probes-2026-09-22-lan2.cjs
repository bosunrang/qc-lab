// HISTORICAL PRE-FIX PROBES cho SIGMA-REVIEW-2026-09-22-lan2.md (SG13 … SG21).
// SG13…SG19 ĐÃ ĐƯỢC SỬA, nên file này BÂY GIỜ DỪNG SỚM (fail ở SG13) — đó là
// kết quả đúng. Nó chỉ còn giá trị làm bằng chứng trạng thái trước sửa.
// Hồi quy chính thức của bản đã sửa: `app/tests/sigma-review-lan2.test.mjs`
// (chạy bằng `npm test`).
// Các assert dưới đây mô tả KHUYẾT TẬT LÚC ĐÓ, không phải kỳ vọng hồi quy.
// Chỉ đọc: SQLite `:memory:` và hàm thuần; không đụng DB người dùng.
// Chạy: npm run app:build:main && node docs/sigma-review-probes-2026-09-22-lan2.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const req = (p) => require(path.join(root, p));
const { openDatabase } = req('app-dist/main/db/open-database.js');
const { createConfigHandlers } = req('app-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = req('app-dist/main/ipc/sigma-handlers.js');
const { createWestgardHandlers } = req('app-dist/main/ipc/westgard-handlers.js');
const { listOperationalLevels } = req('app-dist/main/db/operational-levels.js');
const { buildSigmaCohorts } = req('app-dist/main/domain/sigma-cohort.js');
const { westgard } = req('app-dist/main/domain/westgard-engine.js');
const { sigmaQualityDesign, dpmoFromSigma, uncertaintyBudget, eqaRoundsStats } = req('app-dist/main/domain/sigma-metrics.js');

const actor = { userId: 'u', username: 'u', name: 'U', role: 'admin', clientId: 'probe' };
const log = (tag, ...rest) => console.log(String(tag).padEnd(9), ...rest);

/** Xét nghiệm 1 máy + N mức, kèm handler Sigma/Westgard. */
function lab(levels, name = 'Glucose', unit = 'mmol/L') {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'M' } }, actor).data;
  const test = config.saveTest({ data: { name, instrumentId: inst.id, unit } }, actor).data;
  for (const level of levels) config.saveTestLevel({ testId: test.id, data: { level, mean: 100, sd: 2 } }, actor);
  return { db, config, test, sigma: createSigmaHandlers(db), westgard: createWestgardHandlers(db) };
}
function seedIqc(db, testId, level, month, lot = 'L1', count = 30) {
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  for (let i = 0; i < count; i++) {
    insert.run(`${lot}-${month}-${level}-${i}`, testId, level, `2026-${month}-${String(i % 20 + 1).padStart(2, '0')}`,
      String(i), 100 + (i % 5 - 2) * 1.5, lot, 100, 2);   // CV ≈ 2,16% → Sigma ≈ 4,2
  }
}

// ── SG13: bảng Westgard Sigma Rules chọn theo SỐ DÒNG của kỳ ─────────────────
{
  const { db, sigma, test, config } = lab([1, 2, 3]);
  for (const month of ['08', '09']) for (const level of [1, 2, 3]) seedIqc(db, test.id, level, month);
  const rows = (period, levels) => {
    const found = sigma.listCohorts(test.id, period, levels);
    return levels.map((level) => ({
      level, tea: 10, biasEqa: 1, cvSource: 'iqc-cohort', sourceLot: 'L1',
      refreshCohort: true, cohortReviewed: true,
      cohortFingerprint: found.find((c) => c.level === level && c.lot === 'L1').fingerprint,
    }));
  };
  const full = sigma.savePeriod({ testId: test.id, period: '2026-08', teaSource: 'ricos', tea: 10, levels: rows('2026-08', [1, 2, 3]) }, actor);
  const partial = sigma.savePeriod({ testId: test.id, period: '2026-09', teaSource: 'ricos', tea: 10, levels: rows('2026-09', [1, 2]) }, actor);
  const a = full.data.levels[0].qualityDesign, b = partial.data.levels[0].qualityDesign;
  log('SG13', `test_levels khai báo: ${config.listTestLevels(test.id).length} mức`);
  log('SG13', `kỳ đủ 3 dòng  → bảng ${a.levels} mức · ${a.rules.join('/')} · N=${a.n} R=${a.r}`);
  log('SG13', `kỳ chỉ 2 dòng → bảng ${b.levels} mức · ${b.rules.join('/')} · N=${b.n} R=${b.r}`);
  assert.equal(a.levels, 3);
  assert.equal(b.levels, 2, 'SG13: bớt một dòng đổi hẳn bảng Sigma Rules');
  assert.notDeepEqual(a.rules, b.rules);
  // Mức KHÔNG có trong test_levels vẫn lưu được và vẫn tính vào levelCount.
  const ghost = sigma.savePeriod({ testId: test.id, period: '2026-07', teaSource: 'ricos', tea: 10,
    levels: [{ level: 1, tea: 10, cv: 2, biasEqa: 1 }, { level: 7, tea: 10, cv: 2, biasEqa: 1 }] }, actor);
  assert.deepEqual(ghost.data.levels.map((l) => l.level), [1, 7], 'SG13: cổng lưu nhận mức không tồn tại');
  log('SG13', 'mức 7 (không có trong test_levels) vẫn lưu được và vẫn đếm vào levelCount');
  db.close();
}

// ── SG14: trang Sigma đếm mức bằng listTestLevels, không qua cổng vận hành ───
{
  const { db, config, test } = lab([1, 2], 'Na');
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g-run','G run',1,'active'),('g-stop','G stop',1,'stopped')").run();
  db.prepare("INSERT INTO qc_lots(id,lot_no,level,group_id,exp) VALUES ('l1','L1',1,'g-run','2027-01-01'),('l2','L2',2,'g-stop','2027-01-01')").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='l1' WHERE test_id=? AND level=1").run(test.id);
  db.prepare("UPDATE test_levels SET qc_lot_id='l2' WHERE test_id=? AND level=2").run(test.id);
  const all = config.listTestLevels(test.id).map((r) => r.level);
  const operational = listOperationalLevels(db, test.id).map((r) => r.level);
  log('SG14', `listTestLevels (SigmaPage.operationalLevels): [${all}]`);
  log('SG14', `listOperationalLevels (Nhập QC + Westgard)  : [${operational}]`);
  assert.notDeepEqual(all, operational, 'SG14: hai trang đếm số mức khác nhau');
  db.close();
}

// ── SG15: cổng cohort |z| ≥ 3 vs 1-3s "> 3" của engine ───────────────────────
{
  const points = Array.from({ length: 30 }, (_, i) => ({
    id: 'p' + i, level: 1, lot: 'L1', date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`,
    val: 100, voided: 0, qc_mean: 100, qc_sd: 2,
  }));
  points[10].val = 106;                                  // z = +3,000 chẵn
  const [cohort] = buildSigmaCohorts(points, '2026-08', [1], '2026-09-30', new Set());
  const flag = westgard([{ val: 106 }], 100, 2, () => true).F[0];
  log('SG15', `z = ${(106 - 100) / 2} → Westgard: ${flag.level} (${flag.rules.join(',') || '—'}) · cohort: ${cohort.status}`);
  log('SG15', `issues: ${cohort.issues.join(' · ')}`);
  assert.equal(cohort.status, 'out-of-control');
  assert.notEqual(flag.level, 'rej', 'SG15: điểm KHÔNG bị loại nên sẽ không ai mở NCE → cohort bị chặn vĩnh viễn');
}

// ── SG16: đổi cấu hình luật Westgard gỡ hiệu lực rà soát cohort ──────────────
{
  const { db, sigma, westgard: wg, test } = lab([1]);
  seedIqc(db, test.id, 1, '08');
  const cohort = sigma.listCohorts(test.id, '2026-08', [1])[0];
  sigma.savePeriod({ testId: test.id, period: '2026-08', teaSource: 'ricos', tea: 10, levels: [{
    level: 1, tea: 10, biasEqa: 1, cvSource: 'iqc-cohort', sourceLot: 'L1',
    refreshCohort: true, cohortReviewed: true, cohortFingerprint: cohort.fingerprint,
  }] }, actor);
  const read = () => sigma.listPeriods(test.id)[0].levels[0];
  const before = read();
  wg.saveRuleSetting('9x', true, actor);                 // luật này không hề tham gia cổng |z| ≥ 3
  const after = read();
  log('SG16', `trước: stale=${before.cohortStale} reviewed=${before.cohortReviewed} design=${before.qualityDesign ? before.qualityDesign.rules.join('/') : null}`);
  log('SG16', `sau  : stale=${after.cohortStale} reviewed=${after.cohortReviewed} design=${after.qualityDesign}`);
  assert.equal(before.cohortReviewed, true);
  assert.equal(after.cohortStale, true, 'SG16: bật một luật Westgard làm cohort bị coi là đã đổi');
  assert.equal(after.qualityDesign, null, 'SG16: mất luôn gợi ý thiết kế QC');
  db.close();
}

// ── SG17: TEa lấy từ bậc dự phòng bị đóng băng, hồ sơ nói sai nguồn ──────────
{
  const { db, sigma, test } = lab([1]);
  sigma.saveTeaConfig({ testId: test.id, source: 'ricos' }, actor);          // nguồn ĐANG KHAI
  db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)')
    .run(`${test.id}:2026-07`, test.id, '2026-07', null, 'lab', JSON.stringify([{ level: 1, cv: 2, biasEqa: 1 }]));
  const before = sigma.listPeriods(test.id)[0].levels[0];
  log('SG17', `kỳ chốt nguồn "lab" (chưa có hồ sơ → không giải được); màn hình hiện TEa ${before.tea}% từ bậc dự phòng "ricos"`);
  // levelPayload() của SigmaPage gửi lại chính con số ĐÃ GIẢI như một snapshot.
  sigma.savePeriod({ testId: test.id, period: '2026-07', teaSource: 'lab',
    levels: [{ level: 1, tea: before.tea, cv: 2.5, biasEqa: 1, cvSource: 'manual' }] }, actor);
  const after = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(`${test.id}:2026-07`).lv_json)[0];
  log('SG17', `sau 1 lần sửa CV: lv_json.tea = ${after.tea} · teaBasis = ${after.teaBasis ? after.teaBasis.source : 'KHÔNG CÓ'}`);
  assert.equal(after.tea, before.tea);
  assert.equal(after.teaBasis, undefined, 'SG17: TEa bị ghi cứng mà không có nguồn gốc');
  db.close();
}

// ── SG18: MDC kẹp điểm ngoài thang, không dấu hiệu ───────────────────────────
{
  const xMax = 60, yMax = 100, cvRatio = 95, biasRatio = 130;
  const drawn = (100 - Math.min(yMax, biasRatio)) / Math.min(xMax, cvRatio);
  const real = (100 - biasRatio) / cvRatio;
  log('SG18', `thật: CV/TEa ${cvRatio}% · |Bias|/TEa ${biasRatio}% → Sigma ${real.toFixed(2)}`);
  log('SG18', `vẽ  : CV/TEa ${Math.min(xMax, cvRatio)}% · |Bias|/TEa ${Math.min(yMax, biasRatio)}% → đọc ra Sigma ${drawn.toFixed(2)}`);
  assert.ok(Math.abs(drawn - real) > 0.3, 'SG18: toạ độ vẽ nói một Sigma khác hẳn Sigma thật');
}

// ── SG19/SG21: hai chi tiết nhỏ ──────────────────────────────────────────────
{
  const noBias = uncertaintyBudget({ cv: 2, uCref: 0.8, uCal: 1, tea: 10 });
  log('SG19', `chưa có bias: uCref trả về ${noBias.uCref} nhưng uBias = ${noBias.uBias} (không vào u_c)`);
  assert.equal(noBias.uCref, 0.8);
  assert.equal(noBias.uBias, null);
  log('SG21', `EQA 1 vòng −3% → ${eqaRoundsStats([-3]).rms} · 2 vòng −3/−5% → ${eqaRoundsStats([-3, -5]).rms.toFixed(3)} (mất dấu, mean ${eqaRoundsStats([-3, -5]).mean})`);
}

// ── Phần nền đã kiểm và ĐÚNG ─────────────────────────────────────────────────
{
  for (const [sigma, expected] of [[6, 3.4], [5, 233], [4, 6210], [3, 66807]]) {
    const got = dpmoFromSigma(sigma);
    assert.ok(Math.abs(got - expected) / expected < 0.005, `DPMO ${sigma}σ`);
  }
  log('OK', 'DPMO khớp bảng chuẩn (dịch 1,5σ): 6σ=3,40 · 5σ=233 · 4σ=6210 · 3σ=66807');
  assert.equal(sigmaQualityDesign(null), null);
  assert.equal(sigmaQualityDesign(''), null);
  log('OK', 'Sigma chưa tính được KHÔNG bị gán tier "<3σ"');
  const mu = uncertaintyBudget({ cv: 2, bias: 1.5, uCref: 0.8, uCal: 1.2, tea: 10, target: 100 });
  const uBias = Math.hypot(1.5, 0.8), uc = Math.hypot(2, uBias, 1.2);
  assert.ok(Math.abs(mu.uBias - uBias) < 1e-12 && Math.abs(mu.uc - uc) < 1e-12 && Math.abs(mu.U - 2 * uc) < 1e-12);
  assert.equal(uncertaintyBudget({ cv: 2, bias: 1.5, uCref: 0.8, tea: 10 }).teaRatio, null);
  log('OK', 'MU: u_c=√(u(Rw)²+u(bias)²+u(cal)²), u(bias)=√(bias²+u(Cref)²), U=2u_c; thiếu thành phần thì chặn U/TEa');
}

console.log('\nTất cả probe SG13…SG21 tái hiện được trên mã hiện tại.');
