/* ===== AUTH UI STATE ===== */
(function(root){
  const state={currentUser:null,loginFails:0,loginLockUntil:0};
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.AuthUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
