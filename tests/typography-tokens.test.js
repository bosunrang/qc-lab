const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const tokenFile=path.join(root,'assets','tokens.css');
const requiredTokens=['type-overline','type-caption','type-meta','type-body-sm','type-body','type-subhead','type-heading-sm','type-dialog-title','type-symbol-lg','type-symbol-xl','type-heading-lg','type-page-title','type-kpi'];
const tokenSource=fs.readFileSync(tokenFile,'utf8');
requiredTokens.forEach(name=>assert.match(tokenSource,new RegExp(`--${name}\\s*:`),`Thiếu token typography --${name}`));
['type-title','type-micro'].forEach(name=>assert.doesNotMatch(tokenSource,new RegExp(`--${name}\\s*:`),`Token typography cũ --${name} phải được xóa`));

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full];});}
const files=[...walk(path.join(root,'assets')).filter(file=>/\.(?:css|js)$/.test(file)&&file!==tokenFile),path.join(root,'index.html'),path.join(root,'electron','activation.html')];
const violations=[];
const legacyTokenUses=[];
files.forEach(file=>{
  const source=fs.readFileSync(file,'utf8');
  if(/var\(--type-(?:title|micro)\)/.test(source))legacyTokenUses.push(path.relative(root,file));
  source.split(/\r?\n/).forEach((line,index)=>{
    if(/font-size\s*:\s*(?:\d|\.\d)/.test(line)||/font-size=["'](?:\d|\.\d)/.test(line)||/(?:^|[;{])\s*font\s*:[^;}]*\d+(?:\.\d+)?px/.test(line)||/\d+(?:\.\d+)?px\s+(?:Manrope|Arial)/.test(line))violations.push(`${path.relative(root,file)}:${index+1}`);
  });
});
assert.deepStrictEqual(violations,[],`Kích thước chữ phải dùng token, còn hard-code tại:\n${violations.join('\n')}`);
assert.deepStrictEqual(legacyTokenUses,[],`Không được dùng lại token typography cũ:\n${legacyTokenUses.join('\n')}`);
console.log('Typography token convention tests passed');
