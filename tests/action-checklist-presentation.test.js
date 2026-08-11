'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-checklist-presentation.ts')).href;
const program = `
  import { createActionChecklistPresentation } from ${JSON.stringify(source)};
  const presentation = createActionChecklistPresentation({
    checkLabels: { ok: 'Đạt', abnormal: 'Bất thường', na: 'Không áp dụng', 'checked-abnormal': 'Bất thường' },
    effectivenessStatus: form => form.effectivenessStatus === 'ineffective'
      ? { cls: 'warn', label: 'Chưa hiệu lực', complete: false }
      : { cls: 'ok', label: 'Có hiệu lực', complete: true },
  });
  console.log(JSON.stringify({
    completed: presentation.checklistChip([{ status: 'ok', note: '' }, { status: 'abnormal', note: 'Đã xử lý' }]),
    incomplete: presentation.checklistChip([{ status: 'na', note: 'x' }, { status: 'unknown', note: '' }]),
    missing: presentation.sectionChip(['Căn cứ SOP', 'Ngày hoàn thành']),
    clear: presentation.sectionChip([]),
    effectiveness: presentation.effectivenessChip({ effectivenessStatus: 'ineffective', protocolVersion: 3 }),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript action checklist');
const output = JSON.parse(result.stdout);

assert.deepEqual(output.completed, { cls: 'ok', label: 'Đã hoàn tất 2/2' });
assert.deepEqual(output.incomplete, { cls: 'warn', label: 'Đã hoàn tất 0/2' },
  'Bất thường/không áp dụng phải có bằng chứng tối thiểu ba ký tự');
assert.deepEqual(output.missing, { cls: 'warn', label: 'Còn thiếu 2 mục', title: 'Còn thiếu: Căn cứ SOP; Ngày hoàn thành' });
assert.deepEqual(output.clear, { cls: 'ok', label: 'Đã xong', title: 'Không còn mục bắt buộc chưa hoàn thành' });
assert.deepEqual(output.effectiveness, { cls: 'warn', label: 'Chưa hiệu lực', title: 'Chưa hiệu lực' });

console.log('Action checklist presentation TypeScript tests passed');
