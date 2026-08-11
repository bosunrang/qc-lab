const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { loadSandbox, run } = require('../tests/helpers/sandbox');
const { makeState } = require('./performance-baseline');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'performance-budget.json'), 'utf8'));
const budget = config.budgets;

function measure(fn, repeats = 1) {
  const samples = [];
  let value;
  for (let i = 0; i < repeats; i++) {
    const started = performance.now();value = fn(i);samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { ms:Number(samples[Math.floor(samples.length / 2)].toFixed(2)), value };
}

const source = makeState(config.scenario),raw = JSON.stringify(source),shell = { ...source, data:{} },shellRaw = JSON.stringify({ format:1, slot:'a', shell });

(async () => {
const startup = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/settings.js']);
startup.__shellCopies = Array.from({ length:3 }, () => JSON.parse(shellRaw));
const shellInit = measure(i => {
  startup.__candidate = startup.__shellCopies[i];
  return run(startup, `(()=>{const errors=QCCore.validateBackup(__candidate.shell);if(errors.length)throw new Error(errors[0]);state=QCCore.sanitizeBackup(__candidate.shell,{owned:true});ensureShape({sanitized:true});const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length)throw new Error(invariantErrors[0]);})()`);
}, 3);
startup.__full = JSON.parse(raw);
const fullStartup = measure(() => run(startup, `(()=>{const errors=QCCore.validateBackup(__full);if(errors.length)throw new Error(errors[0]);state=QCCore.sanitizeBackup(__full,{owned:true});ensureShape({sanitized:true});const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length)throw new Error(invariantErrors[0]);})()`));

const domain = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/state-storage.js']);
domain.__state = makeState(config.scenario);run(domain, 'state=__state;clearDerived()');
const domainAll = `operationalTests().forEach(t=>{activeWestgard(t);operationalLevels(t).forEach(l=>{acceptedLotPoints(t,l.level);cusumSeries(t,l);});});`;
const coldDomain = measure(() => run(domain, `(()=>{clearDerived();${domainAll}})()`));
const warmDomain = measure(() => run(domain, `(()=>{${domainAll}})()`), 5);
const unrelatedChange = measure(() => run(domain, `(()=>{invalidateDerivedForSave({clearDerived:false});${domainAll}})()`), 5);
const oneTest = measure(() => run(domain, `(()=>{invalidateDerivedForSave({testId:state.tests[0].id});${domainAll}})()`), 3);

const chart = loadSandbox(['core.js', 'generated/modular-pilot.js']),renderValues = Array.from({ length:100000 }, (_, i) => Math.sin(i / 31));
renderValues[12345] = -20;renderValues[87654] = 20;
const sampling = measure(() => chart.ChartViewModel.sampleIndices({ length:renderValues.length,maxPoints:640,valueAt:i=>renderValues[i],preserve:[50000] }), 3);
const sample = sampling.value;
const runs = Array.from({ length:10000 }, (_, i) => `run-${i}`),queries = runs.slice().reverse(),runIndex = new Map(runs.map((value, i) => [value, i]));
const mapLookup = measure(() => queries.forEach(value => runIndex.get(value)), 3);

/* Đường LƯU: ghi tăng dần (writePartitioned + dirtyTestIds) là tối ưu đã chốt —
   gate này khóa cả tín hiệu cấu trúc (chỉ 1 partition được ghi lại, byte ghi
   nhỏ hơn nhiều ghi đầy đủ) lẫn thời gian. IndexedDB giả đếm byte qua put() để
   xấp xỉ chi phí structured-clone thật của trình duyệt. */
const saveCtx = loadSandbox(['modules/local-store.js'], { performance });
saveCtx.__state = source;
const saveBench = await run(saveCtx, `
  var __records=new Map(),__hasStore=false,__putBytes=0;
  var __db={objectStoreNames:{contains:function(){return __hasStore;}},createObjectStore:function(){__hasStore=true;},close:function(){},transaction:function(){return{objectStore:function(){return{
    get:function(key){var req={};Promise.resolve().then(function(){req.result=__records.get(key);if(req.onsuccess)req.onsuccess();});return req;},
    put:function(value){var req={};Promise.resolve().then(function(){__records.set(value.key,value);__putBytes+=JSON.stringify(value).length;if(req.onsuccess)req.onsuccess();});return req;},
    delete:function(key){var req={};Promise.resolve().then(function(){__records.delete(key);if(req.onsuccess)req.onsuccess();});return req;}
  };}};}};
  indexedDB={open:function(){var req={result:__db};Promise.resolve().then(function(){if(req.onupgradeneeded)req.onupgradeneeded();if(req.onsuccess)req.onsuccess();});return req;}};
  (async()=>{
    const seed=await LocalStore.writePartitioned(__state,'');
    const t1=performance.now(),b1=__putBytes;
    const full=await LocalStore.writePartitioned(__state,seed.slot);
    const fullMs=performance.now()-t1,fullBytes=__putBytes-b1;
    const dirtyId=__state.tests[0].id,incSamples=[];
    let inc=null,incBytes=0;
    for(let i=0;i<5;i++){
      const t=performance.now(),b=__putBytes;
      inc=await LocalStore.writePartitioned(__state,i?inc.slot:full.slot,{dirtyTestIds:[dirtyId]});
      incSamples.push(performance.now()-t);if(!i)incBytes=__putBytes-b;
    }
    incSamples.sort((a,b)=>a-b);
    return{fullMs,fullBytes,fullMode:full.mode,incMs:incSamples[2],incBytes,incPartitions:inc.partitionsWritten,incMode:inc.mode};
  })()
`);

const metrics = {
  points:Object.values(source.data).reduce((sum, rows) => sum + rows.length, 0),
  bootShellRatio:Number((Buffer.byteLength(shellRaw) / Buffer.byteLength(raw)).toFixed(5)),
  shellInitMs:shellInit.ms,
  fullStartupMs:fullStartup.ms,
  coldDomainMs:coldDomain.ms,
  warmDomainColdRatio:Number((warmDomain.ms / Math.max(coldDomain.ms, 0.001)).toFixed(5)),
  unrelatedChangeColdRatio:Number((unrelatedChange.ms / Math.max(coldDomain.ms, 0.001)).toFixed(5)),
  oneTestColdRatio:Number((oneTest.ms / Math.max(coldDomain.ms, 0.001)).toFixed(5)),
  displaySamplePoints:sample.length,
  displaySamplingMs:sampling.ms,
  mapLookupMs:mapLookup.ms,
  preservedDisplaySignals:sample.includes(0)&&sample.includes(renderValues.length-1)&&sample.includes(12345)&&sample.includes(87654)&&sample.includes(50000),
  saveFullMs:Number(saveBench.fullMs.toFixed(2)),
  saveIncrementalMs:Number(saveBench.incMs.toFixed(2)),
  saveIncrementalBytesRatio:Number((saveBench.incBytes / Math.max(saveBench.fullBytes, 1)).toFixed(5)),
  saveIncrementalPartitions:saveBench.incPartitions,
};

const failures = [];
function max(name, actual, limit){if(actual>limit)failures.push({name,actual,expected:`<= ${limit}`});}
max('bootShellRatio',metrics.bootShellRatio,budget.bootShellMaxRatio);
max('shellInitMs',metrics.shellInitMs,budget.shellInitMaxMs);
max('fullStartupMs',metrics.fullStartupMs,budget.fullStartupMaxMs);
max('coldDomainMs',metrics.coldDomainMs,budget.coldDomainMaxMs);
max('warmDomainColdRatio',metrics.warmDomainColdRatio,budget.warmDomainMaxColdRatio);
max('unrelatedChangeColdRatio',metrics.unrelatedChangeColdRatio,budget.unrelatedChangeMaxColdRatio);
max('oneTestColdRatio',metrics.oneTestColdRatio,budget.oneTestMaxColdRatio);
max('displaySamplePoints',metrics.displaySamplePoints,budget.displaySampleMaxPoints);
max('displaySamplingMs',metrics.displaySamplingMs,budget.displaySamplingMaxMs);
max('mapLookupMs',metrics.mapLookupMs,budget.mapLookupMaxMs);
max('saveIncrementalMs',metrics.saveIncrementalMs,budget.saveIncrementalMaxMs);
max('saveIncrementalBytesRatio',metrics.saveIncrementalBytesRatio,budget.saveIncrementalMaxBytesRatio);
max('saveIncrementalPartitions',metrics.saveIncrementalPartitions,budget.saveIncrementalMaxPartitions);
if(!metrics.preservedDisplaySignals)failures.push({name:'preservedDisplaySignals',actual:false,expected:'true'});

const report={gate:'QC Lab performance regression',pass:failures.length===0,node:process.version,platform:`${process.platform}-${process.arch}`,scenario:config.scenario,budgets:budget,metrics,failures};
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
if(failures.length)process.exitCode=1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
