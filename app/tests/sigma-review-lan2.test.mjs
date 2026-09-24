// Hồi quy cho lượt rà Six Sigma lần 2 (SG13…SG19) — xem
// `docs/SIGMA-REVIEW-2026-09-22-lan2.md`. Khác với
// `docs/sigma-review-probes-2026-09-22-lan2.cjs` (ghi nhận TRẠNG THÁI LỖI),
// file này khẳng định HÀNH VI ĐÚNG và phải luôn xanh.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { buildSigmaCohorts } = require('../../app-dist/main/domain/sigma-cohort.js');
const { westgard } = require('../../app-dist/main/domain/westgard-engine.js');
const { uncertaintyBudget } = require('../../app-dist/main/domain/sigma-metrics.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

/** Xét nghiệm có `levels` mức QC ĐANG VẬN HÀNH (lô gắn vào nhóm lô đang chạy). */
function lab(t, levels) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mmol/L' } }, actor).data;
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g','Nhom dang chay',1,'active')").run();
  for (const level of levels) {
    db.prepare('INSERT INTO qc_lots(id,lot_no,level,group_id,exp) VALUES (?,?,?,?,?)').run('l' + level, 'L1', level, 'g', '2027-01-01');
    config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2, qcLotId: 'l' + level } }, actor);
  }
  return { db, config, assay, sigma: createSigmaHandlers(db), westgardHandlers: createWestgardHandlers(db) };
}
/** 30 điểm IQC ổn định (CV ≈ 2,16%) cho một mức trong một tháng. */
function seedIqc(db, testId, level, month) {
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  for (let i = 0; i < 30; i++) {
    insert.run(`p${month}-${level}-${i}`, testId, level, `2026-${month}-${String(i % 20 + 1).padStart(2, '0')}`, String(i), 100 + (i % 5 - 2) * 1.5, 'L1', 100, 2);
  }
}
/** Payload mức lấy CV từ cohort IQC và đã xác nhận rà soát. */
function reviewedCohortLevels(sigma, testId, period, levels) {
  const found = sigma.listCohorts(testId, period, levels);
  return levels.map((level) => ({
    level, tea: 10, biasEqa: 1, cvSource: 'iqc-cohort', sourceLot: 'L1',
    refreshCohort: true, cohortReviewed: true,
    cohortFingerprint: found.find((c) => c.level === level && c.lot === 'L1').fingerprint,
  }));
}

test('SG13: bảng Westgard Sigma Rules theo thiết kế QC đang vận hành, không theo số dòng của kỳ', t => {
  const { db, sigma, assay } = lab(t, [1, 2, 3]);
  for (const month of ['08', '09']) for (const level of [1, 2, 3]) seedIqc(db, assay.id, level, month);
  const full = sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'ricos', tea: 10, levels: reviewedCohortLevels(sigma, assay.id, '2026-08', [1, 2, 3]) }, actor);
  // Kỳ chỉ nhập được 2 mức (vd chưa có EQA cho mức 3) VẪN phải đọc bảng 3 mức.
  const partial = sigma.savePeriod({ testId: assay.id, period: '2026-09', teaSource: 'ricos', tea: 10, levels: reviewedCohortLevels(sigma, assay.id, '2026-09', [1, 2]) }, actor);
  assert.equal(full.ok, true); assert.equal(partial.ok, true);
  const a = full.data.levels[0].qualityDesign, b = partial.data.levels[0].qualityDesign;
  assert.equal(a.levels, 3);
  assert.equal(b.levels, 3, 'bớt một dòng KHÔNG được đổi bảng');
  assert.equal(b.levelCount, 3, 'levelCount là số mức QC đang vận hành');
  assert.deepEqual(b.rules, a.rules);
  assert.equal(b.n, a.n); assert.equal(b.r, a.r);
});

test('SG13b: một mức QC đang vận hành không được mượn bảng Sigma Rules cho hai mức', t => {
  const { db, sigma, assay } = lab(t, [1]);
  seedIqc(db, assay.id, 1, '08');
  const saved = sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'ricos', tea: 10, levels: reviewedCohortLevels(sigma, assay.id, '2026-08', [1]) }, actor);
  assert.equal(saved.ok, true);
  assert.equal(saved.data.levels[0].qualityDesign, null);
  const page = readFileSync(new URL('../renderer/pages/SigmaPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /cần tối thiểu 2 mức QC đang vận hành/i);
});

