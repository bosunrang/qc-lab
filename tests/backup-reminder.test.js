'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-reminder.ts')).href;
const program = `
  import { createBackupReminder } from ${JSON.stringify(source)};
  const service = createBackupReminder({now: () => Date.parse('2026-08-12T12:00:00Z')});
  const recent = service.lastBackupInfo('2026-08-10T12:00:00Z');
  console.log(JSON.stringify([
    service.lastBackupInfo('bad-date'), recent,
    service.statusText(false, recent), service.statusText(true, recent),
    service.capacityText(0, 10485760, value => value / 1048576, () => false),
    service.capacityText(5242880, 10485760, value => value / 1048576, () => true),
    service.overdue(false, recent, 2), service.overdue(true, recent, 2),
    service.banner(false, {id:'u1'}, service.lastBackupInfo('bad-date'), 7), service.banner(false, {id:'u1'}, recent, 7)
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript backup reminder');
const [invalid, recent, localStatus, cloudStatus, emptyCapacity, fullCapacity, overdue, cloudOverdue, criticalBanner, hiddenBanner] = JSON.parse(result.stdout);
assert.deepEqual(invalid, { never:true, days:null });
assert.deepEqual(recent, { never:false, ts:Date.parse('2026-08-10T12:00:00Z'), days:2 });
assert.match(localStatus, /2 ngày trước/);
assert.match(cloudStatus, /đồng bộ đám mây/);
assert.equal(emptyCapacity, 'Khuyến nghị dưới 10 MB.');
assert.equal(fullCapacity, 'Backup gần nhất 5 MB (khuyến nghị dưới 10 MB). Gần mức khuyến nghị.');
assert.equal(overdue, true);
assert.equal(cloudOverdue, false);
assert.deepEqual(criticalBanner, { hidden:false, className:'backup-dot crit', text:'Chưa sao lưu', title:'Bạn chưa sao lưu dữ liệu trên máy này. Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.' });
assert.deepEqual(hiddenBanner, { hidden:true, className:'', text:'', title:'' });
console.log('Backup reminder TypeScript tests passed');
