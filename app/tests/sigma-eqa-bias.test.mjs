// Bias cho Six Sigma lấy từ ngoại kiểm (docs/SIGMA-REVIEW-2026-11-17.md SB-1..SB-7).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { ensureUser } from './helpers/nce-flow.mjs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);
const { selectSigmaEqaBias } = require('../../app-dist/main/domain/sigma-eqa-bias.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const admin = { userId: 'admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const must = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.data; };
const sample = (over) => ({ resultId: 'r', label: 'x', reportDate: '2026-09-10', result: 102, assigned: 100, assignedUncertain: false, ncCauseCategory: '', ...over });

test('SB-2..SB-6 cập nhật: lấy mọi nồng độ trong 3 tháng, loại đúng căn cứ; Bias trung bình có dấu', () => {
  const r = selectSigmaEqaBias([
    sample({ resultId: 'a', result: 102 }),
    sample({ resultId: 'b', result: 99, reportDate: '2026-06-01' }),
    sample({ resultId: 'c', result: 103, reportDate: '2026-10-05' }),
    sample({ resultId: 'late', reportDate: '2026-11-02' }),
    sample({ resultId: 'old', reportDate: '2025-09-30' }),
    sample({ resultId: 'far', assigned: 140, result: 142.8 }),
    sample({ resultId: 'admin', ncCauseCategory: 'eqa_administrative' }),
    sample({ resultId: 'tech', result: 104, ncCauseCategory: 'eqa_technical' }),
    sample({ resultId: 'unsure', assignedUncertain: true }),
  ], { period: '2026-10' });
  assert.deepEqual(r.window, { start: '2026-08-01', end: '2026-10-31' });
  assert.deepEqual(r.included.map((s) => s.resultId).sort(), ['a', 'c', 'far', 'tech'], 'lấy cả nồng độ xa QC, giữ mẫu có lỗi kỹ thuật');
  assert.deepEqual(Object.fromEntries(r.excluded.map((s) => [s.resultId, s.reason])), {
    late: 'after-period', old: 'outside-window', b: 'outside-window', admin: 'nce-cause', unsure: 'assigned-uncertain',
  });
  assert.ok(Math.abs(r.mean - (2 + 3 + 2 + 4) / 4) < 1e-10);
  assert.equal(r.mixedSigns, false);
  assert.equal(r.enough, true);
  assert.ok(r.rms > r.mean, 'RMS lớn hơn trung bình vì gộp độ phân tán');
  assert.equal(selectSigmaEqaBias([sample({})], { period: '2026-10' }).included.length, 1, 'không cần Mean QC để lấy Bias chung');
  assert.equal(selectSigmaEqaBias([sample({})], { period: '2026-10' }).enough, false);
});

