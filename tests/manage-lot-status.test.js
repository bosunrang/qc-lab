'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-lot-status.ts')).href;
const program = `
  import { createManageLotStatus } from ${JSON.stringify(source)};
  const status = createManageLotStatus({ daysToExpiry: value => ({ none: null, old: -1, soon: 7, fresh: 31 })[value] });
  console.log(JSON.stringify([status({ depleted: true }, '1102'), status({ exp: 'none' }), status({ exp: 'old' }), status({ exp: 'soon' }), status({ exp: 'fresh' })]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage lot status TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ text: 'Đã chuyển tiếp qua lô 1102', cls: 'rej' }, { text: 'Chưa có HSD', cls: 'none' }, { text: 'Hết hạn', cls: 'rej' }, { text: 'Còn 7 ngày', cls: 'warn' }, { text: 'Đang hoạt động', cls: 'ok' }]);
console.log('Manage lot status TypeScript tests passed');
