const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const actions = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-tests-actions-controller.ts'), 'utf8');
const transitionPresentation = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'lot-transition-modal-html.ts'), 'utf8');
const assayPresentation = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'config-assay-modal-html.ts'), 'utf8');
// Máy xét nghiệm/lô QC (Giai đoạn 3) đã chuyển sang component React thật — không còn
// modal-html.ts/chuỗi "title: id ? ..." trong manage-tests-actions-controller.ts nữa,
// nên nhánh riêng bên dưới đọc thẳng JSX của InstrumentModal.tsx/LotModal.tsx.
const instrumentModal = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'modals', 'InstrumentModal.tsx'), 'utf8');
const lotModal = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'modals', 'LotModal.tsx'), 'utf8');
const panelModal = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'modals', 'PanelModal.tsx'), 'utf8');
const lotGroupModal = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'modals', 'LotGroupModal.tsx'), 'utf8');
const teaLabProfileModal = fs.readFileSync(path.join(__dirname, '..', 'src', 'react', 'modals', 'TeaLabProfileModal.tsx'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-page-controller.ts'), 'utf8');
const records = [
  ['Panel QC','Panel QC'],
  ['hồ sơ chuyển lô','hồ sơ chuyển lô'],
  ['nhóm lô','nhóm lô'],
  ['thông tin lô QC','lô QC'],
  ['máy xét nghiệm','máy xét nghiệm'],
  ['xét nghiệm','xét nghiệm'],
];

records.forEach(([editName,addName])=>{
  if(addName==='Panel QC'){assert.ok(panelModal.includes(`{id ? 'Sửa ${editName}' : 'Thêm ${addName}'}`), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);assert.ok(panelModal.includes(`{id ? 'Lưu thay đổi' : 'Thêm ${addName}'}`), `nút ${addName} phải dùng Thêm khi tạo và Lưu thay đổi khi sửa`);return;}
  else if(addName==='hồ sơ chuyển lô')assert.ok(actions.includes(`title: id ? 'Sửa ${editName}' : 'Thêm ${addName}'`)&&transitionPresentation.includes('${input.title}'), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);
  else if(addName==='nhóm lô'){assert.ok(lotGroupModal.includes(`{id ? 'Sửa ${editName}' : 'Thêm ${addName}'}`), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);assert.ok(lotGroupModal.includes(`{id ? 'Lưu thay đổi' : 'Thêm ${addName}'}`), `nút ${addName} phải dùng Thêm khi tạo và Lưu thay đổi khi sửa`);return;}
  else if(addName==='lô QC'){assert.ok(lotModal.includes(`{id ? 'Sửa ${editName}' : 'Thêm ${addName}'}`), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);assert.ok(lotModal.includes(`{id ? 'Lưu thay đổi' : 'Thêm ${addName}'}`), `nút ${addName} phải dùng Thêm khi tạo và Lưu thay đổi khi sửa`);return;}
  else if(addName==='máy xét nghiệm'){assert.ok(instrumentModal.includes(`{id ? 'Sửa ${editName}' : 'Thêm ${addName}'}`), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);assert.ok(instrumentModal.includes(`{id ? 'Lưu thay đổi' : 'Thêm ${addName}'}`), `nút ${addName} phải dùng Thêm khi tạo và Lưu thay đổi khi sửa`);return;}
  else if(addName==='xét nghiệm')assert.ok(actions.includes(`title: id ? 'Sửa ${editName}' : 'Thêm ${addName}'`)&&assayPresentation.includes('${input.title}'), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);
  else assert.ok(actions.includes(`${'${'}id ? 'Sửa ${editName}' : 'Thêm ${addName}'}`), `tiêu đề ${addName} phải phân biệt Thêm/Sửa`);
  assert.ok(actions.includes(`btn(id ? 'Lưu thay đổi' : 'Thêm ${addName}'`), `nút ${addName} phải dùng Thêm khi tạo và Lưu thay đổi khi sửa`);
});
['Lưu Panel QC','Lưu hồ sơ','Lưu nhóm lô','Lưu lô','Lưu máy xét nghiệm'].forEach(label=>assert.equal(actions.includes(`btn('${label}'`),false,`không dùng nhãn tĩnh “${label}” trong popup CRUD`));
['Thêm lô QC','Thêm nhóm lô','Thêm máy xét nghiệm','Thêm Panel QC','Thêm hồ sơ chuyển lô','Thêm xét nghiệm'].forEach(label=>assert.ok(routes.includes(`'${label}'`),`toolbar phải dùng “${label}”`));
assert.ok(routes.includes(`title: hasProfile ? 'Sửa hồ sơ TEa chuẩn hóa' : 'Thêm hồ sơ TEa chuẩn hóa'`),'hồ sơ TEa phải phân biệt Thêm/Sửa');
assert.ok(teaLabProfileModal.includes(`{hasProfile ? 'Lưu thay đổi' : 'Thêm hồ sơ TEa'}`),'nút hồ sơ TEa phải phân biệt Thêm/Lưu thay đổi');
assert.doesNotMatch(actions,/Các trường có dấu/,'popup xét nghiệm không cần lặp lại chú thích dấu sao bắt buộc');
console.log('Manage CRUD label convention tests passed');
