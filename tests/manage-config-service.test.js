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
run(ctx, `state.tests=[{id:'T1',instrumentId:'I1'},{id:'T2',instrumentId:'I2'}]`);
assert.equal(run(ctx, `ManageConfigService.validatePanel(state,{data:{name:'Panel',instrumentId:'I1',testIds:[]}}).error`), 'missing-tests');
assert.equal(run(ctx, `ManageConfigService.validatePanel(state,{data:{name:'Panel',instrumentId:'I1',testIds:['T2']}}).error`), 'wrong-instrument');
result = plain(run(ctx, `ManageConfigService.savePanel(state,{newId:'P1',data:{name:'  Hóa sinh  ',instrumentId:'I1',testIds:['T1','T1'],note:'Ghi chú',active:true}})`));
assert.equal(result.created, true);
assert.equal(result.record.name, 'Hóa sinh');
assert.deepEqual(plain(run(ctx, `state.qcPanels[0].testIds`)), ['T1'], 'panel test IDs are unique');
assert.equal(run(ctx, `ManageConfigService.validatePanel(state,{data:{name:'hoa sinh',instrumentId:'I1',testIds:['T1']}}).error`), 'duplicate-panel');
run(ctx, `state.lotTransitions=[{panelId:'P1'}]`);
assert.equal(run(ctx, `ManageConfigService.panelRemoval(state,{id:'P1'}).error`), 'used-by-transition');
run(ctx, `state.lotTransitions=[]`);
assert.equal(run(ctx, `ManageConfigService.removePanel(state,{id:'P1'}).record.id`), 'P1');
assert.equal(run(ctx, `state.qcPanels.length`), 0);

reset();
run(ctx, `state.qcLots=[{id:'L1',lotNo:'LOT-1'},{id:'L2',lotNo:'LOT-2'},{id:'L3',lotNo:'LOT-3'}]`);
assert.equal(run(ctx, `ManageConfigService.validateLotGroup(state,{data:{lotIds:['L1'],name:''}}).error`), 'too-few-lots');
result = plain(run(ctx, `ManageConfigService.saveLotGroup(state,{newId:'G1',data:{lotIds:['L2','L1','L1'],name:'',note:'Nhóm thử'}})`));
assert.equal(result.created, true);
assert.equal(result.record.name, 'LOT-2/LOT-1');
assert.deepEqual(plain(run(ctx, `state.lotGroups[0].lotIds`)), ['L2','L1']);
assert.equal(run(ctx, `ManageConfigService.validateLotGroup(state,{data:{lotIds:['L1','L2'],name:'Khác'}}).error`), 'duplicate-group', 'same lots in another order cannot make a duplicate group');
run(ctx, `state.tests=[{levels:[{qcLotId:'L1'}]}]`);
assert.equal(run(ctx, `ManageConfigService.lotGroupRemoval(state,{id:'G1'}).error`), 'used-by-assay');
run(ctx, `state.tests=[]`);
assert.equal(run(ctx, `ManageConfigService.removeLotGroup(state,{id:'G1'}).record.id`), 'G1');
assert.equal(run(ctx, `state.lotGroups.length`), 0);
run(ctx, `state.lotGroups=[{id:'G2',name:'Nhóm đang dùng'}]`);
assert.equal(run(ctx, `ManageConfigService.stopLotGroup(state,{id:'G2',stoppedAt:'2026-08-09'}).record.status`), 'stopped');
assert.equal(run(ctx, `state.lotGroups[0].stoppedAt`), '2026-08-09');
assert.equal(run(ctx, `ManageConfigService.stopLotGroup(state,{id:'G2',stoppedAt:'2026-08-10'}).error`), 'not-stoppable');

