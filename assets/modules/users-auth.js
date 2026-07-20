/* ===== USERS PAGE ===== */
function pageUsers(){
  const rows=state.users.map(u=>`<tr>
    <td><b>${esc(u.name||u.username)}</b><div class="hint">@${esc(u.username)}${u.initials?' · '+esc(u.initials):''}</div></td>
    <td>${roleLabel(u.role)}</td>
    <td>${u.active===false?'<span class="tag rej">Khóa</span>':'<span class="tag ok">Hoạt động</span>'}</td>
    <td><div class="user-row-actions">${u.id===currentUser.id?'<span class="hint">(bạn)</span> <button class="btn ghost sm" onclick="resetPass(\''+u.id+'\')">Đổi mật khẩu</button>'
      :'<button class="btn ghost sm" onclick="openUserPerms(\''+u.id+'\')">Sửa quyền</button> <button class="btn ghost sm" onclick="resetPass(\''+u.id+'\')">Đặt lại MK</button> <button class="btn ghost sm" onclick="toggleUser(\''+u.id+'\')">'+(u.active===false?'Mở khóa':'Khóa')+'</button> <button class="btn danger sm" onclick="delUser(\''+u.id+'\')">Xóa</button>'}</div></td></tr>`).join('');
  return headOnly('Quản lý người dùng','Phân quyền thao tác và kiểm soát tài khoản')+
   `<div class="panel"><h3>Thêm người dùng</h3><div class="user-create-layout">
     <div class="user-create-card">
       <div class="user-create-card-title">Thông tin tài khoản</div>
       <div class="user-create-fields">
       <div><label>Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt"></div>
       <div><label>Họ tên</label><input id="uName"></div>
       <div><label>Mã viết tắt</label><input id="uInitials" maxlength="12" placeholder="NTL"></div>
       <div><label>Vai trò</label><select id="uRole" onchange="syncUserPermChecks('newUserPerms',this.value)"><option value="admin">Quản trị</option><option value="technician" selected>KTV</option><option value="viewer">Chỉ xem</option></select></div>
       <div><label>Mật khẩu tạm</label><input id="uPass" type="password" autocomplete="new-password"></div>
       <div class="user-create-actions"><button class="btn teal" onclick="addUser()">Thêm</button></div>
       </div>
     </div>
     <div class="user-create-access">
       <div class="user-create-card"><div class="user-create-card-title">Thẻ được phép dùng</div><div class="user-perm-block">${userPermChecks(rolePageIds('technician'),'newUserPerms','technician')}</div></div>
       <div class="user-list-section"><div class="user-list-title">Danh sách người dùng</div><div class="user-table-wrap"><table class="user-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${rows}</tbody></table></div></div>
     </div>
     </div>
     <div class="hint user-create-hint"><b>Vai trò</b> quyết định quyền sửa/quản trị trong các thẻ được tick. <b>KTV:</b> nhập/sửa dữ liệu vận hành · <b>Chỉ xem:</b> chỉ đọc. Người dùng mới sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</div></div>`;
}
function pageAudit(){
  const total=(state.activity||[]).length;
  const chain=typeof auditVerifyChain==='function'?auditVerifyChain():{ok:true,checked:0,legacy:total};
  const chainHtml=chain.ok?`<span class="tag ok">Chuỗi hash hợp lệ</span> <span class="hint">${chain.checked} dòng đã khóa hash${chain.legacy?` · ${chain.legacy} dòng cũ chưa có hash`:''}</span>`:`<span class="tag rej">Audit có dấu hiệu bị sửa</span> <span class="hint">Lỗi tại dòng #${(state.activity[chain.brokenIndex]||{}).seq||chain.brokenIndex+1}: ${esc(chain.reason)}</span>`;
  const rows=(state.activity||[]).slice().reverse().map(a=>`<tr><td><div class="audit-time-cell"><span class="audit-seq">${a.seq?'#'+a.seq:''}</span><span class="audit-time">${formatDateTimeVN(a.ts)}</span></div></td><td><b>${esc(a.user||'')}</b><div class="hint">${roleLabel(a.role||'viewer')}${a.username?' · @'+esc(a.username):''}</div></td><td><span class="pill">${esc(a.type||'')}</span></td><td>${esc(a.target||'')||'<span class="hint">—</span>'}</td><td class="audit-detail">${esc(a.detail||'')||'<span class="hint">—</span>'}</td></tr>`).join('');
  return headOnly('Nhật ký hoạt động','Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem')+
    `<div class="panel"><h3>Công cụ</h3><div class="row-flex">
      <button class="btn ghost sm" onclick="exportActivityCSV()">Xuất Excel nhật ký</button>
      ${total?`<button class="btn danger sm" onclick="clearActivityLog()">Xóa nhật ký</button>`:''}
      <div class="hint" style="align-self:center">${total} dòng hoạt động đã ghi nhận. ${chainHtml}</div>
    </div></div>
    <div class="panel"><h3>Hoạt động gần đây</h3>${rows?`<table class="audit-table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có hoạt động','Nhật ký sẽ bắt đầu ghi từ các thao tác tiếp theo.')}</div>`;
}
function exportActivityCSV(){const rows=[['Seq','Thời gian','Người dùng','Tên đăng nhập','Vai trò','Hành động','Đối tượng','Chi tiết','PrevHash','Hash']];(state.activity||[]).forEach(a=>rows.push([a.seq||'',formatDateTimeVN(a.ts),a.user||'',a.username||'',roleLabel(a.role||'viewer'),a.type||'',a.target||'',a.detail||'',a.prevHash||'',a.hash||'']));downloadCSV('Nhat_ky_hoat_dong_QCLab.csv',rows);}
/* Xóa vĩnh viễn toàn bộ nhật ký hoạt động — khác với "Xóa sạch dữ liệu test" (resetAllData)
   vốn CHỦ ĐỘNG giữ lại nhật ký. Đây là ngoại lệ duy nhất cho quy tắc "chỉ ghi nối tiếp,
   không tự cắt bớt dòng" — chỉ admin bấm được, có xác nhận, và tự ghi lại đúng 1 dòng nhật ký
   mới ghi nhận việc đã xóa (để vẫn còn dấu vết là đã có một lần xóa, dù không phục hồi được nội dung cũ). */
