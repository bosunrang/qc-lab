'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'backup', 'backup-inspection-summary.ts')).href;
const program = `
  import { createBackupInspectionSummary } from ${JSON.stringify(source)};
  const summary=createBackupInspectionSummary({size:value=>'S-'+value});
  const modern=summary({meta:{type:'full',checksumStatus:'verified'},summary:{points:12,configuredTests:3,minDate:'2026-01-01',maxDate:'2026-01-31'},size:99});
  const legacy=summary({meta:{type:'legacy',checksumStatus:'legacy'},summary:{},size:1});
  if(!modern.includes('Backup đầy đủ hợp lệ.')||!modern.includes('SHA-256 hợp lệ.')||!modern.includes('S-99 MB')||!modern.includes('Điểm QC: 12')||!legacy.includes('Backup JSON cũ hợp lệ.')||!legacy.includes('File cũ chưa có checksum')||!legacy.includes('— đến —'))throw new Error('must preserve backup inspection summary');
  console.log('Backup inspection summary TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy backup inspection summary TypeScript');
console.log(result.stdout.trim());
