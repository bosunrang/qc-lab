const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const actions = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'manage-tests-actions.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'manage-routes.js'), 'utf8');
const records = [
  ['Panel QC','Panel QC'],
  ['hồ sơ chuyển lô','hồ sơ chuyển lô'],
  ['nhóm lô','nhóm lô'],
  ['thông tin lô QC','lô QC'],
  ['máy xét nghiệm','máy xét nghiệm'],
  ['xét nghiệm','xét nghiệm'],
];

records.forEach(([editName,addName])=>{
  assert.ok(actions.includes(`${'${'}id?'Sửa ${editName}':'Thêm ${addName}'}`), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);
  assert.ok(actions.includes(`btn(id?'Lưu thay đổi':'Thêm ${addName}'`), `nút ${addName} phải dùng Thêm khi tạo và Lưu thay đổi khi sửa`);
});
['Lưu Panel QC','Lưu hồ sơ','Lưu nhóm lô','Lưu lô','Lưu máy xét nghiệm'].forEach(label=>assert.equal(actions.includes(`btn('${label}'`),false,`không dùng nhãn tĩnh “${label}” trong popup CRUD`));
['Thêm lô QC','Thêm nhóm lô','Thêm máy xét nghiệm','Thêm Panel QC','Thêm hồ sơ chuyển lô','Thêm xét nghiệm'].forEach(label=>assert.ok(routes.includes(`'${label}'`),`toolbar phải dùng “${label}”`));
assert.ok(routes.includes(`title:hasProfile?'Sửa hồ sơ TEa chuẩn hóa':'Thêm hồ sơ TEa chuẩn hóa'`),'hồ sơ TEa phải phân biệt Thêm/Sửa');
assert.ok(routes.includes(`btn(hasProfile?'Lưu thay đổi':'Thêm hồ sơ TEa'`),'nút hồ sơ TEa phải phân biệt Thêm/Lưu thay đổi');
assert.doesNotMatch(actions,/Các trường có dấu/,'popup xét nghiệm không cần lặp lại chú thích dấu sao bắt buộc');
console.log('Manage CRUD label convention tests passed');