reset();
run(ctx, `state.qcLots=[{id:'L1',level:1},{id:'L2',level:2},{id:'L3',level:1}];state.lotTransitions=[{id:'TR1',panelId:'P1',fromLotId:'L1',toLotId:'L3',status:'accepted',applied:true}]`);
assert.equal(run(ctx, `ManageConfigService.validateLotTransition(state,{panelId:'',fromLotId:'L1',toLotId:'L3'}).error`), 'missing-panel');
assert.equal(run(ctx, `ManageConfigService.validateLotTransition(state,{panelId:'P1',fromLotId:'L1',toLotId:'L2'}).error`), 'different-levels');
assert.equal(run(ctx, `ManageConfigService.validateLotTransition(state,{panelId:'P1',fromLotId:'L1',toLotId:'L3'}).error`), 'duplicate-transition');
assert.equal(run(ctx, `ManageConfigService.validateLotTransition(state,{id:'TR1',panelId:'P1',fromLotId:'L1',toLotId:'L3',status:'planned',switchesLot:item=>item.applied}).error`), 'accepted-immutable');
result = plain(run(ctx, `ManageConfigService.validateLotTransition(state,{id:'TR1',panelId:'P1',fromLotId:'L1',toLotId:'L3',status:'accepted',switchesLot:item=>item.applied})`));
assert.equal(result.finalChanged, false);
result = plain(run(ctx, `ManageConfigService.saveLotTransition(state,{newId:'TR2',data:{panelId:'P2',status:'planned'}})`));
assert.equal(result.created, true);
assert.equal(run(ctx, `ManageConfigService.saveLotTransition(state,{id:'TR2',data:{status:'rejected'}}).created`), false);
assert.equal(run(ctx, `state.lotTransitions.find(x=>x.id==='TR2').status`), 'rejected');
assert.equal(run(ctx, `ManageConfigService.lotTransitionRemoval(state,{id:'TR1',switchesLot:item=>item.applied}).error`), 'accepted-applied');
assert.equal(run(ctx, `ManageConfigService.removeLotTransition(state,{id:'TR2',switchesLot:()=>false}).record.id`), 'TR2');
assert.equal(run(ctx, `state.lotTransitions.some(x=>x.id==='TR2')`), false);
result = plain(run(ctx, `ManageConfigService.prepareLotTransitionData({old:{criteria:'c',conclusion:'k',approvedBy:'old',approvedAt:'old-at',note:'n'},panelId:'P1',fromLotId:'L1',toLotId:'L3',status:'accepted',startDate:'',today:'2026-08-09',finalChanged:true,approvedBy:'new',approvedAt:'new-at'})`));
assert.deepEqual(result, {panelId:'P1',fromLotId:'L1',toLotId:'L3',startDate:'2026-08-09',status:'accepted',criteria:'c',conclusion:'k',approvedBy:'new',approvedAt:'new-at',note:'n'});
assert.equal(run(ctx, `ManageConfigService.transitionSwitchesLot({fromLotId:'L1',toLotId:'L2',status:'accepted'})`), true);
run(ctx, `state.qcLots=[{id:'L1'},{id:'L2'}];state.lotTransitions=[{fromLotId:'L1',toLotId:'L2',status:'accepted'},{fromLotId:'L2',toLotId:'L1',status:'planned'}]`);
assert.deepEqual(plain(run(ctx, `[...ManageConfigService.syncLotDepletion(state)]`)), ['L1']);
assert.equal(run(ctx, `state.qcLots[0].depleted`), true);
assert.equal(run(ctx, `state.qcLots[1].depleted`), false);
run(ctx, `state.qcLots=[{id:'L1',lotNo:'LOT-1'}];state.lotGroups=[{id:'G1',lotIds:['L1','L1'],active:true,name:''},{id:'G2',lotIds:['L1'],active:true,name:'Khác'}]`);
assert.deepEqual(plain(run(ctx, `[...ManageConfigService.normalizeLotGroups(state)]`)), ['G2']);
assert.deepEqual(plain(run(ctx, `state.lotGroups`)), [{id:'G1',lotIds:['L1'],active:true,name:'LOT-1'}]);

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

