'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'storage-usage.ts')).href;
const program = `
  import { storageBytesText, storageUsageText } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    storageBytesText(-1), storageBytesText(1536),
    storageUsageText({a:[1,2],b:[3]}, null),
    storageUsageText({}, {usage: 1536, quota: 10240, usageDetails:{indexedDB:1024}})
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript storage usage');
const [zero, kilobytes, missingEstimate, estimate] = JSON.parse(result.stdout);
assert.equal(zero, '0 B');
assert.equal(kilobytes, '1.5 KB');
assert.match(missingEstimate, /Số điểm QC: 3/);
assert.match(missingEstimate, /không cung cấp thông tin hạn mức/);
assert.match(estimate, /Dung lượng IndexedDB: 1\.0 KB/);
assert.match(estimate, /1\.5 KB \/ 10 KB \(15\.00%\)/);
console.log('Settings storage usage TypeScript tests passed');
