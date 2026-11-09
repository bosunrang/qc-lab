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

// Mỗi loại PDF một biểu mẫu kiểm soát riêng, cấu hình tại thẻ Báo cáo &
// Biểu mẫu, không cất lẫn trong hồ sơ đơn vị. Giá trị mặc định đảm bảo PDF
// vẫn in được khi DB chưa từng mở thẻ cấu hình.
const DEFAULT_FORMS = {
  iqc: { formCode: 'BM-NK-01', version: '1.0', effectiveDate: '' },
  westgard: { formCode: 'BM-WG-01', version: '1.0', effectiveDate: '' },
  sigma: { formCode: 'BM-SS-01', version: '1.0', effectiveDate: '' },
  reagent: { formCode: 'BM-HC-01', version: '1.0', effectiveDate: '' },
  review: { formCode: 'BM-XX-01', version: '1.0', effectiveDate: '' },
  eqa: { formCode: 'BM-NGK-01', version: '1.0', effectiveDate: '' },
};
assert.deepEqual(report.getReportTemplateSettings(), DEFAULT_FORMS);
assert.equal(report.saveReportTemplateSettings({ data: { kind: 'sigma', formCode: 'BM-SS-02', version: '2.0' } }, { ...actor, role: 'staff' }).ok, false);
assert.equal(report.saveReportTemplateSettings({ data: { kind: 'sigma', formCode: '', version: '2.0' } }, actor).ok, false);
assert.equal(report.saveReportTemplateSettings({ data: { kind: 'khac', formCode: 'X', version: '1' } }, actor).error.code, 'invalid-form-kind');
assert.equal(report.saveReportTemplateSettings({ data: { kind: 'iqc', formCode: 'X', version: '1', effectiveDate: '2026-02-30' } }, actor).error.code, 'invalid-effective-date');
const savedTemplate = report.saveReportTemplateSettings({ data: { kind: 'sigma', formCode: 'BM-SS-02', version: '2.0', effectiveDate: '2026-11-01' } }, actor);
assert.deepEqual(savedTemplate, { ok: true, data: { ...DEFAULT_FORMS, sigma: { formCode: 'BM-SS-02', version: '2.0', effectiveDate: '2026-11-01' } } });
assert.deepEqual(report.getReportTemplateSettings().sigma, { formCode: 'BM-SS-02', version: '2.0', effectiveDate: '2026-11-01' });
assert.deepEqual(report.getReportTemplateSettings().iqc, DEFAULT_FORMS.iqc, 'sửa một biểu mẫu không đụng biểu mẫu khác');
assert.match(db.prepare("SELECT type FROM activity WHERE type LIKE 'Sửa biểu mẫu%' ORDER BY seq DESC LIMIT 1").get()?.type || '', /Báo cáo Six Sigma/);
// Bản lưu cũ chỉ có biểu mẫu Sigma: giữ làm biểu mẫu Sigma, loại khác lấy mặc định.
db.prepare("UPDATE app_meta SET value=? WHERE key='reportTemplateSettings'").run(JSON.stringify({ formCode: 'BM-CU', version: '3' }));
assert.deepEqual(report.getReportTemplateSettings(), { ...DEFAULT_FORMS, sigma: { formCode: 'BM-CU', version: '3', effectiveDate: '' } });

const badFormat = report.lockPeriod({ data: { ym: '2026/08' } }, actor);
assert.equal(badFormat.ok, false);
assert.equal(badFormat.error.code, 'invalid-period');

const locked = report.lockPeriod({ data: { ym: '2026-08', note: 'Da chot bao cao thang 8', acknowledge: true } }, actor);
assert.equal(locked.ok, true);
assert.equal(locked.data.ym, '2026-08');
assert.equal(report.isPeriodLocked('2026-08'), true);

const dupLock = report.lockPeriod({ data: { ym: '2026-08' } }, actor);
assert.equal(dupLock.ok, false);
assert.equal(dupLock.error.code, 'already-locked');

const shortNote = report.unlockPeriod({ data: { ym: '2026-08', note: 'x' } }, actor);
assert.equal(shortNote.ok, false);
assert.equal(shortNote.error.code, 'missing-note');