function fixture() {
  const db = openDatabase(':memory:'); ensureUser(db, admin);
  const c = createConfigHandlers(db), eqa = createEqaHandlers(db), sigma = createSigmaHandlers(db), nce = createNceHandlers(db);
  const machine = must(c.saveInstrument({ data: { name: 'Máy kiểm tra Bias' } }, admin));
  const assay = must(c.saveTest({ data: { name: 'Glucose', instrumentId: machine.id, unit: 'mmol/L' } }, admin));
  for (const [level, mean] of [[1, 5], [2, 15]]) must(c.saveTestLevel({ testId: assay.id, data: { level, mean, sd: .1 } }, admin));
  function importRound({ round = 'ĐỢT 09', date = '2026-09-15', rows, replaceReason } = {}) {
    return must(eqa.importEqaRound({ data: { source: 'pdf',
      round: { program: 'VEQAS', provider: 'Trung tâm', programCode: 'BC', unitCode: '100', year: Number(date.slice(0, 4)), round, reportDate: date },
      rows: rows ?? [{ code: 'GLUC', instrument: machine.name, sample: 'M1', unit: 'mmol/L', result: 5.2, assigned: 5, sigmaP: .05, zProvider: 4, peer: {} }],
      mappings: [{ code: 'GLUC', instrument: machine.name, testId: assay.id }], ...(replaceReason ? { replaceReason } : {}) } }, admin));
  }
  const imported = importRound();
  const view = (period = '2026-09', level = 1) => sigma.eqaBias(assay.id, period, level);
  const rounds = v => v.included.map(s => ({ lab: s.result, target: s.assigned, eqaResultId: s.resultId, label: s.label }));
  // Mẫu ngoại kiểm mới đi qua đường áp dụng chung (SB-4b); danh sách rỗng chỉ lưu CV/Bias tay.
  const save = (rs, options = {}) => sigma.savePeriod({ testId: assay.id, period: '2026-09', tea: 10,
    levels: [{ level: 1, cv: 2 }], ...(rs.length ? { sharedEqaRounds: rs } : {}), ...options }, admin);
  // Sửa CV/MU thông thường: gửi lại vòng đã lưu theo từng mức, không áp dụng lại.
  const keep = (rs, options = {}) => sigma.savePeriod({ testId: assay.id, period: '2026-09', tea: 10,
    levels: [{ level: 1, cv: 2, eqaRounds: rs }], ...options }, admin);
  function conclude(category = 'eqa_administrative') {
    const evidence = eqa.getEqaCorrectiveEvidence({ resultId: imported.results[0].id, runDate: '2026-09-10' });
    const d = must(nce.createNce({ data: { source: 'eqa', eqaResultId: evidence.result.id, expectedEqaFingerprint: evidence.fingerprint, eqaRunDate: evidence.run_date,
      description: 'Kết quả ngoại kiểm dùng để kiểm tra nguồn Bias.', correction: 'Đã đối chiếu số liệu trên báo cáo gốc.', holdResults: false,
      detectedAt: '2026-09-15', ownerUserId: admin.userId } }, admin));
    return must(nce.updateNce({ data: { id: d.record.id, expectedVersion: d.record.row_version,
      patch: { causeStatus: 'identified', causeCategory: category, causeText: 'Đã xác định nguyên nhân bằng nhật ký và đối chiếu báo cáo.' } } }, admin));
  }
  const stored = () => db.prepare('SELECT * FROM sigma_data ORDER BY id').all();
  return { db, c, eqa, sigma, nce, machine, assay, imported, importRound, view, rounds, save, keep, conclude, stored };
}

test('SB-3 cập nhật: đúng 3 tháng lịch ở tháng nhuận và các ngày biên', () => {
  for (const [period, start, end, before, after] of [
    ['2024-02', '2023-12-01', '2024-02-29', '2023-11-30', '2024-03-01'],
    ['2025-02', '2024-12-01', '2025-02-28', '2024-11-30', '2025-03-01'],
    ['2026-01', '2025-11-01', '2026-01-31', '2025-10-31', '2026-02-01'],
    ['2026-04', '2026-02-01', '2026-04-30', '2026-01-31', '2026-05-01'],
  ]) {
    const selected = selectSigmaEqaBias([start, end, before, after].map(reportDate => sample({ resultId: reportDate, reportDate })), { period });
    assert.deepEqual(selected.window, { start, end });
    assert.deepEqual(selected.included.map(s => s.resultId).sort(), [start, end].sort());
    assert.deepEqual(Object.fromEntries(selected.excluded.map(s => [s.resultId, s.reason])), { [before]: 'outside-window', [after]: 'after-period' });
  }
});

test('SB-3..SB-5: lưu vòng mới kiểm lại thời gian, NCE và độ tin cậy; lỗi không ghi dở', () => {
  const f = fixture();
  try {
    const selected = f.rounds(f.view());
    must(f.save([], { levels: [{ level: 1, targetMean: 5, cv: 2, biasEqa: .5 }, { level: 2, targetMean: 15, cv: 3, biasEqa: .7 }] }));
    const before = f.stored(), auditCount = f.db.prepare('SELECT COUNT(*) n FROM activity').get().n;
    for (const options of [{ period: '2026-08' }, { period: '2027-10' }]) {
      assert.equal(f.save(selected, options).error.code, 'invalid-eqa-selection');
      assert.deepEqual(f.stored(), before);
    }
    f.conclude();
    assert.equal(f.view().excluded[0].reason, 'nce-cause');
    const afterNceAuditCount = f.db.prepare('SELECT COUNT(*) n FROM activity').get().n;
    assert(afterNceAuditCount > auditCount);
    assert.equal(f.save(selected, { levels: [{ level: 1, cv: 2 }, { level: 2, cv: 3 }] }).error.code, 'invalid-eqa-selection', 'NCE thay đổi sau lúc mở hộp thoại');
    assert.deepEqual(f.stored(), before);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM activity').get().n, afterNceAuditCount);
    const uncertain = f.importRound({ round: 'ĐỢT 10', date: '2026-10-15', rows: [{ code: 'GLUC', instrument: f.machine.name, sample: 'M1', unit: 'mmol/L', result: 5.2, assigned: 5, sigmaP: .05, zProvider: 4,
      peer: { instrument: { n: 2, mean: 5, sd: 1, cv: 20 } } }] });
    const r = uncertain.results[0];
    assert.equal(f.view('2026-10').excluded.find(s => s.resultId === r.id).reason, 'assigned-uncertain');
    assert.equal(f.save([{ lab: r.result, target: r.assigned, eqaResultId: r.id }], { period: '2026-10' }).error.code, 'invalid-eqa-selection');
    assert.deepEqual(f.stored(), before);
  } finally { f.db.close(); }
});

