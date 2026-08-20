'use strict';
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const calls = [];
const ctx = loadSandbox(['core.js', 'modules/state.js'], { Blob });
// downloadBackupText giờ ở trong generated/modular-pilot.js, được loadSandbox() tự chèn
// vì danh sách có modules/state.js — bundle gán root.blobDownload khi nạp nên stub phải
// đặt SAU bước nạp (trực tiếp lên context), không qua tham số globals (bị bundle ghi đè).
ctx.blobDownload = (name, blob) => { calls.push({ name, blob }); };

const ok = run(ctx, `downloadBackupText('backup.json','{"a":1}')`);
assert.equal(ok, true, 'downloadBackupText phải báo thành công khi blobDownload có sẵn');
assert.equal(calls.length, 1, 'phải gọi blobDownload đúng 1 lần');
assert.equal(calls[0].name, 'backup.json');
assert.ok(calls[0].blob instanceof Blob, 'phải truyền một Blob thật');
assert.equal(calls[0].blob.type, 'application/json');

console.log('Backup download TypeScript bridge tests passed');
