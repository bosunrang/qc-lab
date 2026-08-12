'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-issue-row-html.ts')).href;
const program = `
  import { createActionIssueRowHtml } from ${JSON.stringify(source)};
  const render = createActionIssueRowHtml({ escape: value => String(value).replaceAll('<', '&lt;'), quote: value => String(value).replaceAll("'", "\\\\'"), button: (label, action, variant) => '[' + label + '|' + action + '|' + variant + ']' });
  console.log(JSON.stringify([render({ severity: 'rej', level: 'Mức <1', state: 'Từ chối', value: '12.3', unit: 'mmol/L', rules: '1-3s', error: 'SE', workflowClass: 'rej', workflowLabel: 'Cần xử lý', sideChips: '<i>Rerun</i>', footer: 'Phụ trách: A', action: { kind: 'create', testId: "T'1", level: 2, rules: "1'3s", error: 'SE', hint: 'Kiểm tra', pointId: "P'1", date: '2026-08-12' } }), render({ severity: 'warn', level: 'Mức 2', state: 'Cảnh báo', value: '5', unit: '', rules: '', error: 'RE', workflowClass: 'warn', workflowLabel: 'Theo dõi', sideChips: '', footer: 'Gợi ý', action: { kind: 'continue', index: 3 } })]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action issue row HTML TypeScript');
const [create, resume] = JSON.parse(result.stdout);
assert.match(create, /Mức &lt;1 · Từ chối/);
assert.match(create, /<i>Rerun<\/i>/);
assert.match(create, /Lập hồ sơ\|beginActionFromIssue\('T\\'1',2,'1\\'3s','SE','Kiểm tra','P\\'1','2026-08-12'\)\|ghost sm/);
assert.match(resume, /Tiếp tục hồ sơ\|editAction\(3\)\|ghost sm/);
console.log('Action issue row HTML TypeScript tests passed');