test('SB-4b: Bias chung chỉ từ ngoại kiểm; vòng nhập tay lưu riêng mức; không trộn, không thêm mẫu lẻ', () => {
  const f = fixture();
  try {
    const rounds = f.rounds(f.view());
    const manual = { lab: 5.1, target: 5 };
    assert.equal(f.save([...rounds, manual]).error.code, 'eqa-mixed', 'không trộn dòng nhập tay vào Bias chung');
    const levels = [{ level: 1, cv: 2 }, { level: 2, cv: 3 }];
    const shared = must(f.save(rounds, { levels }));
    assert.ok(shared.levels.every((l) => l.eqaRounds.length === rounds.length), 'Bias chung áp cho mọi mức');
    // Vòng nhập tay ở mức 2 chỉ đổi mức 2, mức 1 giữ mẫu ngoại kiểm.
    const keep1 = shared.levels.find((l) => l.level === 1).eqaRounds;
    const perLevel = must(f.sigma.savePeriod({ testId: f.assay.id, period: '2026-09', tea: 10, levels: [{ level: 1, cv: 2, eqaRounds: keep1 }, { level: 2, cv: 3, eqaRounds: [manual] }] }, admin));
    assert.deepEqual(perLevel.levels.find((l) => l.level === 1).eqaRounds, keep1);
    assert.deepEqual(perLevel.levels.find((l) => l.level === 2).eqaRounds.map((r) => r.eqaResultId), [undefined]);
    // Thêm mẫu ngoại kiểm lẻ vào một mức, hoặc trộn với vòng tay trong một mức: bị chặn.
    assert.equal(f.sigma.savePeriod({ testId: f.assay.id, period: '2026-09', tea: 10, levels: [{ level: 1, cv: 2, eqaRounds: keep1 }, { level: 2, cv: 3, eqaRounds: rounds }] }, admin).error.code, 'eqa-shared-only');
    assert.equal(f.sigma.savePeriod({ testId: f.assay.id, period: '2026-09', tea: 10, levels: [{ level: 1, cv: 2, eqaRounds: [...keep1, manual] }, { level: 2, cv: 3, eqaRounds: [manual] }] }, admin).error.code, 'eqa-mixed');
  } finally { f.db.close(); }
});

test('SB-5: hồ sơ đổi sang "chưa xác định" giữ nhóm cũ trong CSDL nhưng không còn loại mẫu', () => {
  const f = fixture();
  try {
    const d = f.conclude('eqa_program');
    assert.equal(f.view().excluded[0]?.reason, 'nce-cause');
    must(f.nce.updateNce({ data: { id: d.record.id, expectedVersion: d.record.row_version,
      patch: { causeStatus: 'undetermined', causeCheckPlan: 'Theo dõi đợt kế tiếp và đối chiếu nội kiểm cùng ngày.' } } }, admin));
    assert.equal(f.db.prepare('SELECT cause_category c FROM nce_records WHERE id=?').get(d.record.id).c, 'eqa_program');
    assert.equal(f.view().excluded.some((s) => s.reason === 'nce-cause'), false);
  } finally { f.db.close(); }
});

