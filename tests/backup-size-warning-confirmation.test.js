'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-size-warning-confirmation.ts')).href;
const program = `
  import { createBackupSizeWarningConfirmation } from ${JSON.stringify(source)};
  const model=createBackupSizeWarningConfirmation(value=>value>10?'Gần ngưỡng':'');
  if(model({bytes:10})!==null)throw new Error('must omit warning under threshold');
  const dialog=model({bytes:11});if(!dialog||dialog.kicker!=='Dung lượng backup lớn'||dialog.message!=='Gần ngưỡng'||dialog.confirmLabel!=='Xuất backup')throw new Error('must preserve warning confirmation dialog');
  console.log('Backup size warning confirmation TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup size warning confirmation TypeScript');
console.log(result.stdout.trim());
