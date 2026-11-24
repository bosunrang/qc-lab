// Thông báo (U8 của đánh giá 2026-10-31): lưu thành công là dòng tự tắt, lỗi là
// hộp thoại kiểu `error`. Logic thuần, test thẳng trên `.ts` như modal-layers.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { dismissToast, showToast, toastDuration, toastStore } from '../renderer/state/toast-store.ts';
import { closeDialog, dialogStore, errorDialog, reportFormError } from '../renderer/state/dialog-store.ts';

test('dòng báo thành công tự tắt, giữ tối đa 3 dòng', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    for (const text of ['Một', 'Hai', 'Ba', 'Bốn']) showToast(`Đã lưu ${text}.`);
    assert.deepEqual(toastStore.getState().toasts.map((t) => t.message), ['Đã lưu Hai.', 'Đã lưu Ba.', 'Đã lưu Bốn.']);
    dismissToast(toastStore.getState().toasts[0].id);
    assert.equal(toastStore.getState().toasts.length, 2, 'bấm ✕ thì đóng ngay');
    mock.timers.tick(4000);
    assert.equal(toastStore.getState().toasts.length, 0, 'câu ngắn tắt sau 4 giây');
  } finally {
    mock.timers.reset();
  }
});

test('thời gian hiện theo độ dài câu, trong khoảng 4–8 giây', () => {
  assert.equal(toastDuration('Đã lưu.'), 4000);
  assert.equal(toastDuration('x'.repeat(100)), 6000);
  assert.equal(toastDuration('x'.repeat(500)), 8000);
});

test('thông báo nhập QC giữ mức cảnh báo và loại bỏ, không hiển thị như lưu thành công', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    showToast('Đã lưu Mức 1.');
    showToast('Mức 1 cảnh báo — 1-2s.', 'warn');
    showToast('Mức 2 vi phạm — 1-3s.', 'rej');
    assert.deepEqual(toastStore.getState().toasts.map((t) => t.kind), ['ok', 'warn', 'rej']);
    mock.timers.tick(8000);
    assert.equal(toastStore.getState().toasts.length, 0);
  } finally { mock.timers.reset(); }
});

test('errorDialog mở hộp thoại kiểu lỗi, giữ tiêu đề', () => {
  void errorDialog('Tên máy xét nghiệm này đã tồn tại.', { title: 'Chưa lưu được' });
  const dialog = dialogStore.getState().dialog;
  assert.equal(dialog.kind, 'info');
  assert.deepEqual(dialog.opts, { title: 'Chưa lưu được', type: 'error' });
  closeDialog();
});

test('lỗi nhập liệu giữ trường cần focus, không mở hộp thoại', async () => {
  const error = { message: 'Vui lòng nhập tên xét nghiệm.', fields: ['name'] };
  let fieldError = null;
  await reportFormError(error, (value) => { fieldError = value; });
  assert.equal(fieldError, error);
  assert.equal(dialogStore.getState().dialog.kind, 'none');
});

test('lỗi thao tác xoá lỗi đầu form và chờ xác nhận hộp thoại hệ thống', async () => {
  let fieldError = { message: 'Lỗi cũ', fields: ['name'] };
  let completed = false;
  const pending = reportFormError({ message: 'Thao tác không được mở qua mạng nội bộ.', fields: [] }, (value) => { fieldError = value; })
    .then(() => { completed = true; });
  assert.equal(fieldError, null);
  const dialog = dialogStore.getState().dialog;
  assert.equal(dialog.kind, 'info');
  assert.deepEqual(dialog.opts, { title: 'Chưa lưu được', type: 'error' });
  assert.equal(dialog.message, 'Thao tác không được mở qua mạng nội bộ.');
  assert.equal(completed, false, 'chưa cho lưu lại trong khi đang đọc lỗi');
  dialog.resolve();
  closeDialog();
  await pending;
  assert.equal(completed, true);
});
