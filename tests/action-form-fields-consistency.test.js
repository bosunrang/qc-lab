'use strict';
// Quét mã nguồn (cùng kiểu tests/westgard-rule-registry.test.js): ACT_FIELDS trong
// action-form-controller.ts phục vụ BA việc — dựng giá trị ban đầu của form, giữ nội
// dung đang gõ qua rerender() (captureActionDraft() lặp qua toàn bộ mảng nên luôn tự
// đúng), và ĐỌC LẠI để lưu (readActionProtocolForm()/addAction() đọc từng ô một, tay
// viết riêng, không lặp qua ACT_FIELDS). Nếu ai thêm một ô mới vào ACT_FIELDS (để nó
// được giữ nội dung khi rerender) nhưng quên đọc ô đó khi lưu, người dùng gõ xong vẫn
// thấy chữ trên màn hình (nhờ ACT_FIELDS) nhưng bấm lưu thì giá trị lặng lẽ biến mất —
// không lỗi console, không cảnh báo. Không kịch bản nce-check nào hiện có đi qua đủ
// 49 trường để lộ ra một trường bị bỏ sót đơn lẻ kiểu này.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'actions', 'action-form-controller.ts'), 'utf8');

const fieldsBlock = /const ACT_FIELDS: \[string, string, string\]\[\] = \[([\s\S]*?)\];/.exec(source);
assert.ok(fieldsBlock, 'không tìm thấy khai báo ACT_FIELDS — kiểm tra tên/cấu trúc có đổi không');
const fields = [...fieldsBlock[1].matchAll(/\['([a-zA-Z]+)',\s*'([a-zA-Z]+)',\s*'(text|date|num)'\]/g)].map(m => ({ id: m[1], key: m[2] }));
assert.ok(fields.length >= 40, `chỉ đọc được ${fields.length} trường — regex có thể không còn khớp cấu trúc ACT_FIELDS`);

const readForm = /const readActionProtocolForm[\s\S]*?\}\);/.exec(source);
const addActionFn = /const addAction = async \(\)[\s\S]*?\n  \};/.exec(source);
assert.ok(readForm, 'không tìm thấy readActionProtocolForm()');
assert.ok(addActionFn, 'không tìm thấy addAction()');
const readBody = readForm[0] + '\n' + addActionFn[0];

const missing = fields.filter(f => !readBody.includes(`'${f.id}'`)).map(f => `${f.id} (${f.key})`);
assert.deepEqual(missing, [], `Các trường sau có trong ACT_FIELDS (giữ nội dung khi rerender) nhưng KHÔNG được đọc lại trong readActionProtocolForm()/addAction() khi lưu — người dùng gõ xong bấm lưu sẽ mất trắng giá trị mà không có cảnh báo nào: ${missing.join(', ')}`);

console.log(`Action form field consistency: ${fields.length} trường ACT_FIELDS đều được đọc lại khi lưu`);
