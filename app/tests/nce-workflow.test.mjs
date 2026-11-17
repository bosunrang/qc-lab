// Thứ tự điều hướng phải theo thanh bước, không theo thứ tự cổng nghiệp vụ.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let nextStage, nceStages, stageForMissing;
before(async () => {
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL('../renderer', import.meta.url)),
    logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ nextStage, nceStages, stageForMissing } = await server.ssrLoadModule('/pages/actions/workflow.ts'));
});
after(async () => { await server?.close(); });

const missing = (...codes) => codes.map((code) => ({ code, message: code }));
test('NCE: sau xác minh kỹ thuật ưu tiên ảnh hưởng bệnh nhân trước QC chạy lại', () => {
  const record = { next_step: 'release' };
  assert.equal(nextStage(record, missing('technical-assessment', 'missing-rerun', 'patient-impact')), 'technical');
  assert.equal(nextStage(record, missing('missing-rerun', 'patient-impact')), 'impact');
  assert.equal(nextStage(record, missing('patient-impact', 'missing-rerun')), 'impact');
  assert.equal(nextStage(record, missing('missing-rerun')), 'release');
  assert.equal(nextStage(record, missing('missing-rerun', 'patient-impact-coverage')), 'impact');
});

test('NCE: ưu tiên các bước còn thiếu sớm hơn và giữ luồng duyệt', () => {
  assert.equal(nextStage({ next_step: 'release' }, missing('missing-rerun', 'patient-impact', 'check-instrument', 'containment')), 'identity');
  assert.equal(nextStage({ next_step: 'release' }, missing('missing-rerun', 'patient-impact', 'check-instrument')), 'check');
  assert.equal(nextStage({ next_step: 'release' }, []), 'release');
  assert.equal(nextStage({ next_step: 'submit' }, missing('risk', 'release', 'technical-assessment')), 'technical');
  assert.equal(nextStage({ next_step: 'submit' }, []), 'review');
  assert.equal(nextStage({ next_step: 'approve' }, missing('risk')), 'review');
  assert.equal(nextStage({ next_step: null }, []), 'review');
});

test('NCE ngoại kiểm: bỏ xác minh kỹ thuật IQC, phân loại nguyên nhân trước ảnh hưởng bệnh nhân (N-10..N-12)', () => {
  assert.deepEqual(nceStages(true).map((s) => s.id), ['identity', 'check', 'impact', 'release', 'capa', 'review']);
  assert.equal(nceStages(true)[1].label, 'Rà soát & phân loại nguyên nhân');
  assert.deepEqual(nceStages(false).map((s) => s.id), ['identity', 'check', 'technical', 'impact', 'release', 'capa', 'review'], 'hồ sơ nội kiểm giữ 7 bước');
  assert.equal(stageForMissing({ code: 'cause-eqa-category' }, true), 'check');
  assert.equal(stageForMissing({ code: 'cause-eqa-category' }, false), 'capa');
  const eqa = { next_step: 'release', eqa_result_id: 'r1' };
  assert.equal(nextStage(eqa, missing('patient-impact', 'cause-eqa-status')), 'check');
  assert.equal(nextStage({ next_step: 'submit', eqa_result_id: 'r1' }, missing('risk', 'cause')), 'check');
});
