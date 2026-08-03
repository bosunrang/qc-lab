/* ===== ENTRY UI STATE ===== */
(function(root){
  const state={entrySel:null,entryDays:30,entryStart:null,entryEnd:null,entrySheetMonth:'',entryQ:'',entryMachine:'all',entryLastMsg:'',entryAutoOpenKey:null,entryPendingSheetFocus:'',entryJumpToday:false,entryLjRenderCache:null,entryPartialRenderCache:null,entryPrevOpen:new Map(),entryExpandedTables:new Set(),entryDetailOpen:new Set(),treeOpen:new Set(),entryExtraRun:new Set(),entryTreeCollapsed:null};
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.EntryUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
