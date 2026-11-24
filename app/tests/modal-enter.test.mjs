// Phím Enter trong modal = bấm nút chính, trừ các trường hợp loại trừ. Logic
// THUẦN nên test thẳng trên `.ts` qua ESM type-stripping, cùng cách
// `entry-sheet-navigation.test.mjs` làm.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modalEnterSubmits } from '../renderer/lib/modal-enter.ts';

const enter = (tagName, extra = {}) => ({
  key: 'Enter', defaultPrevented: false, isComposing: false,
  ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
  target: { tagName, isContentEditable: false }, ...extra,
});

test('Enter trong ô nhập hoặc ô select đang đóng thì lưu', () => {
  assert.equal(modalEnterSubmits(enter('INPUT')), true);
  assert.equal(modalEnterSubmits(enter('SELECT')), true);
});

test('Enter để chọn mục trong danh sách select đang mở không lưu (lỗi từ commit 86b3dbc)', () => {
  // Với `appearance:base-select`, khi danh sách mở thì keydown Enter có
  // target là chính thẻ `option` — đã tái hiện trên Chromium.
  assert.equal(modalEnterSubmits(enter('OPTION')), false);
});

test('Các cổng loại trừ cũ vẫn giữ', () => {
  assert.equal(modalEnterSubmits(enter('TEXTAREA')), false);
  assert.equal(modalEnterSubmits(enter('BUTTON')), false);
  assert.equal(modalEnterSubmits(enter('A')), false);
  assert.equal(modalEnterSubmits(enter('DIV', { target: { tagName: 'DIV', isContentEditable: true } })), false);
  assert.equal(modalEnterSubmits(enter('INPUT', { isComposing: true })), false, 'bộ gõ tiếng Việt đang ghép chữ');
  assert.equal(modalEnterSubmits(enter('INPUT', { defaultPrevented: true })), false);
  assert.equal(modalEnterSubmits(enter('INPUT', { ctrlKey: true })), false);
  assert.equal(modalEnterSubmits(enter('INPUT', { shiftKey: true })), false);
  assert.equal(modalEnterSubmits({ ...enter('INPUT'), key: 'Escape' }), false);
});
