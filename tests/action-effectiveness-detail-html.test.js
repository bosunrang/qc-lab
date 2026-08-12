'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-effectiveness-detail-html.ts')).href;
const program = `
  import { createActionEffectivenessDetailHtml } from ${JSON.stringify(source)};
  const render = createActionEffectivenessDetailHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(render({ effectiveness: 'Có hiệu lực', note: '12/08/2026 · Lan', residual: { risk: 'Thấp', score: 8, basis: 'Theo SOP <01>' }, returned: 'Thiếu chữ ký', followUpNceId: 'NCE-2', parentNceId: 'NCE-1', approval: 'Chờ duyệt', workflow: 'Đang điều tra' }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action effectiveness detail HTML TypeScript');
assert.match(result.stdout, /Nguy cơ còn lại: Thấp · RPN 8/);
assert.match(result.stdout, /Theo SOP &lt;01>/);
assert.match(result.stdout, /Đã trả lại: Thiếu chữ ký/);
assert.match(result.stdout, /Đã chuyển sang hồ sơ NCE-2/);
assert.match(result.stdout, /Chờ duyệt · Đang điều tra/);
console.log('Action effectiveness detail HTML TypeScript tests passed');
