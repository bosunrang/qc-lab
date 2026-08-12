'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'brand-profile.ts')).href;
const program = `
  import { createBrandProfile } from ${JSON.stringify(source)};
  const profile = createBrandProfile((value, limit) => String(value).trim().slice(0, limit));
  console.log(JSON.stringify([profile(null), profile({brandTitle:'  Lab  ',brandSub:'  Nội kiểm  ',logoText:'ABCDE',logoData:' x '})]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript brand profile');
const [defaults, custom] = JSON.parse(result.stdout);
assert.deepEqual(defaults, { brandTitle:'QC Lab', brandSub:'Nội kiểm xét nghiệm', logoText:'QC', logoData:'' });
assert.deepEqual(custom, { brandTitle:'Lab', brandSub:'Nội kiểm', logoText:'ABCD', logoData:'x' });
console.log('Settings brand profile TypeScript tests passed');
