'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-followup-panel-html.ts')).href;
const program = `
  import { dashboardFollowupPanelHtml } from ${JSON.stringify(source)};
  console.log(JSON.stringify([dashboardFollowupPanelHtml('', '', '', ''), dashboardFollowupPanelHtml('U', 'O', 'M', 'W')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard follow-up panel HTML TypeScript');
assert.match(JSON.parse(result.stdout)[0], /Không có điểm bị loại\/cảnh báo/);
assert.equal(JSON.parse(result.stdout)[1], '<div class="dash-list">UOMW</div>');
console.log('Dashboard follow-up panel HTML TypeScript tests passed');
