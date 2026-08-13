'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-export-message.ts')).href;
const program = `
  import { createBackupExportMessage } from ${JSON.stringify(source)};
  const message=createBackupExportMessage();
  if(message.createError({message:'hỏng'})!=='Không tạo được file backup:\\nhỏng'||message.createError(null)!=='Không tạo được file backup:\\nLỗi không xác định.'||!message.downloadError.includes('chưa được xem là đã sao lưu'))throw new Error('must preserve backup export error messages');
  console.log('Backup export message TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup export message TypeScript');
console.log(result.stdout.trim());
