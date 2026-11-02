// Chỉ ra ô sai khi lưu biểu mẫu thất bại (U7 của đánh giá 2026-10-31).
// Logic THUẦN nên test thẳng trên `.ts` qua ESM type-stripping, cùng cách
// `modal-layers.test.mjs` làm. Hành vi trên app thật ở `e2e/modal-ux.e2e.mjs`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addIdToken, formError, formErrorFrom, markInvalidField, pickField, removeIdToken,
} from '../renderer/lib/field-error.ts';

const MAP = { 'missing-name': 'name', 'duplicate-name': 'name', 'missing-dates': ['effectiveDate', 'approvedDate'] };

test('mã lỗi IPC → ô ứng viên; mã không có trong bảng là lỗi chung', () => {
  assert.deepEqual(formErrorFrom({ code: 'duplicate-name', message: 'Trùng tên' }, MAP), { message: 'Trùng tên', fields: ['name'] });
  assert.deepEqual(formErrorFrom({ code: 'missing-dates', message: 'Thiếu ngày' }, MAP).fields, ['effectiveDate', 'approvedDate']);
  assert.deepEqual(formErrorFrom({ code: 'not-found', message: 'Không thấy' }, MAP).fields, []);
  assert.deepEqual(formErrorFrom({ message: 'Không mã' }, MAP).fields, []);
  // Khoá kế thừa từ Object.prototype không được coi là mã lỗi.
  assert.deepEqual(formErrorFrom({ code: 'toString', message: 'x' }, MAP).fields, []);
  assert.deepEqual(formError('Chọn máy', 'instrumentIds'), { message: 'Chọn máy', fields: ['instrumentIds'] });
  assert.deepEqual(formError('Lỗi chung').fields, []);
});

test('mỗi lần lưu thất bại là một lỗi mới, kể cả cùng câu', () => {
  const first = formErrorFrom({ code: 'missing-name', message: 'Nhập tên' }, MAP);
  const second = formErrorFrom({ code: 'missing-name', message: 'Nhập tên' }, MAP);
  assert.notEqual(first, second, 'đối tượng khác nhau thì hook đánh dấu và focus lại');
});

test('chọn ô còn trống đầu tiên, bỏ ô form không có', () => {
  const values = { effectiveDate: '01/11/2026', approvedDate: '  ', preparedBy: 'A' };
  const valueOf = (name) => (name in values ? values[name] : null);
  assert.equal(pickField(['effectiveDate', 'approvedDate'], valueOf), 'approvedDate');
  assert.equal(pickField(['preparedBy', 'effectiveDate'], valueOf), 'preparedBy', 'không ô nào trống thì lấy ô đầu');
  assert.equal(pickField(['missing', 'effectiveDate'], valueOf), 'effectiveDate', 'ô không có trong form bị bỏ qua');
  assert.equal(pickField(['missing'], valueOf), null);
  assert.equal(pickField([], valueOf), null);
});

test('thêm/bớt id trong aria-describedby giữ mô tả sẵn có', () => {
  assert.equal(addIdToken(null, 'err'), 'err');
  assert.equal(addIdToken('hint', 'err'), 'hint err');
  assert.equal(addIdToken('hint err', 'err'), 'hint err', 'không thêm trùng');
  assert.equal(removeIdToken('hint err', 'err'), 'hint');
  assert.equal(removeIdToken('err', 'err'), null, 'rỗng thì gỡ hẳn thuộc tính');
  assert.equal(removeIdToken(null, 'err'), null);
});

/** Ô nhập giả: đủ các phương thức `markInvalidField` dùng. */
function fakeControl(attrs = {}) {
  const listeners = new Map();
  return {
    attrs: { ...attrs }, focused: 0,
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) || []), fn]); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter((item) => item !== fn)); },
    focus() { this.focused += 1; },
    fire(type) { for (const fn of listeners.get(type) || []) fn(); },
    listenerCount() { return [...listeners.values()].reduce((sum, list) => sum + list.length, 0); },
  };
}

test('đánh dấu ô: aria-invalid, nối dòng lỗi, focus; sửa ô thì tự gỡ', () => {
  const control = fakeControl({ 'aria-describedby': 'hint' });
  markInvalidField(control, 'err-1');
  assert.equal(control.attrs['aria-invalid'], 'true');
  assert.equal(control.attrs['aria-describedby'], 'hint err-1');
  assert.equal(control.focused, 1);
  control.fire('input');
  assert.equal(control.attrs['aria-invalid'], undefined);
  assert.equal(control.attrs['aria-describedby'], 'hint', 'mô tả sẵn có được giữ lại');
  assert.equal(control.listenerCount(), 0, 'gỡ dấu thì gỡ luôn bộ lắng nghe');
});

test('lỗi đổi hoặc mất: hàm gỡ trả ô về như cũ, gọi lại vẫn an toàn', () => {
  const control = fakeControl();
  const unmark = markInvalidField(control, 'err-2');
  unmark();
  assert.deepEqual(control.attrs, {});
  control.setAttribute('aria-describedby', 'other');
  unmark();
  assert.equal(control.attrs['aria-describedby'], 'other', 'gọi lần hai không đụng vào ô nữa');
  // Chọn ngày trên lịch (`DateField`) cũng tính là sửa ô.
  const date = fakeControl();
  markInvalidField(date, 'err-3');
  date.fire('qc-field-edit');
  assert.equal(date.attrs['aria-invalid'], undefined);
});

test('không có dòng lỗi để nối thì chỉ đánh dấu và focus', () => {
  const control = fakeControl();
  markInvalidField(control, '');
  assert.deepEqual(control.attrs, { 'aria-invalid': 'true' });
  control.fire('change');
  assert.deepEqual(control.attrs, {});
});
