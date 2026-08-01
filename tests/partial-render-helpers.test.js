const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js',
  'modules/state.js',
  'modules/qc-domain.js', // searchText() — bộ lọc KPI dùng, phải là bản thật để đúng cách bỏ dấu tiếng Việt
  'modules/entry-ui-state.js',
  'modules/analysis-ui-state.js',
  'modules/router-render.js',
  'modules/dashboard-routes.js',
  'modules/entry-routes.js',
  'modules/westgard-routes.js',
], { document: { addEventListener() {} } });

const result = run(ctx, `
  (function(){
    function option(){return{value:'',textContent:''};}
    var select={value:'B',disabled:false,children:[],replaceChildren:function(){this.children=[].slice.call(arguments);}};
    document={createElement:function(tag){if(tag!=='option')throw new Error('unexpected tag');return option();}};
    replaceSelectItems(select,[{value:'A',label:'Assay A'},{value:'B',label:'Assay B'}],'Empty');
    var kept={value:select.value,disabled:select.disabled,labels:select.children.map(x=>x.textContent)};
    replaceSelectItems(select,[],'Không tìm thấy');
    return{kept,empty:{disabled:select.disabled,value:select.children[0].value,label:select.children[0].textContent}};
  })()
`);

const value = JSON.parse(JSON.stringify(result));
assert.deepEqual(value.kept, { value: 'B', disabled: false, labels: ['Assay A', 'Assay B'] });
assert.deepEqual(value.empty, { disabled: true, value: '', label: 'Không tìm thấy' });

const dashboardKpis = run(ctx, `
  (function(){
    state.data={T1:[
      {id:'old',date:'2026-06-25',level:1,val:10},
      {id:'ok',date:'2026-07-01',level:1,val:10},
      {id:'warn',date:'2026-07-02',level:1,val:11},
      {id:'rej',date:'2026-07-03',level:1,val:14},
      {id:'void',date:'2026-07-04',level:1,val:15,voided:true}
    ]};
    ACTION_LABELS={cause:{instrument:'Thiết bị'}};
    actionCancelled=function(a){return a.recordStatus==='cancelled';};
    actionRecorded=function(a){return !!a.action;};
    actionWorkflowStatus=function(a){return{complete:a.stage==='closed',stage:a.stage};};
    actionEventDate=function(a){return a.date;};
    actionOverdue=function(a){return{overdue:a.stage!=='closed'&&a.dueDate<'2026-07-29'};};
    var test={id:'T1',name:'Sodium'},wg={byPoint:new Map([['warn',{level:'warn'}],['rej',{level:'rej'}],['void',{level:'rej'}]])};
    return dashboardKpiSnapshot([{t:test,wg:wg}],[
      {id:'a1',action:'Điều tra',stage:'investigating',date:'2026-07-10',createdAt:'2026-07-10T00:00:00Z',dueDate:'2026-07-20',causeCategory:'instrument',effectivenessStatus:'pending'},
      {id:'a2',action:'Vệ sinh máy',stage:'closed',date:'2026-07-01',createdAt:'2026-07-01T00:00:00Z',approvedAt:'2026-07-04T00:00:00Z',dueDate:'2026-07-05',causeCategory:'instrument',effectivenessStatus:'effective'},
      {id:'a3',action:'Mở nhầm',stage:'cancelled',date:'2026-07-01',recordStatus:'cancelled'}
    ],'2026-07-29');
  })()
`);
const kpiValue = JSON.parse(JSON.stringify(dashboardKpis));
assert.deepEqual(kpiValue.quality, { points:3, rejected:1, warnings:1, acceptedRate:66.7, rejectRate:33.3, previousRejectRate:0, rejectRateDelta:33.3 });
assert.equal(kpiValue.capa.open, 1);
assert.equal(kpiValue.capa.closed, 1);
assert.equal(kpiValue.capa.overdue, 1);
assert.equal(kpiValue.capa.evaluated, 1);
assert.equal(kpiValue.capa.effectiveRate, 100);
assert.equal(kpiValue.capa.averageCloseDays, 3);
assert.equal(kpiValue.capa.onTimeRate, 100);
assert.deepEqual(kpiValue.capa.stages, { investigating:1, rerun:0, effectiveness:0, approval:0, closed:1 });
assert.deepEqual(kpiValue.causes, [{ label:'Thiết bị', count:2 }]);
assert.equal(kpiValue.months.find(x=>x.key==='2026-07').rejected, 1);

/* Ô lọc KPI theo xét nghiệm phải theo đúng quy ước tìm kiếm của app: gõ dở thì
   thu hẹp danh sách TẠI CHỖ (không vẽ lại trang, không tự đổi lựa chọn), chỉ khi
   chọn ở <select> mới tính lại KPI. Bản dùng datalist trước đó đòi gõ khớp CHÍNH
   XÁC cả tên mới lọc được, và rời ô khi đang gõ dở thì âm thầm nhảy về "Tất cả". */