const notLocked = report.unlockPeriod({ data: { ym: '2099-01', note: 'Ly do hop le du dai' } }, actor);
assert.equal(notLocked.ok, false);
assert.equal(notLocked.error.code, 'not-locked');

const unlocked = report.unlockPeriod({ data: { ym: '2026-08', note: 'Phat hien can bo sung them so lieu' } }, actor);
assert.equal(unlocked.ok, true);
assert.equal(report.isPeriodLocked('2026-08'), false);

assert.equal(report.listPeriodLocks().length, 0);

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
// Từ 2026-09-26 mọi trang đi qua `downloadCsv()`; BOM được kiểm bằng hành vi ở
// `csv-download.test.mjs`, ở đây chỉ còn kiểm Báo cáo dùng đúng hàm đó.
{
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../renderer/pages/ReportPage.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes("downloadCsv(lines.join('\\n'), `bao-cao-${stamp()}.csv`)"), 'CSV phải xuất qua downloadCsv() để có BOM');
  // Tên tệp theo tên xét nghiệm, không phải uid — đây là hồ sơ đem lưu.
  assert.match(page, /selected\?\.testName \|\| 'xet-nghiem'/);
  assert.doesNotMatch(page, /`\$\{selectedId\}-\$\{isoToday\(\)\}`/, 'không đặt tên tệp bằng testId');

  // Cột Lô đứng ngay sau Mức trong cả tiêu đề lẫn dòng dữ liệu.
  assert.match(page, /const POINT_HEADERS = \['Ngày', 'Mức', 'Lô', 'Lần chạy', 'Giá trị', 'Người thực hiện', 'Trạng thái'\];/);
  assert.match(page, /p\.level, p\.lot \|\| '—', p\.run_id/);

  // Phụ lục NCE phải nói rõ trạng thái hồ sơ (kể cả đã huỷ — giữ dòng vì nó
  // là dấu vết) bằng nhãn, không in mã máy.
  assert.match(page, /'Tầng xử lý', 'Hạn xử lý', 'Trạng thái'\]/);
  assert.match(page, /NCE_STATUS_LABEL\[r\.status\]/, 'nceRow() phải sinh ô trạng thái hồ sơ bằng nhãn');
  // Số ô `nceRow()` sinh ra phải khớp số cột tiêu đề, nếu không bảng lệch cột.
  const headerCount = (/const NCE_HEADERS = \[([^\]]+)\]/.exec(page)?.[1] || '').split(',').length;
  const cellCount = (/function nceRow\(r: NceRecordRow\): string\[\] \{[\s\S]*?return \[([\s\S]*?)\];/.exec(page)?.[1] || '')
    .split(/,(?![^[(]*[\])])/).length;
  assert.equal(headerCount, 8);
  assert.equal(cellCount, headerCount, 'số ô nceRow() phải khớp số cột NCE_HEADERS');

  // Khoảng ngày đảo ngược bị chặn ở nút xuất, kèm giải thích.
  assert.match(page, /const rangeInvalid = !!start && !!end && start > end;/);
  assert.match(page, /const disabled = !summaries\.length \|\| busy \|\| rangeInvalid;/);
  assert.match(page, /Biểu mẫu báo cáo PDF/);
  assert.match(page, /Mã biểu mẫu/);
  assert.match(page, /Phiên bản/);
  assert.match(page, /Ngày hiệu lực/);
  assert.match(page, /REPORT_FORM_KINDS\.map/);
  assert.match(page, /saveTemplate\(\{ kind, \.\.\.forms\[kind\] \}\)/);
  // PDF nội kiểm có phần đầu kiểm soát tài liệu, số trang và khu vực ký.
  assert.match(page, /loadPrintIdentity\('iqc'\)/);
  assert.match(page, /documentHeader\(identity, 'Báo cáo nội kiểm'/);
  assert.match(page, /\$\{appendix\}\$\{signatureBlock\(\)\}/);
  assert.match(page, /`bao-cao-\$\{stamp\(\)\}\.pdf`, \{ pageNumbers: true \}/);
  const reportCss = readFileSync(new URL('../renderer/styles/pages/report.css', import.meta.url), 'utf8');
  assert.match(reportCss, /\.report-template-fields input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\{height:var\(--control-h\);min-height:var\(--control-h\);\}/);
}

console.log('app report-handlers end-to-end tests passed');


