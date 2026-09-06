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

// 5) exportCsv() tra dung header + so dong khop voi query() cung bo loc
const csv = audit.exportCsv({ query: 'glucose' });
const csvLines = csv.split('\n');
assert.equal(csvLines[0], 'seq,ts,user,username,role,type,detail,target');
assert.equal(csvLines.length, 2, 'header + 1 dong khop "glucose"');

// 6) verifyChainNow() phai OK khi chuoi chua bi dung tay
const verify1 = audit.verifyChainNow();
assert.equal(verify1.ok, true, JSON.stringify(verify1));
assert.equal(verify1.checked, 4);

// 7) archive(): thang khong hop le phai bi chan
const badMonths = audit.archive({ data: { months: 5 } }, actor);
assert.equal(badMonths.ok, false);
assert.equal(badMonths.error.code, 'invalid-months');

// Chen thang mot dong THAT CU (3 nam truoc) truc tiep vao DB de mo phong nhat
// ky da ton tai lau - dung hash-chain that (noi tiep hash cuoi hien tai) de
// khong tu pha chuoi cua chinh mini truoc khi test archive.
const beforeArchive = audit.query({});
const { auditEntryHash } = require('../../app-v2-dist/main/domain/audit-chain.js');
const oldTs = new Date(); oldTs.setFullYear(oldTs.getFullYear() - 3);
const oldEntry = {
  id: 'old-entry-1', seq: 0, ts: oldTs.toISOString(), user: 'Quan tri vien', username: 'admin', userId: 'u1',
  role: 'admin', type: 'Nhập QC', detail: 'Diem cu 3 nam truoc', target: '', clientId: 'test-client', prevHash: '', hash: '',
};
oldEntry.hash = auditEntryHash(oldEntry);
// Chen VAO DAU chuoi (truoc moi dong hien co) roi noi lai toan bo chuoi phia
// sau cho dung - gan lai seq TRUOC khi tinh hash (auditEntryHash tinh ca seq
// vao payload, gan seq SAU khi hash se lam hash+seq lech nhau).
const { relinkAuditChain } = require('../../app-v2-dist/main/domain/audit-chain.js');
db.exec('DELETE FROM activity');
const ordered = [oldEntry, ...beforeArchive.rows.slice().reverse()].map((e, i) => ({ ...e, seq: i + 1 }));
const relinked = relinkAuditChain(ordered, '');
for (const e of relinked) {
  db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, e.seq, e.ts, e.user, e.username, e.userId || 'u1', e.role, e.type, e.detail, e.target || '', e.clientId || 'test-client', e.prevHash, e.hash);
}
assert.equal(audit.verifyChainNow().ok, true, 'chuoi phai van hop le sau khi noi lai voi dong cu chen dau');

const archived = audit.archive({ data: { months: 12 } }, actor);
assert.equal(archived.ok, true);
assert.equal(archived.data.removedCount, 1, 'chi dong 3 nam truoc moi cu hon 12 thang');
const afterArchiveVerify = audit.verifyChainNow();
assert.equal(afterArchiveVerify.ok, true, 'chuoi phai van xac minh duoc TU ANCHOR sau khi cat, khong bao "bi pha"');
const afterArchiveQuery = audit.query({});
assert.ok(!afterArchiveQuery.rows.some(r => r.detail === 'Diem cu 3 nam truoc'), 'dong cu phai bien mat khoi bang song');

console.log('app-v2 audit-handlers end-to-end tests passed');