async function clearActivityLog(){
  if(!requireAdmin())return;
  const count=(state.activity||[]).length;if(!count)return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa nhật ký hoạt động',message:`Xóa vĩnh viễn toàn bộ ${count} dòng nhật ký hoạt động?`,detail:'Không thể khôi phục lại được — nên xuất Excel nhật ký trước nếu cần lưu lại.',confirmLabel:'Xóa nhật ký',cancelLabel:'Hủy'}))return;
  state.activity=[];
  logAct('Xóa nhật ký hoạt động',`Đã xóa vĩnh viễn ${count} dòng nhật ký trước đó`,'Nhật ký');
  save({clearDerived:false});rerender();
  await infoDialog('Đã xóa nhật ký hoạt động.',{type:'success'});
}
async function addUser(){
  if(!requireAdmin())return;
  const username=document.getElementById('uUser').value.trim().toLowerCase();const name=document.getElementById('uName').value.trim();const initials=QCCore.cleanText(document.getElementById('uInitials').value,12).trim().toUpperCase();const rolev=document.getElementById('uRole').value;const pass=document.getElementById('uPass').value;
  if(!username||!pass){await infoDialog('Nhập tên đăng nhập và mật khẩu.');return;}
  const passErr=passwordError(pass);if(passErr){await infoDialog(passErr);return;}
  if(state.users.some(u=>u.username===username)){await infoDialog('Tên đăng nhập đã tồn tại.');return;}
  const pagePerms=await collectUserPerms('newUserPerms',rolev);if(!pagePerms)return;
  const passHash=await hashPass(pass);state.users.push({id:uid(),username,name,initials,role:rolev,pagePerms,passHash,active:true,mustChangePassword:true});logAct('Thêm người dùng',roleLabel(rolev)+' · '+pagePerms.length+' thẻ · yêu cầu đổi mật khẩu',username);save({clearDerived:false});rerender();
}
function userPermChecks(selectedIds,groupId,roleValue){
  const base=new Set(rolePageIds(roleValue)),selected=new Set((selectedIds&&selectedIds.length?selectedIds:rolePageIds(roleValue)).filter(id=>base.has(id)));
  return `<div id="${groupId}" class="user-perm-grid">${PAGES.map(([id,title])=>{const allowed=base.has(id);return`<label class="${allowed?'':'disabled'}"><input type="checkbox" value="${id}" ${selected.has(id)?'checked':''} ${!allowed?'disabled':''}><span>${esc(title)}</span></label>`;}).join('')}</div>`;
}
function syncUserPermChecks(groupId,roleValue){
  const box=document.getElementById(groupId),base=new Set(rolePageIds(roleValue));if(!box)return;
  box.querySelectorAll('input[type=checkbox]').forEach(i=>{const allowed=base.has(i.value);i.disabled=!allowed;i.closest('label').classList.toggle('disabled',!allowed);if(!allowed)i.checked=false;});
}
async function collectUserPerms(groupId,roleValue){
  const box=document.getElementById(groupId),base=new Set(rolePageIds(roleValue));if(!box)return rolePageIds(roleValue);
  const picked=[...box.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value).filter(id=>base.has(id));
  if(!picked.length){await infoDialog('Cần chọn ít nhất một thẻ được phép dùng.');return null;}
  return [...new Set(picked)];
}
async function openUserPerms(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  if(currentUser&&currentUser.id===id){await infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập. Hãy dùng tài khoản quản trị khác nếu cần thay đổi.');return;}
  const roleSelect=`<select id="editUserRole" onchange="syncUserPermChecks('editUserPerms',this.value)"><option value="admin" ${u.role==='admin'?'selected':''}>Quản trị</option><option value="technician" ${u.role==='technician'?'selected':''}>KTV</option><option value="viewer" ${u.role==='viewer'?'selected':''}>Chỉ xem</option></select>`;
  openModal(`<div class="modal"><div class="modal-h"><h3>Sửa quyền người dùng</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="hint"><b>${esc(u.name||u.username)}</b> · @${esc(u.username)}</div>
      <label>Vai trò</label>${roleSelect}
      <label style="margin-top:12px">Thẻ được phép dùng</label>${userPermChecks(u.pagePerms,'editUserPerms',u.role)}
      <div class="hint" style="margin-top:10px">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào.</div>
    </div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="applyUserPerms('${id}')">Lưu quyền</button></div></div>`);
}
async function applyUserPerms(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  if(currentUser&&currentUser.id===id){await infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập.');return;}
  const rolev=document.getElementById('editUserRole').value,pagePerms=await collectUserPerms('editUserPerms',rolev);if(!pagePerms)return;
  u.role=rolev;u.pagePerms=pagePerms;
  logAct('Cập nhật quyền người dùng',`${roleLabel(rolev)} · ${pagePerms.length} thẻ`,u.username);
  save({clearDerived:false});closeModal();if(!canAccessPage(page))page=firstAccessPage();renderBrand();nav();rerender();
}
function resetPass(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  const self=currentUser&&currentUser.id===id;
  openModal(`<div class="modal"><div class="modal-h"><h3>${self?'Đổi mật khẩu':'Đặt lại mật khẩu'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="hint">${self?'Nhập mật khẩu mới cho tài khoản đang đăng nhập.':'Nhập mật khẩu tạm; người dùng sẽ phải đổi lại khi đăng nhập.'}</div>
      <label>Mật khẩu mới</label><input id="resetPass1" type="password" autocomplete="new-password">
      <label>Nhập lại mật khẩu</label><input id="resetPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')applyResetPass('${id}')">
      <div id="resetPassMsg"></div>
    </div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="applyResetPass('${id}')">Lưu mật khẩu</button></div></div>`);
  setTimeout(()=>{const e=document.getElementById('resetPass1');if(e)e.focus();},50);
}
async function applyResetPass(id){
  if(!requireAdmin())return;
  const u=state.users.find(x=>x.id===id);if(!u)return;
  const p1=document.getElementById('resetPass1').value,p2=document.getElementById('resetPass2').value,msg=document.getElementById('resetPassMsg'),err=passwordError(p1);
  if(err||p1!==p2){if(msg)msg.innerHTML=`<div class="auth-err">${esc(err||'Hai mật khẩu không khớp.')}</div>`;return;}
  u.passHash=await hashPass(p1);
  u.mustChangePassword=!(currentUser&&currentUser.id===id);
  logAct('Đổi mật khẩu',u.mustChangePassword?'Đặt mật khẩu tạm và yêu cầu đổi lại':'Người dùng đổi mật khẩu',u.username);
  save({clearDerived:false});closeModal();rerender();await infoDialog(u.mustChangePassword?'Đã đặt mật khẩu tạm. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.':'Đã cập nhật mật khẩu.',{type:'success'});
}
function toggleUser(id){if(!requireAdmin())return;const u=state.users.find(x=>x.id===id);u.active=u.active===false?true:false;logAct(u.active?'Mở khóa người dùng':'Khóa người dùng','Cập nhật trạng thái tài khoản',u.username);save({clearDerived:false});rerender();}
async function delUser(id){if(!requireAdmin())return;if(id===currentUser.id){await infoDialog('Không thể xóa chính mình.');return;}const u=state.users.find(x=>x.id===id);if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa người dùng',message:`Xóa người dùng ${u?(u.name||u.username):''}?`,confirmLabel:'Xóa người dùng',cancelLabel:'Hủy'}))return;state.users=state.users.filter(u=>u.id!==id);logAct('Xóa người dùng','Xóa tài khoản khỏi hệ thống',u?u.username:'');save({clearDerived:false});rerender();}

/* ===== AUTH ===== */
const PASS_ITERATIONS=600000; /* OWASP: >=600k vòng PBKDF2-SHA256. Hash cũ 210k vẫn xác thực (verifyPass đọc số vòng từ chuỗi hash) và tự nâng cấp khi đăng nhập. */
function bytesHex(a){return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');}
function hexBytes(s){return new Uint8Array((s.match(/.{1,2}/g)||[]).map(x=>parseInt(x,16)));}
function passwordError(p){if(!p)return'Mật khẩu không được để trống.';if(p.length<8)return'Mật khẩu phải có ít nhất 8 ký tự.';return'';}
async function legacyHashPass(p){try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('qclab::'+p));return bytesHex(new Uint8Array(buf));}catch(e){let h=0;const s='qclab::'+p;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return'f'+h.toString(16);}}
async function hashPass(p){
  if(!crypto.subtle)throw new Error('Trình duyệt không hỗ trợ mã hóa mật khẩu an toàn.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:PASS_ITERATIONS},key,256);
  return`pbkdf2$${PASS_ITERATIONS}$${bytesHex(salt)}$${bytesHex(new Uint8Array(bits))}`;
}
async function verifyPass(p,stored){
  if(String(stored||'').startsWith('pbkdf2$')){const [,it,saltHex,want]=stored.split('$'),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:hexBytes(saltHex),iterations:+it},key,256);return bytesHex(new Uint8Array(bits))===want;}
  return await legacyHashPass(p)===stored;
}
async function ensureAdmin(){if(!state.users||!state.users.length){state.users=[{id:uid(),username:'admin',name:'Quản trị viên',role:'admin',passHash:await legacyHashPass('admin'),active:true,mustChangePassword:true}];save({cloud:false,clearDerived:false});}}
function blankAppState(users){
  return{lab:{name:'',dept:'',address:'',brandTitle:'QC Lab',brandSub:'Nội kiểm xét nghiệm',logoText:'QC',logoData:''},tests:[],machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],users:Array.isArray(users)?users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT},westgardProfileVersion:2,configMigrationVersion:1,schemaVersion:STATE_SCHEMA_VERSION};
}
async function resetAllData(){
  if(!requireAdmin())return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa sạch dữ liệu test',message:'Xóa sạch toàn bộ dữ liệu test?',detail:'Nhật ký hoạt động sẽ được giữ lại và ghi nhận thao tác này.',confirmLabel:'Tiếp tục',cancelLabel:'Hủy'}))return;
  if(!await confirmDialog({kicker:'Xác nhận lần cuối',title:'Xóa sạch dữ liệu test',message:'Dữ liệu QC, cấu hình, lô, panel và khắc phục sẽ bị xóa.',detail:'Nhật ký audit vẫn được giữ. Nếu đang bật đám mây, trạng thái trắng cũng sẽ được đồng bộ lên Firebase.',confirmLabel:'Xóa sạch dữ liệu',cancelLabel:'Hủy'}))return;
  if(typeof backupCurrentData==='function'&&!backupCurrentData('truoc-xoa')){await infoDialog('Không tạo được bản backup an toàn. Dữ liệu chưa bị xóa.');return;}
  const keepUsers=(state.users||[]).length?state.users:[];
  const keepActivity=[...(state.activity||[])];
  localStorage.removeItem('qclab');localStorage.removeItem('qclab_boot');if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);if(typeof LocalStore!=='undefined')LocalStore.clear().catch(()=>{});
  state=blankAppState(keepUsers);
  state.activity=keepActivity;
  ensureShape();await ensureAdmin();logAct('Xóa sạch dữ liệu test','Đưa app về trạng thái trắng, giữ người dùng và nhật ký audit','Dữ liệu');save();rerender();await infoDialog('Đã xóa sạch dữ liệu test. App đã về trạng thái trắng.',{type:'success'});
}
function downloadStartupData(){
  if(!startupProblem)return;
  const blob=new Blob([startupProblem.raw],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='qclab-du-lieu-can-phuc-hoi-'+Date.now()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function resetStartupData(){
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Tạo dữ liệu mới',message:'Tạo dữ liệu mới?',detail:'Dữ liệu cũ sẽ không bị dùng nữa. Hãy tải bản cần phục hồi trước khi tiếp tục.',confirmLabel:'Tạo dữ liệu mới',cancelLabel:'Hủy'}))return;
  localStorage.removeItem('qclab');localStorage.removeItem('qclab_boot');if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);if(typeof LocalStore!=='undefined')LocalStore.clear().catch(()=>{});startupProblem=null;
  state=blankAppState([]);
  ensureShape();await ensureAdmin();showLogin();
}
function showStartupRecovery(){
  let ov=document.getElementById('authOverlay');if(!ov){ov=document.createElement('div');ov.id='authOverlay';document.body.appendChild(ov);}
  ov.style.display='flex';
  ov.innerHTML=`<div class="auth-card"><div class="auth-brand">Cần phục hồi dữ liệu</div>
    <div class="auth-sub">QC Lab phát hiện dữ liệu cục bộ không hợp lệ và đã dừng để tránh ghi đè.</div>
    <div class="auth-err">${esc(startupProblem&&startupProblem.message||'Không đọc được dữ liệu.')}</div>
    <button class="btn teal" style="width:100%;margin-top:16px" onclick="downloadStartupData()">Tải dữ liệu gốc xuống</button>
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick="resetStartupData()">Tạo dữ liệu mới</button>
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
  ov.innerHTML=`<div class="auth-card"><div class="auth-brand">QC Lab</div><div class="auth-sub">Quản lý nội kiểm chất lượng xét nghiệm</div>
    <label>Tên đăng nhập</label><input id="liUser" autocomplete="username" autofocus>
    <label>Mật khẩu</label><input id="liPass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
    ${msg?`<div class="auth-err">${esc(msg)}</div>`:''}
    <button class="btn teal" style="width:100%;margin-top:16px" onclick="doLogin()">Đăng nhập</button>
    <div class="auth-hint">${defaultHint}Phiên bản ${esc(app.version||'dev')}</div></div>`;
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
async function doLogin(){
  if(Date.now()<loginLockUntil){showLogin('Sai mật khẩu quá nhiều lần. Thử lại sau '+Math.ceil((loginLockUntil-Date.now())/1000)+' giây.');return;}
  const u=document.getElementById('liUser').value.trim().toLowerCase();const p=document.getElementById('liPass').value;
  if(typeof storageHydrationPromise!=='undefined'&&!await storageHydrationPromise){showStartupRecovery();return;}
  const user=state.users.find(x=>x.username===u);
  const failOnce=msg=>{loginFails++;if(loginFails>=5){loginLockUntil=Date.now()+30000;loginFails=0;}showLogin(msg);};
  if(!user||user.active===false){failOnce('Tài khoản không tồn tại hoặc đã bị khóa.');return;}
  let ok=false;try{ok=await verifyPass(p,user.passHash);}catch(e){showLogin('Không thể kiểm tra mật khẩu trên trình duyệt này.');return;}
  if(!ok){failOnce('Sai mật khẩu.');return;}
  loginFails=0;loginLockUntil=0;
  currentUser=user;logAct('Đăng nhập','Đăng nhập thành công','Tài khoản');
  if(user.username==='admin'&&p==='admin'&&!String(user.passHash||'').startsWith('pbkdf2$'))user.mustChangePassword=true;
  else if(!String(user.passHash||'').startsWith('pbkdf2$')||+(String(user.passHash).split('$')[1]||0)<PASS_ITERATIONS){
    /* Nâng cấp hash trong suốt: dùng đúng mật khẩu vừa xác thực để băm lại theo chuẩn mới. */
    try{user.passHash=await hashPass(p);logAct('Nâng cấp mật khẩu','Tự động băm lại theo chuẩn mới khi đăng nhập','Tài khoản');}catch(e){}
  }
  save({cloud:false,clearDerived:false});if(user.mustChangePassword)showPasswordChange();else showApp();
}
function showPasswordChange(msg){
  let ov=document.getElementById('authOverlay');if(!ov){ov=document.createElement('div');ov.id='authOverlay';document.body.appendChild(ov);}ov.style.display='flex';
  ov.innerHTML=`<div class="auth-card"><div class="auth-brand">Đổi mật khẩu</div><div class="auth-sub">Cần cập nhật mật khẩu trước khi vào hệ thống</div>
    <label>Mật khẩu mới</label><input id="newPass1" type="password" autocomplete="new-password">
    <label>Nhập lại mật khẩu mới</label><input id="newPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')changeRequiredPassword()">
    ${msg?`<div class="auth-err">${esc(msg)}</div>`:''}
    <button class="btn teal" style="width:100%;margin-top:16px" onclick="changeRequiredPassword()">Lưu mật khẩu mới</button>
    <div class="auth-hint">Mật khẩu cần ít nhất 8 ký tự và không nên dùng lại mật khẩu mặc định.</div></div>`;
  setTimeout(()=>{const e=document.getElementById('newPass1');if(e)e.focus();},50);
}
async function changeRequiredPassword(){
  const p1=document.getElementById('newPass1').value,p2=document.getElementById('newPass2').value,err=passwordError(p1);
  if(err){showPasswordChange(err);return;}if(p1!==p2){showPasswordChange('Hai mật khẩu không khớp.');return;}
  currentUser.passHash=await hashPass(p1);currentUser.mustChangePassword=false;logAct('Đổi mật khẩu','Người dùng cập nhật mật khẩu','Tài khoản');save({cloud:!!(fb&&fb.initialized),clearDerived:false});showApp();
}
function logout(){if(currentUser){logAct('Đăng xuất','Đăng xuất khỏi phần mềm','Tài khoản');save({cloud:false,clearDerived:false});}currentUser=null;page='dash';showLogin();}
function showApp(){
  const ov=document.getElementById('authOverlay');if(ov)ov.style.display='none';
  if(!canAccessPage(page))page=firstAccessPage();
  document.getElementById('userBox').innerHTML='';
  renderBrand();nav();sideFoot();rerender();
}
