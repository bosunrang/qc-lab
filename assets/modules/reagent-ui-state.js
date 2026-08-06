/* ===== REAGENT UI STATE ===== */
(function(root){
  const state={rcId:null,rcSaveT:null,rcModalQ:'',rcCreateModalQ:'',rcQuickType:'',rcMetaBefore:null};
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.ReagentUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
