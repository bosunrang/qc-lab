/* ===== AUTH UI STATE ===== */
(function(root){
  // Khôi phục khóa đăng nhập (số lần sai/thời điểm hết khóa) từ localStorage — xem
  // persistLoginLockout() trong users-auth.js. Không khôi phục thì tải lại trang giữa
  // các lần thử là cách né cơ chế chống dò mật khẩu đơn giản nhất.
  let lockout=null;
  try{lockout=JSON.parse(localStorage.getItem('qclab_login_lockout')||'null');}catch(e){lockout=null;}
  const state={currentUser:null,loginFails:(lockout&&Number(lockout.fails))||0,loginLockUntil:(lockout&&Number(lockout.until))||0};
  Object.keys(state).forEach(name=>Object.defineProperty(root,name,{configurable:true,get(){return state[name];},set(value){state[name]=value;}}));
  root.AuthUIState=state;
})(typeof globalThis!=='undefined'?globalThis:this);