test('SG13: không lập được kỳ cho mức chưa khai, nhưng mức cũ vẫn sửa được', t => {
  const { db, config, sigma, assay } = lab(t, [1]);
  const ghost = sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'ricos', levels: [{ level: 1, cv: 2, biasEqa: 1 }, { level: 7, cv: 2, biasEqa: 1 }] }, actor);
  assert.equal(ghost.ok, false);
  assert.equal(ghost.error.code, 'unknown-level');

  // Mức 2 được khai rồi lập kỳ, sau đó bị xoá khỏi cấu hình: kỳ cũ vẫn sửa được.
  config.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 120, sd: 2 } }, actor);
  assert.equal(sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'ricos', levels: [{ level: 1, cv: 2, biasEqa: 1 }, { level: 2, cv: 2, biasEqa: 1 }] }, actor).ok, true);
  db.prepare('DELETE FROM test_levels WHERE test_id=? AND level=2').run(assay.id);
  const edit = sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'ricos', levels: [{ level: 1, cv: 2, biasEqa: 1 }, { level: 2, cv: 3, biasEqa: 1 }] }, actor);
  assert.equal(edit.ok, true, 'kỳ lịch sử không được khoá cứng vì cấu hình đổi sau');
  assert.equal(edit.data.levels.find((level) => level.level === 2).cv, 3);
});

test('SG14: listTestLevels trả cờ operational để Sigma đếm đúng thiết kế QC', t => {
  const { db, config, assay } = lab(t, [1]);
  config.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 120, sd: 2 } }, actor);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g2','Nhom da dung',1,'stopped')").run();
  db.prepare("INSERT INTO qc_lots(id,lot_no,level,group_id,exp) VALUES ('l2s','L2',2,'g2','2027-01-01')").run();
  db.prepare("UPDATE test_levels SET qc_lot_id='l2s' WHERE test_id=? AND level=2").run(assay.id);
  assert.deepEqual(config.listTestLevels(assay.id).map((row) => [row.level, row.operational]), [[1, 1], [2, 0]]);
  const page = readFileSync(new URL('../renderer/pages/SigmaPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /operationalLevels = .*filter\(\(l\) => l\.operational !== 0\)/, 'SigmaPage phải lọc theo cờ');
});

