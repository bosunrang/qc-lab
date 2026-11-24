// Quyền cấu hình tiêu chí QC (gói GV1 của kế hoạch khắc phục 2026-10-31):
// - `qc.config` mới chặn lập dải PXN, hoàn dải NSX và cấu hình TEa Six Sigma;
// - hành động luật Westgard theo xét nghiệm chỉ admin;
// - nhật ký ghi trước → sau; hồ sơ TEa có link nguồn; EFLM cần ngày tra.
// Chạy trên handler + SQLite thật, cùng cách các test handler khác.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser } from './helpers/nce-flow.mjs';
import { listActivity } from './helpers/activity.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { resolveTea } = require('../../app-dist/main/domain/sigma-tea-core.js');
const { manualRangeDeviation, MANUAL_SD_RATIO_LIMIT } = require('../../app-dist/main/domain/range-workflow.js');
const { hasUserCapability, parseUserCapabilities } = require('../../app-dist/main/domain/capabilities.js');
const { NOT_RETROACTIVE_NOTE } = require('../../app-dist/main/domain/rule-config.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const tech = { userId: 'u-tech', username: 'ktv', name: 'KTV', role: 'technician', clientId: 't' };
const viewer = { userId: 'u-view', username: 'xem', name: 'Người xem', role: 'viewer', clientId: 't' };

/** Một xét nghiệm 1 mức đã có đủ 20 ngày dữ liệu đạt để lập dải PXN. */
function fixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  for (const actor of [admin, tech, viewer]) ensureUser(db, actor);
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mmol/L' } }, admin).data;
  const lot = config.saveLot({ data: { lotNo: 'LOT-1', level: 1 } }, admin).data;
  assert.equal(config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 10, sd: 1, qcLotId: lot.id } }, admin).ok, true);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lot.id }] });
  const entry = createEntryHandlers(db);
  for (let day = 1; day <= 20; day++) {
    const date = `2026-07-${String(day).padStart(2, '0')}`;
    assert.equal(entry.addPoint({ data: { testId: assay.id, level: 1, date, val: day % 2 ? 9.8 : 10.2 } }, admin).ok, true);
  }
  return {
    db, config, entry, assay,
    sigma: createSigmaHandlers(db), westgard: createWestgardHandlers(db), auth: createAuthHandlers(db),
  };
}

const reason = 'Đủ 20 ngày dữ liệu ổn định của lô mới';

test('KTV không có qc.config bị chặn lập dải, hoàn dải và cấu hình TEa', (t) => {
  const { entry, sigma, assay } = fixture(t);
  assert.equal(entry.rangeCandidate(assay.id, 1).data.eligible, true, 'dữ liệu phải đủ điều kiện để lỗi chỉ đến từ quyền');
  assert.equal(entry.applyLabRange({ data: { testId: assay.id, level: 1, reason } }, tech).error.code, 'forbidden-qc-config');
  assert.equal(entry.revertManufacturerRange({ data: { testId: assay.id, level: 1, reason } }, tech).error.code, 'forbidden-qc-config');
  assert.equal(sigma.saveTeaConfig({ testId: assay.id, source: 'clia' }, tech).error.code, 'forbidden-qc-config');
  assert.equal(sigma.saveTeaConfig({ testId: assay.id, source: 'clia' }, viewer).error.code, 'forbidden-qc-config');
});

test('Cấp qc.config thì KTV làm được; thu hồi thì bị chặn ngay ở lần ghi kế tiếp', (t) => {
  const { db, entry, sigma, auth, assay } = fixture(t);
  assert.deepEqual(auth.setNceCapabilities({ id: tech.userId, capabilities: ['qc.config'] }, admin).data.capabilities, ['qc.config']);
  assert.equal(entry.applyLabRange({ data: { testId: assay.id, level: 1, reason } }, tech).ok, true);
  assert.equal(sigma.saveTeaConfig({ testId: assay.id, source: 'clia' }, tech).ok, true);
  const grant = listActivity(db).find((row) => row.type === 'Phân quyền nghiệp vụ');
  assert.match(grant.detail, /không có quyền riêng → qc\.config/);
  assert.equal(auth.setNceCapabilities({ id: tech.userId, capabilities: [] }, admin).ok, true);
  assert.equal(sigma.saveTeaConfig({ testId: assay.id, source: 'ricos' }, tech).error.code, 'forbidden-qc-config');
  assert.equal(auth.setNceCapabilities({ id: viewer.userId, capabilities: ['qc.config'] }, admin).error.code, 'viewer-capabilities');
});

test('Hành động luật theo xét nghiệm chỉ admin; nhật ký ghi trước → sau; lưu lại y nguyên là không đổi', (t) => {
  const { db, westgard, assay } = fixture(t);
  assert.equal(westgard.saveRuleAction(assay.id, '1-3s', 'alert', tech).error.code, 'forbidden');
  assert.equal(westgard.saveRuleAction(assay.id, '1-3s', 'alert', admin).ok, true);
  assert.equal(listActivity(db)[0].detail, `Luật 1-3s: theo cấu hình chung → cảnh báo. ${NOT_RETROACTIVE_NOTE}`);
  const before = listActivity(db).length;
  assert.equal(westgard.saveRuleAction(assay.id, '1-3s', 'alert', admin).ok, true);
  assert.equal(listActivity(db).length, before, 'không ghi nhật ký khi không có gì đổi');
  assert.equal(westgard.saveRuleAction(assay.id, '1-3s', '', admin).ok, true);
  assert.equal(listActivity(db)[0].detail, `Luật 1-3s: cảnh báo → theo cấu hình chung. ${NOT_RETROACTIVE_NOTE}`);
});

