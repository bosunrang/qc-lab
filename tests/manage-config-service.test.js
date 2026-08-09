const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
const plain = value => JSON.parse(JSON.stringify(value));
const reset = () => run(ctx, `state={
  instruments:[{id:'I1',name:'AU480',section:'Hóa sinh',active:true},{id:'I2',name:'EasyLyte',section:'Điện giải',active:true}],
  machines:['AU480','EasyLyte'],tests:[],qcPanels:[],assayGroups:[],data:{},sigmaData:{}
};`);

reset();
assert.equal(run(ctx, `ManageConfigService.validateInstrument(state,{data:{name:'  '}}).error`), 'missing-name');
assert.equal(run(ctx, `ManageConfigService.validateInstrument(state,{data:{name:' au480 '}}).error`), 'duplicate-name');
assert.equal(run(ctx, `ManageConfigService.saveInstrument(state,{id:'missing',data:{name:'New'}}).error`), 'not-found');
let result = plain(run(ctx, `ManageConfigService.saveInstrument(state,{newId:'I3',data:{name:'  Cobas  ',section:'  Hóa sinh  ',active:true}})`));
assert.equal(result.created, true);
assert.equal(result.record.name, 'Cobas');
assert.equal(result.record.section, 'Hóa sinh');
assert.deepEqual(plain(run(ctx, 'state.machines')), ['AU480','EasyLyte','Cobas']);
run(ctx, `state.tests=[{id:'T1',name:'Glucose',instrumentId:'I1',machine:'AU480'}]`);
result = plain(run(ctx, `ManageConfigService.saveInstrument(state,{id:'I1',data:{name:'AU5800',section:'Hóa sinh'}})`));
assert.equal(result.created, false);
assert.equal(run(ctx, `state.tests[0].machine`), 'AU5800');
assert.equal(run(ctx, `ManageConfigService.instrumentRemoval(state,{id:'I1'}).error`), 'used-by-assay');
run(ctx, `state.tests=[];state.qcPanels=[{id:'P1',instrumentId:'I1',testIds:[]}]`);
assert.equal(run(ctx, `ManageConfigService.instrumentRemoval(state,{id:'I1'}).error`), 'used-by-panel');
run(ctx, `state.qcPanels=[]`);
result = plain(run(ctx, `ManageConfigService.removeInstrument(state,{id:'I1'})`));
assert.equal(result.record.name, 'AU5800');
assert.equal(run(ctx, `state.instruments.some(x=>x.id==='I1')`), false);

reset();
const validAssay = `{name:'Sodium',analyteId:'sodium',instrumentId:'I1',machine:'AU480',decimalPlaces:2,tea:5,levels:ManageConfigService.defaultAssayLevels()}`;
assert.equal(run(ctx, `ManageConfigService.validateAssay(state,{data:{name:'Sodium',instrumentId:'missing',decimalPlaces:2,tea:5}}).error`), 'missing-required');
assert.equal(run(ctx, `ManageConfigService.validateAssay(state,{data:{name:'Sodium',instrumentId:'I1',decimalPlaces:7,tea:5}}).error`), 'invalid-decimals');
assert.equal(run(ctx, `ManageConfigService.validateAssay(state,{data:{name:'Sodium',instrumentId:'I1',decimalPlaces:2,tea:-1}}).error`), 'invalid-tea');
result = plain(run(ctx, `ManageConfigService.saveAssay(state,{newId:'T1',data:${validAssay}})`));
assert.equal(result.created, true);
assert.deepEqual(plain(run(ctx, `state.data.T1`)), []);
assert.equal(run(ctx, `ManageConfigService.validateAssay(state,{data:${validAssay}}).error`), 'duplicate-assay');
assert.equal(run(ctx, `ManageConfigService.saveAssay(state,{id:'missing',data:${validAssay}}).error`), 'not-found');

run(ctx, `state.qcPanels=[
  {id:'P1',instrumentId:'I1',testIds:['T1']},
  {id:'P2',instrumentId:'I2',testIds:['T1']}
];state.assayGroups=[{id:'G1',testIds:['T1']}];state.sigmaData.T1=[{period:'2026-08'}];state.data.T1=[{id:'p1'}];`);
result = plain(run(ctx, `ManageConfigService.saveAssay(state,{id:'T1',data:{...state.tests[0],instrumentId:'I2',machine:'EasyLyte'}})`));
assert.equal(result.oldInstrumentId, 'I1');
assert.deepEqual(plain(run(ctx, `state.qcPanels.map(p=>p.testIds)`)), [[],['T1']]);
result = plain(run(ctx, `ManageConfigService.removeAssay(state,{id:'T1'})`));
assert.equal(result.pointsCount, 1);
assert.equal(run(ctx, `state.tests.length`), 0);
assert.deepEqual(plain(run(ctx, `state.qcPanels.map(p=>p.testIds)`)), [[],[]]);
assert.deepEqual(plain(run(ctx, `state.assayGroups[0].testIds`)), []);
assert.equal(run(ctx, `'T1' in state.data`), false);
assert.equal(run(ctx, `'T1' in state.sigmaData`), false);

assert.deepEqual(plain(run(ctx, `ManageConfigService.defaultAssayLevels()`)), [{level:1,mean:null,sd:null,low:null,high:null,rangeK:2,mfgMean:null,mfgSd:null,applied:'mfg',meanSdHistory:[]}]);
console.log('manage-config-service tests passed');
