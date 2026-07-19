const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js']);

// Removing lot 1103 from the only group that contains it must unlink level 3 and
// physically remove its saved Sigma inputs/calculation sources from every period.
run(ctx, `
  state.lotGroups=[{id:'G1',name:'1101/1102',lotIds:['L1','L2'],active:true}];
  state.qcLots=[
    {id:'L1',lotNo:'1101',level:1,active:true},
    {id:'L2',lotNo:'1102',level:2,active:true},
    {id:'L3',lotNo:'1103',level:3,active:true}
  ];
  state.tests=[{id:'T1',name:'Sodium',levels:[
    {level:1,qcLotId:'L1',lot:'1101'},
    {level:2,qcLotId:'L2',lot:'1102'},
    {level:3,qcLotId:'L3',lot:'1103',exp:'2027-01-01',meanSdHistory:[{qcLotId:'L3',lot:'1103',mean:100,sd:2}]}
  ]}];
  state.sigmaData={T1:[
    {id:'P1',period:'2026-06',lv:{1:{cv:1},2:{cv:2},3:{cv:3,biasEqa:1}}},
    {id:'P2',period:'2026-07',lv:{1:{cv:1},2:{cv:2},3:{cv:4,biasEqa:2}}}
  ]};
  globalThis.__firstSync=reconcileSigmaLevelsWithLotGroups();
`);
assert.deepEqual(JSON.parse(JSON.stringify(run(ctx, '__firstSync'))), { unlinked: 1, pruned: 2, tests: 1 });
assert.equal(run(ctx, "state.tests[0].levels[2].qcLotId"), '', 'the removed lot is no longer the live level assignment');
assert.equal(run(ctx, "state.tests[0].levels[2].lot"), '');
assert.equal(run(ctx, "state.tests[0].levels[2].meanSdHistory.length"), 1, 'Mean/SD history remains available for audit');
assert.equal(run(ctx, "Object.hasOwn(state.sigmaData.T1[0].lv,'3')"), false);
assert.equal(run(ctx, "Object.hasOwn(state.sigmaData.T1[1].lv,'3')"), false);
assert.equal(run(ctx, "Object.keys(state.sigmaData.T1[1].lv).join(',')"), '1,2');

// A previous buggy version may already have cleared qcLotId but left lv[3]. The
// load-time repair still removes that stale key when levels 1/2 remain grouped.
run(ctx, `state.sigmaData.T1[0].lv[3]={cv:9,biasEqa:1}; globalThis.__repairSync=reconcileSigmaLevelsWithLotGroups();`);
assert.equal(run(ctx, '__repairSync.pruned'), 1);
assert.equal(run(ctx, "Object.hasOwn(state.sigmaData.T1[0].lv,'3')"), false);

// Stopping a group is reversible and must preserve its Sigma history.
run(ctx, `
  state.lotGroups.push({id:'G2',name:'1103',lotIds:['L3'],active:true,status:'stopped'});
  state.tests[0].levels[2].qcLotId='L3';state.tests[0].levels[2].lot='1103';
  state.sigmaData.T1[0].lv[3]={cv:3,biasEqa:1};
  globalThis.__stoppedSync=reconcileSigmaLevelsWithLotGroups();
`);
assert.equal(run(ctx, '__stoppedSync.pruned'), 0);
assert.equal(run(ctx, "state.tests[0].levels[2].qcLotId"), 'L3');
assert.equal(run(ctx, "Object.hasOwn(state.sigmaData.T1[0].lv,'3')"), true);

// Legacy/manual Sigma data without any lot relationship is left untouched.
run(ctx, `
  state.lotGroups=[];state.tests=[{id:'LEG',levels:[{level:1,qcLotId:''}]}];
  state.sigmaData={LEG:[{id:'OLD',lv:{1:{cv:2,biasEqa:1}}}]};
  globalThis.__legacySync=reconcileSigmaLevelsWithLotGroups();
`);
assert.equal(run(ctx, '__legacySync.pruned'), 0);
assert.equal(run(ctx, "Object.hasOwn(state.sigmaData.LEG[0].lv,'1')"), true);

console.log('Sigma level reconciliation tests passed');