test('Mean/SD chỉnh tay lệch xa dải đề xuất được ghi rõ vào nhật ký', (t) => {
  const { db, entry, assay } = fixture(t);
  const proposed = entry.rangeCandidate(assay.id, 1).data.proposed;
  const wide = { mean: proposed.mean, sd: proposed.sd * 3 };
  assert.equal(entry.applyLabRange({ data: { testId: assay.id, level: 1, reason, mean: wide.mean, sd: wide.sd } }, admin).ok, true);
  const row = listActivity(db).find((item) => item.type === 'Thiết lập dải QC mới');
  assert.match(row.detail, /chỉnh thủ công \(đề xuất Mean/);
  assert.match(row.detail, /SD tay gấp 3\.00 lần/);
  assert.match(row.detail, /VƯỢT NGƯỠNG CẢNH BÁO/);
  assert.match(row.detail, /Bias đối chiếu so với Mean NSX 10:/);
});

test('manualRangeDeviation: chỉ vượt ngưỡng khi SD rộng hơn hoặc Mean dời quá xa', () => {
  assert.equal(manualRangeDeviation({ mean: 10, sd: 1 }, { mean: 10, sd: MANUAL_SD_RATIO_LIMIT }).exceeds, false, 'đúng bằng ngưỡng chưa vượt');
  assert.equal(manualRangeDeviation({ mean: 10, sd: 1 }, { mean: 10, sd: 1.6 }).exceeds, true);
  assert.equal(manualRangeDeviation({ mean: 10, sd: 1 }, { mean: 11.5, sd: 1 }).exceeds, true);
  assert.equal(manualRangeDeviation({ mean: 10, sd: 1 }, { mean: 10.5, sd: 0.8 }).exceeds, false);
  assert.equal(manualRangeDeviation({ mean: 10, sd: 0 }, { mean: 10, sd: 1 }), null);
});

test('Cấu hình TEa Six Sigma ghi trước → sau của trường đổi', (t) => {
  const { db, sigma, assay } = fixture(t);
  assert.equal(sigma.saveTeaConfig({ testId: assay.id, source: 'eflm', tea: 6.9, eflmLookupDate: '2026-10-01' }, admin).ok, true);
  const detail = listActivity(db).find((row) => row.type === 'Cập nhật TEa Six Sigma').detail;
  assert.match(detail, /nguồn: .* → eflm/);
  assert.match(detail, /ngày tra EFLM: — → 2026-10-01/);
  assert.match(detail, /TEa EFLM: — → 6\.9/);
});

test('EFLM chỉ được coi là đã truy vết khi có ngày tra cứu', () => {
  const base = { name: 'Glucose', tea_ref_key: '', unit: 'mmol/L', tea: 6.9, tea_source: 'eflm', eflm_tea: 6.9 };
  assert.equal(resolveTea({ ...base, eflm_ref: 'biologicalvariation.eu' }, [], [], 'eflm').value, null);
  assert.equal(resolveTea({ ...base, eflm_lookup_date: '2026-10-01' }, [], [], 'eflm').value, 6.9);
});

test('Hồ sơ TEa: "Nguồn khác đã thẩm định" bắt buộc link http(s); hồ sơ cũ lưu lại không đổi', (t) => {
  const { db, config } = fixture(t);
  const data = {
    name: 'Activated partial thromboplastin time', unit: 's', labValue: 10, labSource: 'other', reference: 'Bài báo kiểm chứng',
    reason: 'Áp dụng theo tài liệu đã thẩm định nội bộ', effectiveDate: '2026-01-01', approvedDate: '2025-12-15',
    preparedBy: 'KTV A', approvedBy: 'Trưởng khoa B',
  };
  assert.equal(config.saveTeaRef({ data }, admin).error.code, 'missing-source-url');
  assert.equal(config.saveTeaRef({ data: { ...data, sourceUrl: 'tai-lieu.pdf' } }, admin).error.code, 'invalid-source-url');
  const saved = config.saveTeaRef({ data: { ...data, sourceUrl: 'https://doi.org/10.1000/xyz' } }, admin);
  assert.equal(saved.ok, true);
  assert.equal(JSON.parse(saved.data.sources_json).sourceUrl, 'https://doi.org/10.1000/xyz');
  assert.match(listActivity(db)[0].detail, /\(https:\/\/doi\.org\/10\.1000\/xyz\)/);
  // Nguồn khác không bắt buộc link; không nhập thì sources_json không có khoá,
  // nên lưu lại y nguyên vẫn là "không đổi".
  const regulation = config.saveTeaRef({ data: { ...data, name: 'Glucose', labSource: 'regulation' } }, admin);
  assert.equal(regulation.ok, true);
  assert.equal('sourceUrl' in JSON.parse(regulation.data.sources_json), false);
  const count = listActivity(db).length;
  assert.equal(config.saveTeaRef({ id: regulation.data.id, data: { ...data, name: 'Glucose', labSource: 'regulation' } }, admin).ok, true);
  assert.equal(listActivity(db).length, count);
});

test('parseUserCapabilities/hasUserCapability: admin mặc nhiên có, người xem không bao giờ có', () => {
  assert.deepEqual(parseUserCapabilities('["qc.config","nce.godmode","qc.config"]'), ['qc.config']);
  assert.deepEqual(parseUserCapabilities('không phải JSON'), []);
  assert.equal(hasUserCapability({ role: 'admin', capabilities: [] }, 'qc.config'), true);
  assert.equal(hasUserCapability({ role: 'technician', capabilities: ['qc.config'] }, 'qc.config'), true);
  assert.equal(hasUserCapability({ role: 'technician', capabilities: [] }, 'qc.config'), false);
  assert.equal(hasUserCapability({ role: 'viewer', capabilities: ['qc.config'] }, 'qc.config'), false);
  assert.equal(hasUserCapability(null, 'qc.config'), false);
});
