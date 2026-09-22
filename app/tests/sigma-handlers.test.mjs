// Kiem chung end-to-end trang Six Sigma: luu 1 ky (CV/Bias/u(cal) da review
// thu cong), tinh lai sigma/MU dung tu du lieu da luu, cap nhat ky da co
// (khong tao dong moi), va cac dieu kien loi.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const sigmaHandlers = createSigmaHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
// Kỳ Sigma chỉ được lập cho mức QC ĐÃ KHAI của xét nghiệm — cổng `unknown-level`
// của `savePeriod()`. Trước đây file này lưu thẳng mức 1/2 cho một xét nghiệm
// chưa có dòng `test_levels` nào, tức đúng trạng thái mà cổng đó chặn.
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 200, sd: 4 } }, actor);

// Nút Thêm/Xóa trong Sigma chỉ bật/tắt theo dõi, không xóa danh mục xét nghiệm.
const untracked = sigmaHandlers.setTracking({ testId: test.id, tracked: false }, actor);
assert.equal(untracked.ok, true);
assert.equal(db.prepare('SELECT sigma_tracked FROM tests WHERE id=?').get(test.id).sigma_tracked, 0);
const retracked = sigmaHandlers.setTracking({ testId: test.id, tracked: true }, actor);
assert.equal(retracked.ok, true);
assert.equal(db.prepare('SELECT sigma_tracked FROM tests WHERE id=?').get(test.id).sigma_tracked, 1);

// TEa/EFLM được chỉnh tại Sigma nhưng là cấu hình cho kỳ SAU; không đụng dữ
// liệu kỳ đã lưu. Các trường truy xuất phải được lưu cùng xét nghiệm.
const teaConfig = sigmaHandlers.saveTeaConfig({ testId: test.id, source: 'eflm', tea: 5.5, eflmAnalyte: 'Glucose', eflmAps: 'desirable', eflmLookupDate: '2026-09-09', eflmRef: 'https://biologicalvariation.eu' }, actor);
assert.equal(teaConfig.ok, true);
assert.equal(teaConfig.data.tea_source, 'eflm');
assert.equal(teaConfig.data.tea, 5.5);
assert.equal(teaConfig.data.eflm_analyte, 'Glucose');
// Đổi nguồn riêng không được xoá metadata EFLM đã nhập; đây là lời gọi từ
// dropdown thật, không kèm lại toàn bộ form EFLM.
const switchTeaSource = sigmaHandlers.saveTeaConfig({ testId: test.id, source: 'lab' }, actor);
assert.equal(switchTeaSource.ok, true);
assert.equal(switchTeaSource.data.eflm_analyte, 'Glucose');
assert.equal(switchTeaSource.data.eflm_ref, 'https://biologicalvariation.eu');

// 1) Ky khong hop le
const badPeriod = sigmaHandlers.savePeriod({ testId: test.id, period: '2026/08', levels: [{ level: 1, cv: 2 }] }, actor);
assert.equal(badPeriod.ok, false);
assert.equal(badPeriod.error.code, 'invalid-period');

const badTea = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-08', tea: -1, levels: [{ level: 1, cv: 2 }] }, actor);
assert.equal(badTea.ok, false);
assert.equal(badTea.error.code, 'invalid-tea');

// Handler la ranh gioi tin cay: goi IPC truc tiep khong duoc chen mot nguon
// TEa tuy y vao du lieu lich su, du giao dien chi hien bon nguon hop le.
const badTeaSource = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-08', tea: 15, teaSource: 'nguon-tu-tao', levels: [{ level: 1, cv: 2 }] }, actor);
assert.equal(badTeaSource.ok, false);
assert.equal(badTeaSource.error.code, 'invalid-tea-source');
assert.equal(sigmaHandlers.listPeriods(test.id).length, 0, 'nguồn TEa không hợp lệ không được tạo hay sửa kỳ');

// 2) Luu ky hop le: TEa=15, Muc 1 co CV=3, Bias=1.2, u(cal)=0.5
const saved = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-08', tea: 15, teaSource: 'CLIA',
  levels: [{ level: 1, tea: 15, cv: 3, biasEqa: 1.2, uCref: 0.3, uCal: 0.5 }],
}, actor);
assert.equal(saved.ok, true);
const lv = saved.data.levels[0];
assert.ok(lv.sigma, 'phai tinh duoc sigma khi co du TEa/CV/Bias');
// sigma = (15 - |1.2|) / 3
assert.ok(Math.abs(lv.sigma.sigma - (15 - 1.2) / 3) < 1e-9);
assert.ok(lv.mu, 'phai tinh duoc MU khi co CV');
// u(Cref) la thanh phan THU TU cua ngan sach (Nordtest: u(bias) = sqrt(bias^2
// + u(Cref)^2)). Truoc 11/09 no duoc SUY tu SD chuoi bias nen khong bao gio
// thieu -> ngan sach luon "du" mot cach gia tao.
assert.equal(lv.mu.complete, true, 'du ca 4 thanh phan (cv/bias/Cref/cal) phai la complete');
assert.ok(Math.abs(lv.mu.uCref - 0.3) < 1e-12, 'u(Cref) phai la so da nhap, khong suy tu chuoi bias');
// u(bias) = sqrt(1.2^2 + 0.3^2)
assert.ok(Math.abs(lv.mu.uBias - Math.sqrt(1.2 * 1.2 + 0.3 * 0.3)) < 1e-12, 'u(bias) phai ghep u(Cref) theo Nordtest');

