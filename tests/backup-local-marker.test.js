'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'backup', 'backup-local-marker.ts')).href;
const program = `
  import { createBackupLocalMarker } from ${JSON.stringify(source)};
  const data={};const marker=createBackupLocalMarker({storage:{getItem:key=>data[key]??null,setItem:(key,value)=>data[key]=value},now:()=> '2026-08-13T00:00:00.000Z'});
  marker.mark(1234);if(data.qclab_lastbackup!=='2026-08-13T00:00:00.000Z'||marker.lastRaw()!=='2026-08-13T00:00:00.000Z'||data.qclab_lastbackup_bytes!=='1234'||marker.bytes()!==1234)throw new Error('must persist and read backup timestamp plus positive bytes');
  marker.mark(0);if(data.qclab_lastbackup_bytes!=='1234')throw new Error('must retain last positive byte count');
  const failing=createBackupLocalMarker({storage:{getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}},now:()=>''});if(failing.lastRaw()!==null||failing.bytes()!==0)throw new Error('must tolerate unavailable storage');
  console.log('Backup local marker TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup local marker TypeScript');
console.log(result.stdout.trim());
