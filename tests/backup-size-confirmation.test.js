'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-size-confirmation.ts')).href;
const program = `
  import { createBackupSizeConfirmation } from ${JSON.stringify(source)};
  const model=createBackupSizeConfirmation({error:size=>size>100?'Quá lớn':'',size:value=>'S-'+value});
  if(model({bytes:10,title:'T',detail:'D'})!==null)throw new Error('must omit confirmation under threshold');
  const dialog=model({bytes:101,title:'T',detail:'D'});if(!dialog||dialog.kicker!=='Vượt giới hạn khuyến nghị'||dialog.message!=='Quá lớn Dung lượng thực tế S-101 MB.'||dialog.confirmLabel!=='Vẫn tiếp tục')throw new Error('must preserve oversized confirmation dialog');
  console.log('Backup size confirmation TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup size confirmation TypeScript');
console.log(result.stdout.trim());
