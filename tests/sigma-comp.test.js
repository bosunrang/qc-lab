/**
 * Tests for the Six Sigma bias/TEa source-selection logic (assets/modules/sigma.js).
 *
 * QCCore.sigmaMetric (the raw Sigma=(TEa-|Bias|)/CV formula) already has
 * coverage in tests/qccore.test.js. What was untested is the business logic
 * layered on top of it in sigma.js: the EQA-only Bias source and
 * which TEa source (EFLM/CLIA/Ricos) actually feed that formula - a wrong
 * precedence here silently changes a lab's reported Sigma without any error.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/sigma-cohort-service.js', 'modules/sigma-ui-state.js', 'modules/sigma.js']);

assert.equal(ctx.sgInputDisplayValue(.721694321),'0.72','CV/Bias display is concise while stored precision remains unchanged');
assert.equal(ctx.sgInputDisplayValue(''),'');

// A stopped lot group is no longer operational for new QC entry, but its levels,
// lot-specific IQC cohort and target snapshots must remain available to old Sigma periods.
{
  const historical=run(ctx, `(function(){
    state.tests=[{id:'H1',name:'Sodium',levels:[{level:1,qcLotId:'L1',lot:'1101',mean:140,sd:2.5,meanSdHistory:[{qcLotId:'L1',lot:'1101',mean:140,sd:2.5}]}]}];
    state.qcLots=[{id:'L1',lotNo:'1101',level:1}];
    state.lotGroups=[{id:'G1',name:'1101',lotIds:['L1'],active:true,status:'stopped'}];
    state.data={H1:[
      {id:'a',date:'2020-06-02',level:1,lot:'1101',val:139,qcMean:140,qcSd:2.5},
      {id:'b',date:'2020-06-20',level:1,lot:'1101',val:141,qcMean:140,qcSd:2.5}
    ]};
    state.sigmaData={H1:[{id:'P1',period:'2020-06',lv:{}}]};
    operationalLevels=function(){return[];};
    const t=state.tests[0],e=state.sigmaData.H1[0],groups=sgCohortGroups(t,e);
    return{levels:sgVisibleLevels(t),periodLevels:sgPeriodLevels(t,e),groups:groups.map(g=>({level:g.level,configuredLot:g.configuredLot,lots:g.cohorts.map(c=>c.lot),targetMean:g.cohorts[0]&&g.cohorts[0].targetMean,targetSd:g.cohorts[0]&&g.cohorts[0].targetSd}))};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(historical)),{levels:[1],periodLevels:[1],groups:[{level:1,configuredLot:'1101',lots:['1101'],targetMean:140,targetSd:2.5}]},'stopping a lot group must not hide or detach its historical Sigma cohort');
}

{
  const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'sigma.js'), 'utf8');
  const sigmaCss = fs.readFileSync(path.join(__dirname, '..', 'assets', 'professional-sigma.css'), 'utf8');
  const baseCss = fs.readFileSync(path.join(__dirname, '..', 'assets', 'professional-base.css'), 'utf8');
  assert.match(source, /class="sg-simple-table"/, 'Sigma periods use the compact CV–Bias–Sigma table');
  assert.match(source, /function sgRemoveTracked\(id\)\{\s*if\(!requireAdmin\(\)\)return;/, 'untracking a test from Sigma requires admin, matching the admin-only "+ Thêm" action');
  assert.doesNotMatch(source, /role\(\)==='admin'\?'<button class="btn teal" onclick="sgOpenAddTest\(\)">\+ Thêm<\/button>':''\}\$\{canWrite\(\)/, 'the "Xóa" tracked-test button is no longer shown to non-admin roles that can only canWrite()');
  assert.doesNotMatch(source, /<label>Độ lệch so với target IQC%<\/label>/, 'Bias IQC input is absent from the Sigma UI');
  assert.match(source, /Chọn CV IQC theo lô/, 'automatic import is labelled as a lot-based CV cohort');
  assert.doesNotMatch(source, /Bias Peer|Peer group|sg-bias-source/, 'Peer is absent from the Sigma UI and business logic');
  assert.match(source, /class="sg-data-head-actions"/, 'per-level EQA Bias actions are placed in the period header');
  assert.match(source, /class="sg-action-col">Thao tác<\/th>/, 'period table has a labelled and separated action column');
  assert.match(source, /data-sg-period-id="\$\{escAttr\(e\.id\)\}"[\s\S]*?onclick="sgSelectPeriod\('\$\{e\.id\}'\)"/, 'each period row is selected by clicking the row');
  assert.doesNotMatch(source, /name="sgStatusPeriod"/, 'the per-row status radio is removed in favour of clicking the row');
  assert.match(source, /<h3 class="sg-setup-heading">Tình trạng<\/h3>/, 'the status panel has the concise requested title');
  assert.doesNotMatch(source, /Tình trạng kỳ gần nhất|Kỳ gần nhất:/, 'the obsolete latest-period wording is removed');
  assert.match(source, /sgFrequencyHTML\(t,selectedRow,levels\)/, 'the QC design table follows the period selected for status');
  assert.match(source, /sg-selected-period-hint[\s\S]*?Kỳ đang xem:/, 'the QC design table identifies the period it is evaluating');
  assert.match(source, /exportSigmaPeriodXLSX\('\$\{e\.id\}'\)/, 'each period row exports its own workbook');
  assert.match(source, /btn\('Xóa',`sgDelPeriod\('\$\{e\.id\}'\)`,'danger sm sg-row-delete'/, 'each writable period row uses the labelled system-danger delete button');
  assert.doesNotMatch(source, /class="x" onclick="sgDelPeriod/, 'the obsolete icon-only period delete control is removed');
  assert.match(source, /'exportSigmaPeriodsXLSX\(\)'/, 'the footer exports the combined multi-period comparison workbook');
  assert.match(source, /Xuất tổng hợp các kỳ/, 'combined export is clearly distinguished from row export');
  assert.doesNotMatch(source, /sgSaveSoon|sgSaveT/, 'manual Sigma edits no longer wait on the obsolete pre-save timer');
  assert.doesNotMatch(source, /sg-cv-row-hint/, 'the obsolete CV-lot instruction under the table is removed');
  assert.match(source, /btn\(icoDownload\(\)\+'Xuất tổng hợp các kỳ','exportSigmaPeriodsXLSX\(\)','teal sg-combined-export'/, 'combined Excel export is available in the period header');
  assert.match(source, /btn\(printIcon\+'PDF tổng hợp các kỳ','printSigmaPeriods\(\)','teal sg-combined-print'/, 'combined PDF export is available in the period header');
  assert.doesNotMatch(source, /sg-period-actions/, 'the obsolete footer action row is removed');
  assert.doesNotMatch(source, /<button class="btn ghost sm" title="Tính Bias EQA\/EQC từ nhiều vòng"/, 'period cells no longer repeat a Bias calculation button');
  assert.match(source, /class="sg-eqa-table"/, 'EQA Bias modal uses the compact reference-style table');
  assert.match(source, /Chọn hoặc thêm xét nghiệm vào Six Sigma/, 'Sigma add opens a picker that also navigates tracked assays');
  assert.match(source, /sgTrackTest/, 'Sigma picker tracks an assay selected from the shared catalog');
  assert.match(source, /sgViewTrackedTest/, 'Sigma picker can open an already-tracked assay for inspection');
  assert.doesNotMatch(source, /sgGoAssayCatalog/, 'Sigma add no longer redirects to the assay configuration page');
  assert.match(source, /Áp dụng cho kỳ nào\?/, 'EQA Bias modal can apply the reviewed Bias to selected periods');
  assert.match(sigmaCss, /input\.sg-number:hover:not\(:disabled\)/, 'Sigma numeric inputs reveal their editor affordance on hover');
  assert.match(sigmaCss, /input\.sg-number:focus/, 'Sigma numeric inputs reveal their editor affordance on focus');
  assert.match(sigmaCss, /border-color:transparent; background:transparent;/, 'Sigma numeric inputs stay visually clean at rest');
  assert.match(sigmaCss, /\.sg-simple-table \.sg-action-col\{[\s\S]*?border-left:2px solid var\(--line\);/, 'the action column has a visible vertical separator');
  assert.match(sigmaCss, /button\.btn\.teal\.sg-row-cv\{[\s\S]*?background:var\(--teal\);[\s\S]*?color:var\(--on-accent\);/, 'lot CV action uses the requested teal background and white text');
  assert.doesNotMatch(sigmaCss, /sg-row-delete/, 'period delete relies on the shared system-danger button without local color overrides');
  assert.match(sigmaCss, /tr\.sg-period-selected td\{[\s\S]*?background:/, 'the selected status period is visibly highlighted');
  assert.doesNotMatch(sigmaCss, /\.sg-period-radio\{/, 'the obsolete period radio styling is removed');
  assert.match(sigmaCss, /tr\.sg-period-selected td:first-child\{[\s\S]*?box-shadow:inset 4px 0 0 var\(--teal\)/, 'the selected period row is marked by the teal left stripe');
  assert.match(sigmaCss, /tr\.sg-period-row\{[\s\S]*?cursor:pointer;/, 'the whole period row is clickable to select');
  // Scrollbar styling is a global default now (professional-base.css `*::-webkit-scrollbar*`),
  // not a per-selector rule — the Sigma table inherits it like every other scroll box.
  assert.match(baseCss, /\*::-webkit-scrollbar\{[\s\S]*?height:var\(--scrollbar-size\);/, 'the global thin-scrollbar default (inherited by the Sigma table) uses the shared token');
  assert.match(baseCss, /\*::-webkit-scrollbar-button\{[\s\S]*?display:none;/, 'the global scrollbar default removes the bulky native arrow buttons everywhere, including Sigma');
  assert.match(source, /<col style="width:140px">/, 'the period/year column has a little more room while staying compact');
  assert.match(source, /<col style="width:228px"><\/colgroup>/, 'the action column gives a small share back to the period column while retaining all row actions');
  assert.match(source, /tableMin=368\+levels\.length\*295/, 'the minimum table width is derived from the compact columns');
  assert.match(source, /class="sg-period-month"[\s\S]*?class="sg-period-year"/, 'month and year selectors have dedicated compact sizing hooks');
  assert.doesNotMatch(sigmaCss, /\.sg-period-actions\{/, 'unused footer action styling is removed');
  assert.match(sigmaCss, /#sgFreq table\{[\s\S]*?table-layout:fixed;/, 'Sigma QC-frequency table uses a stable fixed column layout');
  assert.match(sigmaCss, /#sgFreq table th:nth-child\(1\), #sgFreq table td:nth-child\(1\)\{width:7%;\}/, 'Sigma QC-design table gives Mức 7%');
  assert.match(sigmaCss, /#sgFreq table th:nth-child\(2\), #sgFreq table td:nth-child\(2\)\{width:8%;/, 'Sigma QC-design table gives Sigma 8%');
  assert.match(sigmaCss, /#sgFreq table th:nth-child\(3\), #sgFreq table td:nth-child\(3\)\{width:27%;\}/, 'Sigma QC-design table gives OPSpecs 27%');
  assert.match(sigmaCss, /#sgFreq table th:nth-child\(4\), #sgFreq table td:nth-child\(4\)\{width:22%;\}/, 'Sigma QC-design table gives risk 22%');
  assert.match(sigmaCss, /#sgFreq table th:nth-child\(5\), #sgFreq table td:nth-child\(5\)\{width:36%;\}/, 'Sigma QC-design table gives action 36%');
  assert.match(sigmaCss, /@media\(max-width:760px\)[\s\S]*?#sgFreq table th:nth-child\(1\)[\s\S]*?min-width:76px;[\s\S]*?white-space:nowrap;/, 'mobile QC-design level column stays on one line');
  assert.match(sigmaCss, /@media\(max-width:760px\)[\s\S]*?#sgFreq table th:nth-child\(2\)[\s\S]*?min-width:72px;[\s\S]*?white-space:nowrap;/, 'mobile QC-design Sigma column stays on one line');
}

// --- Manual CV/Bias edits mark persistence dirty immediately. ---
//     Local/Firebase writers retain their own debounce, so reload can flush local state
//     without sending one network request for every keystroke.
{
  const editCtx=loadSandbox(['core.js','modules/state.js','modules/sigma-cohort-service.js','modules/sigma-ui-state.js','modules/sigma.js']);
  const saved=run(editCtx, `(function(){
    globalThis.requireWrite=function(){return true;};
    globalThis.save=function(opts){globalThis.__manualSaveCalls=(globalThis.__manualSaveCalls||0)+1;globalThis.__manualSaveOpts=opts;};
    globalThis.sgRefreshSoon=function(){};
    state.tests=[{id:'T1',name:'Sodium',tea:5,teaSource:'ricos',levels:[{level:1,mean:100,sd:2}]}];
    state.sigmaData={T1:[{id:'P1',period:'2026-07',tea:5,teaSource:'ricos',lv:{}}]};
    sgTest='T1';sgCell('P1',1,'cv','1.25');sgCell('P1',1,'biasEqa','2.5');
    return{calls:__manualSaveCalls,opts:__manualSaveOpts,level:state.sigmaData.T1[0].lv[1]};
  })()`);
  const value=JSON.parse(JSON.stringify(saved));
  assert.equal(value.calls,2,'each manual edit immediately enters the normal persistence pipeline');
  assert.deepEqual(value.opts,{clearDerived:false,sigmaTestId:'T1'});
  assert.equal(value.level.cv,1.25);
  assert.equal(value.level.cvSource,'manual');
  assert.equal(value.level.biasEqa,2.5);
  assert.equal(value.level.biasEqaMethod,'manual');
}

// --- Adding an assay to Sigma uses the existing shared assay catalog ---
{
  const pickerCtx=loadSandbox(['core.js','modules/state.js','modules/sigma-cohort-service.js','modules/sigma-ui-state.js','modules/sigma.js']);
  const added=run(pickerCtx, `(function(){
    state.tests=[{id:'T1',name:'Glucose',levels:[{level:1,qcLotId:'L1'},{level:2,qcLotId:'L2'},{level:3,qcLotId:''}],sgTracked:false}];
    operationalLevels=function(t){return t.levels.filter(l=>l.qcLotId);};
    requireAdmin=function(){return true;};save=function(){globalThis.__saved=true;};closeModal=function(){globalThis.__closed=true;};rerender=function(){globalThis.__rendered=true;};
    sgTrackTest('T1');return{tracked:state.tests[0].sgTracked,selected:sgTest,visibleLevels:sgVisibleLevels(state.tests[0]),saved:__saved,closed:__closed,rendered:__rendered};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(added)),{tracked:true,selected:'T1',visibleLevels:[1,2],saved:true,closed:true,rendered:true});
}

// --- Already-tracked assays in the picker can be selected for inspection ---
{
  const pickerCtx=loadSandbox(['core.js','modules/state.js','modules/sigma-cohort-service.js','modules/sigma-ui-state.js','modules/sigma.js']);
  const selected=run(pickerCtx, `(function(){
    state.tests=[{id:'T1',name:'Glucose',sgTracked:true},{id:'T2',name:'Sodium',sgTracked:true}];sgTest='T1';
    closeModal=function(){globalThis.__closed=true;};rerender=function(){globalThis.__rendered=true;};
    sgViewTrackedTest('T2');return{selected:sgTest,closed:__closed,rendered:__rendered};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(selected)),{selected:'T2',closed:true,rendered:true});
}

// --- Applying a reviewed EQA Bias to selected periods only ---
{
  const periods=[{id:'P1',lv:{}},{id:'P2',lv:{1:{biasEqa:9}}},{id:'P3',lv:{}}],rounds=[{lab:'5.59',target:'5.55'}];
  assert.equal(ctx.sgApplyBiasToPeriods(periods,['P1','P3'],1,.72,rounds),2);
  assert.equal(periods[0].lv[1].biasEqa,.72);
  assert.equal(periods[1].lv[1].biasEqa,9,'an unselected period keeps its reviewed Bias');
  assert.equal(periods[2].lv[1].biasEqaMethod,'rms');
  assert.equal(JSON.stringify(periods[2].lv[1].eqaRounds),JSON.stringify(rounds));
  assert.equal(periods[0].lv[1].eqaBatchId,periods[2].lv[1].eqaBatchId,'selected periods share one persisted application batch');
  assert.deepEqual(ctx.sgBiasLinkedPeriodIds(periods,'P3',1),['P1','P3'],'reopening a reviewed batch restores all selected periods');
  assert.notEqual(periods[0].lv[1].eqaRounds,periods[2].lv[1].eqaRounds,'each period owns a separate rounds array');
  ctx.sgApplyBiasToPeriods(periods,['P1'],1,.72654321,rounds);
  assert.equal(periods[0].lv[1].biasEqa,.72654321,'Bias RMS keeps full precision and is rounded only for display');
  assert.deepEqual(ctx.sgBiasLinkedPeriodIds(periods,'P1',1),['P1'],'a later subset application reopens with that subset only');

  const legacy=[
    {id:'M5',lv:{1:{biasEqa:.67,biasEqaMethod:'rms',eqaRounds:rounds}}},
    {id:'M6',lv:{1:{biasEqa:.67,biasEqaMethod:'rms',eqaRounds:rounds}}},
    {id:'M7',lv:{1:{biasEqa:.67,biasEqaMethod:'rms',eqaRounds:rounds}}}
  ];
  assert.deepEqual(ctx.sgBiasLinkedPeriodIds(legacy,'M7',1),['M5','M6','M7'],'existing multi-period data without a batch id is recognized by matching reviewed rounds');
}

// --- Closing the cohort picker must discard its transient selection context ---
{
  run(ctx, `function closeModal(){globalThis.__cohortClosed=true;} sgCohortCtx={test:true}; sgCohortClose();`);
  assert.equal(run(ctx,'sgCohortCtx'),null);
  assert.equal(run(ctx,'__cohortClosed'),true);
}

// --- TEa source lookup against the built-in reference table (REFTESTS in state.js) ---
{
  const cliaMeta=run(ctx,'TEA_SOURCE_REGISTRY.clia');
  const ricosMeta=run(ctx,'TEA_SOURCE_REGISTRY.ricos');
  assert.equal(cliaMeta.version,'CMS-3355-F / 42 CFR §§493.931, 493.941');
  assert.equal(cliaMeta.effectiveDate,'2024-07-11');
  assert.equal(ricosMeta.version,'2014');
  assert.equal(ricosMeta.status,'retired','Ricos is explicitly marked as a legacy reference');
}
{
  const t = { name: 'Glucose', tea: 0, teaSource: 'ricos' };
  assert.equal(ctx.sgTeaBySource(t, 'ricos'), 6.96, 'Ricos/biological-variation TEa% for Glucose from REFTESTS');
  assert.equal(ctx.sgTeaBySource(t, 'clia'), 8, 'CLIA TEa% for Glucose from REFTESTS');
  assert.equal(ctx.sgTeaBySource(t, 'eflm'), 0, 'EFLM must return 0 (not a stale/wrong value) when no EFLM lookup trace exists yet');
}
{
  const sodiumMeta=ctx.teaAnalyteMeta('Sodium');
  assert.equal(run(ctx,'TEA_ANALYTE_CATALOG.length'),run(ctx,'REFTESTS.length'),'mọi dòng TEa mặc định đều đến từ catalog chuẩn');
  assert.equal(new Set(run(ctx,'Object.values(TEA_ANALYTE_META).map(x=>x.analyteId)')).size,run(ctx,'REFTESTS.length'),'analyteId mặc định không được trùng');
  assert.equal(sodiumMeta.displayName,'Sodium (Na)','giao diện dùng tên quốc tế kèm viết tắt');
  assert.equal(sodiumMeta.standardName,'Sodium');
  assert.ok(sodiumMeta.aliases.includes('Na'),'viết tắt hỗ trợ tìm xét nghiệm');
  assert.equal(ctx.sgRef({name:'Sodium'})[0],'Sodium','tên quốc tế tra đúng TEa');
  assert.equal(ctx.sgRef({name:'Na'})[0],'Sodium','viết tắt tra đúng TEa');
  assert.equal(ctx.sgRef({analyteId:'qclab-sodium',name:'Renamed display'})[0],'Sodium','analyteId giữ liên kết TEa ổn định');
  assert.equal(run(ctx,'TEA_ANALYTE_CATALOG.length'),77,'catalog gồm 65 mục cũ và 12 mục huyết học/đông máu mới');
  assert.equal(ctx.sgRef({name:'WBC'})[0],'Leukocyte count','viết tắt huyết học tra đúng tên quốc tế');
  assert.equal(ctx.sgTeaBySource({name:'WBC',tea:0},'clia'),10,'WBC dùng tiêu chí CLIA ±10%');
  assert.equal(ctx.sgTeaBySource({name:'RBC',tea:0},'clia'),4,'RBC dùng tiêu chí CLIA ±4%');
  assert.equal(ctx.sgTeaBySource({name:'PLT',tea:0},'clia'),25,'PLT dùng tiêu chí CLIA ±25%');
  assert.equal(ctx.sgTeaBySource({name:'PT',tea:0},'clia'),15,'PT dùng tiêu chí CLIA ±15%');
  assert.equal(ctx.sgTeaBySource({name:'INR',tea:0},'clia'),15,'INR dùng tiêu chí CLIA ±15%');
  assert.equal(ctx.sgTeaBySource({name:'D-Dimer',tea:0},'clia'),0,'D-dimer không được gán TEa CLIA khi bảng nguồn không quy định');
}
{
  const t={name:'Glucose',tea:0,teaSource:'clia'},snap=ctx.sgTeaSnapshot(t);
  assert.equal(snap.teaSourceId,'clia-cms-3355-f-2024');
  assert.equal(snap.teaSourceVersion,'CMS-3355-F / 42 CFR §§493.931, 493.941');
  assert.equal(snap.teaEffectiveDate,'2024-07-11');
  assert.match(snap.teaSourceUrl,/^https:\/\//);
  assert.match(snap.teaReference,/Phiên bản:/,'Sigma snapshot carries a human-readable source version');
}
{
  const t = { name: 'Glucose', tea: 5.5, teaSource: 'eflm', eflmAnalyte: 'Glucose', eflmRef: 'EFLM DB' };
  assert.equal(ctx.sgTeaBySource(t, 'eflm'), 5.5, 'EFLM TEa% is used once a lookup trace (analyte/ref/date) is present');
}

// --- Name matching must be exact-first: "CK-MB" must NOT inherit "CK"'s TEa ---
{
  const ckmb = { name: 'CK-MB', tea: 0, teaSource: 'ricos' };
  assert.equal(ctx.sgTeaBySource(ckmb, 'clia'), 25, 'CK-MB gets its own CLIA TEa, not CK (20)');
  assert.equal(ctx.sgTeaBySource(ckmb, 'ricos'), 30.06, 'CK-MB gets its own Ricos TEa, not CK (30.3)');
  const ck = { name: 'CK', tea: 0, teaSource: 'ricos' };
  assert.equal(ctx.sgTeaBySource(ck, 'clia'), 20, 'plain CK still resolves to its own row');
  assert.equal(ctx.sgTeaBySource(ck, 'ricos'), 30.3);
  // Prefix fallback still helps when there is no exact row (e.g. a unit suffix)
  const glu = { name: 'Glucose (huyết thanh)', tea: 0, teaSource: 'ricos' };
  assert.equal(ctx.sgTeaBySource(glu, 'ricos'), 6.96, 'names with a suffix still match via longest-prefix fallback');
  // Unknown name resolves to no reference (TEa 0) rather than a wrong match
  assert.equal(ctx.sgTeaBySource({ name: 'Không có trong bảng', tea: 0, teaSource: 'ricos' }, 'ricos'), 0);
  assert.equal(ctx.sgRef({ name: 'Troponin' }), undefined, 'ambiguous shortened names must not silently choose Troponin I/T');
  assert.equal(ctx.sgRef({ name: 'C' }), undefined, 'a one-letter prefix must not silently choose an unrelated TEa row');
}

// --- Bias source: only EQA/EQC is valid; multiple signed rounds use RMS ---
{
  assert.equal(ctx.sgBiasVal({ biasPeer: 2 }), undefined, 'legacy Peer value is not used as Bias EQA');
  assert.equal(ctx.sgBiasVal({ bias: 0.3 }), 0.3, 'legacy "bias" field (pre-rename) is treated as Bias EQA');
  const stats=ctx.sgBiasStats([{lab:98,target:100},{lab:102,target:100}]);
  assert.equal(stats.signedMean,0,'opposite signed Bias values cancel in the diagnostic signed mean');
  assert.equal(stats.rms,2,'RMS keeps the analytical error magnitude used by Sigma');
  // A single round has nothing to cancel: keep its sign instead of forcing sqrt(bias²).
  const single=ctx.sgBiasStats([{lab:98,target:100}]);
  assert.equal(single.signedMean,-2);
  assert.equal(single.rms,-2,'with one round, the applied Bias keeps its sign instead of losing direction to RMS');
}

// --- CLIA absolute limits may only be converted at a matching measurement unit ---
{
  const matching={name:'Glucose',unit:'mmol/L',teaSource:'clia'};
  assert.ok(ctx.sgTeaBySource(matching,'clia',1)>8,'matching mmol/L uses the greater of the percentage and absolute CLIA limits');
  const mismatch={name:'Glucose',unit:'mg/dL',teaSource:'clia'};
  assert.equal(ctx.sgTeaBySource(mismatch,'clia',1),8,'mismatched units fall back to the percentage criterion instead of mixing units');
  assert.match(ctx.sgTeaCriterionText(mismatch,'clia'),/không áp dụng giới hạn tuyệt đối/);
  const entry={teaSource:'clia',lv:{1:{sourceTargetMean:1}}};
  ctx.sgSetLevelTeaSnapshot(mismatch,entry,1,true);
  assert.equal(entry.lv[1].teaCriterionRule,'percent','the saved criterion records what was actually applied');
  assert.equal(entry.lv[1].teaCriterionAbsolute,undefined,'an incompatible absolute limit is not persisted as if it had been used');
  // Calcium has no CLIA percentage alternative (only an absolute limit) — with a
  // mismatched unit there is nothing usable at all, so no rule should be recorded.
  const noFallback={name:'Calcium',unit:'mg/dL',teaSource:'clia'};
  const entry2={teaSource:'clia',lv:{1:{sourceTargetMean:1}}};
  ctx.sgSetLevelTeaSnapshot(noFallback,entry2,1,true);
  assert.equal(entry2.lv[1].tea,undefined,'no TEa could be resolved');
  assert.equal(entry2.lv[1].teaCriterionRule,undefined,'must not record a rule label with no value behind it');
}

// --- A period snapshot must keep its reviewed TEa when the current reference later changes ---
{
  run(ctx, "state.teaRefs=[{id:'g1',name:'Glucose',unit:'mmol/L',clia:8,ricos:9.99,section:'Hóa sinh'}]");
  const t = { name: 'Glucose', tea: 0, teaSource: 'ricos' };
  const e = { tea: 6.96, teaSource: 'ricos', lv: { 1: { cv: 2, biasEqa: 0.5 } } };
  const R = ctx.sgComp(t, e, 1);
  assert.equal(R.tea, 6.96, 'saved period TEa takes precedence over the newly edited reference table');
  assert.ok(Math.abs(R.sigma - (6.96 - 0.5) / 2) < 1e-9);
  run(ctx, 'state.teaRefs=[]');
}

// --- Manually changing TEa updates only the current period, not reviewed history ---
{
  run(ctx, `
    function requireWrite(){return true;}
    function save(){}
    function rerender(){}
    const currentPeriod=isoMonth();
    state.tests=[{id:'Tmanual',name:'Sodium',tea:0.73,teaSource:'eflm',eflmAnalyte:'Sodium'}];
    state.sigmaData={Tmanual:[
      {id:'old',period:'2026-06',tea:0.73,teaSource:'eflm',lv:{}},
      {id:'current',period:currentPeriod,tea:0.73,teaSource:'eflm',lv:{}}
    ]};
    sgTest='Tmanual';
    sgSetTea('5');
  `);
  assert.equal(run(ctx, "state.sigmaData.Tmanual.find(x=>x.id==='current').tea"), 5, 'the current Sigma period follows a manually entered TEa');
  assert.equal(run(ctx, "state.sigmaData.Tmanual.find(x=>x.id==='old').tea"), 0.73, 'an earlier reviewed period keeps its historical TEa');
}

// --- Automatic IQC import uses the raw, single-lot cohort across month boundaries ---
{
  run(ctx, `
    function requireWrite(){return true;}
    function save(){}
    function rerender(){}
    function alert(v){globalThis.__sigmaAlert=v;}
    function infoDialog(v){globalThis.__sigmaAlert=v;return Promise.resolve();}
    function esc(v){return String(v);}
    function operationalLevels(t){return t.levels;}
    function stats(values){return QCCore.stats(values);}
    state.tests=[{id:'T1',name:'Glucose',tea:0,teaSource:'ricos',levels:[{level:1,mean:100,lot:'L1',applied:'lab'}]}];
    state.data={T1:[
      {date:'2026-06-30',runId:'2026-06-30-1',level:1,lot:'L1',val:100,qcMean:100,qcSd:2},
      {date:'2026-07-01',runId:'2026-07-01-1',level:1,lot:'L1',val:98,qcMean:100,qcSd:2},
      {date:'2026-07-01',runId:'2026-07-01-2',level:1,lot:'L1',val:106,qcMean:100,qcSd:2},
      {date:'2026-07-01',runId:'2026-07-01-3',level:1,lot:'L1',val:999,qcMean:100,qcSd:2,voided:true},
      {date:'2026-07-02',runId:'2026-07-02-1',level:1,lot:'L1',val:102,qcMean:100,qcSd:2}
    ]};
    state.sigmaData={T1:[{id:'P1',period:'2026-07',lv:{}}]};
    sgTest='T1';sgPullCV();
  `);
  const pulled = run(ctx, 'state.sigmaData.T1[0]');
  assert.equal(pulled.lv[1].n, 4, 'the same QC lot remains one cohort across June and July');
  assert.equal(pulled.lv[1].sourceStart, '2026-06-30');
  assert.equal(pulled.lv[1].sourceEnd, '2026-07-02');
  assert.equal(pulled.lv[1].sourceLot, 'L1');
  assert.equal(pulled.lv[1].cvSource, 'iqc-cohort');
  assert.equal(pulled.lv[1].biasIqc, undefined, 'automatic IQC import does not calculate or persist Bias IQC');
  assert.equal(pulled.lv[1].biasIqcTargetSource, undefined);
  assert.equal(ctx.sgComp(run(ctx, 'state.tests[0]'), pulled, 1), null, 'Sigma waits for EQA after importing CV');
  assert.ok(Math.abs(pulled.lv[1].cv-3.36517266534)<1e-8,'CV keeps full precision for the cross-month lot cohort');
}

// --- Choosing a different lot never pools it with the earlier lot ---
{
  run(ctx, `
    state.data.T1.push({date:'2026-07-03',runId:'2026-07-03-1',level:1,lot:'L2',val:100,qcMean:100,qcSd:2});
    state.sigmaData.T1[0].lv[1].sourceTargetMean=999;
    const __groups=sgCohortGroups(state.tests[0],state.sigmaData.T1[0]);
    globalThis.__mixedSummary=sgApplyCohortChoices(state.tests[0],state.sigmaData.T1[0],__groups,{1:'L2'});
  `);
  const level=run(ctx,'state.sigmaData.T1[0].lv[1]');
  assert.equal(run(ctx,'__groups[0].cohorts.length'),2,'both lots are offered as separate choices');
  assert.equal(level.cv,undefined,'a one-point selected lot cannot reuse the earlier lot CV');
  assert.equal(level.sourceTargetMean,undefined,'stale target metadata is removed with the invalid imported CV');
  assert.equal(run(ctx,'__mixedSummary.cleared'),1);
}

// --- A level containing multiple lots in one period can select one cohort, never pool both ---
{
  run(ctx, `
    state.tests=[{id:'Tmulti',name:'Glucose',tea:0,teaSource:'ricos',levels:[{level:1,mean:100,lot:'L2'}]}];
    state.data={Tmulti:[
      {date:'2026-07-01',runId:'2026-07-01-1',level:1,lot:'L1',val:99,qcMean:100,qcSd:2},
      {date:'2026-07-02',runId:'2026-07-02-1',level:1,lot:'L1',val:101,qcMean:100,qcSd:2},
      {date:'2026-07-03',runId:'2026-07-03-1',level:1,lot:'L2',val:109,qcMean:110,qcSd:2},
      {date:'2026-07-04',runId:'2026-07-04-1',level:1,lot:'L2',val:111,qcMean:110,qcSd:2}
    ]};
    state.sigmaData={Tmulti:[{id:'P2',period:'2026-07',lv:{}}]};
    const __multiGroups=sgCohortGroups(state.tests[0],state.sigmaData.Tmulti[0]);
    globalThis.__multiSummary=sgApplyCohortChoices(state.tests[0],state.sigmaData.Tmulti[0],__multiGroups,{1:'L2'});
  `);
  const selected=run(ctx, 'state.sigmaData.Tmulti[0].lv[1]');
  assert.equal(run(ctx,'__multiGroups[0].cohorts.length'),2);
  assert.equal(selected.sourceLot,'L2');
  assert.equal(selected.n,2);
  assert.ok(Math.abs(selected.cv-1.2856486931)<1e-8,'CV is calculated from L2 values 109 and 111 only');
  assert.equal(run(ctx,'__multiSummary.imported'),1);
}

// --- End-to-end: sgComp wires bias-source selection + TEa selection into QCCore.sigmaMetric ---
{
  const t = { name: 'Glucose', tea: 0, teaSource: 'ricos' };
  const e = { lv: { 1: { cv: 2, biasEqa: 0.5 } } };
  const R = ctx.sgComp(t, e, 1);
  assert.equal(R.biasMethod, 'manual');
  assert.equal(R.bias, 0.5);
  assert.equal(R.cv, 2);
  assert.equal(R.tea, 6.96);
  // Sigma = (TEa - |Bias|) / CV = (6.96 - 0.5) / 2
  assert.ok(Math.abs(R.sigma - (6.96 - 0.5) / 2) < 1e-9);
}

// --- Cohort readiness gates classification and QC recommendations ---
{
  const t = { name: 'Glucose', tea: 0, teaSource: 'ricos' };
  const period = n => ({lv:{1:{cv:2,biasEqa:.5,cvSource:'iqc-period',n,cohortStatus:n<20?'insufficient':n<30?'provisional':'eligible'}}});
  const short=ctx.sgComp(t,period(19),1),provisional=ctx.sgComp(t,period(20),1),eligible=ctx.sgComp(t,period(30),1);
  assert.equal(short.classifiable,false);
  assert.equal(short.qcpEligible,false);
  assert.match(short.label,/Chưa đủ/);
  assert.equal(provisional.classifiable,true);
  assert.equal(provisional.qcpEligible,false);
  assert.match(provisional.warning,/tạm thời/);
  assert.equal(eligible.classifiable,true);
  assert.equal(eligible.qcpEligible,true);
  assert.ok(eligible.run);
  const manual=ctx.sgComp(t,{lv:{1:{cv:2,biasEqa:.5}}},1);
  assert.equal(manual.classifiable,true);
  assert.equal(manual.qcpEligible,false);
  assert.match(manual.warning,/nhập tay/);
  assert.match(ctx.sgFrequencyHTML(t,{e:{period:'2026-07'},rs:[short]},[1]),/Không dùng để đề xuất QC/);
}

// --- User-editable reference table (state.teaRefs) overrides/extends REFTESTS ---
{
  run(ctx, "state.teaRefs=[{id:'o1',name:'CK-MB',unit:'U/L',clia:26,ricos:31,section:'Hóa sinh'},{id:'o2',name:'Xét nghiệm mới',unit:'x',clia:12,ricos:null,section:'Khác'}]");
  assert.equal(ctx.sgTeaBySource({ name: 'CK-MB', tea: 0, teaSource: 'ricos' }, 'clia'), 26, 'user override replaces the default CLIA value');
  assert.equal(ctx.sgTeaBySource({ name: 'CK-MB', tea: 0, teaSource: 'ricos' }, 'ricos'), 31, 'user override replaces the default Ricos value');
  assert.equal(ctx.sgTeaBySource({ name: 'Xét nghiệm mới', tea: 0, teaSource: 'ricos' }, 'clia'), 12, 'a brand-new custom entry is looked up');
  assert.equal(ctx.sgTeaBySource({ name: 'Xét nghiệm mới', tea: 0, teaSource: 'ricos' }, 'ricos'), 0, 'null Ricos on a custom entry → 0 (no value)');
  assert.equal(ctx.sgTeaBySource({ name: 'Glucose', tea: 0, teaSource: 'ricos' }, 'ricos'), 6.96, 'untouched defaults still resolve');
  run(ctx, "state.teaRefs=[]");
}

// --- SG_CLIA_FIXED absolute limits must stay in the same unit as their REFTESTS row ---
// The CLIA absolute limits in SG_CLIA_FIXED are hand-converted into each analyte's
// REFTESTS *default* unit. Nothing at runtime re-checks that pairing: if a REFTESTS
// default unit is ever changed (or a key misspelled) without updating SG_CLIA_FIXED,
// sgUnitsMatch() silently stops applying the absolute limit — or applies a value that
// is now in the wrong unit — with no error. Guard the two tables against drifting apart.
{
  const fixed = run(ctx, 'SG_CLIA_FIXED');
  const refUnit = new Map(run(ctx, 'REFTESTS').map(r => [ctx.teaAnalyteMeta(r[0]).analyteId, r[1]]));
  Object.keys(fixed).forEach(key => {
    assert.ok(refUnit.has(key), `SG_CLIA_FIXED key "${key}" has no matching REFTESTS row (dead entry — check the spelling)`);
    assert.equal(
      ctx.sgUnitKey(fixed[key].unit), ctx.sgUnitKey(refUnit.get(key)),
      `SG_CLIA_FIXED["${key}"] unit "${fixed[key].unit}" no longer matches REFTESTS unit "${refUnit.get(key)}" — the pre-converted absolute limit is now in the wrong unit`
    );
  });
}

// --- Pulling CV via the cohort import ("CV lô") must not re-snapshot TEa for a period
// other than the current one — mirrors the guarantee sgSyncCurrentPeriodTea() already
// gives manual TEa edits (see the "an earlier reviewed period keeps its historical TEa"
// assertion above). Regression: sgImportCohort() used to always pass force=true to
// sgSetLevelTeaSnapshot() regardless of which period was being pulled, so re-pulling CV
// for an old, already-reviewed period silently rewrote its TEa to today's reference
// table value instead of leaving the historically captured one alone.
{
  const currentPeriod = run(ctx, 'isoMonth()');
  const fakeCohort = {
    lot: 'L1', n: 3, stats: { cv: 1.8, n: 3 }, start: '2025-12-15', end: '2025-12-17',
    issues: [], excluded: { voided: 0, invalidValue: 0 }, targetMean: 5.5, targetSd: 0.3,
  };
  run(ctx, `
    state.tests=[{id:'T1',name:'Glucose',tea:0,teaSource:'ricos',levels:[{level:1,mean:5.5,sd:0.3,lot:'L1'}]}];
    state.sigmaData={T1:[
      {id:'OLD',period:'2025-12',tea:8,teaEffectiveDate:'2020-01-01',lv:{1:{tea:8,teaEffectiveDate:'2020-01-01'}}},
      {id:'CUR',period:'${currentPeriod}',tea:8,teaEffectiveDate:'2020-01-01',lv:{1:{tea:8,teaEffectiveDate:'2020-01-01'}}},
      {id:'EMPTY',period:'2025-11',lv:{1:{}}}
    ]};
    const t=state.tests[0],data=state.sigmaData.T1,cohort=${JSON.stringify(fakeCohort)};
    sgImportCohort(t,data.find(x=>x.id==='OLD'),1,cohort);
    sgImportCohort(t,data.find(x=>x.id==='CUR'),1,cohort);
    sgImportCohort(t,data.find(x=>x.id==='EMPTY'),1,cohort);
  `);
  assert.equal(run(ctx, "state.sigmaData.T1.find(x=>x.id==='OLD').lv[1].tea"), 8, 'pulling CV for an old, already-TEa-reviewed period leaves its historical TEa untouched');
  assert.equal(run(ctx, "state.sigmaData.T1.find(x=>x.id==='CUR').lv[1].tea"), 6.96, 'pulling CV for the current period still refreshes TEa from the live reference table');
  assert.equal(run(ctx, "state.sigmaData.T1.find(x=>x.id==='EMPTY').lv[1].tea"), 6.96, 'a period that never had a TEa captured still gets one filled in on first import, even if not the current period');
}

// --- Untracking a test from Sigma is admin-only, same as adding one ---
{
  run(ctx, `
    function requireAdmin(){return globalThis.__isAdmin===true;}
    function save(){}
    function rerender(){}
    state.tests=[{id:'T1',name:'Glucose',sgTracked:true}];
    sgTest='T1';
    globalThis.__isAdmin=false;
    sgRemoveTracked('T1');
  `);
  assert.equal(run(ctx, 'state.tests[0].sgTracked'), true, 'a non-admin call to sgRemoveTracked() is blocked and the test stays tracked');
  run(ctx, `globalThis.__isAdmin=true; sgRemoveTracked('T1');`);
  assert.equal(run(ctx, 'state.tests[0].sgTracked'), false, 'an admin can still untrack a test');
}

console.log('Sigma bias/TEa source-selection tests passed');
