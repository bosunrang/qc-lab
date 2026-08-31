type Row=Record<string,any>;
export type ConfigurationRelationDependencies={uid:()=>string;switchesLot:(transition:Row)=>boolean;applyAcceptedTransition:(transition:Row)=>void;normalizeLotGroups:()=>void;syncLotDepletion:()=>void};

export function reconcileConfigurationRelations(state:Row,deps:ConfigurationRelationDependencies){
  /* Giai đoạn 7 (state immutable): gán lại `state.qcPanels` bằng mảng MỚI
     thay vì .push() tại chỗ (nhóm instruments/qcLots/qcPanels, 2026-08-30).
     `group.lotIds.push(...)` (dòng dưới) đổi thành gán lại mảng con `lotIds`
     (nhóm lotGroups/tests/teaRefs/lotTransitions, 2026-08-31) — an toàn vì
     `lotIds` chỉ là mảng chuỗi id, không có phần tử OBJECT nào bị thay thế;
     bản thân object `group` VẪN mutate tại chỗ (field `lotIds` của nó đổi,
     không phải chính `group` bị thay bằng object mới) nên
     targetSwitchCtx/activateLotGroup (giữ tham chiếu OBJECT `group`, xem kế
     hoạch kiến trúc) không bị ảnh hưởng. */
  if(!state.qcPanels.length&&state.assayGroups.length)state.assayGroups.forEach((group:Row)=>{const first=(state.tests||[]).find((test:Row)=>(group.testIds||[]).includes(test.id));state.qcPanels=[...state.qcPanels,{id:group.id||deps.uid(),name:group.name||'Panel QC',instrumentId:first&&first.instrumentId||state.instruments[0].id,testIds:[...(group.testIds||[])],note:group.note||'Chuyển từ nhóm xét nghiệm cũ',active:group.active!==false}];});
  state.lotGroups.forEach((group:Row)=>{group.lotIds=Array.isArray(group.lotIds)?[...new Set(group.lotIds)].filter(id=>(state.qcLots||[]).some((lot:Row)=>lot.id===id)):[];});
  state.qcLots.forEach((lot:Row)=>{if(lot.groupId){const group=state.lotGroups.find((item:Row)=>item.id===lot.groupId);if(group&&!group.lotIds.includes(lot.id))group.lotIds=[...group.lotIds,lot.id];}});
  const retiredTo=new Map((state.lotTransitions||[]).filter(deps.switchesLot).map((transition:Row)=>[String(transition.fromLotId),String(transition.toLotId)]));
  state.lotGroups.forEach((group:Row)=>{if(group.active===false)return;group.lotIds=(group.lotIds||[]).filter((id:unknown)=>{const replacement=retiredTo.get(String(id));return !(replacement&&(group.lotIds||[]).some((lotId:unknown)=>String(lotId)===replacement));});});
  state.lotGroups.forEach((group:Row)=>{group.lotIds=[...new Set(group.lotIds||[])].filter(id=>(state.qcLots||[]).some((lot:Row)=>lot.id===id));});
  state.qcLots.forEach((lot:Row)=>{const group=state.lotGroups.find((item:Row)=>(item.lotIds||[]).includes(lot.id));lot.groupId=group?group.id:'';});
  state.assayGroups.forEach((group:Row)=>{group.testIds=Array.isArray(group.testIds)?group.testIds.filter(id=>(state.tests||[]).some((test:Row)=>test.id===id)):[];});
  state.qcPanels.forEach((panel:Row)=>{if(!(state.instruments||[]).some((instrument:Row)=>instrument.id===panel.instrumentId))panel.instrumentId=state.instruments[0]&&state.instruments[0].id||'';panel.testIds=Array.isArray(panel.testIds)?panel.testIds.filter(id=>(state.tests||[]).some((test:Row)=>test.id===id)):[];if(panel.active==null)panel.active=true;});
  state.lotTransitions=state.lotTransitions.filter((transition:Row)=>(state.qcLots||[]).some((lot:Row)=>lot.id===transition.fromLotId)&&(state.qcLots||[]).some((lot:Row)=>lot.id===transition.toLotId)&&(!transition.panelId||(state.qcPanels||[]).some((panel:Row)=>panel.id===transition.panelId)));
  state.lotTransitions.filter(deps.switchesLot).forEach(deps.applyAcceptedTransition);
  deps.normalizeLotGroups();deps.syncLotDepletion();
}
