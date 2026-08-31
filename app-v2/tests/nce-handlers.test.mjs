// Kiem chung end-to-end module NCE/CAPA: tao ho so, duyet/tra lai/huy, cong
// hieu luc chi mo sau khi co ngay hoan thanh hanh dong.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createNceHandlers } = require('../../app-v2-dist/main/ipc/nce-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const nce = createNceHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;

// 1) Xu ly tuc thoi qua ngan phai bi chan
const tooShort = nce.create({ data: { testId: test.id, date: '2026-08-01', correction: 'ngan' } }, actor);
assert.equal(tooShort.ok, false);
assert.equal(tooShort.error.code, 'missing-correction');

// 2) Tao ho so hop le
const created = nce.create({ data: { testId: test.id, level: 1, lot: 'L1', date: '2026-08-01', rule: '1-3s', errorType: 'RE', correction: 'Giu ket qua, kiem tra lai may va lam lai QC', dueDate: '2026-08-10' } }, actor);
assert.equal(created.ok, true);
assert.equal(created.data.approval_status, 'pending');
// Ma NCE lay theo ngay THAT SU dang mo ho so (hom nay), khong phai ngay xay
// ra su co (co the phat hien tre vai ngay) - dung quy uoc ban cu.
const todayPrefix = 'NCE-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
assert.ok(created.data.nce_id.startsWith(todayPrefix), `nce_id=${created.data.nce_id} phai bat dau bang ${todayPrefix}`);

// 3) Danh gia hieu luc khi CHUA co ngay hoan thanh phai bi chan
const tooEarly = nce.markEffectiveness({ data: { id: created.data.id, status: 'effective' } }, actor);
assert.equal(tooEarly.ok, false);
assert.equal(tooEarly.error.code, 'missing-completed-date');

// 4) Cap nhat ngay hoan thanh
const completed = nce.setActionCompletedDate({ data: { id: created.data.id, actionCompletedDate: '2026-08-05' } }, actor);
assert.equal(completed.ok, true);

// 5) Danh gia hieu luc thanh cong sau khi co ngay hoan thanh
const effective = nce.markEffectiveness({ data: { id: created.data.id, status: 'effective', note: 'Khong tai dien sau 2 tuan' } }, actor);
assert.equal(effective.ok, true);
assert.equal(effective.data.effectiveness_status, 'effective');

// 6) Duyet ho so
const approved = nce.approve({ data: { id: created.data.id } }, actor);
assert.equal(approved.ok, true);
assert.equal(approved.data.approval_status, 'approved');

// 7) Ho so da duyet khong the huy
const cancelApproved = nce.cancel({ data: { id: created.data.id, note: 'Muon huy nham' } }, actor);
assert.equal(cancelApproved.ok, false);
assert.equal(cancelApproved.error.code, 'already-approved');

// 8) Tao ho so thu 2, tra lai (ly do qua ngan phai bi chan truoc)
const second = nce.create({ data: { testId: test.id, date: '2026-08-02', correction: 'Giu ket qua cho toi khi kiem tra xong may' } }, actor);
const returnShort = nce.returnForRevision({ data: { id: second.data.id, note: 'x' } }, actor);
assert.equal(returnShort.ok, false);
assert.equal(returnShort.error.code, 'missing-note');
const returned = nce.returnForRevision({ data: { id: second.data.id, note: 'Thieu can cu SOP, bo sung lai' } }, actor);
assert.equal(returned.ok, true);
assert.equal(returned.data.approval_status, 'returned');

// 9) Huy ho so thu 2
const cancelled = nce.cancel({ data: { id: second.data.id, note: 'Nhap trung ho so voi cai khac' } }, actor);
assert.equal(cancelled.ok, true);
assert.equal(cancelled.data.record_status, 'cancelled');
const cancelAgain = nce.cancel({ data: { id: second.data.id, note: 'Huy lan nua' } }, actor);
assert.equal(cancelAgain.ok, false);
assert.equal(cancelAgain.error.code, 'already-cancelled');

// 10) listRecords tra dung 2 ho so
assert.equal(nce.listRecords().length, 2);

console.log('app-v2 nce-handlers end-to-end tests passed');
