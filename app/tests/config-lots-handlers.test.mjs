// Kiểm thử đầu-cuối cho phần mở rộng của Cấu hình chung: lô QC, nhóm lô,
// Panel QC, chuyển tiếp lô, TEa tham
// chiếu, phạm vi luật Westgard theo xét nghiệm. Tách file riêng với
// config-handlers.test.mjs vì file đó khoá số đếm audit log tuyệt đối.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const h = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

const instrument = h.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
const test1 = h.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, teaRefKey: 'qclab-glucose' } }, actor).data;
const test2 = h.saveTest({ data: { name: 'Ure', instrumentId: instrument.id } }, actor).data;

// TEa CLIA tự khai phải lưu đủ quy tắc + giới hạn tuyệt đối; đây là dữ liệu
// đầu vào cho resolver Sigma, không phải chỉ là metadata của biểu mẫu.
const customTea = h.addTeaAnalyte({
  name: 'Marker tuyệt đối', unit: 'L', clia: '3', cliaRule: 'greater-of', cliaAbsolute: '0.05', cliaAbsoluteUnit: 'liter',
}, actor);
assert.equal(customTea.ok, true);
const savedCustomTea = h.listTeaRefs().find((item) => item.analyte_id === customTea.data.analyteId);
assert.equal(savedCustomTea?.clia_rule, 'greater-of');
assert.equal(savedCustomTea?.clia_absolute, 0.05);
assert.equal(savedCustomTea?.clia_absolute_unit, 'liter');
assert.equal(h.removeTeaRef({ id: savedCustomTea.id }, actor).ok, true, 'dọn fixture để các kiểm tra TEa bên dưới giữ đúng ngữ cảnh');
const invalidAbsoluteTea = h.addTeaAnalyte({ name: 'Marker thiếu ngưỡng', cliaRule: 'absolute' }, actor);
assert.equal(invalidAbsoluteTea.ok, false);
assert.equal(invalidAbsoluteTea.error.code, 'missing-clia-absolute');

// ---- Lô QC ----
const lot1 = h.saveLot({ data: { lotNo: 'L1', level: 1 } }, actor);
assert.equal(lot1.ok, true);
const lot2 = h.saveLot({ data: { lotNo: 'L2', level: 1 } }, actor);
assert.equal(lot2.ok, true);
assert.equal(h.listLots().length, 2);

const lotMissing = h.saveLot({ data: { lotNo: '' } }, actor);
assert.equal(lotMissing.ok, false);
assert.equal(lotMissing.error.code, 'missing-lot-no');

// ---- Nhóm lô QC — bắt buộc >= 2 lô ----
const groupTooFew = h.saveLotGroup({ data: { name: 'Nhóm A', lotIds: [lot1.data.id] } }, actor);
assert.equal(groupTooFew.ok, false);
assert.equal(groupTooFew.error.code, 'not-enough-lots');

const group = h.saveLotGroup({ data: { name: '', lotIds: [lot1.data.id, lot2.data.id] } }, actor);
assert.equal(group.ok, true);
assert.equal(group.data.name, 'L1/L2', 'bỏ trống tên phải tự ghép từ số lô');
assert.deepEqual(group.data.lotIds.sort(), [lot1.data.id, lot2.data.id].sort());
// Cả 2 lô phải thật sự được gán group_id trong bảng qc_lots.
const lotsAfterGroup = h.listLots();
assert.ok(lotsAfterGroup.every(l => l.group_id === group.data.id));

// Sửa lại nhóm, bỏ lot2 khỏi nhóm (chỉ còn lot1 + 1 lô mới) — lot2 phải được
// gỡ group_id (NULL), không còn dính vào nhóm cũ.
const lot3 = h.saveLot({ data: { lotNo: 'L3', level: 1 } }, actor).data;
const groupUpdated = h.saveLotGroup({ id: group.data.id, data: { name: 'Nhóm A đổi tên', lotIds: [lot1.data.id, lot3.id] } }, actor);
assert.equal(groupUpdated.ok, true);
const lot2AfterUpdate = h.listLots().find(l => l.id === lot2.data.id);
assert.equal(lot2AfterUpdate.group_id, null, 'lô bị gỡ khỏi nhóm phải có group_id=NULL, không còn thuộc nhóm cũ');

