'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'application', 'settings', 'lab-profile-service.ts')).href;
const program = `
  import { createLabProfileService } from ${JSON.stringify(source)};
  const clean = (value, limit = 1000) => String(value || '').trim().slice(0, limit);
  const service = createLabProfileService(clean, value => ({brandTitle:clean(value.brandTitle || 'QC Lab',80),brandSub:clean(value.brandSub || 'Nội kiểm xét nghiệm',120),logoText:clean(value.logoText || 'QC',8).slice(0,4),logoData:clean(value.logoData || '',120000)}));
  console.log(JSON.stringify([
    service.updateLab({logoData:'keep',name:'old'}, {name:'  Bệnh viện  ',dept:' Hóa sinh ',address:' Địa chỉ '}),
    service.updateBrand({name:'Bệnh viện',logoData:' image '}, {brandTitle:' ',brandSub:'  Khoa xét nghiệm ',logoText:'ABCDE'}),
    service.updateLogo({name:'Bệnh viện'}, 'data:image/png;base64,abc'), service.clearLogo({name:'Bệnh viện',logoData:'old'})
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript lab profile service');
const [lab, brand, logo, cleared] = JSON.parse(result.stdout);
assert.deepEqual(lab, {logoData:'keep',name:'Bệnh viện',dept:'Hóa sinh',address:'Địa chỉ'});
assert.deepEqual(brand, {name:'Bệnh viện',logoData:'image',brandTitle:'',brandSub:'Khoa xét nghiệm',logoText:'ABCD'});
assert.deepEqual(logo, {name:'Bệnh viện',logoData:'data:image/png;base64,abc'});
assert.deepEqual(cleared, {name:'Bệnh viện',logoData:''});
console.log('Lab profile service TypeScript tests passed');
