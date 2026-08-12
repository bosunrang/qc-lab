'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-cancelled-alert-html.ts')).href;
const program = `
  import { createActionCancelledAlertHtml } from ${JSON.stringify(source)};
  const render = createActionCancelledAlertHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(JSON.stringify([render({ reason: 'Mở <nhầm>', by: 'Lan', at: '12/08/2026 09:00' }), render()]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action cancelled alert HTML TypeScript');
const [alert, empty] = JSON.parse(result.stdout);
assert.match(alert, /Hồ sơ đã hủy/);
assert.match(alert, /Mở &lt;nhầm> · Lan · 12\/08\/2026 09:00/);
assert.equal(empty, '');
console.log('Action cancelled alert HTML TypeScript tests passed');
