'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'dashboard', 'dashboard-test-status-tags.ts')).href;
const program = `
  import { dashboardTestStatusTags } from ${JSON.stringify(source)};
  console.log(JSON.stringify(['rej','warn','ok','none'].map(status => dashboardTestStatusTags.westgard(status)).concat([dashboardTestStatusTags.today(2, 2), dashboardTestStatusTags.today(1, 2), dashboardTestStatusTags.today(0, 2), dashboardTestStatusTags.today(0, 0)])));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy dashboard test status tags TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['<span class="tag rej">Loại bỏ</span>', '<span class="tag warn">Cảnh báo</span>', '<span class="tag ok">Đạt</span>', '<span class="pill">chưa có</span>', '<span class="tag ok">Đủ hôm nay</span>', '<span class="tag warn">1/2 mức</span>', '<span class="tag none">Chưa QC</span>', '<span class="tag none">Chưa QC</span>']);
console.log('Dashboard test status tags TypeScript tests passed');
