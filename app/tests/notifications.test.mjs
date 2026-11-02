// Thông báo (U8 của đánh giá 2026-10-31): lưu thành công là dòng tự tắt, lỗi là
// hộp thoại kiểu `error`. Logic thuần, test thẳng trên `.ts` như modal-layers.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { dismissToast, showToast, toastDuration, toastStore } from '../renderer/state/toast-store.ts';
import { closeDialog, dialogStore, errorDialog } from '../renderer/state/dialog-store.ts';

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

test('errorDialog mở hộp thoại kiểu lỗi, giữ tiêu đề', () => {
  void errorDialog('Tên máy xét nghiệm này đã tồn tại.', { title: 'Chưa lưu được' });
  const dialog = dialogStore.getState().dialog;
  assert.equal(dialog.kind, 'info');
  assert.deepEqual(dialog.opts, { title: 'Chưa lưu được', type: 'error' });
  closeDialog();
});