// Mean/SD chỉ được gán vào lô tồn tại, đúng mức và còn sử dụng. UI bình
// thường đã lọc lựa chọn, nhưng cổng IPC phải tự bảo vệ tính toàn vẹn DB.
const level2Lot = h.saveLot({ data: { lotNo: 'L-M2', level: 2 } }, actor).data;
const depletedLot = h.saveLot({ data: { lotNo: 'L-HET', level: 1, depleted: true } }, actor).data;
assert.equal(h.saveTestLevel({ testId: test1.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: 'khong-ton-tai' } }, actor).error.code, 'missing-lot');
assert.equal(h.saveTestLevel({ testId: test1.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: level2Lot.id } }, actor).error.code, 'wrong-lot-level');
assert.equal(h.saveTestLevel({ testId: test1.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: depletedLot.id } }, actor).error.code, 'depleted-lot');

const panelNoInstrument = h.savePanel({ data: { name: 'Panel A', testIds: [] } }, actor);
assert.equal(panelNoInstrument.ok, false);
assert.equal(panelNoInstrument.error.code, 'missing-instrument');

const panelUnknownTest = h.savePanel({ data: { name: 'Panel rỗng trá hình', instrumentId: instrument.id, testIds: ['khong-ton-tai'] } }, actor);
assert.equal(panelUnknownTest.ok, false);
assert.equal(panelUnknownTest.error.code, 'missing-tests');

const panelMixedUnknownTest = h.savePanel({ data: { name: 'Panel bị cắt ngầm', instrumentId: instrument.id, testIds: [test1.id, 'khong-ton-tai'] } }, actor);
assert.equal(panelMixedUnknownTest.ok, false);
assert.equal(panelMixedUnknownTest.error.code, 'wrong-instrument', 'không được âm thầm bỏ id hỏng rồi lưu phần còn lại');

const panel = h.savePanel({ data: { name: 'Panel A', instrumentId: instrument.id, testIds: [test1.id, test2.id] } }, actor);
assert.equal(panel.ok, true);
assert.deepEqual(panel.data.testIds.sort(), [test1.id, test2.id].sort());

// Sửa panel, bỏ test2 — junction phải phản ánh đúng (không còn test2).
const panelUpdated = h.savePanel({ id: panel.data.id, data: { name: 'Panel A', instrumentId: instrument.id, testIds: [test1.id] } }, actor);
assert.equal(panelUpdated.ok, true);
assert.deepEqual(panelUpdated.data.testIds, [test1.id]);

// Đổi xét nghiệm sang máy khác phải tự gỡ nó khỏi Panel của máy cũ. Nếu
// không, chính thao tác sửa xét nghiệm sẽ tạo ra
// Panel chứa xét nghiệm khác máy — trạng thái mà savePanel vốn từ chối.
const instrumentB = h.saveInstrument({ data: { name: 'Máy B' } }, actor).data;
const duplicateAnalyte = h.saveTest({ data: { name: 'GLU', instrumentId: instrument.id, teaRefKey: 'qclab-glucose' } }, actor);
assert.equal(duplicateAnalyte.ok, false, 'cùng analyte trên cùng máy phải bị chặn');
assert.equal(duplicateAnalyte.error.code, 'duplicate-name');
const sameAnalyteOtherMachine = h.saveTest({ data: { name: 'Glucose', instrumentId: instrumentB.id, teaRefKey: 'qclab-glucose' } }, actor);
assert.equal(sameAnalyteOtherMachine.ok, true, 'cùng xét nghiệm trên máy khác phải được phép');
h.removeTest({ id: sameAnalyteOtherMachine.data.id }, actor);
const movedTest = h.saveTest({ id: test1.id, data: { name: 'Glucose', instrumentId: instrumentB.id, teaRefKey: 'qclab-glucose' } }, actor);
assert.equal(movedTest.ok, true);
assert.deepEqual(h.listPanels().find((p) => p.id === panel.data.id).testIds, [], 'đổi máy phải gỡ liên kết Panel sai máy');
// Đổi về máy cũ không được tự ý khôi phục liên kết đã gỡ; người dùng phải
// chủ động thêm lại xét nghiệm vào Panel.
h.saveTest({ id: test1.id, data: { name: 'Glucose', instrumentId: instrument.id, teaRefKey: 'qclab-glucose' } }, actor);
assert.deepEqual(h.listPanels().find((p) => p.id === panel.data.id).testIds, []);
const restoredPanel = h.savePanel({ id: panel.data.id, data: { name: 'Panel A', instrumentId: instrument.id, testIds: [test1.id] } }, actor);
assert.equal(restoredPanel.ok, true);