test('SB-5: NCE khớp đúng nội dung, giữ loại trừ khi đổi phiên bản không đổi số và không loại nhầm báo cáo sửa', () => {
  for (const category of ['eqa_administrative', 'eqa_program', 'eqa_technical']) {
    const f = fixture();
    try {
      const dossier = f.conclude(category);
      const excluded = category !== 'eqa_technical';
      assert.equal(f.view().excluded.some(s => s.reason === 'nce-cause'), excluded);
      f.importRound({ replaceReason: 'Trung tâm phát hành lại, không đổi số liệu.' });
      const machine = must(f.c.saveInstrument({ data: { name: 'Máy bổ sung' } }, admin));
      const other = must(f.c.saveTest({ data: { name: 'Glucose', instrumentId: machine.id } }, admin));
      const identical = must(f.eqa.importEqaRound({ data: { source: 'pdf',
        round: { program: 'VEQAS', provider: 'Trung tâm', programCode: 'BC', unitCode: '100', year: 2026, round: 'ĐỢT 09', reportDate: '2026-09-15' },
        rows: [{ code: 'GLUC', instrument: machine.name, sample: 'M2', unit: 'mmol/L', result: 5, assigned: 5, sigmaP: .05, zProvider: 0, peer: {} }],
        mappings: [{ code: 'GLUC', instrument: machine.name, testId: other.id }] } }, admin));
      assert.notEqual(identical.results.find(r => r.test_id === f.assay.id).id, f.imported.results[0].id);
      assert.equal(f.view().excluded.some(s => s.reason === 'nce-cause'), excluded, 'không chỉ so mã kết quả phiên bản');
      f.importRound({ replaceReason: 'Sửa số liệu trên báo cáo.', rows: [{ code: 'GLUC', instrument: f.machine.name, sample: 'M1', unit: 'mmol/L', result: 5.05, assigned: 5, sigmaP: .05, zProvider: 1, peer: {} }] });
      assert.equal(f.view().included.length, 1);
      assert.equal(f.view().included[0].result, 5.05);
      must(f.save(f.rounds(f.view())));
      assert.equal(f.nce.getNce(dossier.record.id, admin).record.eqa_snapshot_json, dossier.record.eqa_snapshot_json);
    } finally { f.db.close(); }
  }
});

test('SB-6..SB-7: chặn mẫu lặp theo từng mức, cho dùng hai mức phù hợp và không sửa vòng trùng lịch sử', () => {
  const f = fixture();
  try {
    const [r] = f.rounds(f.view());
    assert.equal(f.save([r, r, r]).error.code, 'duplicate-eqa-source');
    assert.deepEqual(f.stored(), []);
    const saved = must(f.save([{ ...r, label: 'Nhãn giả từ client' }]));
    assert.equal(saved.levels[0].eqaRounds[0].label, r.label, 'nhãn mới do main lấy từ nguồn');
    assert.equal(f.save([r, r]).error.code, 'duplicate-eqa-source', 'không nhân thêm một vòng đã lưu');
    // Dựng kỳ cũ từng có dòng trùng để xác nhận không di trú hay sửa ngầm lịch sử.
    const raw = f.stored()[0], levels = JSON.parse(raw.lv_json);
    levels[0].eqaRounds.push({ ...levels[0].eqaRounds[0] });
    f.db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(levels), raw.id);
    const old = f.sigma.listPeriods(f.assay.id)[0].levels[0];
    assert.equal(old.eqaRounds.length, 2);
    const unchanged = must(f.keep(old.eqaRounds));
    assert.deepEqual(unchanged.levels[0].eqaRounds, old.eqaRounds);
    assert.equal(f.keep([...old.eqaRounds, r]).error.code, 'duplicate-eqa-source');
    must(f.c.saveTestLevel({ testId: f.assay.id, data: { level: 2, mean: 5.5, sd: .1 } }, admin));
    const both = must(f.save([r], { period: '2026-10', levels: [{ level: 1, targetMean: 5, cv: 2 }, { level: 2, targetMean: 5.5, cv: 3 }] }));
    assert.deepEqual(both.levels.map(l => l.eqaRounds.length), [1, 1], 'một mẫu trong Bias chung được lưu làm căn cứ của mỗi mức');
  } finally { f.db.close(); }
});

