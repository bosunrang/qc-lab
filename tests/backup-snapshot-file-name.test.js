'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-snapshot-file-name.ts')).href;
const program = `
  import { createBackupSnapshotFileName } from ${JSON.stringify(source)};
  const name=createBackupSnapshotFileName(()=> '2026-08-13T14:05:06.789Z')('truoc-nhap');
  if(name!=='qclab-truoc-nhap-2026-08-13-14-05-06Z.json')throw new Error('must create a filesystem-safe snapshot backup filename');
  console.log('Backup snapshot file name TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup snapshot file name TypeScript');
console.log(result.stdout.trim());