// CLIA có giới hạn tuyệt đối phải chụp TEa theo TỪNG mức QC. Nếu dùng chung
// tea của kỳ, hai mức có Mean khác nhau sẽ bị tính Sigma/MDC/MU sai.
const perLevelTea = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-06', tea: 4,
  levels: [{ level: 1, tea: 2, targetMean: 100, cv: 1, biasEqa: 0.5 }, { level: 2, tea: 8, targetMean: 200, cv: 1, biasEqa: 0.5 }],
}, actor);
assert.equal(perLevelTea.ok, true);
assert.equal(perLevelTea.data.levels[0].tea, 2);
assert.equal(perLevelTea.data.levels[1].tea, 8);
assert.equal(perLevelTea.data.levels[0].sigma.sigma, 1.5);
assert.equal(perLevelTea.data.levels[1].sigma.sigma, 7.5);
assert.equal(perLevelTea.data.levels[0].targetMean, 100);
assert.equal(perLevelTea.data.levels[1].targetMean, 200);
assert.ok(Math.abs(perLevelTea.data.levels[1].mu.absoluteU - perLevelTea.data.levels[0].mu.absoluteU * 2) < 1e-9, 'MU tuyệt đối phải dùng Mean đã chốt của đúng mức');

// Nút "+ Thêm kỳ" chỉ tạo mới, không được ghi đè kỳ hiện hữu.
const duplicateCreate = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-08', tea: 15, teaSource: 'CLIA', createOnly: true,
  levels: [{ level: 1, cv: 99, biasEqa: 1.2, uCal: 0.5 }],
}, actor);
assert.equal(duplicateCreate.ok, false);
assert.equal(duplicateCreate.error.code, 'duplicate-period');
assert.equal(sigmaHandlers.listPeriods(test.id).find((period) => period.period === '2026-08').levels[0].cv, 3, 'tao trung ky khong duoc ghi de so lieu da luu');

// 3) listPeriods phai tra dung cac ky da luu (2026-06 tu case TEa theo muc
// o tren + 2026-08), sap tang dan theo ky, va tinh LAI dung nhu luc luu.
const periods = sigmaHandlers.listPeriods(test.id);
assert.deepEqual(periods.map((period) => period.period), ['2026-06', '2026-08']);
const august = periods.find((period) => period.period === '2026-08');
assert.ok(Math.abs(august.levels[0].sigma.sigma - lv.sigma.sigma) < 1e-9);

// 4) Luu lai CUNG ky (thang 08) phai CAP NHAT, khong tao dong moi
const resaved = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-08', tea: 15, teaSource: 'CLIA',
  levels: [{ level: 1, cv: 4, biasEqa: 0.5, uCal: 0.3 }],
}, actor);
assert.equal(resaved.ok, true);
const afterResave = sigmaHandlers.listPeriods(test.id);
assert.equal(afterResave.filter((period) => period.period === '2026-08').length, 1, 'van dung 1 ky 2026-08, khong nhan doi');
assert.equal(afterResave.find((period) => period.period === '2026-08').levels[0].cv, 4);

// 4b) Đổi kỳ là một giao dịch riêng: không được tạo bản mới rồi để lại bản
// cũ (KTV có quyền sửa nhưng không có quyền xóa kỳ).
const renamed = sigmaHandlers.renamePeriod({ id: resaved.data.id, period: '2026-07' }, actor);
assert.equal(renamed.ok, true);
assert.equal(renamed.data.period, '2026-07');
const afterRename = sigmaHandlers.listPeriods(test.id);
assert.equal(afterRename.some((period) => period.period === '2026-08'), false, 'doi ky khong duoc de lai ban ghi cu');
assert.equal(afterRename.filter((period) => period.period === '2026-07').length, 1);
assert.equal(afterRename.find((period) => period.period === '2026-07').id, `${test.id}:2026-07`);

