'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-form-model.ts')).href;
const program = `
  import { createActionFormModel } from ${JSON.stringify(source)};
  const model = createActionFormModel({
    todayIso: () => '2026-08-11', dueDate: days => '2026-08-' + String(11 + days),
    operationalLevels: test => test.levels || [], effectivenessComplete: action => action.effectivenessStatus === 'effective',
  });
  const tests = [{ id: 'a', levels: [{ level: 2 }, { level: 3 }] }];
  console.log(JSON.stringify({
    manual: model.defaults(tests, { manual: true }, { name: 'KTV A' }),
    seeded: model.defaults(tests, { testId: 'a', level: 3, date: '2026-08-10', rule: '1-3s' }, { username: 'ktv' }),
    sources: model.sourceOptions([['', 'Chọn'], ['iqc', 'IQC'], ['eqa', 'EQA']], false, 'eqa'),
    legacySource: model.sourceOptions([['', 'Chọn'], ['iqc', 'IQC']], false, 'iqc'),
    opening: [...model.defaultOpenSections({ protocolVersion: 3, effectivenessStatus: 'pending' }, { missingBySection: { risk: ['RPN'], cause: [] } })],
    effectiveness: [...model.defaultOpenSections({ protocolVersion: 3, effectivenessStatus: 'pending' }, { missingBySection: {} })],
    draft: model.build(null, tests, { testId: 'a', level: 2 }, { username: 'ktv' }, { aRiskSeverity: '3', aCorrection: 'Đã xử lý' }),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript action form model');
const output = JSON.parse(result.stdout);

assert.equal(output.manual.testId, '');
assert.equal(output.manual.eventSource, '');
assert.equal(output.seeded.level, 3);
assert.equal(output.seeded.by, 'ktv');
assert.deepEqual(output.sources.map(item => item[0]), ['', 'eqa'], 'NCE không gắn điểm QC không được mở bằng nguồn IQC');
assert.deepEqual(output.legacySource.map(item => item[0]), ['', 'iqc'], 'hồ sơ cũ vẫn phải hiển thị nguồn IQC để không che mất dữ liệu');
assert.deepEqual(output.opening, ['risk']);
assert.deepEqual(output.effectiveness, ['eff']);
assert.equal(output.draft.riskSeverity, 3);
assert.equal(output.draft.correction, 'Đã xử lý');
assert.equal(output.draft.testId, 'a');

console.log('Action form model TypeScript tests passed');