test('SB-7: đọc và sửa CV/MU giữ các vòng, nhãn, Bias và TEa lịch sử khi nguồn/NCE/Mean thay đổi', () => {
  const f = fixture();
  try {
    const rs = f.rounds(f.view());
    const saved = must(f.save(rs, { levels: [{ level: 1, tea: 10, targetMean: 5, cv: 2, eqaRounds: rs, uCref: .2, uCal: .1 }] }));
    const lv = saved.levels[0];
    f.conclude();
    f.importRound({ replaceReason: 'Báo cáo mới sau khi kỳ Sigma đã lưu.' });
    must(f.c.saveTestLevel({ testId: f.assay.id, data: { level: 1, mean: 15, sd: .3 } }, admin));
    const before = f.stored();
    const read = f.sigma.listPeriods(f.assay.id)[0].levels[0];
    assert.deepEqual(read.eqaRounds, lv.eqaRounds);
    assert.equal(read.biasEqa, lv.biasEqa);
    assert.deepEqual(f.stored(), before, 'đọc không ghi lại hoặc lọc lại vòng đã chụp');
    const updated = must(f.keep([], {
      levels: [{ level: 1, tea: 10, targetMean: 5, cv: 2.5, eqaRounds: lv.eqaRounds.map(r => ({ ...r, label: 'Nhãn sửa từ client' })), uCref: .4, uCal: .3 }] }));
    const after = updated.levels[0];
    assert.deepEqual(after.eqaRounds, lv.eqaRounds);
    assert.equal(after.biasEqa, lv.biasEqa);
    assert.equal(after.teaSnapshot, lv.teaSnapshot);
    assert.equal(after.targetMean, lv.targetMean);
    assert.equal(after.cv, 2.5); assert.equal(after.uCref, .4); assert.equal(after.uCal, .3);
    assert.equal(f.save(lv.eqaRounds, { period: '2026-10' }).error.code, 'invalid-eqa-selection', 'không mang miễn trừ lịch sử sang kỳ mới');
    assert.equal(f.save([], { levels: [{ level: 2, cv: 3, eqaRounds: lv.eqaRounds }] }).error.code, 'eqa-shared-only', 'không mang miễn trừ sang mức khác');
    assert.equal(f.stored().length, 1);
  } finally { f.db.close(); }
});

test('SB-4 cập nhật: Mean cohort đổi không lọc mất nguồn Bias chung', () => {
  const f = fixture();
  try {
    must(f.sigma.saveTeaConfig({ testId: f.assay.id, source: 'eflm', tea: 10, eflmAnalyte: 'Glucose', eflmLookupDate: '2026-09-01', eflmRef: 'Nguồn EFLM kiểm thử' }, admin));
    must(f.save([], { teaSource: 'eflm', levels: [{ level: 1, targetMean: 5, cv: 2, biasEqa: .5 }] }));
    const rs = f.rounds(f.view());
    must(f.c.saveTestLevel({ testId: f.assay.id, data: { level: 1, mean: 15, sd: .3 } }, admin));
    makeOperationalQc(f.db, { testId: f.assay.id, instrumentId: f.machine.id, assignments: [{ level: 1, lotNo: 'QC-MEAN15' }] });
    const entry = createEntryHandlers(f.db);
    for (let day = 1; day <= 3; day++) must(entry.addPoint({ data: { testId: f.assay.id, level: 1, date: `2026-09-0${day}`, runId: 'A', val: 15 + day * .01 } }, admin));
    const saved = must(f.save(rs, { levels: [{ level: 1, targetMean: 5, cv: 2, cvSource: 'iqc-cohort', sourceLot: 'QC-MEAN15' }] }));
    assert.equal(saved.levels[0].targetMean, 15);
    assert.equal(saved.levels[0].eqaRounds.length, 1);
    assert.ok(Math.abs(saved.levels[0].biasEqa - 4) < 1e-10);
  } finally { f.db.close(); }
});

