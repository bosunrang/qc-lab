/* ===== USERS PAGE ===== */
function pageUsers(){
  const users=globalThis.userListModel(state.users,currentUser&&currentUser.id);
  const rows=users.map(u=>globalThis.userRowHtml({user:u,currentUserId:currentUser&&currentUser.id,esc,roleLabel,btn})).join('');
  return globalThis.usersPageHtml({head:headOnly('Quản lý người dùng','Phân quyền thao tác và kiểm soát tài khoản'),rows,roleOptions:roleSelectOptions('technician'),permissionChecks:userPermChecks(rolePageIds('technician'),'newUserPerms','technician'),addButton:btn('Thêm','addUser()','teal')});
}
let auditQ='',auditFrom='',auditTo='',auditPage=1,auditPageSize=25;
const AUDIT_PAGE_SIZES=globalThis.activityAuditPageSizes;
function auditDateKey(a){
  return globalThis.activityAuditFilter.dateKey(a);
}
function auditFilteredActivities(items=state.activity||[]){
  return globalThis.activityAuditFilter.filter(items,auditQ,auditFrom,auditTo);
}
function auditSetQuery(value){
  const next=globalThis.activityAuditFilterState.withQuery({query:auditQ,from:auditFrom,to:auditTo,page:auditPage,pageSize:auditPageSize},value);auditQ=next.query;auditPage=next.page;scheduleSearchRender(auditSetQuery,rerender,'auditSearch');
}
function auditSetDate(field,value){
  const iso=value?(vnPickerParse(value)||parseVN(value)||''):'';
  const next=globalThis.updateActivityAuditDateRange({from:auditFrom,to:auditTo},field,iso);auditFrom=next.from;auditTo=next.to;auditPage=1;rerender();
}
function auditSetPageSize(value){
  const next=globalThis.activityAuditFilterState.withPageSize({query:auditQ,from:auditFrom,to:auditTo,page:auditPage,pageSize:auditPageSize},value,AUDIT_PAGE_SIZES);auditPageSize=next.pageSize;auditPage=next.page;rerender();
}
function auditSetPage(value){
  auditPage=globalThis.activityAuditFilterState.withPage({query:auditQ,from:auditFrom,to:auditTo,page:auditPage,pageSize:auditPageSize},value).page;rerender();
}
function auditClearFilters(){
  const next=globalThis.activityAuditFilterState.cleared({query:auditQ,from:auditFrom,to:auditTo,page:auditPage,pageSize:auditPageSize});auditQ=next.query;auditFrom=next.from;auditTo=next.to;auditPage=next.page;rerender();
}
function pageAudit(){
  const total=(state.activity||[]).length;
  const oversizeWarn=total>ACTIVITY_ROTATE_TO?` <span class="tag warn">Nhật ký đang rất lớn</span> <span class="hint">Nên lưu trữ bớt dòng cũ — hệ thống sẽ tự xoay vòng ở ${ACTIVITY_HARD_CAP} dòng (không xuất CSV).</span>`:'';
  const chain=typeof auditChainStatus==='function'?auditChainStatus():{ok:true,checked:0,legacy:total,idle:false};
  const chainHtml=chain.idle
    ?`<span class="tag none">Chưa kiểm chuỗi hash</span> ${btn('Kiểm tra chuỗi hash','auditVerifyChainNow()','ghost sm')} <span class="hint">Nhật ký lớn (${chain.total} dòng) nên không tự kiểm mỗi lần mở trang.</span>`
    :chain.ok?`<span class="tag ok">Chuỗi hash hợp lệ</span> <span class="hint">${chain.checked} dòng đã khóa hash${chain.legacy?` · ${chain.legacy} dòng cũ chưa có hash`:''}</span>`:`<span class="tag rej">Audit có dấu hiệu bị sửa</span> <span class="hint">Lỗi tại dòng #${(state.activity[chain.brokenIndex]||{}).seq||chain.brokenIndex+1}: ${esc(chain.reason)}</span>`;
  const filtered=auditFilteredActivities(),pageInfo=globalThis.activityAuditPagination(filtered,auditPage,auditPageSize),pageCount=pageInfo.pageCount;
  auditPage=pageInfo?pageInfo.page:Math.min(Math.max(1,auditPage),pageCount);
  const offset=pageInfo?pageInfo.offset:(auditPage-1)*auditPageSize,pageRows=pageInfo?pageInfo.rows:filtered.slice(offset,offset+auditPageSize);
  const rows=pageRows.map(a=>globalThis.activityAuditRowHtml({sequenceHtml:a.seq?'#'+a.seq:'',timeHtml:formatDateTimeVN(a.ts),userHtml:esc(a.user||''),roleHtml:roleLabel(a.role||'viewer'),usernameHtml:a.username?' · @'+esc(a.username):'',typeHtml:esc(a.type||''),targetHtml:esc(a.target||''),detailHtml:esc(a.detail||'')})).join('');
  const hasFilter=!!(auditQ||auditFrom||auditTo);
  const pageSizeOptions=AUDIT_PAGE_SIZES.map(size=>`<option value="${size}" ${size===auditPageSize?'selected':''}>${size} dòng</option>`).join('');
  const resultFrom=pageInfo?pageInfo.resultFrom:(filtered.length?offset+1:0),resultTo=pageInfo?pageInfo.resultTo:Math.min(offset+auditPageSize,filtered.length);
  const pagination=filtered.length?`<div class="audit-pagination"><span class="hint">Hiển thị ${resultFrom}–${resultTo} / ${filtered.length} dòng</span><div>${btn('‹ Trước',`auditSetPage(${auditPage-1})`,'ghost sm','',{disabled:auditPage<=1})}<b>Trang ${auditPage}/${pageCount}</b>${btn('Sau ›',`auditSetPage(${auditPage+1})`,'ghost sm','',{disabled:auditPage>=pageCount})}</div></div>`:'';
  const rowsOrEmptyState=rows?`<div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState(total?'Không tìm thấy nhật ký':'Chưa có hoạt động',total?'Thử từ khóa hoặc khoảng ngày khác.':'Nhật ký sẽ bắt đầu ghi từ các thao tác tiếp theo.');
  return globalThis.activityAuditPageHtml({head:headOnly('Nhật ký hoạt động','Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem'),exportButton:btn('Xuất CSV nhật ký','exportActivityCSV()','teal sm'),archiveButton:total?btn('Lưu trữ nhật ký cũ','archiveActivityLog()','ghost sm'):'',total,chainHtml,oversizeWarn,searchValue:escAttr(auditQ),fromDate:dateBox('auditFromDate',auditFrom,'audit-date',`aria-label="Lọc nhật ký từ ngày" onchange="auditSetDate('from',this.value)"`),toDate:dateBox('auditToDate',auditTo,'audit-date',`aria-label="Lọc nhật ký đến ngày" onchange="auditSetDate('to',this.value)"`),pageSizeOptions,clearFiltersButton:hasFilter?btn('Xóa bộ lọc','auditClearFilters()','ghost sm audit-clear-filter'):'',filteredCount:filtered.length,rowsOrEmptyState,pagination});
}
function activityCSVRows(items){return globalThis.activityAuditCsv(items);}
function exportActivityCSV(){globalThis.csvDownload('Nhat_ky_hoat_dong_QCLab.csv',activityCSVRows(state.activity));}
/* Lưu trữ CÓ CHỦ ĐÍCH nhật ký cũ: xuất CSV phần bị cắt TRƯỚC, chỉ khi file đã
   tạo xong mới gỡ khỏi state — khác với xoay vòng tự động (auditRotateOverflow),
   đường này không mất dữ liệu. CSV giữ nguyên cột PrevHash/Hash để phần đã lưu
   trữ kiểm chứng độc lập được: hash dòng cuối file phải khớp tipHash trong dòng
   checkpoint ghi lại sau khi cắt. */
function archiveActivityLog(){
  if(!requireAdmin())return;
  const total=(state.activity||[]).length;if(!total)return;
  openModal(globalThis.activityAuditArchiveModalHtml({total,cancelButtonHtml:btn('Hủy','closeModal()','ghost'),archiveButtonHtml:btn('Xuất CSV và lưu trữ','confirmArchiveActivityLog()','teal')}));
}
async function confirmArchiveActivityLog(){
  if(!requireAdmin())return;
  const result=await globalThis.ActivityArchiveCommand.execute((document.getElementById('auditArchiveMonths')||{}).value);if(result.status==='done')auditPage=1;
}
async function addUser(){
  if(!requireAdmin())return;
  const username=document.getElementById('uUser').value.trim().toLowerCase();const name=document.getElementById('uName').value.trim();const initials=QCCore.cleanText(document.getElementById('uInitials').value,12).trim().toUpperCase();const rolev=document.getElementById('uRole').value;const pass=document.getElementById('uPass').value;
  const userErr=globalThis.newUserValidationError({username,password:pass,existingUsernames:state.users.map(u=>u.username)});if(userErr){await infoDialog(userErr);return;}
  const pagePerms=await collectUserPerms('newUserPerms',rolev);if(!pagePerms)return;
  await globalThis.UserLifecycleCommand.add({id:uid(),username,name,initials,role:rolev,pagePerms,password:pass,auditDetail:roleLabel(rolev)+' · '+pagePerms.length+' thẻ · yêu cầu đổi mật khẩu'});rerender();
}
function userPermChecks(selectedIds,groupId,roleValue){
  const base=new Set(rolePageIds(roleValue)),initial=selectedIds&&selectedIds.length?selectedIds:rolePageIds(roleValue),selected=new Set(globalThis.selectUserPermissions(initial,[...base]));
  return globalThis.userPermissionChecksHtml(escAttr(groupId),PAGES.map(([id,title])=>({idHtml:escAttr(id),titleHtml:esc(title),allowed:base.has(id),selected:selected.has(id)})));
}
function syncUserPermChecks(groupId,roleValue){
  const box=document.getElementById(groupId),base=new Set(rolePageIds(roleValue));if(!box)return;
  box.querySelectorAll('input[type=checkbox]').forEach(i=>{const allowed=base.has(i.value);i.disabled=!allowed;i.closest('label').classList.toggle('disabled',!allowed);if(!allowed)i.checked=false;});
}
async function collectUserPerms(groupId,roleValue){
  const box=document.getElementById(groupId),base=new Set(rolePageIds(roleValue));if(!box)return rolePageIds(roleValue);
  const selected=[...box.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value),picked=globalThis.selectUserPermissions(selected,[...base]);
  if(!picked.length){await infoDialog('Cần chọn ít nhất một thẻ được phép dùng.');return null;}
  return [...new Set(picked)];
}
async function openUserPerms(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  if(currentUser&&currentUser.id===id){await infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập. Hãy dùng tài khoản quản trị khác nếu cần thay đổi.');return;}
  const roleSelect=globalThis.userRoleSelectHtml(roleSelectOptions(u.role));
  openModal(globalThis.userPermissionsModalHtml({userName:esc(u.name||u.username),username:esc(u.username),roleSelectHtml:roleSelect,permissionChecksHtml:userPermChecks(u.pagePerms,'editUserPerms',u.role),cancelButtonHtml:btn('Hủy','closeModal()','ghost'),saveButtonHtml:btn('Lưu quyền',`applyUserPerms('${id}')`,'teal')}));
}
async function applyUserPerms(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  if(currentUser&&currentUser.id===id){await infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập.');return;}
  const rolev=document.getElementById('editUserRole').value,pagePerms=await collectUserPerms('editUserPerms',rolev);if(!pagePerms)return;
  globalThis.UserLifecycleCommand.updatePermissions(u,{role:rolev,pagePerms,auditDetail:`${roleLabel(rolev)} · ${pagePerms.length} thẻ`});
  closeModal();if(!canAccessPage(page))page=firstAccessPage();renderBrand();nav();rerender();
}
function resetPass(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  const self=currentUser&&currentUser.id===id;
  openModal(globalThis.resetPasswordModalHtml({title:self?'Đổi mật khẩu':'Đặt lại mật khẩu',message:self?'Nhập mật khẩu mới cho tài khoản đang đăng nhập.':'Nhập mật khẩu tạm; người dùng sẽ phải đổi lại khi đăng nhập.',enterAction:`if(event.key==='Enter')applyResetPass('${id}')`,cancelButtonHtml:btn('Hủy','closeModal()','ghost'),saveButtonHtml:btn('Lưu mật khẩu',`applyResetPass('${id}')`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('resetPass1');if(e)e.focus();},50);
}
async function applyResetPass(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  const p1=document.getElementById('resetPass1').value,p2=document.getElementById('resetPass2').value,msg=document.getElementById('resetPassMsg'),err=globalThis.passwordChangeError(p1,p2);
  if(err){if(msg)msg.innerHTML=`<div class="auth-err">${esc(err)}</div>`;return;}
  const updated=await globalThis.UserLifecycleCommand.resetPassword(u,p1,!(currentUser&&currentUser.id===id));
  closeModal();rerender();await infoDialog(updated.mustChangePassword?'Đã đặt mật khẩu tạm. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.':'Đã cập nhật mật khẩu.',{type:'success'});
}
function toggleUser(id){if(!requireAdmin())return;const u=state.users.find(x=>x.id===id);globalThis.UserLifecycleCommand.toggle(u);rerender();}
async function delUser(id){if(!requireAdmin())return;if(id===currentUser.id){await infoDialog('Không thể xóa chính mình.');return;}const u=state.users.find(x=>x.id===id);if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa người dùng',message:`Xóa người dùng ${u?(u.name||u.username):''}?`,confirmLabel:'Xóa người dùng',cancelLabel:'Hủy'}))return;globalThis.UserLifecycleCommand.remove(id);rerender();}

/* ===== AUTH =====
   Hash PBKDF2-SHA256 (OWASP: >=600k vòng — hằng số PASSWORD_HASH_ITERATIONS
   sống ở src/domain/auth/pbkdf2-password-service.ts, NGUỒN DUY NHẤT) và hash
   SHA-256 legacy (hash cũ vẫn xác thực được, tự nâng cấp lên PBKDF2 khi đăng
   nhập) đều đã chuyển sang TypeScript qua pbkdf2PasswordService/
   legacyPasswordHashService — xem tests/auth-security.test.js. */
function passwordError(p){return globalThis.passwordPolicyError(p);}
async function legacyHashPass(p){return globalThis.legacyPasswordHashService.hash(p);}
async function hashPass(p){return globalThis.pbkdf2PasswordService.hash(p);}
async function verifyPass(p,stored){
  if(globalThis.isPbkdf2PasswordHash(stored))return globalThis.pbkdf2PasswordService.verify(p,stored);
  return await legacyHashPass(p)===stored;
}
async function confirmReauthentication(){
  const input=document.getElementById('reauthPassword'),err=document.getElementById('reauthError');
  if(!currentUser||!input){closeDialogOverlay(false);return;}
  let ok=false;try{ok=await verifyPass(input.value,currentUser.passHash);}catch(e){}
  input.value='';
  if(!ok){if(err)err.hidden=false;input.focus();return;}
  closeDialogOverlay(true);
}
function reauthenticateCurrentUser({title='Xác thực lại',message='Nhập lại mật khẩu để tiếp tục.'}={}){
  if(!currentUser)return Promise.resolve(false);
  return new Promise(resolve=>openDialogOverlay(`<div class="modal confirm-modal">
    <div class="confirm-modal-h"><div class="confirm-modal-kicker">Thao tác được kiểm soát</div>${modalCloseButton('closeDialogOverlay(false)')}</div>
    <h3 class="confirm-modal-title">${esc(title)}</h3>
    <div class="confirm-modal-body"><div class="confirm-modal-icon info" aria-hidden="true">✓</div><div class="confirm-modal-text"><b>${esc(message)}</b><p>Tài khoản: ${esc(currentUser.name||currentUser.username||'')}</p></div></div>
    <div class="reauth-modal-field">
      <label for="reauthPassword">Mật khẩu hiện tại</label>
      <input id="reauthPassword" type="password" autocomplete="current-password" autofocus onkeydown="if(event.key==='Enter'){event.preventDefault();confirmReauthentication()}">
      <div id="reauthError" class="auth-err" hidden>Mật khẩu không đúng.</div>
    </div>
    <div class="confirm-modal-actions">${btn('Hủy','closeDialogOverlay(false)','ghost')}${btn('Xác thực','confirmReauthentication()','teal')}</div>
  </div>`,resolve));
}
async function ensureAdmin(){await globalThis.AdminBootstrapCommand.ensure();}
function blankAppState(users){
  return globalThis.blankAppStateFactory(users);
}
async function resetAllData(){
  if(!requireAdmin())return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa sạch dữ liệu test',message:'Xóa sạch toàn bộ dữ liệu test?',detail:'Nhật ký hoạt động sẽ được giữ lại và ghi nhận thao tác này.',confirmLabel:'Tiếp tục',cancelLabel:'Hủy'}))return;
  if(!await confirmDialog({kicker:'Xác nhận lần cuối',title:'Xóa sạch dữ liệu test',message:'Dữ liệu QC, cấu hình, lô, panel và khắc phục sẽ bị xóa.',detail:'Nhật ký audit vẫn được giữ. Nếu đang bật đám mây, trạng thái trắng cũng sẽ được đồng bộ lên Firebase.',confirmLabel:'Xóa sạch dữ liệu',cancelLabel:'Hủy'}))return;
  if(!await reauthenticateCurrentUser({title:'Xác thực xóa sạch dữ liệu',message:'Nhập lại mật khẩu trước khi xóa toàn bộ dữ liệu QC và cấu hình.'}))return;
  if(typeof backupCurrentData==='function'&&!await backupCurrentData('truoc-xoa')){await infoDialog('Không tạo được bản backup an toàn. Dữ liệu chưa bị xóa.');return;}
  await globalThis.ResetOperationalDataCommand.execute();await infoDialog('Đã xóa sạch dữ liệu test. App đã về trạng thái trắng.',{type:'success'});
}
function downloadStartupData(){
  if(!startupProblem)return;
  const blob=new Blob([startupProblem.raw],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='qclab-du-lieu-can-phuc-hoi-'+Date.now()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function resetStartupData(){
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Tạo dữ liệu mới',message:'Tạo dữ liệu mới?',detail:'Dữ liệu cũ sẽ không bị dùng nữa. Hãy tải bản cần phục hồi trước khi tiếp tục.',confirmLabel:'Tạo dữ liệu mới',cancelLabel:'Hủy'}))return;
  startupProblem=null;await globalThis.ResetOperationalDataCommand.execute({keepUsers:false,keepAudit:false,log:false,save:false,render:false});showLogin();
}
function authBrandMark(){const logo=brandLogo();return `<div class="brand-mark">${logo?`<img src="${escAttr(logo)}" alt="">`:esc(brandMarkText())}</div>`;}
function showStartupRecovery(){
  let ov=document.getElementById('authOverlay');if(!ov){ov=document.createElement('div');ov.id='authOverlay';document.body.appendChild(ov);}
  ov.style.display='flex';
  ov.innerHTML=`<div class="auth-card"><div class="auth-head">${authBrandMark()}<div class="auth-brand">Cần phục hồi dữ liệu</div></div>
    <div class="auth-sub">QC Lab phát hiện dữ liệu cục bộ không hợp lệ và đã dừng để tránh ghi đè.</div>
    <div class="auth-err">${esc(startupProblem&&startupProblem.message||'Không đọc được dữ liệu.')}</div>
    <div class="auth-actions">${btn('Tải dữ liệu gốc xuống','downloadStartupData()','teal')}${btn('Tạo dữ liệu mới','resetStartupData()','ghost')}</div>
    <div class="auth-hint">Ưu tiên tải dữ liệu gốc xuống trước để có thể kiểm tra và phục hồi.</div></div>`;
}
function showLogin(msg){
  document.getElementById('nav').innerHTML='';document.getElementById('main').innerHTML='';document.getElementById('userBox').innerHTML='';
  const sf=document.getElementById('sideFoot');if(sf)sf.innerHTML='';
  let ov=document.getElementById('authOverlay');if(!ov){ov=document.createElement('div');ov.id='authOverlay';document.body.appendChild(ov);}
  ov.style.display='flex';
  const app=window.QCLAB_APP||{version:'dev'};
  const admin=(state.users||[]).find(u=>u.username==='admin');
  const defaultHint=admin&&admin.mustChangePassword?'Tài khoản mặc định: <b>admin</b> / <b>admin</b><br>Hệ thống sẽ yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.<br>':'';
  const trial=window.qcLicense&&window.qcLicense.trial;
  const trialLine=trial&&trial.active?`<div class="auth-hint ${trial.daysLeft<=7?'auth-trial-warning':'auth-trial-ok'}">Bản dùng thử: còn ${trial.daysLeft}/${trial.totalDays} ngày</div>`:'';
  ov.innerHTML=`<div class="auth-card"><div class="auth-head">${authBrandMark()}<div class="auth-head-text"><div class="auth-brand">${esc(brandTitle())}</div><div class="auth-sub">${esc(brandSub())}</div></div></div>
    <label>Tên đăng nhập</label><input id="liUser" autocomplete="username" autofocus>
    <label>Mật khẩu</label><input id="liPass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
    ${msg?`<div class="auth-err">${esc(msg)}</div>`:''}
    <div class="auth-actions">${btn('Đăng nhập','doLogin()','teal')}</div>
    ${trialLine}<div class="auth-hint">${defaultHint}Phiên bản ${esc(app.version||'dev')}</div></div>`;
  requestAnimationFrame(focusLoginField);setTimeout(focusLoginField,50);
}
/* Đưa focus về ô đăng nhập theo kiểu "nhường": chỉ focus khi lớp đăng nhập đang
   hiển thị và CHƯA có ô/nút nào trong lớp đó được focus. Nhờ vậy đợt xử lý snapshot
   Firebase đầu tiên (chạy ensureShape đồng bộ, có thể làm khựng luồng chính) không
   cướp mất ô người dùng đã Tab sang, nhưng vẫn khôi phục được focus nếu nó bị mất
   (vd cửa sổ chưa được OS focus lúc mở nguội) để Tab dùng được ngay. */
function focusLoginField(){
  const ov=document.getElementById('authOverlay');
  if(!ov||ov.style.display==='none')return;
  const active=document.activeElement;
  if(active&&active!==document.body&&ov.contains(active))return;
  const user=document.getElementById('liUser');
  if(user)user.focus();
}
/* Lưu số lần sai/thời điểm hết khóa vào localStorage — chỉ giữ trong biến JS thì tải
   lại trang (F5) là reset về 0, vô hiệu hoá cơ chế chống dò mật khẩu ngay lập tức. */
function persistLoginLockout(){try{localStorage.setItem('qclab_login_lockout',JSON.stringify({fails:loginFails,until:loginLockUntil}));}catch(e){}}
async function doLogin(){
  const u=document.getElementById('liUser').value.trim().toLowerCase();const p=document.getElementById('liPass').value;
  // Thông báo lỗi KHÔNG được phân biệt "tài khoản không tồn tại" với "sai mật khẩu" —
  // nếu không kẻ dò có thể dùng đó để liệt kê username hợp lệ trước khi dò mật khẩu.
  // Chi tiết thật (để phân biệt khi tra soát) chỉ ghi vào nhật ký hoạt động nội bộ.
  const genericFailMsg='Tên đăng nhập hoặc mật khẩu không đúng.';
  if(typeof storageHydrationPromise!=='undefined'&&!await storageHydrationPromise){showStartupRecovery();return;}
  const result=await globalThis.LoginWorkflowCommand.authenticate({users:state.users,username:u,password:p,lock:{fails:loginFails,until:loginLockUntil},now:Date.now()});
  if(result.status==='locked'){showLogin(result.message);return;}
  if(result.status==='failed'){if(result.reason==='verification-error'){showLogin('Không thể kiểm tra mật khẩu trên trình duyệt này.');return;}loginFails=result.lock.fails;loginLockUntil=result.lock.until;persistLoginLockout();showLogin(genericFailMsg);return;}
  loginFails=result.lock.fails;loginLockUntil=result.lock.until;persistLoginLockout();
  currentUser=result.user;
  if(currentUser.mustChangePassword)showPasswordChange();else showApp();
}
function showPasswordChange(msg){
  let ov=document.getElementById('authOverlay');if(!ov){ov=document.createElement('div');ov.id='authOverlay';document.body.appendChild(ov);}ov.style.display='flex';
  ov.innerHTML=`<div class="auth-card"><div class="auth-head">${authBrandMark()}<div class="auth-brand">Đổi mật khẩu</div></div><div class="auth-sub">Cần cập nhật mật khẩu trước khi vào hệ thống</div>
    <label>Mật khẩu mới</label><input id="newPass1" type="password" autocomplete="new-password">
    <label>Nhập lại mật khẩu mới</label><input id="newPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')changeRequiredPassword()">
    ${msg?`<div class="auth-err">${esc(msg)}</div>`:''}
    <div class="auth-actions">${btn('Lưu mật khẩu mới','changeRequiredPassword()','teal')}</div>
    <div class="auth-hint">Mật khẩu cần ít nhất 8 ký tự và không nên dùng lại mật khẩu mặc định.</div></div>`;
  setTimeout(()=>{const e=document.getElementById('newPass1');if(e)e.focus();},50);
}
async function changeRequiredPassword(){
  const p1=document.getElementById('newPass1').value,p2=document.getElementById('newPass2').value;
  const result=await globalThis.RequiredPasswordWorkflowCommand.complete({user:currentUser,password:p1,confirmation:p2,cloud:!!(fb&&fb.initialized)});
  if(result.status==='invalid'){showPasswordChange(result.error);return;}
  currentUser=result.user;showApp();
}
function logout(){if(currentUser)globalThis.LoginWorkflowCommand.logout();currentUser=null;page='dash';showLogin();}
function showApp(){
  const ov=document.getElementById('authOverlay');if(ov)ov.style.display='none';
  if(!canAccessPage(page))page=firstAccessPage();
  document.getElementById('userBox').innerHTML='';
  renderBrand();nav();sideFoot();rerender();if(typeof lisGatewayStart==='function')setTimeout(lisGatewayStart,0);
}
