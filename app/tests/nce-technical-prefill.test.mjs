// Gợi ý số liệu cho bước "Xác minh kỹ thuật IQC" (đánh giá giao diện
// 09/11/2026): main tính sẵn đơn vị %, TEa vận hành, Bias ổn định, Bias lúc sự
// cố, SD, độ phân tán và cỡ mẫu từ dữ liệu QC để người dùng không phải gõ lại
// các số app đã có. Gợi ý phải qua được đúng cổng của đánh giá kỹ thuật.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must, createIqcNce } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { computeTechnicalPrefill, STABLE_POINTS } = require('../../app-dist/main/domain/nce/technical-prefill.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const point = (val) => ({ val, mean: 100, sd: 2 });

test('hàm thuần: Bias% theo Mean đích, CV% quan sát khi đủ 20 điểm ổn định', () => {
  const stable = Array.from({ length: 25 }, (_, i) => point(i % 2 ? 101 : 99));
  const result = computeTechnicalPrefill({ level: 1, lot: 'L1', stable, incident: [point(105), point(106)], target: { mean: 100, sd: 2 }, tea: 8, teaSource: 'CLIA' });
  assert.equal(result.unit, '%');
  assert.equal(result.sampleCount, STABLE_POINTS, 'chỉ lấy 20 điểm ổn định gần nhất');
  assert.equal(result.stableBias, 0);
  assert.equal(result.incidentBias, 5.5);
  assert.ok(result.sd > 0.9 && result.sd < 1.1, `CV% quan sát ≈ 1: ${result.sd}`);
  assert.match(result.sdSource, /CV% quan sát của 20 điểm/);
  assert.equal(result.observedDispersion, 0.707, 'SD của hai điểm sự cố');
  assert.deepEqual(result.notes, []);
});

test('hàm thuần: ít điểm ổn định thì SD theo Mean/SD đích; một điểm sự cố thì độ phân tán là độ lệch so với Bias ổn định', () => {
  const result = computeTechnicalPrefill({ level: 2, lot: 'L2', stable: [point(101), point(99), point(100)], incident: [point(107)], target: { mean: 100, sd: 2 }, tea: null, teaSource: '' });
  assert.equal(result.sd, 2, 'CV% đích = 2/100');
  assert.match(result.sdSource, /Mean\/SD đích mức 2/);
  assert.equal(result.observedDispersion, 7);
  assert.equal(result.tea, null);
  assert.equal(result.notes.length, 2, 'báo thiếu điểm ổn định và thiếu TEa');
});

test('hồ sơ IQC thật: gợi ý lấy đúng mức bị loại, TEa vận hành, và ghi được đánh giá kỹ thuật bằng chính số gợi ý', (t) => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, admin);
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mmol/L' } }, admin).data;
  for (const level of [1, 2]) config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2 } }, admin);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1 }, { level: 2 }] });
  must(createSigmaHandlers(db).saveTeaConfig({ testId: assay.id, source: 'clia' }, admin), 'TEa CLIA');
  const add = (date, z1) => {
    for (const [level, z] of [[1, z1], [2, 0]]) must(entry.addPoint({ data: { testId: assay.id, level, date, runId: `${date}-1`, val: 100 + z * 2 } }, admin), `${date} M${level}`);
  };
  for (let day = 1; day <= 22; day++) add(`2026-09-${String(day).padStart(2, '0')}`, day % 2 ? 0.5 : -0.5);
  add('2026-09-23', 2.5);
  add('2026-09-24', 2.5); // 2-2s: loại lần chạy 24/09, chuỗi vi phạm bắt đầu 23/09
  const trigger = { date: '2026-09-24', runId: '2026-09-24-1' };

  const dossier = createIqcNce(nce, admin, assay.id, trigger);
  const prefill = dossier.technical_prefill;
  assert.ok(prefill, 'hồ sơ IQC đang mở có gợi ý');
  assert.equal(prefill.level, 1, 'mức bị loại có |z| lớn nhất');
  assert.equal(prefill.unit, '%');
  assert.ok(prefill.tea > 0, 'TEa vận hành theo CLIA');
  assert.match(prefill.teaSource, /CLIA/);
  assert.equal(prefill.stableBias, 0, '22 lần chạy ±0,5 SD quanh Mean');
  assert.equal(prefill.incidentBias, 5, 'z 2,5 × SD 2 trên Mean 100 = 5%');
  assert.equal(prefill.incidentCount, 2, 'gồm lần đầu của chuỗi 2-2s (23/09) và lần khởi đầu');
  assert.equal(prefill.sampleCount, 20);
  assert.ok(prefill.sd > 0.9 && prefill.sd < 1.1);

  const saved = nce.recordNceTechnicalAssessment({ data: {
    id: dossier.record.id, expectedVersion: dossier.record.row_version,
    assessment: {
      errorNature: 'systematic', metricMode: 'calculated', metricReason: '',
      verificationMethod: 'Đối chiếu nhật ký máy, hiệu chuẩn và lô vật liệu QC',
      correctiveEvidence: 'Hiệu chuẩn lại, chạy lại QC đủ hai mức đều đạt',
      technicalConclusion: 'Sai số hệ thống do hiệu chuẩn, đã khắc phục',
      unit: prefill.unit, tea: prefill.tea, teaSource: prefill.teaSource, stableBias: prefill.stableBias,
      incidentBias: prefill.incidentBias, postCorrectionBias: null, sd: prefill.sd, sdSource: prefill.sdSource,
      observedDispersion: prefill.observedDispersion, sampleCount: prefill.sampleCount,
      meanResetDecision: 'not_applicable', meanResetReason: '', meanResetEvidence: '',
    },
  } }, admin);
  assert.equal(saved.ok, true, `số gợi ý qua được cổng đánh giá kỹ thuật: ${JSON.stringify(saved.error)}`);

  // Điểm khởi đầu bị huỷ sau khi lập hồ sơ: gợi ý vẫn dùng giá trị đã chụp lúc
  // sự cố (bằng chứng), không mất Bias lúc sự cố.
  const triggerPoint = db.prepare("SELECT id FROM qc_points WHERE test_id=? AND date='2026-09-24' AND level=1").get(assay.id).id;
  must(entry.voidPoint({ data: { pointId: triggerPoint, kind: 'data-entry', reason: 'Huỷ sau khi đã lập hồ sơ để kiểm gợi ý' } }, admin), 'huỷ điểm khởi đầu');
  const after = nce.getNce(dossier.record.id, admin).technical_prefill;
  assert.ok(after.incidentCount >= 1, 'vẫn có điểm sự cố từ snapshot');
  assert.equal(after.incidentBias, 5);
});
