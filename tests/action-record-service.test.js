'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'nce', 'action-record-service.ts')).href;
const program = `
  import { createActionRecordService } from ${JSON.stringify(source)};
  const records = [];
  const service = createActionRecordService({ now: () => '2026-08-17T08:00:00.000Z', createId: () => 'a1', isCancelled: action => action.recordStatus === 'cancelled', approvalStatus: action => action.approvalStatus || 'pending' });
  const created = service.create(records, { nceId: 'NCE-MỚI', protocolVersion: 3, effectivenessStatus: 'pending', action: 'Khắc phục' }, { id: 'u1', username: 'ktv-a', name: 'KTV A' });
  const updated = service.update(created, { action: 'Khắc phục đầy đủ', effectivenessStatus: 'effective', effectivenessDate: '2026-08-09', effectivenessNote: 'Theo dõi không tái diễn' }, { id: 'u2', username: 'admin', name: 'Quản trị' });
  console.log(JSON.stringify({ same: updated === created, id: created.id, approvalStatus: created.approvalStatus, editors: created.contentEditorUserIds, effectivenessBy: created.effectivenessBy }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy ActionRecordService TypeScript');
assert.deepEqual(JSON.parse(result.stdout), { same: true, id: 'a1', approvalStatus: 'pending', editors: ['u1', 'u2'], effectivenessBy: 'Quản trị' });
console.log('Action record service TypeScript tests passed');
