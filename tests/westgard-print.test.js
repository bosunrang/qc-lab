const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/reports.js'], { window: { QCLAB_APP: { name: 'QC Lab', version: 'test' } } });
run(ctx, `
  state={lab:{name:'PXN',dept:'Hóa sinh'},westgardRules:{'1-3s':true,'1-2s':false},tests:[{id:'T1',name:'Sodium',unit:'mmol/L',machine:'Máy A'}]};
  selTest='T1';
  WG_RULES=['1-3s','1-2s'];
  wgPrevOpen=new Set();
  QCCore={westgardByPoint:(pts)=>({F:pts.map(()=>({rules:[]})),zs:pts.map(()=>0)})};
  function testRuleOn(t,rule){return !!(t.wgOnOverride&&t.wgOnOverride[rule])||(state.westgardRules||{})[rule]!==false;}
  function testRuleOnWithin(t,rule){return testRuleOn(t,rule);}
  function ruleResultLevel(t,rules){return rules&&rules.length?'rej':'ok';}
  function instrumentName(){return 'Máy A';}
  function testDisplayName(t){return t&&t.name||'';}
  function fmt(v,d=2){return Number(v).toFixed(d);}
  function vnDate(d){return d;}
  function qcVerdictLabel(l){return l==='ok'?'Đạt':l==='warn'?'Cảnh báo':'Loại bỏ';}
  function pointStaff(p){return {code:p.staff||'NV1',name:''};}
  function formatDateTimeVN(){return '21/07/2026 10:00';}
  function userName(){return 'Quản trị viên';}
  function ljDataURL(pts,mean,sd){return 'data:lj:'+pts.length+':'+mean+':'+sd;}
  function ljMultiDataURL(views,t){return 'data:ljmulti:'+views.length;}
  let __printed=null,__info='';
  openPrint=async(title,body,options)=>{__printed={title,body,options};};
  infoDialog=async message=>{__info=message;__printed=null;};
`);

// --- No test selected: bails out with an info dialog instead of printing ---
(async()=>{
  run(ctx, "selTest=''; activeWestgard=()=>({views:[]});");
  await ctx.printWestgard();
  let info = run(ctx, '__info');
  assert.match(info, /Chưa chọn được xét nghiệm/);

  // --- No operational levels: bails out too ---
  run(ctx, "selTest='T1'; activeWestgard=()=>({views:[],byPoint:new Map()});");
  await ctx.printWestgard();
  info = run(ctx, '__info');
  assert.match(info, /chưa có mức QC đang vận hành/);

  // --- Single level, one rejected point ---
  run(ctx, `
    const pts=[{id:'p1',date:'2026-07-01',val:141,staff:'NV1'},{id:'p2',date:'2026-07-02',val:150,staff:'NV2'}];
    const byPoint=new Map([['p1',{level:'ok',rules:[],z:0.2}],['p2',{level:'rej',rules:['1-3s'],supportRules:[],z:3.4}]]);
    activeWestgard=()=>({views:[{l:{level:1,lot:'1101',mean:140,sd:2.5},pts,single:{F:[],zs:[]}}],byPoint});
    function previousLotSeries(){return [];}
  `);
  await ctx.printWestgard();
  let printed = JSON.parse(run(ctx, 'JSON.stringify(__printed)'));
  assert.match(printed.title, /Sodium/, 'print title identifies the test');
  assert.match(printed.body, /Mức 1 — Lô 1101/, 'body identifies level and lot');
  assert.match(printed.body, /data:lj:2:140:2\.5/, 'the LJ chart is rendered from the level\'s own points/mean/sd');
  assert.match(printed.body, /Điểm vi phạm\/cảnh báo/, 'the violations table is included when a rejected point exists');
  assert.doesNotMatch(printed.body, /data:ljmulti/, 'a single operational level does not draw the combined multi-level chart');

  // --- Two levels with data: combined multi-level chart is drawn too ---
  run(ctx, `
    const pts1=[{id:'p1',date:'2026-07-01',val:141}],pts2=[{id:'p3',date:'2026-07-01',val:41}];
    const byPoint2=new Map([['p1',{level:'ok',rules:[],z:0.2}],['p3',{level:'ok',rules:[],z:0.1}]]);
    activeWestgard=()=>({views:[{l:{level:1,lot:'1101',mean:140,sd:2.5},pts:pts1,single:{F:[],zs:[]}},{l:{level:2,lot:'1102',mean:40,sd:1.2},pts:pts2,single:{F:[],zs:[]}}],byPoint:byPoint2});
  `);
  await ctx.printWestgard();
  printed = JSON.parse(run(ctx, 'JSON.stringify(__printed)'));
  assert.match(printed.body, /data:ljmulti:2/, 'two operational levels with points draw the combined Z-score chart');
  assert.match(printed.body, /Không có điểm vi phạm/, 'a clean level says so instead of an empty table');

  // --- "Xem lô cũ" toggled on for a level: prints the previous-lot series instead ---
  run(ctx, `
    wgPrevOpen=new Set(['T1|1']);
    function previousLotSeries(t,level){return level===1?[{lot:'0900',mean:139,sd:2.4,pts:[{id:'op1',date:'2026-05-01',val:200}]}]:[];}
    activeWestgard=()=>({views:[{l:{level:1,lot:'1101',mean:140,sd:2.5},pts:[{id:'p1',date:'2026-07-01',val:141}],single:{F:[],zs:[]}}],byPoint:new Map([['p1',{level:'ok',rules:[],z:0.2}]])});
    QCCore.westgardByPoint=(pts)=>({F:pts.map(()=>({rules:['1-3s']})),zs:pts.map(()=>4)});
  `);
  await ctx.printWestgard();
  printed = JSON.parse(run(ctx, 'JSON.stringify(__printed)'));
  assert.match(printed.body, /Lô cũ 0900/, 'toggling "xem lô cũ" prints the previous lot instead of the current one');
  assert.match(printed.body, /data:lj:1:139:2\.4/, 'the previous lot\'s own points/mean/sd feed the chart, not the current lot\'s');
  assert.match(printed.body, /không gồm luật liên mức/, 'the previous-lot caveat about cross-level rules is included');

  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'router-render.js'), 'utf8');
  assert.match(source, /onclick="printWestgard\(\)"/, 'the Westgard page wires up a print action');
  assert.match(source, /wgChartMode==='lj'\?'<div>/, 'the print button only shows in the default Levey-Jennings view, not CUSUM');

  console.log('Westgard print tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
