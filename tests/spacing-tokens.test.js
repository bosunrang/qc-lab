const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const assets=path.join(root,'assets');
const tokens=fs.readFileSync(path.join(assets,'tokens.css'),'utf8');
const components=fs.readFileSync(path.join(assets,'components.css'),'utf8').replace(/\s+/g,'');
['space-2xs','space-xs','space-sm','space-md','space-lg','space-section','space-panel','space-modal','space-xl','space-2xl','panel-inline-padding','modal-inline-padding','table-cell-block-padding','table-cell-inline-padding'].forEach(name=>assert.match(tokens,new RegExp(`--${name}\\s*:`),`Thiếu token khoảng cách --${name}`));
assert.match(tokens,/--panel-content-gap\s*:\s*var\(--space-section\)\s*;/,'Khoảng cách nội dung panel phải lấy từ thang spacing');
assert.ok(components.includes('.modal-b{padding:var(--panel-content-gap)var(--modal-inline-padding);'),'Nội dung modal phải dùng spacing token');
assert.ok(components.includes('.modal-f{padding:var(--space-lg)var(--modal-inline-padding);'),'Footer modal phải dùng spacing token');
assert.ok(components.includes('th,td{text-align:left;padding:var(--table-cell-block-padding)var(--table-cell-inline-padding);'),'Ô bảng phải dùng spacing token');
assert.ok(components.includes('.field-error{display:none;color:var(--danger-ink);margin-top:var(--space-xs)}'),'Lỗi biểu mẫu phải dùng component chung');
assert.ok(components.includes('.sr-only{position:absolute!important;'),'Nội dung hỗ trợ trình đọc màn hình phải dùng component chung');

assert.ok(components.includes('.auth-actions{display:grid;gap:var(--space-sm);margin-top:var(--space-panel)}'),'Nút xác thực phải dùng nhóm action và spacing token chung');

const excluded=new Set(['reports.js']);
const violations=[];
for(const name of fs.readdirSync(path.join(assets,'modules'))){
  if(!name.endsWith('.js')||excluded.has(name))continue;
  const source=fs.readFileSync(path.join(assets,'modules',name),'utf8');
  source.split(/\r?\n/).forEach((line,index)=>{
    if(/style="[^"]*margin-(?:top|bottom):\d+px/.test(line)||/style="[^"]*clip:rect\(0,0,0,0\)/.test(line))violations.push(`${name}:${index+1}`);
  });
}
assert.deepStrictEqual(violations,[],`Spacing tĩnh và sr-only phải dùng class chung, còn inline tại:\n${violations.join('\n')}`);
const usersAuth=fs.readFileSync(path.join(assets,'modules','users-auth.js'),'utf8');
const manageActions=fs.readFileSync(path.join(assets,'modules','manage-tests-actions.js'),'utf8');
const reports=fs.readFileSync(path.join(assets,'modules','reports.js'),'utf8');
assert.doesNotMatch(usersAuth,/\bstyle\s*=/,'Màn hình xác thực/audit không được quay lại inline style');
assert.doesNotMatch(manageActions,/\bstyle\s*=/,'Popup cấu hình không được quay lại inline style');
assert.doesNotMatch(reports,/style="(?:margin|padding|width|align-self)|<col\s+style=/,'Báo cáo in phải dùng class cho khoảng cách và độ rộng tĩnh');
console.log('Spacing token convention tests passed');
