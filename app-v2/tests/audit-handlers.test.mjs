// Kiem chung end-to-end trang Nhat ky hoat dong: audit-handlers.ts noi dung
// domain/audit-filter.ts (da co san, da co test oracle rieng) vao SQLite that
// qua dung thu tu (doc ASC roi moi loc/dao chieu - filterActivity tu dao ve
// moi-nhat-truoc o buoc cuoi).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createAuditHandlers } = require('../../app-v2-dist/main/ipc/audit-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const audit = createAuditHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// Tao vai thao tac de co du dong audit (moi lan goi ghi dung 1 dong)
const i1 = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const i2 = config.saveInstrument({ data: { name: 'May B' } }, actor).data;
config.saveTest({ data: { name: 'Glucose', instrumentId: i1.id } }, actor);
config.saveTest({ data: { name: 'Ure', instrumentId: i2.id } }, actor);

// 1) query() khong tham so tra ve TAT CA, moi-nhat-truoc (seq giam dan)
const all = audit.query({});
assert.equal(all.rows.length, 4, 'phai co dung 4 dong audit (2 may + 2 xet nghiem)');
assert.ok(all.rows[0].seq > all.rows[all.rows.length - 1].seq, 'phai sap moi nhat truoc');
assert.equal(all.page, 1);
assert.equal(all.pageCount, 1);

// 2) Loc theo van ban (khong phan biet dau/hoa-thuong, khop text-utils.textKey)
const filtered = audit.query({ query: 'glucose' });
assert.equal(filtered.rows.length, 1);
assert.equal(filtered.rows[0].detail.includes('Glucose'), true);

// 3) Loc khong khop tra ve rong, khong loi
const none = audit.query({ query: 'khong-ton-tai-xyz' });
assert.equal(none.rows.length, 0);
assert.equal(none.pageCount, 1);
assert.equal(none.resultFrom, 0);

// 4) Phan trang: pageSize=2 phai chia dung 4 dong thanh 2 trang
const page1 = audit.query({ page: 1, pageSize: 2 });
assert.equal(page1.rows.length, 2);
assert.equal(page1.pageCount, 2);
const page2 = audit.query({ page: 2, pageSize: 2 });
assert.equal(page2.rows.length, 2);
// 2 trang gop lai phai dung 4 dong, khong trung/thieu
const seqSeen = new Set([...page1.rows, ...page2.rows].map(r => r.seq));
assert.equal(seqSeen.size, 4);

console.log('app-v2 audit-handlers end-to-end tests passed');
