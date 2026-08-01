const assert=require('node:assert/strict');
const{loadSandbox,run}=require('./helpers/sandbox');

const ctx=loadSandbox(['modules/data-io.js'],{
  window:{QCLAB_APP:{name:'QC Lab',version:'2.4.0'}},
  atob:value=>Buffer.from(value,'base64').toString('binary'),
});

run(ctx,`
  const p1={id:'p1',date:'2026-07-01',runId:'R1',level:1,val:140,staff:'NV1'};
  const p2={id:'p2',date:'2026-07-01',runId:'R1',level:2,val:160,staff:'NV1'};
  const levels=[{level:1,lot:'1101',mean:140,sd:2.5,applied:'manufacturer'},{level:2,lot:'1102',mean:160,sd:2.5,applied:'manufacturer'}];
  state={lab:{name:'PXN',dept:'Hóa sinh'},tests:[{id:'T1',name:'Sodium',unit:'mmol/L',machine:'Máy A'}],westgardRules:{'1-2s':true,'1-3s':true},actions:[]};
  function activeWestgard(){return{byPoint:new Map([['p1',{level:'rej',rules:['1-3s'],supportRules:[],z:3.2}],['p2',{level:'ok',rules:[],supportRules:[],z:0}]])};}
  function sgTea(){return 0.73;}function sgTeaSource(){return 'ricos';}function sgTeaLabel(){return 'Ricos / Westgard biological variation';}
  function sgTeaRefText(){return 'Phiên bản 2014';}function operationalLevels(){return levels;}
  function operationalLotPoints(t,level){return level===1?[p1]:[p2];}function previousLotSeries(){return[];}
  function reportRangeText(){return '01/07/2026 – 23/07/2026';}function formatDateTimeVN(){return '23/07/2026 10:00';}
  function userName(){return 'Quản trị viên';}function testDisplayName(t){return t.name;}function vnDate(v){return v;}
  function fmt(v,d=2){return Number(v).toFixed(d);}function pointStaff(p){return{code:p.staff};}
  function stateName(v){return v==='rej'?'Loại bỏ':v==='warn'?'Cảnh báo':'Đạt';}function errorType(){return '—';}
  function reportLevelStats(pts,mean){return{st:{n:pts.length,m:mean,sd:0,cv:0},bias:0,te:0,sigma:null};}
  function ljDataURL(){return 'data:image/png;base64,iVBORw0KGgo=';}function ljMultiDataURL(){return 'data:image/png;base64,iVBORw0KGgo=';}
  function __doc(){const d=reportXlsxDoc('T1','2026-07-01','2026-07-23');return JSON.parse(JSON.stringify({cols:d.cols,rows:d.rows,merges:d.merges,rowHeights:d.rowHeights,images:d.images.map(x=>({row0:x.row0,dispW:x.dispW,dispH:x.dispH}))}));}
  function __reportStyles(){return RXST;}
`);

const doc=ctx.__doc(),text=doc.rows.flatMap(r=>r.map(c=>c&&c.v)).filter(v=>v!==undefined).join(' | ');
assert.match(text,/QC Lab 2\.4\.0/);
assert.doesNotMatch(text,/westgard-print-hidpi/,'internal build label is hidden from the exported report');
assert.equal(Array.from(doc.cols).join(','),'13,12,14,10,10,10,12,13,15,18','report grid gives the NCE/date and rule columns enough width while staying balanced across A:J');
assert.ok(doc.merges.includes('A4:B4')&&doc.merges.includes('C4:F4')&&doc.merges.includes('G4:H4')&&doc.merges.includes('I4:J4'),'paired metadata uses balanced label/value blocks');
assert.ok(doc.merges.includes('A7:B7')&&doc.merges.includes('C7:J7'),'wide metadata keeps the same label grid');
assert.match(text,/Ghi chú Sigma/);
assert.equal(doc.images.length,3,'two-level report includes the combined chart and one chart per level');
doc.images.forEach(img=>{assert.equal(img.dispW,930);assert.equal(img.dispH,286);});
const level1Index=doc.rows.findIndex(r=>r.some(c=>c&&/^Mức 1 — Lô 1101/.test(String(c.v))));
assert.ok(level1Index>=doc.images[0].row0+19,'the first level heading starts after the combined chart plus a safety gutter');
const statsHeaderIndex=doc.rows.findIndex(r=>r.some(c=>c&&c.v==='Mean thực'));
assert.equal(statsHeaderIndex,doc.images[1].row0+18,'level statistics start immediately after the safely reserved chart area');
const statsRowNo=statsHeaderIndex+1;
assert.ok(doc.merges.includes('B'+statsRowNo+':C'+statsRowNo)&&doc.merges.includes('I'+statsRowNo+':J'+statsRowNo),'statistics header expands Mean and Sigma across the full A:J grid');
assert.ok(doc.merges.includes('B'+(statsRowNo+1)+':C'+(statsRowNo+1))&&doc.merges.includes('I'+(statsRowNo+1)+':J'+(statsRowNo+1)),'statistics values follow the same merged grid as their headers');
const pointsHeaderIndex=doc.rows.findIndex(r=>r.some(c=>c&&c.v==='Lần chạy'));
const pointsRowNo=pointsHeaderIndex+1;
assert.ok(doc.merges.includes('A'+pointsRowNo+':B'+pointsRowNo)&&doc.merges.includes('C'+pointsRowNo+':D'+pointsRowNo)&&doc.merges.includes('I'+pointsRowNo+':J'+pointsRowNo),'QC point header gives date, run and evidence enough width');
assert.ok(doc.merges.includes('A'+(pointsRowNo+1)+':B'+(pointsRowNo+1))&&doc.merges.includes('C'+(pointsRowNo+1)+':D'+(pointsRowNo+1))&&doc.merges.includes('I'+(pointsRowNo+1)+':J'+(pointsRowNo+1)),'each QC point row preserves the header merge pattern');
assert.equal(doc.rows[pointsHeaderIndex+1][8].s,ctx.__reportStyles().TD,'rule/evidence content is centered under its header');
const violHeaderIndex=doc.rows.findIndex(r=>r.some(c=>c&&c.v==='Loại sai số'));
const violRowNo=violHeaderIndex+1;
assert.ok(doc.merges.includes('A'+violRowNo+':B'+violRowNo)&&doc.merges.includes('F'+violRowNo+':G'+violRowNo)&&doc.merges.includes('H'+violRowNo+':J'+violRowNo),'violation header expands date, rule and error type across A:J');
assert.ok(doc.merges.includes('A'+(violRowNo+1)+':B'+(violRowNo+1))&&doc.merges.includes('F'+(violRowNo+1)+':G'+(violRowNo+1))&&doc.merges.includes('H'+(violRowNo+1)+':J'+(violRowNo+1)),'violation rows preserve the same merge pattern');

console.log('Report layout tests passed');
