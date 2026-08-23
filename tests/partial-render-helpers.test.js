const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js',
  'generated/modular-pilot.js',
], { document: { addEventListener() {} } });

const result = run(ctx, `
  (function(){
    function option(){return{value:'',textContent:''};}
    var select={value:'B',disabled:false,children:[],replaceChildren:function(){this.children=[].slice.call(arguments);}};
    // replaceSelectItems() giờ đóng gói document tại thời điểm nạp bundle (xem
    // live-row-filter.ts) nên gán lại toàn bộ biến document=... ở đây sẽ không
    // được closure đó thấy — phải gắn thêm method lên CÙNG object đã capture.
    document.createElement=function(tag){if(tag!=='option')throw new Error('unexpected tag');return option();};
    replaceSelectItems(select,[{value:'A',label:'Assay A'},{value:'B',label:'Assay B'}],'Empty');
    var kept={value:select.value,disabled:select.disabled,labels:select.children.map(x=>x.textContent)};
    replaceSelectItems(select,[],'Không tìm thấy');
    return{kept,empty:{disabled:select.disabled,value:select.children[0].value,label:select.children[0].textContent}};
  })()
`);

const value = JSON.parse(JSON.stringify(result));
assert.deepEqual(value.kept, { value: 'B', disabled: false, labels: ['Assay A', 'Assay B'] });
assert.deepEqual(value.empty, { disabled: true, value: '', label: 'Không tìm thấy' });

const rowWindow = run(ctx, `
  (function(){
    var rows=Array.from({length:250},function(_,i){return{id:i};});
    var compact=wgRowsWindow(rows,'current:T1|1|L1');
    wgVisibleRows.set('current:T1|1|L1', 240);
    var loadedMore=wgRowsWindow(rows,'current:T1|1|L1');
    wgVisibleRows.set('current:T1|1|L1', 250);
    var expanded=wgRowsWindow(rows,'current:T1|1|L1');
    wgVisibleRows.delete('current:T1|1|L1');
    var collapsedBack=wgRowsWindow(rows,'current:T1|1|L1');
    var short=wgRowsWindow(rows.slice(0,40),'short');
    return{
      compact:{length:compact.rows.length,first:compact.rows[0].id,last:compact.rows[compact.rows.length-1].id,total:compact.total,limited:compact.limited},
      loadedMore:{length:loadedMore.rows.length,first:loadedMore.rows[0].id,total:loadedMore.total,limited:loadedMore.limited},
      expanded:{length:expanded.rows.length,first:expanded.rows[0].id,total:expanded.total,limited:expanded.limited},
      collapsedBack:{length:collapsedBack.rows.length,total:collapsedBack.total,limited:collapsedBack.limited},
      short:{length:short.rows.length,limited:short.limited}
    };
  })()
`);
const windowValue = JSON.parse(JSON.stringify(rowWindow));
assert.deepEqual(windowValue.compact, { length: 120, first: 130, last: 249, total: 250, limited: true });
assert.deepEqual(windowValue.loadedMore, { length: 240, first: 10, total: 250, limited: true });
assert.deepEqual(windowValue.expanded, { length: 250, first: 0, total: 250, limited: false });
assert.deepEqual(windowValue.collapsedBack, { length: 120, total: 250, limited: true });
assert.deepEqual(windowValue.short, { length: 40, limited: false });

const entryWindow = run(ctx, `
  (function(){
    var rows=Array.from({length:420},function(_,i){return{id:i};}),key='T1|1|L1|2026-01-01|2026-03-31';
    var compact=entryRowsWindow(rows,key);
    entryExpandedTables.add(key);
    var expanded=entryRowsWindow(rows,key);
    return{
      compact:{length:compact.rows.length,first:compact.rows[0].id,last:compact.rows[compact.rows.length-1].id,total:compact.total,limited:compact.limited},
      expanded:{length:expanded.rows.length,first:expanded.rows[0].id,total:expanded.total,limited:expanded.limited,expanded:expanded.expanded}
    };
  })()
`);
const entryWindowValue = JSON.parse(JSON.stringify(entryWindow));
assert.deepEqual(entryWindowValue.compact, { length:180, first:240, last:419, total:420, limited:true });
assert.deepEqual(entryWindowValue.expanded, { length:420, first:0, total:420, limited:false, expanded:true });