const candidates=plain(run(ctx, `ManageConfigService.lotGroupActivationCandidates([
  {id:'T1',levels:[{level:1,qcLotId:'OLD'}]},
  {id:'T2',levels:[{level:1,qcLotId:'L1'}]}
],[{id:'L1',lotNo:'LOT-1',level:1}],(test,level,lotId)=>test.id==='T1'?{mean:100,sd:2,low:96,high:104}:null)`));
assert.equal(candidates.length, 1, 'only an assay with a usable target snapshot and a different current lot is eligible');
assert.deepEqual(candidates[0].pick, {use:true,mean:100,low:96,high:104,sd:2});
assert.equal(run(ctx, `ManageConfigService.activationReplacedGroupId({levels:[{level:1,qcLotId:'OLD'}]},{id:'L1',level:1},'NEW',id=>id==='OLD'?[{id:'OLD-GROUP'}]:[])`), 'OLD-GROUP');
assert.equal(run(ctx, `ManageConfigService.activationReplacedGroupId({levels:[{level:1,qcLotId:'L1'}]},{id:'L1',level:1},'NEW',()=>[{id:'NEW'}])`), '', 'already-linked lots do not stop another group');
const activation=plain(run(ctx, `(function(){
  const old={id:'OLD'},next={id:'NEW',status:'stopped',stoppedAt:'2026-01-01'},test={levels:[{level:1,qcLotId:'OLDLOT'}]},lot={id:'NEWLOT',level:1};
  const result=ManageConfigService.applyLotGroupActivation({group:next,candidates:[{t:test,lot,pick:{use:true}}],groups:[old,next],effectiveFrom:'2026-08-09',note:'activate',applyTarget:()=>true,groupsForLot:id=>id==='OLDLOT'?[old]:[],groupInUse:()=>false});
  return {result,old,next};
})()`));
assert.equal(activation.result.status, 'applied');
assert.equal(activation.result.count, 1);
assert.equal(activation.old.status, 'stopped');
assert.equal(activation.old.stoppedAt, '2026-08-09');
assert.equal(activation.next.status, undefined, 'the activated group clears its stale stopped marker');

reset();
run(ctx, `state.qcLots=[{id:'L1',lotNo:'LOT-1',level:1}];state.tests=[{levels:[{qcLotId:'L1'}]}];`);
assert.equal(run(ctx, `ManageConfigService.validateLot(state,{data:{lotNo:'',level:1}}).error`), 'missing-lot-no');
assert.equal(run(ctx, `ManageConfigService.validateLot(state,{data:{lotNo:'lot-1',level:1}}).error`), 'duplicate-lot');
assert.equal(run(ctx, `ManageConfigService.validateLot(state,{id:'L1',data:{lotNo:'LOT-1',level:2}}).error`), 'level-in-use');
run(ctx, `state.tests=[{levels:[{qcLotId:'L1',level:1,lot:'LOT-1',exp:'2026-01-01',meanSdHistory:[{qcLotId:'L1',lot:'LOT-1'}]}]}]`);
result = plain(run(ctx, `ManageConfigService.saveLot(state,{id:'L1',data:{lotNo:'LOT-RENAMED',level:1,exp:'2027-01-01'},renamePoints:(level,oldLot,newLot)=>level===1&&oldLot==='LOT-1'&&newLot==='LOT-RENAMED'?3:0})`));
assert.equal(result.created, false);
assert.equal(result.renamedPoints, 3);
assert.equal(run(ctx, `state.tests[0].levels[0].lot`), 'LOT-RENAMED');
assert.equal(run(ctx, `state.tests[0].levels[0].meanSdHistory[0].lot`), 'LOT-RENAMED');
run(ctx, `state.data={T1:[{level:1,lot:'OLD'},{level:2,lot:'OLD'}],T2:[{level:1,lot:'OLD'},{level:1,lot:'OTHER'}]}`);
assert.equal(run(ctx, `ManageConfigService.lotPointsToRename(state,1,'OLD').length`), 2);
assert.equal(run(ctx, `ManageConfigService.renameLotPoints(state,1,'OLD','NEW')`), 2);
assert.deepEqual(plain(run(ctx, `Object.values(state.data).flat().map(p=>p.lot)`)), ['NEW','OLD','NEW','OTHER']);

