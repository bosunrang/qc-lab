// Máy trạng thái và quyền của hồ sơ NCE mới (docs/NCE-REDESIGN-2026-10-12.md
// mục 4, D-09, D-10). Ca nghiệm thu 9, 10, 12.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dossier } from './helpers/nce-fixture.mjs';
const require = createRequire(import.meta.url);

const { nextNceStatus, canDoNceOperation } = require('../../app-dist/main/domain/nce/state.js');
const {
  parseNceCapabilities, hasNceCapability, canReleaseNce, canSubmitNce, canCancelNce, canApproveNce, nceParticipantRoles,
} = require('../../app-dist/main/domain/nce/permissions.js');

test('chỉ các chuyển trạng thái trong sơ đồ là hợp lệ', () => {
  assert.equal(nextNceStatus('open', 'release'), 'released');
  assert.equal(nextNceStatus('released', 'submit'), 'pending_approval');
  assert.equal(nextNceStatus('pending_approval', 'approve'), 'closed');
  assert.equal(nextNceStatus('pending_approval', 'return'), 'released');
  assert.equal(nextNceStatus('open', 'cancel'), 'cancelled');
  assert.equal(nextNceStatus('open', 'submit'), null, 'chưa cho chạy lại thì chưa nộp duyệt');
  assert.equal(nextNceStatus('released', 'approve'), null);
  assert.equal(nextNceStatus('closed', 'return'), null, 'hồ sơ đã đóng là bất biến');
});

test('ca 12: hồ sơ đã cho chạy lại không hủy được', () => {
  for (const status of ['released', 'pending_approval', 'closed', 'cancelled']) assert.equal(nextNceStatus(status, 'cancel'), null, status);
});

test('thao tác sửa theo trạng thái', () => {
  assert.equal(canDoNceOperation('open', 'attachRun'), true);
  assert.equal(canDoNceOperation('released', 'attachRun'), false, 'sau mốc cắt, lần hỏng mới là sự kiện mới');
  assert.equal(canDoNceOperation('open', 'reviewEffectiveness'), false, 'chưa chạy lại thì chưa đánh giá hiệu lực');
  assert.equal(canDoNceOperation('released', 'reviewEffectiveness'), true);
  assert.equal(canDoNceOperation('released', 'recordPatientImpact'), true, 'thông tin kết quả đã trả có thể đến muộn');
  for (const op of ['update', 'addAction', 'completeAction', 'recordPatientImpact']) {
    assert.equal(canDoNceOperation('pending_approval', op), false, `chờ duyệt khóa ${op}`);
    assert.equal(canDoNceOperation('closed', op), false, `đã đóng khóa ${op}`);
  }
});

test('capability đọc từ JSON, mã lạ bị bỏ, JSON hỏng là không có quyền', () => {
  assert.deepEqual(parseNceCapabilities('["nce.approve","nce.approve","admin.all"]'), ['nce.approve']);
  assert.deepEqual(parseNceCapabilities('{hỏng'), []);
  assert.deepEqual(parseNceCapabilities(null), []);
});

test('ca 9: KTV không có capability bị chặn; quản trị viên mặc nhiên có quyền', () => {
  const tech = { userId: 'u1', role: 'technician', capabilities: [] };
  assert.equal(canReleaseNce(tech).ok, false);
  assert.equal(canApproveNce(tech, dossier()).ok, false);
  assert.equal(canReleaseNce({ ...tech, capabilities: ['nce.release'] }).ok, true);
  assert.equal(hasNceCapability({ userId: 'a', role: 'admin' }, 'nce.approve'), true);
  // Người chỉ xem không bao giờ có capability ghi, kể cả khi dữ liệu lỡ ghi.
  assert.equal(hasNceCapability({ userId: 'v', role: 'viewer', capabilities: ['nce.approve'] }, 'nce.approve'), false);
});

test('ca 10: mọi người đã tham gia hồ sơ đều không được duyệt', () => {
  const d = dossier({ status: 'pending_approval' });
  const approver = (userId) => ({ userId, role: 'technician', capabilities: ['nce.approve'] });
  for (const [userId, role] of [['u-reporter', 'người báo cáo'], ['u-owner', 'người phụ trách'], ['u-releaser', 'người cho chạy lại'], ['u-tech', 'người hoàn thành hành động'], ['u-reviewer', 'người đánh giá hiệu lực']]) {
    const result = canApproveNce(approver(userId), d);
    assert.equal(result.ok, false, userId);
    assert.equal(result.code, 'not-independent');
    assert.match(result.message, new RegExp(role));
  }
  assert.equal(canApproveNce(approver('u-independent'), d).ok, true);
  // Quản trị viên cũng phải độc lập.
  assert.equal(canApproveNce({ userId: 'u-owner', role: 'admin' }, d).ok, false);
});

test('người làm một hành động đã hủy không bị coi là đã tham gia', () => {
  const d = dossier({ actions: [{ ...dossier().actions[0], status: 'cancelled', doneByUserId: 'u-x' }] });
  assert.deepEqual(nceParticipantRoles('u-x', d), []);
});

test('ngoại lệ phân tách nhiệm vụ chỉ dùng được khi bật và có mã SOP', () => {
  const d = dossier({ status: 'pending_approval' });
  const owner = { userId: 'u-owner', role: 'admin' };
  assert.equal(canApproveNce(owner, d, { enabled: true, sopRef: '' }).ok, false);
  const result = canApproveNce(owner, d, { enabled: true, sopRef: 'SOP-QM-02' });
  assert.equal(result.ok, true);
  assert.equal(result.usedException, true);
  assert.deepEqual(result.conflicts, ['người phụ trách']);
});

test('nộp duyệt và hủy theo vai trò trong hồ sơ', () => {
  const d = dossier({ status: 'open' });
  const tech = (userId) => ({ userId, role: 'technician', capabilities: [] });
  assert.equal(canSubmitNce(tech('u-owner'), d).ok, true);
  assert.equal(canSubmitNce(tech('u-reporter'), d).ok, true);
  assert.equal(canSubmitNce(tech('u-other'), d).ok, false);
  assert.equal(canCancelNce(tech('u-other'), d).ok, false);
  assert.equal(canCancelNce({ userId: 'u-other', role: 'technician', capabilities: ['nce.approve'] }, d).ok, true);
  assert.equal(canSubmitNce({ userId: 'u-owner', role: 'viewer' }, d).ok, false, 'người chỉ xem không ghi được');
});
