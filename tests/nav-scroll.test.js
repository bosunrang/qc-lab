const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','assets','modules','router-render.js'),'utf8');
const navEl={scrollTop:318,_html:''};
Object.defineProperty(navEl,'innerHTML',{get(){return this._html;},set(value){this._html=value;this.scrollTop=0;}});
const context={
  document:{getElementById:id=>id==='nav'?navEl:null,addEventListener(){}},
  window:{},currentUser:{role:'admin'},page:'settings',
  console,setTimeout,clearTimeout
};
vm.createContext(context);
vm.runInContext(source,context);
vm.runInContext('nav()',context);

assert.equal(navEl.scrollTop,318,'dựng lại điều hướng phải giữ nguyên vị trí cuộn');
assert.match(navEl.innerHTML,/aria-current="page"/,'mục đang chọn vẫn phải được cập nhật sau khi dựng lại');