// ---- Chuyển tiếp lô ----
const transitionSameLot = h.createLotTransition({ data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot1.data.id } }, actor);
assert.equal(transitionSameLot.ok, false);
assert.equal(transitionSameLot.error.code, 'same-lot');

const transition = h.createLotTransition({ data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id, startDate: '2026-06-01' } }, actor);
assert.equal(transition.ok, true);
assert.equal(transition.data.status, 'planned');

// Trùng hồ sơ (cùng Panel + cùng cặp lô) bị chặn.
const dup = h.createLotTransition({ data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id } }, actor);
assert.equal(dup.ok, false);
assert.equal(dup.error.code, 'duplicate-transition');

// MỘT hàm lưu duy nhất (2026-09-03): status đi kèm cùng lần
// gọi createLotTransition, không phải hàm riêng — modal chỉ có 1 nút Lưu.
const activate = h.createLotTransition({ id: transition.data.id, data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id, startDate: '2026-06-01', status: 'active' } }, actor);
assert.equal(activate.ok, true);
assert.equal(activate.data.status, 'active');

// Panel này không có xét nghiệm nào đang dùng lô cũ (lot1) → "Chấp nhận" bị
// chặn ngay ở cổng acceptanceGate, không đụng gì tới hồ sơ.
const noTargets = h.createLotTransition({ id: transition.data.id, data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id, startDate: '2026-06-01', status: 'accepted' } }, actor);
assert.equal(noTargets.ok, false);
assert.equal(noTargets.error.code, 'no-target-tests');
assert.equal(h.listLotTransitions().find(t => t.id === transition.data.id).status, 'active', 'bi chan thi khong duoc doi status');

// test1 giờ dùng lot1 ở mức 1 — "Chấp nhận" thiếu Mean/SD ứng viên bị chặn,
// nêu đúng tên xét nghiệm còn thiếu.
h.saveTestLevel({ testId: test1.id, data: { level: 1, mean: 90, sd: 2, qcLotId: lot1.data.id } }, actor);
const missingTarget = h.createLotTransition({ id: transition.data.id, data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id, startDate: '2026-06-01', status: 'accepted' } }, actor);
assert.equal(missingTarget.ok, false);
assert.equal(missingTarget.error.code, 'missing-target');
assert.match(missingTarget.error.message, /Glucose/);

// Chấp nhận (kèm Mean/SD ứng viên hợp lệ) — chuyển trạng thái, ghi nhận
// người/ngày duyệt, áp Mean/SD vào test_levels, đánh dấu lô cũ hết dùng.
const accept = h.createLotTransition({ id: transition.data.id, data: {
  panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id, startDate: '2026-06-01', status: 'accepted',
  criteria: [{ testId: test1.id, level: 1, mean: 100, sd: 3 }],
} }, actor);
assert.equal(accept.ok, true);
assert.equal(accept.data.status, 'accepted');
assert.ok(accept.data.approved_at);
assert.equal(accept.data.approved_by, 'admin');
const level1AfterAccept = h.listTestLevels(test1.id).find(l => l.level === 1);
assert.equal(level1AfterAccept.qc_lot_id, lot3.id);
assert.equal(level1AfterAccept.mean, 100); assert.equal(level1AfterAccept.sd, 3);
assert.equal(h.listLots().find(l => l.id === lot1.data.id).depleted, 1);

// Đã chấp nhận thì không đổi status khác 'accepted' được nữa.
const afterDecided = h.createLotTransition({ id: transition.data.id, data: { panelId: panel.data.id, fromLotId: lot1.data.id, toLotId: lot3.id, status: 'rejected' } }, actor);
assert.equal(afterDecided.ok, false);
assert.equal(afterDecided.error.code, 'accepted-immutable');

// ---- TEa tham chiếu ----
const teaMissing = h.saveTeaRef({ data: { name: 'Glucose' } }, actor);
assert.equal(teaMissing.ok, false);
assert.equal(teaMissing.error.code, 'invalid-value');

const tea = h.saveTeaRef({
  data: {
    name: 'Glucose', labValue: 10, labSource: 'regulation', reference: 'CLIA 2024 final rule',
    reason: 'Áp dụng theo quy định mới nhất của CLIA', effectiveDate: '2026-01-01',
    approvedDate: '2025-12-15', nextReviewDate: '2027-01-01', preparedBy: 'KTV A', approvedBy: 'Trưởng khoa B',
  },
}, actor);
assert.equal(tea.ok, true);
assert.equal(tea.data.lab, 10);
assert.equal(h.listTeaRefs().length, 1);

