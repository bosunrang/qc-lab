'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'backup-ui.js'), 'utf8');
assert.match(source, /function downloadBackupText\(name,json\)\{try\{if\(globalThis\.blobDownload\)\{globalThis\.blobDownload\(name,new Blob\(\[json\],\{type:'application\/json'\}\)\);return true;\}/,
  'xuất backup phải dùng blobDownload TypeScript khi artifact đã nạp');
console.log('Backup download TypeScript bridge tests passed');
