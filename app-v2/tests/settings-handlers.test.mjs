// Kiem chung end-to-end trang Cai dat: ho so phong xet nghiem (bang `lab`,
// 1 dong id=1 duoc chen san boi openDatabase()).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createSettingsHandlers } = require('../../app-v2-dist/main/ipc/settings-handlers.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const settings = createSettingsHandlers(db);
const config = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// 1) Ho so mac dinh da co san (dong id=1 duoc chen luc mo DB)
const initial = settings.getLabProfile();
assert.equal(initial.id, 1);
assert.equal(initial.brand_title, 'QC Lab');
assert.equal(initial.name, '');

// 2) Luu ho so day du
const saved = settings.saveLabProfile({ data: {
  name: 'Phong xet nghiem A', dept: 'Khoa Sinh hoa', address: '123 Duong X',
  brandTitle: 'QC Lab A', brandSub: 'Noi kiem A',
} }, actor);
assert.equal(saved.ok, true);
assert.equal(saved.data.name, 'Phong xet nghiem A');
assert.equal(saved.data.dept, 'Khoa Sinh hoa');

// 3) getLabProfile phai phan anh dung gia tri vua luu
const after = settings.getLabProfile();
assert.equal(after.address, '123 Duong X');
assert.equal(after.brand_title, 'QC Lab A');

// 4) Bo trong brandTitle/brandSub phai fallback ve mac dinh (khop DEFAULT
// trong schema), khong luu chuoi rong
const fallback = settings.saveLabProfile({ data: { name: 'B', brandTitle: '', brandSub: '' } }, actor);
assert.equal(fallback.ok, true);
assert.equal(fallback.data.brand_title, 'QC Lab');
assert.equal(fallback.data.brand_sub, 'Nội kiểm xét nghiệm');

// 5) Moi lan luu ghi dung 1 dong audit
const activity = config.listActivity();
assert.equal(activity.length, 2);
assert.deepEqual(activity.map(a => a.type), ['Sửa thông tin phòng xét nghiệm', 'Sửa thông tin phòng xét nghiệm']);

console.log('app-v2 settings-handlers end-to-end tests passed');