// 5) Ky KHONG co u(cal) phai bi danh dau "chua du" (missing), KHONG duoc coi
// nhu 0 - dung dung nguyen tac da chot trong ke hoach kien truc.
const noCoA = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-09', tea: 15, levels: [{ level: 1, cv: 3, biasEqa: 1 }],
}, actor);
assert.equal(noCoA.ok, true);
assert.equal(noCoA.data.levels[0].mu.complete, false);
assert.ok(noCoA.data.levels[0].mu.missing.includes('u(cal)'));
// Cung nguyen tac cho u(Cref): chua co bao cao EQA/chung chi thi VANG MAT.
assert.ok(noCoA.data.levels[0].mu.missing.includes('u(Cref)'), 'thieu u(Cref) phai vao missing[]');
assert.equal(noCoA.data.levels[0].mu.uCref, null, 'u(Cref) chua danh gia phai la null, khong duoc la 0');
// Nhung o che do ISO/TS 20914 (bias da hieu chinh, khong cong vao ngan sach)
// thi u(Cref) khong con y nghia -> khong duoc doi.
const noBiasBranch = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-09', tea: 15,
  levels: [{ level: 1, cv: 3, biasEqa: 1.2, uCal: 0.5, muBiasMode: 'exclude' }],
}, actor);
assert.equal(noBiasBranch.ok, true);
assert.ok(!noBiasBranch.data.levels[0].mu.missing.includes('u(Cref)'), 'tat nhanh bias thi khong doi u(Cref)');
assert.equal(noBiasBranch.data.levels[0].mu.complete, true);
// u(Cref) am bi chan ngay o IPC.
const badUCref = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-09', tea: 15, levels: [{ level: 1, cv: 3, uCref: -1 }] }, actor);
assert.equal(badUCref.ok, false);
assert.equal(badUCref.error.code, 'invalid-u-cref');
assert.equal(noCoA.data.levels[0].mu.uCal, null, 'u(cal) chua danh gia phai la null, khong duoc la 0');

// Không được giả định Bias = 0 khi EQA/EQC chưa có: Sigma phải để trống để
// tránh kết luận năng lực quá lạc quan.
const missingBias = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-09', tea: 15, levels: [{ level: 1, cv: 3 }],
}, actor);
assert.equal(missingBias.ok, true);
assert.equal(missingBias.data.levels[0].sigma, null);

// 6) Mỗi vòng EQA/EQC phải truy vết được KQ PXN + Target; Bias% được tính
// lại từ cặp đó. Nhiều vòng dùng RMS, không dùng trung bình cộng có dấu.
const eqaSaved = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-10', tea: 15,
  levels: [{ level: 1, cv: 3, eqaRounds: [{ lab: 98, target: 100 }, { lab: 102, target: 100 }], uCal: 0.5 }],
}, actor);
assert.equal(eqaSaved.ok, true);
const eqaLv = eqaSaved.data.levels[0];
assert.ok(Math.abs(eqaLv.biasEqa - 2) < 1e-9, 'bias phai la RMS=2, khong phai trung binh cong=0');
assert.equal(eqaLv.mixedSigns, true, 'phai bao dau trai nhau de canh bao tren UI');
assert.deepEqual(eqaLv.eqaRounds, [{ lab: 98, target: 100, bias: -2 }, { lab: 102, target: 100, bias: 2 }]);
// u(bias) phai tinh duoc tu bias RMS (u(Cref) chua nhap thi vang mat, xem muc 5)
assert.ok(eqaLv.mu.uBias != null, 'co eqaRounds phai tinh duoc u(bias), khong con null');

// 7) Chặn dữ liệu số không hợp lệ ngay ở IPC, thay vì lưu NaN vào JSON rồi
// làm biểu đồ/bảng Sigma mất định dạng ở lần đọc sau.
const badCv = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-11', tea: 15, levels: [{ level: 1, cv: 0 }] }, actor);
assert.equal(badCv.ok, false);
assert.equal(badCv.error.code, 'invalid-cv');
const duplicateLevel = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-11', tea: 15, levels: [{ level: 1, cv: 2 }, { level: 1, cv: 3 }] }, actor);
assert.equal(duplicateLevel.ok, false);
assert.equal(duplicateLevel.error.code, 'duplicate-level');
const badEqa = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-11', tea: 15, levels: [{ level: 1, cv: 2, eqaRounds: [{ lab: 99, target: 0 }] }] }, actor);
assert.equal(badEqa.ok, false);
assert.equal(badEqa.error.code, 'invalid-eqa-round');

// Kỳ đời cũ từng chỉ lưu Bias%; handler vẫn đọc được để lịch sử không mất.
const legacyEqa = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-12', tea: 15, levels: [{ level: 1, cv: 3, eqaRounds: [-2, 2] }] }, actor);
assert.equal(legacyEqa.ok, true);
assert.deepEqual(legacyEqa.data.levels[0].eqaRounds, [{ lab: null, target: null, bias: -2 }, { lab: null, target: null, bias: 2 }]);

// 8) Nạp CV lô đọc toàn bộ vòng đời lô, nhưng phải có dữ liệu ngay trong kỳ.
for (let i = 0; i < 20; i++) {
  db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,lot,val,qc_mean,qc_sd) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(`p${i}`, test.id, 1, `2026-08-${String(i + 1).padStart(2, '0')}`, '', 'LOT-SG', 100 + (i % 2), 100, 2);
}
const cohorts = sigmaHandlers.listCohorts(test.id, '2026-08', [1]);
assert.equal(cohorts.length, 1);
assert.equal(cohorts[0].lot, 'LOT-SG');
assert.equal(cohorts[0].status, 'provisional');
assert.ok(cohorts[0].cv > 0);

console.log('app sigma-handlers end-to-end tests passed');
