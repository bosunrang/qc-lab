'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-group-status-suffix.ts')).href;
const program = `
  import { targetGroupStatusSuffix } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetGroupStatusSuffix({ status: 'stopped' }), targetGroupStatusSuffix({ status: 'planned' }), targetGroupStatusSuffix({ status: 'active' }), targetGroupStatusSuffix()]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target group status suffix TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [' · Đã dừng', ' · Dự kiến', '', '']);
console.log('Target group status suffix TypeScript tests passed');
