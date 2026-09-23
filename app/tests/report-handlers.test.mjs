// Kiem chung end-to-end trang Bao cao: khoa/mo khoa ky bao cao va xem lai
// diem QC theo khoang ngay. Kiem chung viec KHOA THAT SU chan them/huy diem
// QC nam o tests/period-lock-enforcement.test.mjs (giao giua entry-handlers
// va report-handlers), khong lap lai o day.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const db = openDatabase(':memory:');
const report = createReportHandlers(db);
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// 1) Dinh dang ky sai phai bi chan
const badFormat = report.lockPeriod({ data: { ym: '2026/08' } }, actor);
assert.equal(badFormat.ok, false);
assert.equal(badFormat.error.code, 'invalid-period');

// 2) Khoa hop le
const locked = report.lockPeriod({ data: { ym: '2026-08', note: 'Da chot bao cao thang 8' } }, actor);
assert.equal(locked.ok, true);
assert.equal(locked.data.ym, '2026-08');
assert.equal(report.isPeriodLocked('2026-08'), true);

// 3) Khoa lai ky da khoa phai bi chan
const dupLock = report.lockPeriod({ data: { ym: '2026-08' } }, actor);
assert.equal(dupLock.ok, false);
assert.equal(dupLock.error.code, 'already-locked');

// 4) Mo khoa thieu ly do (< 5 ky tu) phai bi chan
const shortNote = report.unlockPeriod({ data: { ym: '2026-08', note: 'x' } }, actor);
assert.equal(shortNote.ok, false);
assert.equal(shortNote.error.code, 'missing-note');

// 5) Mo khoa ky CHUA khoa phai bi chan
const notLocked = report.unlockPeriod({ data: { ym: '2099-01', note: 'Ly do hop le du dai' } }, actor);
assert.equal(notLocked.ok, false);
assert.equal(notLocked.error.code, 'not-locked');

// 6) Mo khoa hop le
const unlocked = report.unlockPeriod({ data: { ym: '2026-08', note: 'Phat hien can bo sung them so lieu' } }, actor);
assert.equal(unlocked.ok, true);
assert.equal(report.isPeriodLocked('2026-08'), false);

// 7) listPeriodLocks phan anh dung trang thai hien tai (da mo khoa nen rong)
assert.equal(report.listPeriodLocks().length, 0);