test('SB-2, SB-7: lấy mẫu từ ngoại kiểm đã nhập; lưu kèm mã kết quả, main đối chiếu lại số liệu', () => {
  const db = openDatabase(':memory:');
  try {
    const c = createConfigHandlers(db), eqa = createEqaHandlers(db), sigma = createSigmaHandlers(db);
    const machine = must(c.saveInstrument({ data: { name: 'Máy A' } }, admin));
    const assay = must(c.saveTest({ data: { name: 'Glucose', instrumentId: machine.id, unit: 'mmol/L' } }, admin));
    must(c.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 5, sd: 0.1 } }, admin));
    must(c.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 15, sd: 0.3 } }, admin));
    const round = (n, rows, replaceReason) => must(eqa.importEqaRound({ data: {
      round: { program: 'VEQAS', provider: 'Trung tâm', programCode: 'BC', unitCode: '100', year: 2026, round: `ĐỢT 0${n}`, reportDate: `2026-0${n}-15` },
      rows: rows.map(([sample, result, assigned]) => ({ ref: `${n}-${sample}`, code: 'GLUC', instrument: 'Máy A', sample, unit: 'mmol/L', result, assigned, sigmaP: 0.5, zProvider: Number(((result - assigned) / 0.5).toFixed(2)), peer: {} })),
      source: 'pdf', mappings: [{ code: 'GLUC', instrument: 'Máy A', testId: assay.id }], ...(replaceReason ? { replaceReason } : {}),
    } }, admin));
    round(1, [['A', 5.1, 5], ['B', 15.3, 15]]);
    round(2, [['A', 4.95, 5], ['B', 15.6, 15]]);
    round(3, [['A', 5.15, 5]]);

    const view = sigma.eqaBias(assay.id, '2026-04', 1);
    assert.equal(view.targetMean, null);
    assert.equal(view.included.length, 3, 'lấy cả mẫu A và B trong tháng 2–4');
    assert.ok(Math.abs(view.mean - (-1 + 4 + 3) / 3) < 1e-9);
    assert.equal(view.excluded.filter((s) => s.reason === 'outside-window').length, 2, 'hai mẫu tháng 1 nằm ngoài cửa sổ');
    assert.deepEqual(view, sigma.eqaBias(assay.id, '2026-04', 2), 'nguồn Bias giống nhau ở hai mức');
    assert.equal(sigma.eqaBias(assay.id, 'sai', 1), null);

    const rounds = view.included.map((s) => ({ lab: s.result, target: s.assigned, eqaResultId: s.resultId, label: s.label }));
    const saved = must(sigma.savePeriod({ testId: assay.id, period: '2026-04', tea: 10, levels: [{ level: 1, cv: 2 }], sharedEqaRounds: rounds }, admin));
    const lv = saved.levels[0];
    assert.ok(Math.abs(lv.biasEqa - 2) < 1e-9, 'Sigma dùng trung bình có dấu');
    assert.ok(lv.eqaRounds.every((r) => r.eqaResultId && r.label.includes('VEQAS')), 'giữ mã kết quả và nhãn để truy vết');

    const tampered = [{ ...rounds[0], lab: 9 }];
    assert.equal(sigma.savePeriod({ testId: assay.id, period: '2026-05', tea: 10, levels: [{ level: 1, cv: 2 }], sharedEqaRounds: tampered }, admin).error.code, 'invalid-eqa-source');
    // Lưu lại kỳ (vd. sửa CV) giữ được vòng đã lưu dù đợt ngoại kiểm có phiên bản mới sau đó.
    round(1, [['A', 5.12, 5], ['B', 15.3, 15]], 'Trung tâm phát hành lại báo cáo đợt 01.');
    must(sigma.savePeriod({ testId: assay.id, period: '2026-04', tea: 10, levels: [{ level: 1, cv: 2.5, eqaRounds: lv.eqaRounds }] }, admin));
  } finally { db.close(); }
});

