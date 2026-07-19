const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/reports.js'], { window: { QCLAB_APP: { name: 'QC Lab', version: 'test' } } });
run(ctx, `
  state={lab:{name:'PXN',dept:'Hóa sinh'},westgardRules:{'1-3s':true},tests:[{id:'T1',name:'Sodium',unit:'mmol/L',machine:'Máy A'}]};
  sgTest='T1';
  const __entry={id:'P7',period:'2026-07',lv:{}};
  const __metric={tea:5,sigma:5.63,classifiable:true,c:'#2c7d5c',label:'Xuất sắc',cv:0.77,bias:0.67,dpmo:17,yld:99.9983,cvSource:'iqc-cohort',n:30,sourceLot:'1101',readinessLabel:'Đủ điều kiện dữ liệu'};
  function formatDateTimeVN(){return '18/07/2026 18:00';}
  function userName(){return 'Quản trị viên';}
  function fmt(v,d=2){return Number(v).toFixed(d);}
  function sgFmtDPMO(v){return String(v);}
  function sgData(){return[__entry];}
  function sgVisibleLevels(){return[1,2];}
  function sgRows(){return[{e:__entry,rs:[__metric,null]}];}
  function sigmaReportRows(){return[{period:'07/2026'}];}
  function sigmaTeaTrace(){return'EFLM · Analyte: Sodium';}
  function vnPeriod(){return'07/2026';}
  function instrumentName(){return'Máy A';}
  function sgFrequencyHTML(){return'<div id="opspecs">OPSpecs</div>';}
  function sgTrendSVG(){return'<svg id="sigma-chart"></svg>';}
  function sgMDCSVG(){return'<svg id="mdc-chart"></svg>';}
  let __printed=null,__info='';
  openPrint=async(title,body,options)=>{__printed={title,body,options};};
  infoDialog=async message=>{__info=message;};
`);

const rowHtml = run(ctx, 'sigmaPeriodPrintRows({rs:[__metric,null]},[1,2])');
assert.match(rowHtml, /Mức 1/);
assert.match(rowHtml, /30 điểm · Lô 1101/);
assert.match(rowHtml, /Chưa đủ CV IQC và Bias EQA\/EQC/);

(async()=>{
  await ctx.printSigmaPeriod('P7');
  const printed = JSON.parse(run(ctx, 'JSON.stringify(__printed)'));
  assert.equal(printed.options.landscape, true, 'Sigma period reports should print on A4 landscape');
  assert.match(printed.title, /Sodium.*07\/2026/);
  assert.match(printed.body, /EFLM · Analyte: Sodium/);
  assert.match(printed.body, /id="opspecs"/);
  assert.match(printed.body, /id="sigma-chart"/);
  assert.match(printed.body, /id="mdc-chart"/);

  const sigmaSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'sigma.js'), 'utf8');
  assert.match(sigmaSource, /onclick="printSigmaPeriod\('\$\{e\.id\}'\)"/);
  assert.match(sigmaSource, />\$\{printIcon\}In PDF<\/button>/);
  console.log('Sigma period print tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