const teaRemoved = h.removeTeaRef({ id: tea.data.id }, actor);
assert.equal(teaRemoved.ok, true);
assert.equal(h.listTeaRefs().length, 0);

// ---- Phạm vi luật Westgard theo xét nghiệm ----
const scopes1 = h.listRuleScopes(test1.id, 1);
assert.ok(scopes1.some(s => s.id === '1-3s'));
const saveScope = h.saveRuleScope(test1.id, '2-2s', 'across', actor);
assert.equal(saveScope.ok, true);
const scopesAfter = h.listRuleScopes(test1.id, 1);
assert.equal(scopesAfter.find(s => s.id === '2-2s').scope, 'across');
const clearScope = h.saveRuleScope(test1.id, '2-2s', '', actor);
assert.equal(clearScope.ok, true);
const storedScopes = JSON.parse(db.prepare('SELECT rule_scopes_json FROM tests WHERE id=?').get(test1.id).rule_scopes_json);
assert.equal(Object.hasOwn(storedScopes, '2-2s'), false, 'chon SOP khuyen nghi phai xoa ghi de scope');

const invalidScope = h.saveRuleScope(test1.id, '2-2s', 'khong-hop-le', actor);
assert.equal(invalidScope.ok, false);
assert.equal(invalidScope.error.code, 'invalid-scope');
const impossibleChannel = h.saveRuleScope(test1.id, '1-3s', 'across', actor);
assert.equal(impossibleChannel.ok, false);
assert.equal(impossibleChannel.error.code, 'invalid-scope');
const impossibleR4sChannel = h.saveRuleScope(test1.id, 'R4s', 'within', actor);
assert.equal(impossibleR4sChannel.ok, false);
assert.equal(impossibleR4sChannel.error.code, 'invalid-scope');

const invalidRule = h.saveRuleScope(test1.id, 'khong-ton-tai', 'across', actor);
assert.equal(invalidRule.ok, false);
assert.equal(invalidRule.error.code, 'invalid-rule');

// Backup/dữ liệu cũ có thể chứa `protocol` hoặc chuỗi lạ: cả hai phải rơi
// về SOP mặc định, không được lọt thành scope thứ tư vào engine.
db.prepare('UPDATE tests SET rule_scopes_json=? WHERE id=?').run(JSON.stringify({ '2-2s': 'protocol', '1-3s': 'sai', 'luat-gia': 'both' }), test1.id);
const sanitizedScopes = h.listRuleScopes(test1.id, 2);
assert.equal(sanitizedScopes.find(s => s.id === '2-2s').scope, 'both');
assert.equal(sanitizedScopes.find(s => s.id === '1-3s').scope, 'within');

// Hai ô "để trống" của modal Sửa xét nghiệm phải NÓI RA giá trị thật mà chúng
// rơi về. Bất biến sống còn: `defaultScope`/`defaultAction` là giá trị KHI
// KHÔNG có ghi đè riêng — ghi đè của chính xét nghiệm không được che mất nó,
// nếu không nhãn sẽ lặp lại đúng thứ người dùng vừa chọn và vô nghĩa.
db.prepare('UPDATE tests SET rule_scopes_json=?, rule_actions_json=? WHERE id=?')
  .run(JSON.stringify({ '6x': 'within' }), JSON.stringify({ '6x': 'alert' }), test1.id);
const hints = h.listRuleScopes(test1.id, 2);
const hint6x = hints.find(r => r.id === '6x');
assert.equal(hint6x.scope, 'within', 'scope hieu luc phai theo ghi de rieng');
assert.equal(hint6x.defaultScope, 'both', 'defaultScope la chuan cua ho dem chuoi, khong phai ghi de');
assert.equal(hint6x.action, 'alert', 'action hieu luc phai theo ghi de rieng');
assert.equal(hint6x.defaultAction, 'reject', 'defaultAction la muc do chuan, khong phai ghi de');

// Không truyền số mức: main tự đếm mức đang vận hành, không nhận từ renderer.
const selfCounted = h.listRuleScopes(test1.id);
assert.equal(selfCounted.length, hints.length, 'goi khong tham so van tra du danh sach luat');
assert.ok(selfCounted.every(r => r.defaultScope && r.defaultAction), 'moi luat phai co day du hai gia tri mac dinh');
db.prepare('UPDATE tests SET rule_scopes_json=?, rule_actions_json=? WHERE id=?').run('{}', '{}', test1.id);

console.log('app config-lots-handlers end-to-end tests passed');