reset();
run(ctx, `state.qcLots=[{id:'L1',lotNo:'LOT-1'}];state.lotGroups=[{id:'G1',lotIds:['L1']}];state.lotTransitions=[{fromLotId:'L1',toLotId:'L2',status:'accepted'}];`);
assert.equal(run(ctx, `ManageConfigService.lotRemoval(state,{id:'L1',switchesLot:t=>t.status==='accepted'}).error`), 'used-by-accepted-transition');
run(ctx, `state.lotTransitions=[];state.tests=[{levels:[{qcLotId:'L1'}]}]`);
assert.equal(run(ctx, `ManageConfigService.lotRemoval(state,{id:'L1',switchesLot:()=>false}).error`), 'used-by-assay');
run(ctx, `state.tests=[]`);
assert.equal(run(ctx, `ManageConfigService.removeLot(state,{id:'L1',switchesLot:()=>false}).record.lotNo`), 'LOT-1');
assert.equal(run(ctx, `state.qcLots.length`), 0);
assert.deepEqual(plain(run(ctx, `state.lotGroups[0].lotIds`)), []);

assert.equal(run(ctx, `ManageConfigService.targetPickBackfillPoints([{id:'P1',level:1,lot:'OLD'},{id:'P2',level:1,lot:'OTHER'}],{levels:[{level:1,lot:'OLD'}]},{id:'NEW',level:1,lotNo:'NEW'},{use:true}).length`), 1);
result = plain(run(ctx, `ManageConfigService.normalizeTargetPick({meanRaw:'',lowRaw:'96',highRaw:'104',sdRaw:''})`));
assert.deepEqual(result, {use:true,mean:100,low:96,high:104,sd:2});
assert.deepEqual(plain(run(ctx, `ManageConfigService.normalizeTargetPick({meanRaw:'100',lowRaw:'',highRaw:'',sdRaw:'2',deriveLimits:false})`)), {use:true,mean:100,low:null,high:null,sd:2});
assert.equal(run(ctx, `ManageConfigService.normalizeTargetPick({meanRaw:'100',lowRaw:'104',highRaw:'96',sdRaw:''}).error`), 'invalid-range');
assert.equal(run(ctx, `ManageConfigService.normalizeTargetPick({meanRaw:'100',lowRaw:'',highRaw:'',sdRaw:'0'}).error`), 'invalid-sd');
const targetApply=plain(run(ctx, `(function(){
  const test={id:'T1',levels:[{level:1,qcLotId:'OLD',lot:'OLD-LOT',exp:'2026-01-01',mean:100,sd:2,low:96,high:104,applied:'mfg',meanSdHistory:[]}]};
  const points=[{id:'P1',level:1,lot:null,qcMean:null,qcSd:null},{id:'P2',level:1,lot:'OTHER'}],history=[];
  const changed=ManageConfigService.applyTargetPick({test,lot:{id:'NEW',lotNo:'NEW-LOT',level:1,exp:'2027-01-01'},pick:{use:true,mean:120,sd:3,low:114,high:126},effectiveFrom:'2026-08-09',note:'switch',lots:[{id:'OLD',lotNo:'OLD-LOT'}],points,upsertHistory:(target,lot,entry)=>{history.push({lot:lot.id,entry});target.meanSdHistory.push({...entry,qcLotId:lot.id,lot:lot.lotNo});}});
  return {changed,test,points,history};
})()`));
assert.equal(targetApply.changed, true);
assert.equal(targetApply.test.levels[0].qcLotId, 'NEW');
assert.equal(targetApply.points[0].lot, 'OLD-LOT', 'backfill preserves the outgoing lot identity on historic points');
assert.equal(targetApply.points[0].qcMean, 100);
assert.deepEqual(targetApply.history.map(item => [item.lot,item.entry.effectiveTo,item.entry.planned]), [['OLD','2026-08-09',false],['NEW','2027-01-01',false]]);
const plannedTarget=plain(run(ctx, `(function(){
  const test={levels:[{level:1,meanSdHistory:[]}]},entries=[];
  const changed=ManageConfigService.applyPlannedTarget({test,lot:{id:'L1',lotNo:'LOT-1',level:1},pick:{use:true,mean:100,sd:2,low:96,high:104},note:'draft',upsertHistory:(target,lot,entry)=>entries.push({lot:lot.id,entry})});
  return {changed,entries};
})()`));
assert.equal(plannedTarget.changed, true);
assert.equal(plannedTarget.entries[0].entry.planned, true);
const matrixApply=plain(run(ctx, `(function(){
  const oldGroup={id:'G-OLD'},nextGroup={id:'G-NEXT',status:'stopped'},test={id:'T1',levels:[{level:1,qcLotId:'OLD',lot:'OLD-LOT',mean:100,sd:2,meanSdHistory:[]}]},history=[];
  const result=ManageConfigService.applyTargetMatrix({picked:[{testId:'T1',lot:{id:'NEW',lotNo:'NEW-LOT',level:1},use:true,mean:120,sd:3,low:114,high:126}],group:nextGroup,mode:'switch',overwrites:[{testId:'T1',lot:{level:1}}],effectiveFrom:'2026-08-09',note:'matrix',tests:[test],lots:[{id:'OLD',lotNo:'OLD-LOT'}],groups:[oldGroup,nextGroup],pointsForTest:()=>[],groupsForLot:id=>id==='OLD'?[oldGroup]:[],upsertHistory:(target,lot,entry)=>{history.push({lot:lot.id,entry});target.meanSdHistory.push({...entry,qcLotId:lot.id,lot:lot.lotNo});}});
  return {result,oldGroup,nextGroup,test,history};
})()`));
assert.equal(matrixApply.result.count, 1);
assert.deepEqual(matrixApply.result.stoppedGroupIds, ['G-OLD']);
assert.equal(matrixApply.oldGroup.status, 'stopped');
assert.equal(matrixApply.oldGroup.stoppedAt, '2026-08-09');
assert.equal(matrixApply.nextGroup.status, undefined, 'the selected group clears a stale stopped state after a real switch');
const matrixPlanned=plain(run(ctx, `(function(){
  const group={id:'G-NEXT'},test={id:'T1',levels:[{level:1,qcLotId:'OLD',lot:'OLD-LOT',meanSdHistory:[]}]},history=[];
  const result=ManageConfigService.applyTargetMatrix({picked:[{testId:'T1',lot:{id:'NEW',lotNo:'NEW-LOT',level:1},use:true,mean:120,sd:3,low:114,high:126}],group,mode:'planned',overwrites:[{testId:'T1',lot:{level:1}}],effectiveFrom:'2026-08-09',note:'matrix',tests:[test],lots:[],groups:[group],pointsForTest:()=>[],groupsForLot:()=>[],upsertHistory:(target,lot,entry)=>{history.push(entry);target.meanSdHistory.push({...entry,qcLotId:lot.id,lot:lot.lotNo});}});
  return {result,group,test,history};
})()`));
assert.equal(matrixPlanned.result.count, 1);
assert.equal(matrixPlanned.group.status, 'planned');
assert.equal(matrixPlanned.test.levels[0].qcLotId, 'OLD', 'a planned overwrite must retain the currently live lot');
assert.equal(matrixPlanned.history[0].planned, true);

assert.deepEqual(plain(run(ctx, `ManageConfigService.defaultAssayLevels()`)), [{level:1,mean:null,sd:null,low:null,high:null,rangeK:2,mfgMean:null,mfgSd:null,applied:'mfg',meanSdHistory:[]}]);
console.log('manage-config-service tests passed');