test('Bias chung: dùng đủ các tháng và mọi mẫu nồng độ cao, lưu cùng Bias nhưng CV/TEa/Mean riêng', () => {
  const f = fixture();
  try {
    const row = f.imported.results[0];
    for (const [month, target, lab] of [[7, 280, 285.6], [8, 310, 319.3]]) f.importRound({ round: `ĐỢT 0${month}`, date: `2026-0${month}-15`,
      rows: [{ code: 'GLUC', instrument: f.machine.name, sample: `MAU-${month}`, unit: 'mmol/L', assigned: target, result: lab, sigmaP: target * .03, zProvider: (lab - target) / (target * .03), peer: {} }] });
    const rs = f.rounds(f.view());
    assert.equal(rs.length, 3);
    assert.equal(new Set(f.view().included.map(s => s.reportDate.slice(0, 7))).size, 3);
    assert.deepEqual(f.view(), f.view('2026-09', 2), 'Mean QC 5 và 15 đều lấy đủ cùng ba mẫu');
    const legacy = must(f.save([], { period: '2026-08', levels: [{ level: 1, tea: 9, cv: 1, biasEqa: .5 }, { level: 2, tea: 12, cv: 3, biasEqa: 1.5 }] }));
    const historical = f.stored().find(r => r.id === legacy.id);
    const beforeApply = must(f.save([], { levels: [{ level: 1, tea: 10, targetMean: 5, cv: 2, biasEqa: .5, uCref: .2, uCal: .1 },
      { level: 2, tea: 12, targetMean: 15, cv: 3, biasEqa: 1.5, uCref: .3, uCal: .2 }] }));
    const read = f.sigma.listPeriods(f.assay.id).find(p => p.period === '2026-09');
    assert.deepEqual(read.levels.map(l => l.biasEqa), [.5, 1.5], 'không tự đổi Bias khác nhau của kỳ đã lưu');
    const levels = beforeApply.levels.map(l => ({ level: l.level, tea: l.teaSnapshot, targetMean: l.targetMean, cv: l.cv,
      eqaRounds: l.eqaRounds, biasEqa: l.biasEqa, uCref: l.uCref, uCal: l.uCal }));
    assert.equal(f.save([], { levels: levels.slice(0, 1), sharedEqaRounds: rs }).error.code, 'shared-bias-levels');
    const saved = must(f.save([], { levels, sharedEqaRounds: rs }));
    assert.deepEqual(saved.levels.map(l => l.cv), [2, 3]);
    assert.deepEqual(saved.levels.map(l => l.teaSnapshot), [10, 12]);
    assert.deepEqual(saved.levels.map(l => l.targetMean), [5, 15]);
    assert.deepEqual(saved.levels.map(l => l.uCref), [.2, .3]);
    assert.deepEqual(saved.levels.map(l => l.uCal), [.1, .2]);
    for (const l of saved.levels) {
      assert.ok(Math.abs(l.biasEqa - 3) < 1e-10, 'TB có dấu: (2 + 3 + 4) / 3');
      assert.equal(l.eqaRounds.length, 3, 'không nhân đôi số mẫu vì có hai mức QC');
      assert.ok(Math.abs(l.sigma.sigma - (l.tea - 3) / l.cv) < 1e-10);
    }
    assert.deepEqual(saved.levels[0].eqaRounds, saved.levels[1].eqaRounds);
    assert.deepEqual(f.stored().find(r => r.id === legacy.id), historical);
    assert.equal(saved.levels[0].eqaRounds.some(r => r.eqaResultId === row.id), true);
  } finally { f.db.close(); }
});

test('Bias chung: chặn mẫu trùng, thiếu mẫu mới hoặc mẫu hết hợp lệ; từ chối không ghi dở', () => {
  const f = fixture();
  try {
    const rs = f.rounds(f.view());
    must(f.save([], { levels: [{ level: 1, tea: 10, cv: 2, biasEqa: .5 }, { level: 2, tea: 10, cv: 3, biasEqa: .7 }] }));
    const levels = [{ level: 1, tea: 10, cv: 2, biasEqa: .5 }, { level: 2, tea: 10, cv: 3, biasEqa: .7 }];
    const before = f.stored();
    assert.equal(f.save([], { levels, sharedEqaRounds: [...rs, ...rs] }).error.code, 'duplicate-eqa-source');
    assert.equal(f.save([], { levels, sharedEqaRounds: [] }).error.code, 'invalid-eqa-round');
    f.importRound({ round: 'ĐỢT 08', date: '2026-08-15' });
    assert.equal(f.save([], { levels, sharedEqaRounds: rs }).error.code, 'eqa-selection-changed', 'mẫu mới xuất hiện sau khi mở hộp thoại');
    const fresh = f.rounds(f.view());
    const original = must(f.save([], { levels, sharedEqaRounds: fresh }));
    f.conclude();
    assert.equal(f.save([], { levels, sharedEqaRounds: fresh }).error.code, 'invalid-eqa-selection', 'áp dụng chung kiểm lại cả vòng đã từng lưu');
    const after = f.stored();
    assert.notDeepEqual(after, before);
    assert.deepEqual(f.sigma.listPeriods(f.assay.id)[0].levels.map(l => l.eqaRounds), original.levels.map(l => l.eqaRounds), 'lỗi không thay căn cứ đã chụp');
    const cvOnly = original.levels.map(l => ({ level: l.level, tea: l.teaSnapshot, cv: l.level === 1 ? 2.5 : l.cv, eqaRounds: l.eqaRounds }));
    const updated = must(f.save([], { levels: cvOnly }));
    assert.deepEqual(updated.levels.map(l => l.eqaRounds), original.levels.map(l => l.eqaRounds), 'sửa CV vẫn giữ lịch sử sau NCE thay đổi');
  } finally { f.db.close(); }
});

