const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/data-io.js']);
run(ctx, `
  const __sigmaTests=[{id:'T1',name:'Glucose',levels:[{level:1},{level:2},{level:3}]}];
  const __sigmaPeriods={T1:[
    {id:'P1',period:'2026-06',lv:{}},
    {id:'P2',period:'2026-07',lv:{}}
  ]};
  function sgTrackedTests(){return __sigmaTests;}
  function sgData(id){return __sigmaPeriods[id]||[];}
  function sgRows(t,data){return data.map(e=>({e,rs:[{cv:2,bias:1,sigma:4,dpmo:100,yld:99,label:'Tốt',tea:6},null,{cv:3,bias:1,sigma:3,dpmo:200,yld:98,label:'Cận biên',tea:6}]}));}
  function sgTea(){return 6;}
  function vnPeriod(v){return v.slice(5)+'/'+v.slice(0,4);}
  function __reportRows(testId,mode,period,periodId){return sigmaReportRows(testId,mode,period,periodId);}
`);

assert.equal(ctx.__reportRows('T1').length, 1, 'mặc định chỉ lấy kỳ gần nhất');
assert.equal(Array.from(ctx.__reportRows('T1', 'all'), x => x.period).join('|'), '06/2026|07/2026');
assert.equal(Array.from(ctx.__reportRows('T1', 'period', '2026-06', 'P1'), x => x.period).join('|'), '06/2026');
assert.equal(ctx.__reportRows('T1')[0].levels.length, 2, 'levels without a Sigma result must stay out of the export model');
assert.equal(ctx.__reportRows('T1')[0].levels[1].level, 3, 'a later populated level must retain its real level number');
assert.equal(ctx.__reportRows('T1')[0].levels[1].metric.sigma, 3);
assert.equal(run(ctx, 'SIGMA_EXPORT_PIXEL_RATIO'), 6, 'Sigma chart exports should use a high-density 6x canvas');
assert.ok(run(ctx, 'sigmaExportPixelRatio(4000,400)') < 6, 'oversized charts should be capped to a safe canvas dimension');
assert.equal(run(ctx, 'sigmaExportPixelRatio(0,400)'), 1, 'invalid canvas dimensions should fall back safely');
const mdcItems = ctx.sigmaMdcItems(ctx.__reportRows('T1'));
assert.equal(mdcItems.length, 2, 'all usable QC levels should share one MDC data set');
assert.equal(Array.from(mdcItems, x => x.level).join('|'), '1|3');
assert.equal(ctx.sigmaMdcItems([{tea:6,levels:[{level:1,metric:{cv:NaN,bias:1,sigma:4}}]}]).length, 0, 'invalid MDC points should be ignored');
assert.equal(ctx.sigmaMdcItems([{tea:6,levels:[{level:1,metric:{cv:2,bias:1,sigma:4,classifiable:false}}]}]).length, 0, 'unclassifiable cohorts must stay out of decision charts');

assert.equal(ctx.sigmaExportPeriods([{period:'Kỳ 05/2026'},{period:'2026-06'},{period:'05/2026'}]), '05/2026, 06/2026', 'export metadata should list each period once');
const sharedTea = ctx.sigmaTeaTrace([
  {period:'05/2026',teaLabel:'EFLM Biological Variation Database',teaSourceVersion:'Live database',teaReference:'Analyte: Sodium · APS: desirable'},
  {period:'06/2026',teaLabel:'EFLM Biological Variation Database',teaSourceVersion:'Live database',teaReference:'Analyte: Sodium · APS: desirable'},
  {period:'07/2026',teaLabel:'EFLM Biological Variation Database',teaSourceVersion:'Live database',teaReference:'Analyte: Sodium · APS: desirable'},
]);
assert.equal((sharedTea.match(/EFLM Biological Variation Database/g)||[]).length, 1, 'identical TEa traceability must not repeat for every period');
assert.doesNotMatch(sharedTea, /05\/2026|06\/2026|07\/2026/, 'periods belong in the compact period list when TEa metadata is shared');
const mixedTea = ctx.sigmaTeaTrace([
  {period:'05/2026',teaLabel:'Nguồn A',teaReference:'Tài liệu A'},
  {period:'06/2026',teaLabel:'Nguồn B',teaReference:'Tài liệu B'},
]);
assert.match(mixedTea, /Nguồn A · Tài liệu A \(kỳ 05\/2026\)/, 'different TEa sources must retain their relevant periods for auditability');
assert.match(mixedTea, /Nguồn B · Tài liệu B \(kỳ 06\/2026\)/);

const labelLayout = JSON.parse(run(ctx, `JSON.stringify(sigmaMdcLabelPlacements(
  [{name:'Kỳ 05/2026',x:100,y:100},{name:'Kỳ 06/2026',x:100,y:100}],
  v=>v,v=>v,{measureText:s=>({width:s.length*6})},{left:0,right:300,top:0,bottom:300}
))`));
assert.deepEqual(labelLayout.map(x=>x.label), ['5/2026','6/2026'], 'MDC labels should show only period/year because the point already contains the QC level');
assert.notEqual(`${labelLayout[0].x}:${labelLayout[0].y}`, `${labelLayout[1].x}:${labelLayout[1].y}`, 'nearby MDC labels should be placed in different slots');

console.log('Sigma export selection tests passed');
