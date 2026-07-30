/* ===== SIGMA UI STATE ===== */
(function(root){
  const state={sgTest:null,sgRefreshT:null,sgBiasCtx:null,sgMuCtx:null,sgAddTestQ:'',sgSelectedPeriods:{}};
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.SigmaUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
