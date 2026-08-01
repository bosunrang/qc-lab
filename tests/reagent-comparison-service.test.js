const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/reagent-comparison-service.js']);
const service = ctx.ReagentComparisonService;

function makeState() {
  return { reagentTests: [], reagentOperators: [], reagentSampleTypes: [] };
}

{
  const state = makeState();
  const first = service.ensureOne(state, { id: 'R1' });
  assert.equal(first.created, true);
  assert.equal(first.comparison.id, 'R1');
  assert.equal(first.comparison.rows.length, 5);
  assert.equal(first.comparison.test.sampleType, 'Mẫu bệnh nhân');
  assert.equal(service.ensureOne(state, { id: 'R2' }).created, false);
  assert.equal(state.reagentTests.length, 1, 'ensureOne phải idempotent');
}

{
  const state = makeState();
  assert.equal(service.create(state, { id: '', name: 'ALT' }).error, 'missing-id');
  const created = service.create(state, { id: 'R1', name: ' ALT ', unit: 'U/L' });
  assert.equal(created.comparison.test.reagent, 'ALT');
  assert.equal(created.comparison.test.unit, 'U/L');
  assert.equal(service.create(state, { id: 'R1' }).error, 'duplicate-id');

  assert.equal(service.updateMetadata(state, { id: 'R1', key: 'alpha', value: '0.01' }).value, 0.01);
  assert.equal(service.updateMetadata(state, { id: 'R1', key: 'coverageConfirmed', value: 1 }).value, true);
  assert.equal(service.updateMetadata(state, { id: 'R1', key: 'unsafe', value: 'x' }).error, 'invalid-field');
  assert.equal(created.comparison.test.unsafe, undefined);
}

{
  const state = makeState();
  service.create(state, { id: 'R1' });
  assert.equal(service.updateCell(state, { id: 'R1', rowIndex: 0, column: 1, value: '12.3' }).error, undefined);
  assert.equal(state.reagentTests[0].rows[0][1], '12.3');
  assert.equal(service.updateCell(state, { id: 'R1', rowIndex: 8, column: 1, value: 'x' }).error, 'invalid-row');
  assert.equal(service.updateCell(state, { id: 'R1', rowIndex: 0, column: 2, value: 'x' }).error, 'invalid-column');

  service.clearRows(state, { id: 'R1' });
  assert.equal(state.reagentTests[0].rows.length, 5);
  for (let i = 4; i >= 0; i--) service.removeRow(state, { id: 'R1', rowIndex: i });
  assert.deepEqual(JSON.parse(JSON.stringify(state.reagentTests[0].rows)), [['', '']], 'phải giữ lại một dòng trống');
  service.addRow(state, { id: 'R1' });
  assert.equal(state.reagentTests[0].rows.length, 2);
}

{
  const state = makeState();
  service.create(state, { id: 'R1' });
  assert.equal(service.remove(state, { id: 'R1' }).error, 'last-comparison');
  service.create(state, { id: 'R2' });
  const removed = service.remove(state, { id: 'R1' });
  assert.equal(removed.removed.id, 'R1');
  assert.equal(removed.nextId, 'R2');
  assert.equal(service.remove(state, { id: 'missing' }).error, 'not-found');
}

{
  const state = makeState();
  service.create(state, { id: 'R1' });
  const samples = service.ensureQuickList(state, 'sampleType');
  assert.equal(samples.items.length, 3, 'danh mục loại mẫu mặc định phải được phục hồi');
  assert.equal(service.addQuick(state, { type: 'operator', value: ' Nguyễn Văn A ' }).added, true);
  assert.equal(service.addQuick(state, { type: 'operator', value: 'nguyen van a' }).added, false, 'trùng dấu/hoa thường không được thêm');
  service.pickQuick(state, { id: 'R1', type: 'operator', index: 0 });
  assert.equal(state.reagentTests[0].test.operator, 'Nguyễn Văn A');
  assert.equal(service.removeQuick(state, { type: 'operator', index: 2 }).error, 'invalid-index');
  assert.equal(service.removeQuick(state, { type: 'operator', index: 0 }).removed, 'Nguyễn Văn A');
}

{
  const integration = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js'], { ensureLabBrandShape() {}, ReagentComparisonService: service });
  run(integration, 'state.reagentTests=[];ensureShape();globalThis.__reagentShape=state.reagentTests;');
  assert.equal(integration.__reagentShape.length, 1, 'ensureShape phải tạo dữ liệu mặc định ngoài render');
  assert.equal(integration.__reagentShape[0].rows.length, 5);

  /* Nhánh archiveRegistry (schema 6) đã bị gỡ cùng chức năng lưu trữ theo năm.
     sanitizeBackup() KHÔNG bỏ trường lạ, nên nếu ensureShape() không xóa tường minh thì
     mảng cũ bám theo mọi lần lưu và mọi file backup mãi mãi. schemaVersion vẫn phải là 6:
     hạ về 5 sẽ làm validateStateInvariants() báo "schemaVersion cao hơn app hỗ trợ". */
  run(integration, 'state.archiveRegistry=[{id:"arc1",year:"2026"}];state.schemaVersion=6;ensureShape();globalThis.__afterShape={hasRegistry:"archiveRegistry" in state,schema:state.schemaVersion};');
  assert.equal(integration.__afterShape.hasRegistry, false, 'ensureShape phải xóa hẳn nhánh archiveRegistry cũ khỏi state');
  assert.equal(integration.__afterShape.schema, 6, 'schemaVersion giữ nguyên 6, không hạ ngược');
}

{
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'reagent.js'), 'utf8');
  assert.doesNotMatch(source, /state\.reagentTests\s*=/, 'UI không được thay cả nhánh reagentTests');
  assert.doesNotMatch(source, /state\.reagentTests\.(?:push|splice)\s*\(/, 'UI không được mutation reagentTests trực tiếp');
  assert.doesNotMatch(source, /state\[(?:rcQuickKey\([^)]*\)|key)\]\s*=/, 'UI không được thay danh mục nhanh trực tiếp');
}

{
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(appSource, /\bimport\s*\(/, 'production boot phải chạy được khi mở index.html trực tiếp qua file://');
  const serviceAt=indexSource.indexOf('assets/modules/reagent-comparison-service.js'),appAt=indexSource.indexOf('assets/app.js');
  assert.ok(serviceAt>=0&&appAt>serviceAt, 'classic Reagent service phải tải trước app boot');
}

console.log('ReagentComparisonService tests passed');
