// Ngăn xếp lớp phủ và quyết định đóng modal (U3, U7 của đánh giá 2026-10-31).
// Logic THUẦN nên test thẳng trên `.ts` qua ESM type-stripping, cùng cách
// `modal-enter.test.mjs` làm. Hành vi trên app thật ở `e2e/modal-ux.e2e.mjs`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LayerStack, escapeTargetsLayer } from '../renderer/lib/layer-stack.ts';
import { decideModalClose } from '../renderer/lib/modal-close.ts';

test('Esc chỉ đến lớp trên cùng; gỡ lớp trên thì lớp dưới nhận lại', () => {
  const stack = new LayerStack();
  const closed = [];
  const modal = stack.push(() => closed.push('modal'));
  const picker = stack.push(() => closed.push('picker'));
  assert.equal(stack.isTop(picker), true);
  assert.equal(stack.isTop(modal), false);
  assert.equal(stack.escape(), true);
  assert.deepEqual(closed, ['picker'], 'Esc khi lịch đang mở chỉ đóng lịch');
  stack.remove(picker);
  assert.equal(stack.isTop(modal), true);
  stack.escape();
  assert.deepEqual(closed, ['picker', 'modal']);
  stack.remove(modal);
  assert.equal(stack.escape(), false, 'không còn lớp nào thì không xử lý');
});

test('gỡ một lớp ở giữa không làm lệch lớp trên cùng', () => {
  const stack = new LayerStack();
  const below = stack.push(() => {});
  const middle = stack.push(() => {});
  const top = stack.push(() => {});
  stack.remove(middle);
  assert.equal(stack.isTop(top), true);
  stack.remove(top);
  assert.equal(stack.isTop(below), true);
});

test('Esc bị bỏ qua khi ô bên trong đã xử lý, khi đang gõ dấu, hoặc khi danh sách select đang mở', () => {
  const esc = (extra = {}) => ({ key: 'Escape', defaultPrevented: false, isComposing: false, target: { tagName: 'INPUT' }, ...extra });
  assert.equal(escapeTargetsLayer(esc()), true);
  assert.equal(escapeTargetsLayer(esc({ key: 'Enter' })), false);
  assert.equal(escapeTargetsLayer(esc({ defaultPrevented: true })), false, 'danh sách gợi ý tên xét nghiệm tự đóng');
  assert.equal(escapeTargetsLayer(esc({ isComposing: true })), false);
  assert.equal(escapeTargetsLayer(esc({ target: { tagName: 'OPTION' } })), false);
  assert.equal(escapeTargetsLayer(esc({ target: null })), true);
});

test('đóng modal: đang lưu thì bỏ qua, đã sửa thì hỏi, còn lại đóng ngay', () => {
  assert.equal(decideModalClose({ busy: false, dirty: false, guarded: true }), 'close');
  assert.equal(decideModalClose({ busy: false, dirty: true, guarded: true }), 'confirm');
  assert.equal(decideModalClose({ busy: false, dirty: true, guarded: false }), 'close', 'modal chỉ để xem không hỏi');
  assert.equal(decideModalClose({ busy: true, dirty: false, guarded: true }), 'ignore');
  assert.equal(decideModalClose({ busy: true, dirty: true, guarded: false }), 'ignore', 'đang lưu thì không đóng dù không hỏi');
});
