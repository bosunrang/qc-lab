'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-patient-impact-html.ts')).href;
const program = `
  import { createActionPatientImpactHtml } from ${JSON.stringify(source)};
  const render = createActionPatientImpactHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(JSON.stringify([render('Cần rà soát <kết quả>', 'Thông báo bác sĩ'), render('')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action patient impact HTML TypeScript');
const [withAction, empty] = JSON.parse(result.stdout);
assert.match(withAction, /Cần rà soát &lt;kết quả>/);
assert.match(withAction, /Thông báo bác sĩ/);
assert.match(empty, /Chưa đánh giá/);
console.log('Action patient impact HTML TypeScript tests passed');
