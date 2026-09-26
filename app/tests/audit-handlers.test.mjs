import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createAuditHandlers } = require('../../app-dist/main/ipc/audit-handlers.js');
const { writeAudit, AUDIT_HARD_CAP, AUDIT_ROTATE_TO } = require('../../app-dist/main/ipc/shared.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const audit = createAuditHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

function query(input) { const r = audit.query(input, actor); assert.equal(r.ok, true, JSON.stringify(r)); return r.data; }
function exportCsv(input) { const r = audit.exportCsv(input, actor); assert.equal(r.ok, true, JSON.stringify(r)); return r.data; }
function verifyChainNow() { const r = audit.verifyChainNow(actor); assert.equal(r.ok, true, JSON.stringify(r)); return r.data; }

const i1 = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const i2 = config.saveInstrument({ data: { name: 'May B' } }, actor).data;
config.saveTest({ data: { name: 'Glucose', instrumentId: i1.id } }, actor);
config.saveTest({ data: { name: 'Ure', instrumentId: i2.id } }, actor);

const all = query({});
assert.equal(all.rows.length, 4, 'phai co dung 4 dong audit (2 may + 2 xet nghiem)');
assert.ok(all.rows[0].seq > all.rows[all.rows.length - 1].seq, 'phai sap moi nhat truoc');
assert.equal(all.page, 1);
assert.equal(all.pageCount, 1);

const filtered = query({ query: 'glucose' });
assert.equal(filtered.rows.length, 1);
assert.equal(filtered.rows[0].detail.includes('Glucose'), true);

const none = query({ query: 'khong-ton-tai-xyz' });
assert.equal(none.rows.length, 0);
assert.equal(none.pageCount, 1);
assert.equal(none.resultFrom, 0);

const page1 = query({ page: 1, pageSize: 2 });
assert.equal(page1.rows.length, 2);
assert.equal(page1.pageCount, 2);
const page2 = query({ page: 2, pageSize: 2 });
assert.equal(page2.rows.length, 2);
const seqSeen = new Set([...page1.rows, ...page2.rows].map(r => r.seq));
assert.equal(seqSeen.size, 4);

// 5) CSV là hồ sơ audit hoàn chỉnh: luôn theo thứ tự ghi, không lệ thuộc
// bộ lọc giao diện, và phải giữ đủ hai hash để kiểm chứng độc lập.
const csv = exportCsv({ query: 'glucose' });
const csvLines = csv.split('\n');
assert.equal(csvLines[0], 'Seq,Thời gian,Người dùng,Tên đăng nhập,Vai trò,Hành động,Đối tượng,Chi tiết,PrevHash,Hash');
assert.equal(csvLines.length, 5, 'header + toan bo 4 dong, khong theo bo loc');
assert.match(csvLines[1], /Quản trị/, 'CSV phải xuất nhãn vai trò tiếng Việt');

const verify1 = verifyChainNow();
assert.equal(verify1.ok, true, JSON.stringify(verify1));
assert.equal(verify1.checked, 4);

const badMonths = audit.archive({ data: { months: 5 } }, actor);
assert.equal(badMonths.ok, false);
assert.equal(badMonths.error.code, 'invalid-months');

const beforeArchive = query({});
const { auditEntryHash } = require('../../app-dist/main/domain/audit-chain.js');
const oldTs = new Date(); oldTs.setFullYear(oldTs.getFullYear() - 3);
const oldEntry = {
  id: 'old-entry-1', seq: 0, ts: oldTs.toISOString(), user: 'Quan tri vien', username: 'admin', userId: 'u1',
  role: 'admin', type: 'Nhập QC', detail: 'Diem cu 3 nam truoc', target: '', clientId: 'test-client', prevHash: '', hash: '',
};
oldEntry.hash = auditEntryHash(oldEntry);
const { relinkAuditChain } = require('../../app-dist/main/domain/audit-chain.js');
db.exec('DELETE FROM activity');
const ordered = [oldEntry, ...beforeArchive.rows.slice().reverse()].map((e, i) => ({ ...e, seq: i + 1 }));
const relinked = relinkAuditChain(ordered, '');
for (const e of relinked) {
  db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, e.seq, e.ts, e.user, e.username, e.userId || 'u1', e.role, e.type, e.detail, e.target || '', e.clientId || 'test-client', e.prevHash, e.hash);
}
assert.equal(verifyChainNow().ok, true, 'chuoi phai van hop le sau khi noi lai voi dong cu chen dau');

