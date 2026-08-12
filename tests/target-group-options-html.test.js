'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-group-options-html.ts')).href;
const program = `
  import { targetGroupOptionsHtml } from ${JSON.stringify(source)};
  const groups = [{ id: 'G1', name: 'Lô <cũ>', lots: [] }, { id: 'G2', name: 'Lô mới', lots: ['L1'] }];
  console.log(JSON.stringify([targetGroupOptionsHtml(groups, 'G2', group => group.lots, group => group.name, group => group.id === 'G2' ? ' · Dự kiến' : '', value => String(value).replace(/</g, '&lt;')), targetGroupOptionsHtml([], '', () => [], () => '', () => '', String)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target group options HTML TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['<option value="G2" selected>Lô mới · Dự kiến</option>', '<option value="">Không tìm thấy nhóm lô QC phù hợp</option>']);
console.log('Target group options HTML TypeScript tests passed');
