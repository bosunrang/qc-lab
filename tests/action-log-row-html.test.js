'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-log-row-html.ts')).href;
const program = `
  import { createActionLogRowHtml } from ${JSON.stringify(source)};
  const render = createActionLogRowHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(render({ date: '12/08/2026', openedAt: '12/08/2026 08:00', identity: '<b>NCE-17</b>', sub: 'Mức 1', rule: 'Loại · 1-3s · SE', primary: 'Điều tra <gốc>', owner: 'Lan', dueDate: '13/08/2026', workflowClass: 'rej', workflowLabel: 'Cần xử lý', sideChips: '<i>Quá hạn</i>', approvalTag: '<span>Duyệt</span>', approvalMeta: '<div>BS A</div>', actions: '<button>Chi tiết</button>' }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action log row HTML TypeScript');
assert.match(result.stdout, /Mở: 12\/08\/2026 08:00/);
assert.match(result.stdout, /<b>NCE-17<\/b>/);
assert.match(result.stdout, /Điều tra &lt;gốc>/);
assert.match(result.stdout, /<i>Quá hạn<\/i>/);
assert.match(result.stdout, /<button>Chi tiết<\/button>/);
console.log('Action log row HTML TypeScript tests passed');
