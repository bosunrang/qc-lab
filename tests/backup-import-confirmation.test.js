'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-import-confirmation.ts')).href;
const program = `
  import { createBackupImportConfirmation } from ${JSON.stringify(source)};
  const dialog=createBackupImportConfirmation()({name:'data.json',sizeWarning:'Gần ngưỡng'});
  if(dialog.kicker!=='Thao tác không thể hoàn tác'||dialog.message!=='Nhập backup "data.json"?'||!dialog.detail.includes('Dữ liệu nghiệp vụ hiện tại sẽ được thay thế')||!dialog.detail.endsWith('Gần ngưỡng')||dialog.confirmLabel!=='Nhập backup')throw new Error('must preserve backup import confirmation');
  console.log('Backup import confirmation TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup import confirmation TypeScript');
console.log(result.stdout.trim());
