'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-inspection-message.ts')).href;
const program = `
  import { createBackupInspectionMessage } from ${JSON.stringify(source)};
  const message=createBackupInspectionMessage();if(message.invalid({message:'checksum sai'})!=='File không đạt kiểm tra:\\nchecksum sai'||message.invalid(null)!=='File không đạt kiểm tra:\\nFile không hợp lệ.')throw new Error('must preserve inspection error messages');
  console.log('Backup inspection message TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup inspection message TypeScript');
console.log(result.stdout.trim());