const archived = audit.archive({ data: { months: 12 } }, actor);
assert.equal(archived.ok, true);
assert.equal(archived.data.removedCount, 1, 'chi dong 3 nam truoc moi cu hon 12 thang');
const afterArchiveVerify = verifyChainNow();
assert.equal(afterArchiveVerify.ok, true, 'chuoi phai van xac minh duoc TU ANCHOR sau khi cat, khong bao "bi pha"');
const afterArchiveQuery = query({});
assert.ok(!afterArchiveQuery.rows.some(r => r.detail === 'Diem cu 3 nam truoc'), 'dong cu phai bien mat khoi bang song');

// 9) Xem trước phải xuất ĐÚNG đoạn bị gỡ, giữ hash; khi mốc cắt làm rỗng
// bảng sống, dòng audit kế tiếp phải khởi đầu chuỗi mới thay vì giữ anchor cũ.
const preview = audit.previewArchive({ data: { months: 12 } }, actor);
assert.equal(preview.ok, true);
assert.equal(preview.data.removedCount, 0, 'sau cat khong con dong cu de preview');

const onlyOld = query({}).rows.map((entry, index) => ({ ...entry, id: `all-old-${index}`, seq: index + 1, ts: oldTs.toISOString() }));
const allOldRelinked = relinkAuditChain(onlyOld, '');
db.exec('DELETE FROM activity');
for (const e of allOldRelinked) {
  db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, e.seq, e.ts, e.user, e.username, e.userId || 'u1', e.role, e.type, e.detail, e.target || '', e.clientId || 'test-client', e.prevHash, e.hash);
}
const allOldPreview = audit.previewArchive({ data: { months: 12 } }, actor);
assert.equal(allOldPreview.ok, true);
assert.equal(allOldPreview.data.removedCount, allOldRelinked.length);
assert.equal(allOldPreview.data.retainedCount, 0);
assert.match(allOldPreview.data.csv, /PrevHash,Hash/);
const allOldArchived = audit.archive({ data: { months: 12 } }, actor);
assert.equal(allOldArchived.ok, true);
assert.equal(allOldArchived.data.retainedCount, 0);
assert.equal(verifyChainNow().ok, true, 'cat het log phai khoi dau chuoi hash moi hop le');

// 10) Phòng khi người dùng quên lưu trữ thủ công: giới hạn cứng AUDIT_HARD_CAP,
// vượt 50.000 dòng tự giữ 40.000 dòng mới nhất + 1 dòng giải thích; anchor
// phải nối đúng vào dòng đầu còn lại để verifier không báo sai.
db.exec("DELETE FROM activity; DELETE FROM app_meta WHERE key='activityAnchor'");
const seedInsert = db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const rotationSeed = [];
let previousHash = '';
for (let seq = 1; seq <= AUDIT_HARD_CAP; seq++) {
  const entry = {
    id: `rotation-${seq}`, seq, ts: '2020-01-01T00:00:00.000Z', user: 'Quan tri vien', username: 'admin', userId: 'u1',
    role: 'admin', type: 'Thao tác cũ', detail: `Dòng ${seq}`, target: '', clientId: 'test-client', prevHash: previousHash, hash: '',
  };
  entry.hash = auditEntryHash(entry);
  previousHash = entry.hash;
  rotationSeed.push(entry);
  seedInsert.run(entry.id, entry.seq, entry.ts, entry.user, entry.username, entry.userId, entry.role, entry.type, entry.detail, entry.target, entry.clientId, entry.prevHash, entry.hash);
}
writeAudit(db, actor, 'Thao tác làm vượt ngưỡng', 'Kiểm tra tự xoay vòng', 'Nhật ký');
const rotatedRows = db.prepare('SELECT * FROM activity ORDER BY seq ASC').all();
assert.equal(rotatedRows.length, AUDIT_ROTATE_TO + 1, 'giữ 40.000 dòng mới nhất và thêm 1 dòng báo xoay vòng');
// Dòng thao tác vừa ghi là dòng 50.001, nên phải cắt 10.001 dòng (index 0…10000).
assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='activityAnchor'").get().value, rotationSeed[AUDIT_HARD_CAP - AUDIT_ROTATE_TO].hash);
assert.equal(rotatedRows.at(-1).type, 'Xoay vòng nhật ký hoạt động');
assert.equal(verifyChainNow().ok, true, 'chuỗi phải hợp lệ sau xoay vòng tự động');

console.log('app audit-handlers end-to-end tests passed');


