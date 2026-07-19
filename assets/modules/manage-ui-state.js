/* ===== MANAGEMENT UI STATE ===== */
(function(root){
  const state={
    manageQ:'',
    manageTab:'instruments',
    manageTargetPanel:'',
    manageTargetGroup:'',
    manageTargetLevel:'',
    manageHistoryTest:'',
    targetSwitchCtx:null,
    configNavScroll:0,
  };
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.ManageUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
