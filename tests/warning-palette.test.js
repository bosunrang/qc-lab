const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const assets=path.join(root,'assets');
const tokenFile=path.join(assets,'tokens.css');
const tokenSource=fs.readFileSync(tokenFile,'utf8');
['warning-ink','warning-bg','warning-border','warning-accent'].forEach(name=>assert.match(tokenSource,new RegExp(`--${name}\\s*:`),`Thiếu token cảnh báo --${name}`));
assert.match(tokenSource,/--amber-600\s*:\s*#944f00\s*;/,'Màu chữ cảnh báo chuẩn phải là cam đậm #944f00 (đủ tương phản AA trên --warning-bg, 5.5:1)');
assert.match(tokenSource,/--amber-300\s*:\s*#e4c273\s*;/,'Màu viền cảnh báo chuẩn phải là #e4c273');
assert.match(tokenSource,/--warning-ink\s*:\s*var\(--amber-600\)\s*;/,'Chữ cảnh báo phải dùng màu cam đạt tương phản');
assert.match(tokenSource,/--warning-border\s*:\s*var\(--amber-300\)\s*;/,'Viền cảnh báo phải dùng #e4c273');
assert.match(tokenSource,/--warning-accent\s*:\s*var\(--amber-500\)\s*;/,'Sọc trái cảnh báo phải dùng màu cam nổi bật');

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full];});}
const cssFiles=walk(assets).filter(file=>file.endsWith('.css')&&file!==tokenFile);
const legacy=['#fff0d7','#fbf1de','#fff6e6','#fff2d9','#fff2d8','#fff7e7','#fdf8ee','#fffdf8','#f0ddaf','#eed39f','#ecd9ab','#e6d3ab','#e4c273','#d69a2d','#a96b0b','#9b6712','#9b650c','#9a6700','#7a5310'];
const violations=[];
cssFiles.forEach(file=>{
  const source=fs.readFileSync(file,'utf8').toLowerCase();
  legacy.forEach(color=>{if(source.includes(color))violations.push(`${path.relative(root,file)}: ${color}`);});
});
assert.deepStrictEqual(violations,[],`Màu vàng cảnh báo cũ phải được thay bằng token ngữ nghĩa:\n${violations.join('\n')}`);
console.log('Warning palette convention tests passed');