test('Bias chung: tuỳ chọn 1, 6, 18 tháng, lưu đúng khoảng chọn và giữ khoảng khi sửa CV/MU', () => {
  const f = fixture();
  try {
    f.importRound({ round: 'ĐỢT 06', date: '2026-06-15' });
    f.importRound({ round: 'ĐỢT 11', date: '2025-11-15' });
    const one = f.sigma.eqaBias(f.assay.id, '2026-09', 1, 1);
    assert.deepEqual(one.window, { start: '2026-09-01', end: '2026-09-30' });
    assert.equal(one.n, 1);
    const six = f.sigma.eqaBias(f.assay.id, '2026-09', 1, 6);
    assert.deepEqual(six.window, { start: '2026-04-01', end: '2026-09-30' });
    assert.equal(six.n, 2);
    const eighteen = f.sigma.eqaBias(f.assay.id, '2026-09', 2, 18);
    assert.deepEqual(eighteen.window, { start: '2025-04-01', end: '2026-09-30' });
    assert.equal(eighteen.n, 3, 'không áp trần 12 tháng');
    const rs = f.rounds(six);
    const levels = [{ level: 1, tea: 10, cv: 2, uCref: .2, uCal: .1 }, { level: 2, tea: 12, cv: 3, uCref: .3, uCal: .2 }];
    const original = must(f.save([], { levels, sharedEqaRounds: rs, eqaWindowMonths: 6 }));
    assert.deepEqual(original.levels.map(l => l.eqaWindowMonths), [6, 6]);
    assert.deepEqual(original.levels.map(l => l.eqaRounds.length), [2, 2]);
    const cvOnly = original.levels.map(l => ({ level: l.level, tea: l.teaSnapshot, cv: l.level === 1 ? 2.5 : l.cv, eqaRounds: l.eqaRounds, uCref: l.uCref, uCal: .5 }));
    const saved = must(f.save([], { levels: cvOnly }));
    assert.deepEqual(saved.levels.map(l => l.eqaWindowMonths), [6, 6], 'mặc định ba tháng của lệnh sửa không ghi đè khoảng đã chụp');
    assert.deepEqual(saved.levels.map(l => l.eqaRounds), original.levels.map(l => l.eqaRounds));
    assert.deepEqual(f.sigma.listPeriods(f.assay.id)[0].levels.map(l => l.eqaWindowMonths), [6, 6]);
    const before = f.stored();
    assert.equal(f.save([], { levels: cvOnly, sharedEqaRounds: rs, eqaWindowMonths: 1 }).error.code, 'invalid-eqa-selection', 'cửa sổ lúc lưu phải khớp lúc lấy mẫu');
    assert.deepEqual(f.stored(), before);
    must(f.save([], { levels: cvOnly, sharedEqaRounds: f.rounds(one), eqaWindowMonths: 1 }));
    assert.deepEqual(f.sigma.listPeriods(f.assay.id)[0].levels.map(l => [l.eqaWindowMonths, l.eqaRounds.length]), [[1, 1], [1, 1]]);
  } finally { f.db.close(); }
});

test('Bias chung: chặn số tháng không hợp lệ ở main; cửa sổ 1 tháng giữ đúng ngày nhuận', () => {
  const selected = selectSigmaEqaBias([sample({ reportDate: '2024-02-29' }), sample({ resultId: 'old', reportDate: '2024-01-31' })], { period: '2024-02', windowMonths: 1 });
  assert.deepEqual(selected.window, { start: '2024-02-01', end: '2024-02-29' });
  assert.equal(selected.n, 1);
  const f = fixture();
  try {
    const before = f.stored();
    for (const months of [0, -1, 1.5, NaN, Infinity, '', '6', null, Number.MAX_SAFE_INTEGER]) {
      assert.equal(f.sigma.eqaBias(f.assay.id, '2026-09', 1, months), null);
      assert.equal(f.save([], { eqaWindowMonths: months }).error.code, 'invalid-eqa-window');
      assert.deepEqual(f.stored(), before);
    }
    assert.equal(f.view().windowMonths, 3, 'lời gọi cũ vẫn dùng mặc định ba tháng');
  } finally { f.db.close(); }
});
