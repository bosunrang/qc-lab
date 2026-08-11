type S=Record<string,any>;

export function createQcDerivedIndex(deps:{operationalGroup:(group:S)=>boolean;switchesLot:(transition:S)=>boolean}){
  let cached:any=null;
  const stamp=(state:S,previous?:any[]):any=>{const panels:S[]=state.qcPanels||[],lots:S[]=state.qcLots||[],groups:S[]=state.lotGroups||[],transitions:S[]=state.lotTransitions||[],tests:S[]=state.tests||[],build=!previous,out:any[]|null=build?[]:null;let index=0,ok=true;const check=(value:any)=>{if(build)out!.push(value);else if(ok&&previous![index++]!==value)ok=false;};
    check(state);check(panels);check(panels.length);check(lots);check(lots.length);check(groups);check(groups.length);check(transitions);check(transitions.length);check(tests);check(tests.length);if(!build&&!ok)return false;
    for(let i=0;i<panels.length;i++){const panel=panels[i],ids=panel&&panel.testIds;check(panel);check(panel&&panel.active);check(ids);check(ids?ids.length:-1);}
    for(let i=0;i<groups.length;i++){const group=groups[i],ids=group&&group.lotIds;check(group);check(group&&group.active);check(group&&group.status);check(ids);check(ids?ids.length:-1);}
    for(let i=0;i<transitions.length;i++){const transition=transitions[i];check(transition);check(transition&&transition.fromLotId);check(transition&&transition.toLotId);check(transition&&transition.status);}
    for(let i=0;i<lots.length;i++){const lot=lots[i];check(lot);check(lot&&lot.id);}
    for(let i=0;i<tests.length;i++){const test=tests[i],levels=test&&test.levels;check(test);check(levels);check(levels?levels.length:-1);}
    return build?out:(ok&&index===previous!.length);
  };
  return(state:S)=>{if(cached&&stamp(state,cached.stamp)===true)return cached;const currentStamp=stamp(state),panels=(state.qcPanels||[]).filter((panel:S)=>panel.active!==false),testPanel=new Map(),testOrder=new Map(),lotGroupByLotId=new Map();panels.forEach((panel:S,panelIndex:number)=>(panel.testIds||[]).forEach((id:string,testIndex:number)=>{if(!testPanel.has(id))testPanel.set(id,panel);const order=panelIndex*10000+testIndex;if(!testOrder.has(id)||order<testOrder.get(id))testOrder.set(id,order);}));(state.lotGroups||[]).filter(deps.operationalGroup).forEach((group:S)=>(group.lotIds||[]).forEach((id:string)=>{if(!lotGroupByLotId.has(id))lotGroupByLotId.set(id,group)}));const acceptedTransitionToLot=new Map();(state.lotTransitions||[]).filter(deps.switchesLot).forEach((transition:S)=>{if(!acceptedTransitionToLot.has(transition.toLotId))acceptedTransitionToLot.set(transition.toLotId,transition)});return cached={stamp:currentStamp,panels,testPanel,testOrder,lotById:new Map((state.qcLots||[]).map((lot:S)=>[lot.id,lot])),lotGroupByLotId,acceptedTransitionToLot,operationalTests:null,levels:new Map(),groups:new Map()};};
}