// 8) queryReport: loc dung theo xet nghiem + khoang ngay, bo qua xet nghiem khac
const instrument = config.saveInstrument({ data: { name: 'May Report' } }, actor).data;
const testA = config.saveTest({ data: { name: 'Test A', instrumentId: instrument.id } }, actor).data;
const testB = config.saveTest({ data: { name: 'Test B', instrumentId: instrument.id } }, actor).data;
makeOperationalQc(db, { testId: testA.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
makeOperationalQc(db, { testId: testB.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
entry.addPoint({ data: { testId: testA.id, level: 1, date: '2026-08-01', val: 5, runId: 'r1' } }, actor);
entry.addPoint({ data: { testId: testA.id, level: 1, date: '2026-08-15', val: 6, runId: 'r1' } }, actor);
entry.addPoint({ data: { testId: testA.id, level: 1, date: '2026-09-01', val: 7, runId: 'r1' } }, actor);
entry.addPoint({ data: { testId: testB.id, level: 1, date: '2026-08-10', val: 8, runId: 'r1' } }, actor);

const rowsAll = report.queryReport({ testId: testA.id });
assert.equal(rowsAll.length, 3, 'khong loc ngay phai tra ve ca 3 diem cua Test A');

const rowsRanged = report.queryReport({ testId: testA.id, from: '2026-08-01', to: '2026-08-31' });
assert.equal(rowsRanged.length, 2, 'loc theo khoang ngay phai chi con 2 diem trong thang 8');
assert.ok(rowsRanged.every(r => r.test_id === testA.id), 'khong duoc lan diem cua Test B khac');

// Điểm ĐÃ HUỶ phải còn trong báo cáo kèm lý do — báo cáo là hồ sơ, không
// phải bảng dữ liệu sạch. Trang in gạch ngang những dòng này.
{
  const voidedRows = report.queryReport({ testId: testA.id, from: '', to: '' });
  assert.ok(voidedRows.every(row => 'voided' in row && 'void_reason' in row), 'báo cáo phải mang theo dấu vết huỷ');
}

// Số lô phải đi theo từng dòng báo cáo: một báo cáo bắc qua lần đổi lô liệt
// kê điểm của CẢ HAI lô, thiếu cột này thì không phân biệt được — mà số lô là
// định danh bắt buộc của vật liệu kiểm trong hồ sơ nội kiểm ISO 15189.
{
  const withLot = report.queryReport({ testId: testA.id, from: '', to: '' });
  assert.ok(withLot.length, 'phải có dòng để kiểm');
  assert.ok(withLot.every(row => 'lot' in row), 'mỗi dòng báo cáo phải mang số lô');
  // Và KHÔNG kéo theo cột ngoài hợp đồng: hàng này đi thẳng ra tệp xuất.
  const allowed = new Set(['id', 'test_id', 'level', 'date', 'run_id', 'lot', 'val', 'note', 'operator_name', 'voided', 'void_reason']);
  for (const key of Object.keys(withLot[0])) assert.ok(allowed.has(key), `cột ngoài hợp đồng lọt vào báo cáo: ${key}`);
}

// Xuất CSV phải có BOM UTF-8. Blob `type: text/csv;charset=utf-8` KHÔNG đủ:
// Excel trên Windows đoán mã hoá theo codepage hệ thống khi mở tệp cục bộ,
// thiếu BOM thì toàn bộ tiếng Việt trong báo cáo mở ra là ký tự rác.
{
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../renderer/pages/ReportPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /new Blob\(\['\ufeff', content\], \{ type \}\)/, 'CSV phải ghi kèm BOM UTF-8');
  // Tên tệp theo tên xét nghiệm, không phải uid — đây là hồ sơ đem lưu.
  assert.match(page, /selected\?\.testName \|\| 'xet-nghiem'/);
  assert.doesNotMatch(page, /`\$\{selectedId\}-\$\{isoToday\(\)\}`/, 'không đặt tên tệp bằng testId');

  // Cột Lô đứng ngay sau Mức trong cả tiêu đề lẫn dòng dữ liệu.
  assert.match(page, /const POINT_HEADERS = \['Ngày', 'Mức', 'Lô', 'Lần chạy', 'Giá trị', 'Người thực hiện', 'Trạng thái'\];/);
  assert.match(page, /p\.level, p\.lot \|\| '—', p\.run_id/);

  // Phụ lục NCE phải nói rõ hồ sơ đã huỷ — giữ dòng (nó là dấu vết) nhưng
  // không để nó hiện y hệt hồ sơ đang chờ duyệt.
  assert.match(page, /'Hạn xử lý', 'Trạng thái hồ sơ', 'Duyệt', 'Hiệu lực'/);
  assert.match(page, /cancelled: 'Đã huỷ', active: 'Đang hiệu lực'/);
  assert.match(page, /NCE_RECORD_STATUS\[r\.record_status\]/, 'nceRow() phải sinh ô trạng thái hồ sơ');
  // Số ô `nceRow()` sinh ra phải khớp số cột tiêu đề, nếu không bảng lệch cột.
  const headerCount = (/const NCE_HEADERS = \[([^\]]+)\]/.exec(page)?.[1] || '').split(',').length;
  const cellCount = (/function nceRow\(r: NceRecord\): string\[\] \{[\s\S]*?return \[([\s\S]*?)\];/.exec(page)?.[1] || '')
    .split(/,(?![^[(]*[\])])/).length;
  assert.equal(headerCount, 9);
  assert.equal(cellCount, headerCount, 'số ô nceRow() phải khớp số cột NCE_HEADERS');

  // Khoảng ngày đảo ngược bị chặn ở nút xuất, kèm giải thích.
  assert.match(page, /const rangeInvalid = !!start && !!end && start > end;/);
  assert.match(page, /const disabled = !matched\.length \|\| busy \|\| rangeInvalid;/);
}

console.log('app report-handlers end-to-end tests passed');
