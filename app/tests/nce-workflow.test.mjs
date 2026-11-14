// Thứ tự điều hướng phải theo thanh bước, không theo thứ tự cổng nghiệp vụ.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let nextStage;
before(async () => {
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL('../renderer', import.meta.url)),
    logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ nextStage } = await server.ssrLoadModule('/pages/actions/workflow.ts'));
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