const kpiTestPicker = run(ctx, `
  (function(){
    var renders=0,count={textContent:''};
    var select={value:'all',disabled:false,children:[],replaceChildren:function(){this.children=[].slice.call(arguments);}};
    document={createElement:function(){return{value:'',textContent:''};},
      getElementById:function(id){return id==='dashKpiTest'?select:id==='dashKpiTestCount'?count:null;}};
    rerender=function(){renders++;};
    dashKpiTestChoices=[{id:'T1',label:'Sodium (Na)'},{id:'T2',label:'Glucose (GLU)'},{id:'T3',label:'Sodium niệu'}];
    dashKpiTest='all';dashKpiTestQ='';
    var labels=function(){return select.children.map(function(x){return x.textContent;});};

    dashKpiTestQ='sod';dashboardKpiApplyTestSearch();
    var partial={labels:labels(),count:count.textContent,selected:dashKpiTest,renders:renders};

    dashKpiTestQ='khong khop gi';dashboardKpiApplyTestSearch();
    var noHit={labels:labels(),count:count.textContent,selected:dashKpiTest,renders:renders};

    dashboardKpiSetTest('T2');
    var committed={selected:dashKpiTest,renders:renders};

    dashKpiTestQ='sod';dashboardKpiApplyTestSearch();
    var keepsSelected={labels:labels(),value:select.value,count:count.textContent};

    // Ô tìm phải LÊN LỊCH cập nhật (debounce của scheduleSearchRender) chứ không
    // vẽ lại trang ngay; hủy timer sau khi kiểm để không rớt ra ngoài bài test.
    var before=renders;dashboardKpiTestSearch('sodi');
    var scheduled=!!dashboardKpiTestSearch.searchTimer;
    clearTimeout(dashboardKpiTestSearch.searchTimer);
    return{partial:partial,noHit:noHit,committed:committed,keepsSelected:keepsSelected,
      query:dashKpiTestQ,searchRenders:renders-before,scheduled:scheduled};
  })()
`);
const kpiPickerValue = JSON.parse(JSON.stringify(kpiTestPicker));
assert.deepEqual(kpiPickerValue.partial, { labels:['Tất cả xét nghiệm','Sodium (Na)','Sodium niệu'], count:'2/3', selected:'all', renders:0 },
  'gõ dở phải lọc được ngay và không vẽ lại trang');
assert.deepEqual(kpiPickerValue.noHit, { labels:['Tất cả xét nghiệm'], count:'0/3', selected:'all', renders:0 },
  'không khớp gì thì vẫn còn "Tất cả" và không tự đổi lựa chọn');
assert.deepEqual(kpiPickerValue.committed, { selected:'T2', renders:1 }, 'chọn ở <select> mới là hành vi chốt');
assert.deepEqual(kpiPickerValue.keepsSelected, { labels:['Tất cả xét nghiệm','Glucose (GLU)','Sodium (Na)','Sodium niệu'], value:'T2', count:'2/3' },
  'xét nghiệm đang chọn phải ở lại danh sách dù không khớp từ khóa, nếu không ô chọn sẽ lệch với state');
assert.equal(kpiPickerValue.searchRenders, 0, 'ô tìm kiếm không được tự vẽ lại trang');
assert.equal(kpiPickerValue.scheduled, true, 'ô tìm kiếm phải đi qua scheduleSearchRender (debounce + trả lại con trỏ)');
assert.equal(kpiPickerValue.query, 'sodi', 'ô tìm kiếm phải giữ lại từ khóa vừa gõ');

const rowWindow = run(ctx, `
  (function(){
    var rows=Array.from({length:250},function(_,i){return{id:i};});
    var compact=wgRowsWindow(rows,'current:T1|1|L1');
    wgExpandedRows.add('current:T1|1|L1');
    var expanded=wgRowsWindow(rows,'current:T1|1|L1');
    var short=wgRowsWindow(rows.slice(0,40),'short');
    return{
      compact:{length:compact.rows.length,first:compact.rows[0].id,last:compact.rows[compact.rows.length-1].id,total:compact.total,limited:compact.limited},
      expanded:{length:expanded.rows.length,first:expanded.rows[0].id,total:expanded.total,limited:expanded.limited},
      short:{length:short.rows.length,limited:short.limited}
    };
  })()
`);
const windowValue = JSON.parse(JSON.stringify(rowWindow));
assert.deepEqual(windowValue.compact, { length: 120, first: 130, last: 249, total: 250, limited: true });
assert.deepEqual(windowValue.expanded, { length: 250, first: 0, total: 250, limited: false });
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
    entryTreeKey({currentTarget:items[1],key:'ArrowDown',preventDefault:function(){events.push('prevent:down');}});
    entryTreeKey({currentTarget:items[1],key:'Enter',preventDefault:function(){events.push('prevent:enter');}});
    entryTreeKey({currentTarget:items[0],key:'ArrowRight',preventDefault:function(){events.push('prevent:right');}});
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
assert.equal(run(ctx,"entryLotLabels([{lot:'1101'},{lot:'1102'}])"),'1101 / 1102');
assert.equal(run(ctx,"entryLotLabels([])"),'Chưa gán lô');
// Tiêu đề lô đi qua entryColumns() (dựng từ operationalLevels + lô đang chạy song
// song), không bao giờ từ t.levels thô — giữ nguyên ý ban đầu của guard này.
// Vế "entryColumns chỉ dựng từ operationalLevels" được khoá ở parallel-lot-run.test.js,
// vì qc-domain.js không nằm trong sandbox của file này.
assert.ok(run(ctx,"String(pageEntry).includes('entryLotLabels(entryCols)')"),'entry lot heading must use entry columns');

console.log('Partial render helper tests passed');
