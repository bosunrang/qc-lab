// Kiem chung end-to-end module Reagent (so sanh lo hoa chat): tao, sua
// thong tin, nhap so lieu, tinh thong ke, xoa.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createReagentHandlers } = require('../../app-v2-dist/main/ipc/reagent-handlers.js');

const db = openDatabase(':memory:');
const reagent = createReagentHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// 1) listComparisons tu dong tao 1 ho so trong khi chua co gi (ensureOne)
const initial = reagent.listComparisons();
assert.equal(initial.length, 1);
assert.equal(initial[0].result, null, 'chua nhap so lieu thi ket qua phai la null');

const firstId = initial[0].id;

// 2) Tao them 1 phep so sanh thu 2
const created = reagent.createComparison({ data: { name: 'Glucose', unit: 'mmol/L' } }, actor);
assert.equal(created.ok, true);
assert.equal(created.data.reagent, 'Glucose');
assert.equal(reagent.listComparisons().length, 2);

// 3) Sua thong tin (metadata)
const metaSaved = reagent.saveMetadata({ id: created.data.id, data: { lotOld: 'L1', lotNew: 'L2', biasTarget: 8, coverageConfirmed: true } }, actor);
assert.equal(metaSaved.ok, true);
assert.equal(metaSaved.data.lot_old, 'L1');
assert.equal(metaSaved.data.bias_target, 8);
assert.equal(metaSaved.data.coverage_confirmed, 1);

// 4) Nhap so lieu day du (20 cap, bias 1%) -> tinh duoc thong ke, dat sang loc
const oldVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105];
const rows = oldVals.map(v => [String(v), String(v * 1.01)]);
const rowsSaved = reagent.saveRows({ id: created.data.id, rows }, actor);
assert.equal(rowsSaved.ok, true);
assert.notEqual(rowsSaved.data.result, null);
assert.equal(rowsSaved.data.result.N, 20);
assert.equal(rowsSaved.data.result.passScreen, true, 'bias 1% + coverage confirmed + du 20 cap phai dat sang loc');

// 5) Khong the xoa het ve 0 - phai giu it nhat 1
const removedFirst = reagent.removeComparison({ id: firstId }, actor);
assert.equal(removedFirst.ok, true);
assert.equal(reagent.listComparisons().length, 1);
const removedLast = reagent.removeComparison({ id: created.data.id }, actor);
assert.equal(removedLast.ok, false);
assert.equal(removedLast.error.code, 'last-comparison');

// 6) Sua khong ton tai -> loi not-found
const notFound = reagent.saveMetadata({ id: 'khong-ton-tai', data: {} }, actor);
assert.equal(notFound.ok, false);
assert.equal(notFound.error.code, 'not-found');

console.log('app-v2 reagent-handlers end-to-end tests passed');
