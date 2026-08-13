'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-file-name.ts')).href;
const program = `
  import { createBackupFileName } from ${JSON.stringify(source)};
  const name=createBackupFileName(value=>'13/08/2026')( '2026-08-13' );
  if(name!=='qclab-backup-13-08-2026.json')throw new Error('must use the Vietnamese formatted date in backup filename');
  console.log('Backup file name TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup file name TypeScript');
console.log(result.stdout.trim());
