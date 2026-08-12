'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-transition-row-html.ts')).href;
const program = `
  import { createManageTransitionRowHtml } from ${JSON.stringify(source)};
  const render = createManageTransitionRowHtml({ escape: value => String(value).replaceAll('<', '&lt;'), quote: value => String(value).replaceAll("'", "\\\\'"), button: (label, action, variant) => '[' + label + '|' + action + '|' + variant + ']' });
  console.log(render({ id: "T'1", panel: 'Panel <A>', fromLot: '1101', toLot: '1102', startDate: '12/08/2026', status: { cls: 'ok', text: 'Chấp nhận lô mới' }, movedHtml: '<div>Đã chuyển tiếp</div>', approvalHtml: '<div>Duyệt: BS A</div>' }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage transition row HTML TypeScript');
assert.match(result.stdout, /Panel &lt;A>/);
assert.match(result.stdout, /→ 1102/);
assert.match(result.stdout, /Đã chuyển tiếp/);
assert.match(result.stdout, /Sửa\|openLotTransitionV2\('T\\'1'\)\|ghost sm/);
console.log('Manage transition row HTML TypeScript tests passed');