const keyboardTree = run(ctx, `
  (function(){
    var events=[],items=[0,1,2].map(function(i){return{offsetParent:{},focus:function(){events.push('focus:'+i);},click:function(){events.push('click:'+i);},getAttribute:function(name){return name==='aria-expanded'&&i===0?'false':null;}};});
    document={querySelectorAll:function(){return items;}};
    entryTreeKey.call(items[1],{key:'ArrowDown',preventDefault:function(){events.push('prevent:down');}});
    entryTreeKey.call(items[1],{key:'Enter',preventDefault:function(){events.push('prevent:enter');}});
    entryTreeKey.call(items[0],{key:'ArrowRight',preventDefault:function(){events.push('prevent:right');}});
    return events;
  })()
`);
assert.deepEqual(JSON.parse(JSON.stringify(keyboardTree)), ['prevent:down','focus:2','prevent:enter','click:1','prevent:right','click:0']);

const sheetArrows = run(ctx, `
  (function(){
    function cell(id,date,level,run){return{id:id,dataset:{focusDate:date,focusLevel:String(level),focusRun:String(run)}};}
    var a=cell('a','2026-07-01',0,1),b=cell('b','2026-07-01',1,1),c=cell('c','2026-07-02',0,1),d=cell('d','2026-07-02',1,1),cells=[a,b,c,d];
    function id(value){return value&&value.id||null;}
    return{right:id(entrySheetTarget(cells,a,'ArrowRight')),left:id(entrySheetTarget(cells,b,'ArrowLeft')),down:id(entrySheetTarget(cells,a,'ArrowDown')),up:id(entrySheetTarget(cells,c,'ArrowUp')),rightEdge:id(entrySheetTarget(cells,b,'ArrowRight')),upEdge:id(entrySheetTarget(cells,a,'ArrowUp')),enterWrap:id(entrySheetTarget(cells,c,'Enter')),tabWrap:id(entrySheetTarget(cells,b,'Tab'))};
  })()
`);
assert.deepEqual(JSON.parse(JSON.stringify(sheetArrows)), { right:'b', left:'a', down:'c', up:'a', rightEdge:null, upEdge:null, enterWrap:'a', tabWrap:'a' });

const restoredFilters = run(ctx, `
  (function(){
    var calls=[];
    dashTestFilter=function(value){calls.push('dash:'+value);};
    entryFilter=function(value){calls.push('entry:'+value);};
    page='dash';dashTestQ='glucose';entryQ='';restoreRouteFilters();
    page='entry';entryQ='lot-01';restoreRouteFilters();
    page='westgard';restoreRouteFilters();
    return calls;
  })()
`);
assert.deepEqual(JSON.parse(JSON.stringify(restoredFilters)), ['dash:glucose','entry:lot-01']);
// Tiêu đề lô đi qua entryColumns() (dựng từ operationalLevels + lô đang chạy song
// song), không bao giờ từ t.levels thô — giữ nguyên ý ban đầu của guard này.
// Vế "entryColumns chỉ dựng từ operationalLevels" được khoá ở parallel-lot-run.test.js,
// vì qc-domain.js không nằm trong sandbox của file này. Từ khi pageEntry() chuyển
// sang entry-page-controller.ts (TypeScript, bị Vite biên dịch nên String(pageEntry)
// không còn giữ nguyên tên gọi), guard đọc thẳng mã nguồn TypeScript thay vì hàm đã
// bundle để vẫn chốt đúng ý ban đầu.
const entryControllerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-page-controller.ts'), 'utf8');
assert.match(entryControllerSource, /deps\.pres\.entryLotLabelsTs\(entryCols\)/, 'entry lot heading must use entry columns through TypeScript bridge');

console.log('Partial render helper tests passed');
