/* ===== DASHBOARD / WESTGARD UI STATE ===== */
(function(root){
  const state={selTest:null,statusMemo:new Map(),wgTestQ:'',dashTestQ:'',dashTestStatus:'all',dashKpiPeriod:'30',dashKpiStart:'',dashKpiEnd:'',dashKpiInstrument:'all',dashKpiTest:'all',dashKpiTestQ:'',dashKpiTestChoices:null,dashKpiLast:null,wgPrevOpen:new Set(),wgExpandedRows:new Set(),wgViewMode:'current',wgArchivedGroupId:'',wgArchivedTestId:'',wgArchivedTestQ:'',wgChartMode:'lj'};
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.AnalysisUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
