const assert = require('node:assert/strict');
const { loadSandbox } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
const state = {data:{T1:[
  {id:'p1',date:'2026-07-01',runId:'2026-07-01-1',level:1,lot:'L1',val:100,qcMean:100,qcSd:2},
  {id:'p2',date:'2026-07-01',runId:'2026-07-01-2',level:1,lot:'L1',val:106,qcMean:100,qcSd:2},
  {id:'p3',date:'2026-07-02',runId:'2026-07-02-1',level:1,lot:'L1',val:94,qcMean:100,qcSd:2},
  {id:'p4',date:'2026-07-03',runId:'2026-07-03-1',level:1,lot:'L1',val:999,qcMean:100,qcSd:2,voided:true},
  {id:'p5',date:'2026-07-04',runId:'2026-07-04-1',level:1,lot:'L1',val:'bad',qcMean:100,qcSd:2},
  {id:'p5b',date:'2026-07-04',runId:'2026-07-04-2',level:1,lot:'L1',val:'',qcMean:null,qcSd:null},
  {id:'p6',date:'2026-07-05',runId:'2026-07-05-1',level:1,lot:'L2',val:200,qcMean:200,qcSd:4},
  {id:'p7',date:'2026-06-30',runId:'2026-06-30-1',level:1,lot:'L1',val:1,qcMean:100,qcSd:2},
  {id:'p8',date:'2026-07-01',runId:'2026-07-01-1',level:2,lot:'L1',val:300,qcMean:300,qcSd:5}
]}};

assert.equal(ctx.SigmaCohortService.normalizePeriod('2026-7'),'2026-07');
assert.equal(ctx.SigmaCohortService.normalizePeriod('2026-13'),'');
assert.equal(ctx.SigmaCohortService.normalizeDate('2026-07-01'),'2026-07-01');
assert.equal(ctx.SigmaCohortService.normalizeDate('2026-02-30'),'');

const cohorts=ctx.SigmaCohortService.cohortsForLevelByLot(state,{testId:'T1',level:1,startDate:'2026-07-01',endDate:'2026-07-31'});
assert.equal(cohorts.length,2,'a window containing two lots must produce two cohorts');
const l1=cohorts.find(c=>c.lot==='L1'),l2=cohorts.find(c=>c.lot==='L2');
assert.deepEqual(Array.from(l1.points,p=>p.id),['p1','p2','p3'],'all non-voided finite measurements, including later runs, remain in the cohort');
assert.equal(l1.n,3);
assert.equal(l1.excluded.voided,1);
assert.equal(l1.excluded.invalidValue,2);
assert.equal(l1.start,'2026-07-01');
assert.equal(l1.end,'2026-07-02');
assert.equal(l1.targetMean,100);
assert.equal(l1.targetSd,2);
assert.equal(l2.n,1);
assert.equal(l2.targetMean,200);
assert.ok(l1.stats.cv>0);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.SigmaCohortService.assess({n:19,issues:[]}))),{status:'insufficient',classifiable:false,qcpEligible:false,minimum:20,recommended:30});
assert.equal(ctx.SigmaCohortService.assess({n:20,issues:[]}).status,'provisional');
assert.equal(ctx.SigmaCohortService.assess({n:20,issues:[]}).classifiable,true);
assert.equal(ctx.SigmaCohortService.assess({n:20,issues:[]}).qcpEligible,false);
assert.equal(ctx.SigmaCohortService.assess({n:30,issues:[]}).status,'eligible');
assert.equal(ctx.SigmaCohortService.assess({n:30,issues:[]}).qcpEligible,true);
assert.equal(ctx.SigmaCohortService.assess({n:40,issues:['mixed-target-mean']}).status,'unstable');

const mixed={data:{T1:[
  {date:'2026-07-01',runId:'2026-07-01-1',level:1,lot:'L1',val:10,qcMean:10,qcSd:1},
  {date:'2026-07-02',runId:'2026-07-02-1',level:1,lot:'L1',val:11,qcMean:12,qcSd:1.2}
]}};
const changed=ctx.SigmaCohortService.cohortsForLevelByLot(mixed,{testId:'T1',level:1,startDate:'2026-07-01',endDate:'2026-07-31'})[0];
assert.equal(changed.targetMean,null);
assert.ok(changed.issues.includes('mixed-target-mean'));
assert.ok(changed.issues.includes('mixed-target-sd'));

const crossMonth={data:{T1:[
  {id:'j1',date:'2026-07-30',level:1,lot:'L9',val:100,qcMean:100,qcSd:2},
  {id:'a1',date:'2026-08-01',level:1,lot:'L9',val:101,qcMean:100,qcSd:2},
  {id:'a2',date:'2026-08-15',level:1,lot:'L9',val:99,qcMean:100,qcSd:2},
  {id:'future',date:'2026-08-16',level:1,lot:'L9',val:500,qcMean:100,qcSd:2},
  {id:'new',date:'2026-08-15',level:1,lot:'L10',val:200,qcMean:200,qcSd:4}
]}};
const byLot=ctx.SigmaCohortService.cohortsForLevelByLot(crossMonth,{testId:'T1',level:1,endDate:'2026-08-15'});
assert.equal(byLot.length,2);
const l9=byLot.find(c=>c.lot==='L9');
assert.deepEqual(Array.from(l9.points,p=>p.id),['j1','a1','a2'],'same-lot points cross the month boundary but respect the evaluation cutoff');
assert.equal(l9.start,'2026-07-30');
assert.equal(l9.end,'2026-08-15');

const missingLot=ctx.SigmaCohortService.cohortsForLevelByLot({data:{T1:[{date:'2026-08-01',level:1,lot:'',val:1,qcMean:1,qcSd:.1}]}},{testId:'T1',level:1,endDate:'2026-08-31'})[0];
assert.ok(missingLot.issues.includes('missing-lot'));
assert.equal(ctx.SigmaCohortService.assess(missingLot).status,'unstable');

console.log('Sigma cohort service tests passed');