test('SG15: cổng cohort dùng đúng ngưỡng > 3 SD của 1-3s', () => {
  const base = Array.from({ length: 30 }, (_, i) => ({
    id: 'p' + i, level: 1, lot: 'L1', date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`, val: 100, voided: 0, qc_mean: 100, qc_sd: 2,
  }));
  const at3 = base.map((point, i) => (i === 10 ? { ...point, val: 106 } : point));       // z = 3,000 chẵn
  const over3 = base.map((point, i) => (i === 10 ? { ...point, val: 106.01 } : point));  // z > 3
  const [edge] = buildSigmaCohorts(at3, '2026-08', [1], '2026-09-30', new Set());
  const [beyond] = buildSigmaCohorts(over3, '2026-08', [1], '2026-09-30', new Set());
  assert.equal(edge.outOfControl.rejected, 0);
  assert.equal(edge.status, 'eligible', 'Westgard không loại điểm này nên sẽ không có NCE để gỡ chặn');
  assert.notEqual(westgard([{ val: 106 }], 100, 2, () => true).F[0].level, 'rej');
  assert.equal(beyond.outOfControl.rejected, 1);
  assert.equal(beyond.status, 'out-of-control');
  assert.equal(westgard([{ val: 106.01 }], 100, 2, () => true).F[0].level, 'rej');
});

test('SG16: đổi cấu hình luật Westgard không gỡ hiệu lực rà soát IQC; đổi dữ liệu thì có', t => {
  // Cần thiết kế 2 mức thực để có gợi ý Sigma Rules; ca này kiểm fingerprint
  // Westgard, không kiểm nhánh một mức (đã có SG13b).
  const { db, sigma, westgardHandlers, assay } = lab(t, [1, 2]);
  seedIqc(db, assay.id, 1, '08');
  assert.equal(sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'ricos', tea: 10, levels: reviewedCohortLevels(sigma, assay.id, '2026-08', [1]) }, actor).ok, true);
  const read = () => sigma.listPeriods(assay.id)[0].levels[0];
  const before = read();
  assert.equal(before.cohortReviewed, true);
  assert.ok(before.qualityDesign);

  westgardHandlers.saveRuleSetting('9x', true, actor);
  westgardHandlers.saveRuleAction(assay.id, '6x', 'alert', actor);
  const afterRules = read();
  assert.equal(afterRules.cohortStale, false, 'cổng cohort là |z| > 3, không đọc bảng luật');
  assert.equal(afterRules.cohortReviewed, true);
  assert.deepEqual(afterRules.qualityDesign.rules, before.qualityDesign.rules);

  db.prepare("INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES ('x',?,1,'2026-08-21','99',131,'L1',100,2,0)").run(assay.id);
  assert.equal(read().cohortStale, true, 'thêm điểm QC thì vẫn phải rà soát lại');
});

test('SG17: TEa giải từ bậc dự phòng không bị đóng băng thành snapshot không nguồn gốc', t => {
  const { db, sigma, assay } = lab(t, [1]);
  sigma.saveTeaConfig({ testId: assay.id, source: 'ricos' }, actor);
  // Kỳ chốt nguồn `lab` (chưa có hồ sơ TEa PXN nên không giải được) và không có TEa cấp kỳ.
  db.prepare('INSERT INTO sigma_data(id,test_id,period,tea,tea_source,lv_json) VALUES (?,?,?,?,?,?)')
    .run(`${assay.id}:2026-07`, assay.id, '2026-07', null, 'lab', JSON.stringify([{ level: 1, cv: 2, biasEqa: 1 }]));
  const before = sigma.listPeriods(assay.id)[0].levels[0];
  assert.ok(before.tea > 0, 'vẫn hiển thị được TEa qua bậc dự phòng');
  assert.equal(before.teaSnapshot, null, 'nhưng kỳ chưa từng chụp TEa nào');

  // Đúng thứ `levelPayload()` của SigmaPage gửi khi người dùng chỉ sửa CV.
  assert.equal(sigma.savePeriod({ testId: assay.id, period: '2026-07', teaSource: 'lab',
    levels: [{ level: 1, tea: before.teaSnapshot ?? undefined, cv: 2.5, biasEqa: 1, cvSource: 'manual' }] }, actor).ok, true);
  const stored = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(`${assay.id}:2026-07`).lv_json)[0];
  assert.equal(stored.tea ?? null, null, 'không ghi cứng giá trị đã giải');
  assert.equal(stored.teaBasis, undefined, 'và không bịa nguồn gốc cho nó');
  const page = readFileSync(new URL('../renderer/pages/SigmaPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /tea: level\.teaSnapshot \?\? undefined/, 'levelPayload phải gửi snapshot, không phải giá trị đã giải');
});

test('SG18: MDC vẽ đúng vị trí thật của điểm ngoài thang mặc định', async () => {
  const { transformWithOxc } = await import('vite');
  const vm = await import('node:vm');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const workflow = readFileSync(new URL('../renderer/lib/sigma-workflow.ts', import.meta.url), 'utf8');
  const { stripTypeScriptTypes } = require('node:module');
  const { mdcRatios } = vm.runInNewContext(stripTypeScriptTypes(workflow.replace(/^import .*;\r?$/gm, '').replace(/export /g, '')) + '\n({mdcRatios})');
  const source = readFileSync(new URL('../renderer/components/SigmaCharts.tsx', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const transformed = await transformWithOxc(source, 'SigmaCharts.tsx', { jsx: { runtime: 'classic' } });
  const components = vm.runInNewContext(transformed.code.replace(/export /g, '') + '\n({SigmaMdcChart})', { React, useMemo: React.useMemo, useState: React.useState, mdcRatios });

  // CV/TEa = 95%, |Bias|/TEa = 130% → Sigma −0,32. Thang cũ kẹp về (60; 100),
  // tức vẽ đúng lên đường 0σ.
  const level = { level: 1, tea: 10, cv: 9.5, biasEqa: 13, sigma: { tea: 10, sigma: (10 - 13) / 9.5 } };
  const svg = renderToStaticMarkup(React.createElement(components.SigmaMdcChart, { periods: [{ id: 'p', period: '2026-08', tea: 10, levels: [level] }] }));
  const [circle] = [...svg.matchAll(/<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(Math.abs(circle[0] - (45 + 939 * 0.95)) < 1e-6, `cx thật, không phải mép: ${circle[0]}`);
  assert.ok(Math.abs(circle[1] - (233 - 210 * 130 / 150)) < 1e-6, `cy thật, không phải mép: ${circle[1]}`);
  assert.notEqual(circle[0], 45 + 939, 'không được kẹp về xMax cũ (60%)');
  assert.match(svg, />150</, 'trục Y phải nới tới 150% TEa');

  // Dữ liệu trong thang thì giữ nguyên khung 0–60 / 0–100 như trước.
  const normal = { level: 1, tea: 10, cv: 2, biasEqa: 1, sigma: { tea: 10, sigma: 4.5 } };
  const plain = renderToStaticMarkup(React.createElement(components.SigmaMdcChart, { periods: [{ id: 'p', period: '2026-08', tea: 10, levels: [normal] }] }));
  assert.match(plain, />60</); assert.match(plain, />100</);
  assert.doesNotMatch(plain, />150</);
});

test('SG19: u(Cref) chỉ được báo cáo khi thật sự vào ngân sách MU', () => {
  const noBias = uncertaintyBudget({ cv: 2, uCref: 0.8, uCal: 1, tea: 10 });
  assert.equal(noBias.uBias, null);
  assert.equal(noBias.uCref, null, 'chưa có bias thì u(Cref) không đóng góp vào u_c');
  const withBias = uncertaintyBudget({ cv: 2, bias: 1.5, uCref: 0.8, uCal: 1, tea: 10 });
  assert.equal(withBias.uCref, 0.8);
  assert.ok(Math.abs(withBias.uBias - Math.hypot(1.5, 0.8)) < 1e-12);
});


