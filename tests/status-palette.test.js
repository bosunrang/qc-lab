const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const assets=path.join(root,'assets');
const tokenFile=path.join(assets,'tokens.css');
const tokenSource=fs.readFileSync(tokenFile,'utf8');
['neutral-ink','neutral-bg','neutral-border','success-ink','success-bg','success-border','success-accent','info-ink','info-bg','info-border','info-accent','danger-ink','danger-bg','danger-border','danger-accent'].forEach(name=>assert.match(tokenSource,new RegExp(`--${name}\\s*:`),`Thiếu token trạng thái --${name}`));
assert.match(tokenSource,/--info-ink\s*:\s*var\(--blue-600\)\s*;/,'Thông tin hướng dẫn phải dùng chữ xanh dương');
assert.match(tokenSource,/--info-bg\s*:\s*var\(--blue-100\)\s*;/,'Thông tin hướng dẫn phải dùng nền xanh dương nhạt');
assert.match(tokenSource,/--info-accent\s*:\s*var\(--blue-500\)\s*;/,'Sọc trái thông tin phải dùng xanh dương');
['success-soft','warning-soft','danger-soft'].forEach(name=>assert.doesNotMatch(tokenSource,new RegExp(`--${name}\\s*:`),`Token trạng thái cũ --${name} phải được xóa`));

function compact(file){return fs.readFileSync(path.join(assets,file),'utf8').replace(/\s+/g,'');}
const components=compact('components.css');
assert.ok(components.includes('.tag.ok{background:var(--success-bg);color:var(--success-ink);border:1pxsolidvar(--success-border);'),'Tag Đạt phải dùng trọn bộ token xanh');
assert.ok(components.includes('.tag.rej{background:var(--danger-bg);color:var(--danger-ink);border:1pxsolidvar(--danger-border);'),'Tag Loại bỏ phải dùng trọn bộ token đỏ');
assert.ok(components.includes('.tag.none{background:var(--neutral-bg);color:var(--neutral-ink);border:1pxsolidvar(--neutral-border);'),'Tag trung tính phải dùng trọn bộ token xám');

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full];});}
const cssFiles=walk(assets).filter(file=>file.endsWith('.css')&&file!==tokenFile);
const legacy=['#b8322a','#b93a32','#c7463d','#c0392b','#9e3b34','#9f3a33','#a52b24','#a63c33','#7d2a23','#e2b0aa','#efc2bd','#f0c3bd','#f0c9c5','#f7e7e5','#f8e4e2','#f8dfdd','#fceceb','#dff2ef','#e2f2ef','#badfce','#c5e3df','#edf8f6','#5c7180','#fff8f7','#fffbf0','#fff6e0','#f0d8d5','#f0e4c5','#ead6ad','#fffaf1','#fbf6f5','#faf1f0','#8a5a52'];
const violations=[];
cssFiles.forEach(file=>{
  const source=fs.readFileSync(file,'utf8').toLowerCase();
  legacy.forEach(color=>{if(source.includes(color))violations.push(`${path.relative(root,file)}: ${color}`);});
});
assert.deepStrictEqual(violations,[],`Màu trạng thái cũ phải được thay bằng token ngữ nghĩa:\n${violations.join('\n')}`);
console.log('Status palette convention tests passed');
