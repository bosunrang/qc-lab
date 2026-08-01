const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/data-io.js'], {
  window: { QCLAB_APP: { name: 'QC Lab', version: '2.4.0' } },
  atob: value => Buffer.from(value, 'base64').toString('binary'),
});

run(ctx, `
  state={lab:{name:'PXN',dept:'Hóa sinh'},tests:[{id:'T1',name:'Sodium',unit:'mmol/L',machine:'Máy A'}]};
  selTest='T1'; WG_RULES=['1-3s','2-2s']; wgPrevOpen=new Set();
  function testDisplayName(t){return t.name;}
  function instrumentName(){return 'Máy A';}
  function testRuleOn(){return true;}
  function testRuleOnWithin(t,rule){return rule==='1-3s';}
  function testRuleOnAcross(t,rule){return rule==='2-2s';}
  function ruleResultLevel(t,rules){return rules.length?'rej':'ok';}
  function formatDateTimeVN(){return '22/07/2026 10:00';}
  function userName(){return 'Quản trị viên';}
  function vnDate(v){return v;}
  function fmt(v,d=2){return Number(v).toFixed(d);}
  function pointStaff(p){return {code:p.staff||'NV1'};}
  function qcVerdictLabel(v){return v==='rej'?'Loại bỏ':v==='warn'?'Cảnh báo':'Đạt';}
  function errorType(rules){return rules.includes('1-3s')?'Sai số ngẫu nhiên':'Sai số hệ thống';}
  function previousLotSeries(){return [];}
  function wgMultiViews(t){return activeWestgard(t).views.map(v=>({level:v.l.level,lot:v.l.lot,mean:v.l.mean,sd:v.l.sd,pts:v.pts,label:'M'+v.l.level}));}
  function ljDataURL(){return 'data:image/png;base64,iVBORw0KGgo=';}
  function ljMultiDataURL(){return 'data:image/png;base64,iVBORw0KGgo=';}
  QCCore={westgardByPoint:()=>({F:[],zs:[]})};
  function __doc(){const d=westgardXlsxDoc('T1');return JSON.parse(JSON.stringify({sheetName:d.sheetName,cols:d.cols,rows:d.rows,merges:d.merges,rowHeights:d.rowHeights,images:d.images.map(x=>({row0:x.row0,dispW:x.dispW,dispH:x.dispH}))}));}
`);

run(ctx, `
  const pts=[
    {id:'p1',date:'2026-07-01',runId:'R1',val:141,staff:'NV1'},
    {id:'p2',date:'2026-07-02',runId:'R2',val:140,staff:'NV2'},
    {id:'p3',date:'2026-07-03',runId:'R3',val:150,staff:'NV3'}
  ];
  const byPoint=new Map([
    ['p1',{level:'ok',rules:[],supportRules:['2-2s'],z:0.4}],
    ['p2',{level:'ok',rules:[],supportRules:[],z:0}],
    ['p3',{level:'rej',rules:['1-3s'],supportRules:[],z:4}]
  ]);
  activeWestgard=()=>({views:[{l:{level:1,lot:'1101',mean:140,sd:2.5},pts}],byPoint});
`);

let doc = ctx.__doc();
let text = doc.rows.flatMap(row => row.map(cell => cell && cell.v)).filter(v => v!==undefined).join(' | ');
assert.equal(doc.sheetName, 'Phân tích Westgard');
assert.match(text, /QC Lab 2\.4\.0/);
assert.doesNotMatch(text, /westgard-print-hidpi/, 'internal build label is hidden from the Westgard workbook');
assert.match(text, /Luật theo từng mức.*1-3s/);
assert.match(text, /Luật liên mức \/ lần chạy.*2-2s/);
assert.match(text, /Bằng chứng: 2-2s/, 'support-only points are explicitly exported as evidence');
assert.match(text, /Loại bỏ/);
assert.match(text, /R1/);
assert.match(text, /R3/);
assert.doesNotMatch(text, /R2/, 'ordinary passing points are omitted');
assert.equal(doc.images.length, 1, 'a single visible level receives its own LJ chart');
assert.equal(Array.from(doc.cols).join(','), '7,12,14,9,12,9,15,23,22', 'the detail grid stays compact and aligned with the chart width');
assert.equal(doc.images[0].dispW, 900, 'the chart aligns with the full nine-column report grid');
assert.equal(doc.images[0].dispH, 276, 'the chart preserves the Levey-Jennings aspect ratio');
assert.ok(doc.merges.includes('A4:B4')&&doc.merges.includes('C4:E4')&&doc.merges.includes('F4:G4')&&doc.merges.includes('H4:I4'), 'metadata labels and values use balanced merged blocks');
assert.ok(doc.merges.includes('A6:B6')&&doc.merges.includes('C6:I6'), 'rules metadata uses the same aligned card grid');
assert.ok(doc.merges.includes('A7:B7')&&doc.merges.includes('C7:I7'), 'cross-level rules receive their own aligned metadata row');
assert.equal(doc.images[0].row0+18, doc.rows.findIndex(row=>row.some(cell=>cell&&/^Tổng 3 điểm/.test(String(cell.v)))), 'chart reservation leaves enough room for Excel to render the image without covering the following row');

run(ctx, `
  wgPrevOpen=new Set(['T1|1']);
  previousLotSeries=()=>[{lot:'0900',mean:139,sd:2,pts:[{id:'old1',date:'2026-05-01',runId:'OLD',val:147,staff:'NV4'}]}];
  QCCore.westgardByPoint=()=>({F:[{rules:['1-3s'],supportRules:[]}],zs:[4]});
`);
doc = ctx.__doc();
text = doc.rows.flatMap(row => row.map(cell => cell && cell.v)).filter(v => v!==undefined).join(' | ');
assert.match(text, /Lô cũ 0900 · đã chuyển tiếp/);
assert.match(text, /OLD/);
assert.doesNotMatch(text, /R3/, 'when old lot is open, its detail table replaces the current lot table');
assert.match(text, /không gồm luật liên mức/);

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'westgard-routes.js'), 'utf8');
assert.match(source, /'exportWestgardXLSX\(\)'/);
assert.match(source, /wgChartMode==='lj'\?'<div>/, 'Excel/PDF actions only show in Levey-Jennings mode');

console.log('Westgard Excel tests passed');
