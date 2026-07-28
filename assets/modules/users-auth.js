/* ===== USERS PAGE ===== */
function pageUsers(){
  const rows=state.users.map(u=>`<tr>
    <td><b>${esc(u.name||u.username)}</b><div class="hint">@${esc(u.username)}${u.initials?' · '+esc(u.initials):''}</div></td>
    <td>${roleLabel(u.role)}</td>
    <td>${u.active===false?'<span class="tag rej">Khóa</span>':'<span class="tag ok">Hoạt động</span>'}</td>
    <td><div class="user-row-actions">${u.id===currentUser.id?'<span class="hint">(bạn)</span> '+btn('Đổi mật khẩu',"resetPass('"+u.id+"')",'ghost sm')
      :btn('Sửa quyền',"openUserPerms('"+u.id+"')",'ghost sm')+' '+btn('Đặt lại MK',"resetPass('"+u.id+"')",'ghost sm')+' '+btn(u.active===false?'Mở khóa':'Khóa',"toggleUser('"+u.id+"')",'ghost sm')+' '+btn('Xóa',"delUser('"+u.id+"')",'danger sm')}</div></td></tr>`).join('');
  return headOnly('Quản lý người dùng','Phân quyền thao tác và kiểm soát tài khoản')+
   `<div class="panel"><h3 role="heading" aria-level="2">Thêm người dùng</h3><div class="user-create-layout">
     <div class="user-create-card">
       <div class="user-create-card-title">Thông tin tài khoản</div>
       <div class="user-create-fields">
       <div><label>Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt"></div>
       <div><label>Họ tên</label><input id="uName" aria-label="Họ tên"></div>
       <div><label>Mã viết tắt</label><input id="uInitials" maxlength="12" placeholder="NTL"></div>
       <div><label>Vai trò</label><select id="uRole" aria-label="Vai trò" onchange="syncUserPermChecks('newUserPerms',this.value)"><option value="admin">Quản trị</option><option value="technician" selected>KTV</option><option value="viewer">Chỉ xem</option></select></div>
       <div><label>Mật khẩu tạm</label><input id="uPass" aria-label="Mật khẩu tạm" type="password" autocomplete="new-password"></div>
       <div class="user-create-actions">${btn('Thêm','addUser()','teal')}</div>
       </div>
     </div>
     <div class="user-create-access">
       <div class="user-create-card"><div class="user-create-card-title">Thẻ được phép dùng</div><div class="user-perm-block">${userPermChecks(rolePageIds('technician'),'newUserPerms','technician')}</div></div>
       <div class="user-list-section"><div class="user-list-title">Danh sách người dùng</div><div class="user-table-wrap"><table class="user-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${rows}</tbody></table></div></div>
     </div>
     </div>
     <div class="hint user-create-hint"><b>Vai trò</b> quyết định quyền sửa/quản trị trong các thẻ được tick. <b>KTV:</b> nhập/sửa dữ liệu vận hành · <b>Chỉ xem:</b> chỉ đọc. Người dùng mới sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</div></div>`;
}
let auditQ='',auditFrom='',auditTo='',auditPage=1,auditPageSize=25;
const AUDIT_PAGE_SIZES=[25,50,100];
function auditDateKey(a){
  const d=new Date(a&&a.ts);
  return Number.isFinite(+d)?isoDate(d):'';
}
function auditFilteredActivities(items=state.activity||[]){
  const q=searchText(auditQ);
  return (items||[]).filter(a=>{
    const date=auditDateKey(a);
    if(auditFrom&&(!date||date<auditFrom))return false;
    if(auditTo&&(!date||date>auditTo))return false;
    if(!q)return true;
    return searchText([a.seq,formatDateTimeVN(a.ts),a.user,a.username,roleLabel(a.role||'viewer'),a.type,a.target,a.detail].join(' ')).includes(q);
  }).slice().reverse();
}
function auditSetQuery(value){
  auditQ=value;auditPage=1;
  scheduleSearchRender(auditSetQuery,rerender,'auditSearch');
}
function auditSetDate(field,value){
  const iso=value?(vnPickerParse(value)||parseVN(value)||''):'';
  if(field==='from'){auditFrom=iso;if(iso&&auditTo&&iso>auditTo)auditTo=iso;}
  else{auditTo=iso;if(iso&&auditFrom&&iso<auditFrom)auditFrom=iso;}
  auditPage=1;rerender();
}
function auditSetPageSize(value){
  const size=Number(value);auditPageSize=AUDIT_PAGE_SIZES.includes(size)?size:25;auditPage=1;rerender();
}
function auditSetPage(value){
  auditPage=Math.max(1,Number(value)||1);rerender();
}
function auditClearFilters(){
  auditQ='';auditFrom='';auditTo='';auditPage=1;rerender();
}
function pageAudit(){
  const total=(state.activity||[]).length;
  const oversizeWarn=total>ACTIVITY_ROTATE_TO?` <span class="tag warn">Nhật ký đang rất lớn</span> <span class="hint">Nên lưu trữ bớt dòng cũ — hệ thống sẽ tự xoay vòng ở ${ACTIVITY_HARD_CAP} dòng (không xuất CSV).</span>`:'';
  const chain=typeof auditChainStatus==='function'?auditChainStatus():{ok:true,checked:0,legacy:total,idle:false};
  const chainHtml=chain.idle
    ?`<span class="tag none">Chưa kiểm chuỗi hash</span> ${btn('Kiểm tra chuỗi hash','auditVerifyChainNow()','ghost sm')} <span class="hint">Nhật ký lớn (${chain.total} dòng) nên không tự kiểm mỗi lần mở trang.</span>`
    :chain.ok?`<span class="tag ok">Chuỗi hash hợp lệ</span> <span class="hint">${chain.checked} dòng đã khóa hash${chain.legacy?` · ${chain.legacy} dòng cũ chưa có hash`:''}</span>`:`<span class="tag rej">Audit có dấu hiệu bị sửa</span> <span class="hint">Lỗi tại dòng #${(state.activity[chain.brokenIndex]||{}).seq||chain.brokenIndex+1}: ${esc(chain.reason)}</span>`;
  const filtered=auditFilteredActivities(),pageCount=Math.max(1,Math.ceil(filtered.length/auditPageSize));
  auditPage=Math.min(Math.max(1,auditPage),pageCount);
  const offset=(auditPage-1)*auditPageSize,pageRows=filtered.slice(offset,offset+auditPageSize);
  const rows=pageRows.map(a=>`<tr><td><div class="audit-time-cell"><span class="audit-seq">${a.seq?'#'+a.seq:''}</span><span class="audit-time">${formatDateTimeVN(a.ts)}</span></div></td><td><b>${esc(a.user||'')}</b><div class="hint">${roleLabel(a.role||'viewer')}${a.username?' · @'+esc(a.username):''}</div></td><td><span class="pill">${esc(a.type||'')}</span></td><td>${esc(a.target||'')||'<span class="hint">—</span>'}</td><td class="audit-detail">${esc(a.detail||'')||'<span class="hint">—</span>'}</td></tr>`).join('');
  const hasFilter=!!(auditQ||auditFrom||auditTo);
  const pageSizeOptions=AUDIT_PAGE_SIZES.map(size=>`<option value="${size}" ${size===auditPageSize?'selected':''}>${size} dòng</option>`).join('');
  const resultFrom=filtered.length?offset+1:0,resultTo=Math.min(offset+auditPageSize,filtered.length);
  const pagination=filtered.length?`<div class="audit-pagination"><span class="hint">Hiển thị ${resultFrom}–${resultTo} / ${filtered.length} dòng</span><div>${btn('‹ Trước',`auditSetPage(${auditPage-1})`,'ghost sm','',{disabled:auditPage<=1})}<b>Trang ${auditPage}/${pageCount}</b>${btn('Sau ›',`auditSetPage(${auditPage+1})`,'ghost sm','',{disabled:auditPage>=pageCount})}</div></div>`:'';
  return headOnly('Nhật ký hoạt động','Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem')+
    `<div class="panel"><h3 role="heading" aria-level="2">Công cụ</h3><div class="row-flex">
      ${btn('Xuất CSV nhật ký','exportActivityCSV()','teal sm')}
      ${total?btn('Lưu trữ nhật ký cũ','archiveActivityLog()','ghost sm'):''}
      ${total?btn('Xóa nhật ký','clearActivityLog()','danger sm'):''}
      <div class="hint" style="align-self:center">${total} dòng hoạt động đã ghi nhận. ${chainHtml}${oversizeWarn}</div>
    </div></div>
    <div class="panel audit-log-panel"><div class="audit-log-head"><h3 role="heading" aria-level="2">Hoạt động gần đây</h3><input id="auditSearch" type="search" aria-label="Tìm nhật ký hoạt động" placeholder="Tìm người dùng, hành động, đối tượng..." value="${escAttr(auditQ)}" oninput="auditSetQuery(this.value)"></div>
      <div class="audit-filterbar"><div><label>Từ ngày</label>${dateBox('auditFromDate',auditFrom,'audit-date',`aria-label="Lọc nhật ký từ ngày" onchange="auditSetDate('from',this.value)"`)}</div><div><label>Đến ngày</label>${dateBox('auditToDate',auditTo,'audit-date',`aria-label="Lọc nhật ký đến ngày" onchange="auditSetDate('to',this.value)"`)}</div><div><label>Số dòng mỗi trang</label><select aria-label="Số dòng nhật ký mỗi trang" onchange="auditSetPageSize(this.value)">${pageSizeOptions}</select></div>${hasFilter?btn('Xóa bộ lọc','auditClearFilters()','ghost sm audit-clear-filter'):''}<div class="audit-filter-summary" role="status">${filtered.length}/${total} dòng</div></div>
      ${rows?`<div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState(total?'Không tìm thấy nhật ký':'Chưa có hoạt động',total?'Thử từ khóa hoặc khoảng ngày khác.':'Nhật ký sẽ bắt đầu ghi từ các thao tác tiếp theo.')}
      ${pagination}</div>`;
}
function activityCSVRows(items){const rows=[['Seq','Thời gian','Người dùng','Tên đăng nhập','Vai trò','Hành động','Đối tượng','Chi tiết','PrevHash','Hash']];(items||[]).forEach(a=>rows.push([a.seq||'',formatDateTimeVN(a.ts),a.user||'',a.username||'',roleLabel(a.role||'viewer'),a.type||'',a.target||'',a.detail||'',a.prevHash||'',a.hash||'']));return rows;}
function exportActivityCSV(){downloadCSV('Nhat_ky_hoat_dong_QCLab.csv',activityCSVRows(state.activity));}
/* Xóa vĩnh viễn toàn bộ nhật ký hoạt động — khác với "Xóa sạch dữ liệu test" (resetAllData)
   vốn CHỦ ĐỘNG giữ lại nhật ký. Đây là ngoại lệ duy nhất cho quy tắc "chỉ ghi nối tiếp,
   không tự cắt bớt dòng" — chỉ admin bấm được, có xác nhận, và tự ghi lại đúng 1 dòng nhật ký
   mới ghi nhận việc đã xóa (để vẫn còn dấu vết là đã có một lần xóa, dù không phục hồi được nội dung cũ). */
async function clearActivityLog(){
  if(!requireAdmin())return;
  const count=(state.activity||[]).length;if(!count)return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa nhật ký hoạt động',message:`Xóa vĩnh viễn toàn bộ ${count} dòng nhật ký hoạt động?`,detail:'Không thể khôi phục lại được — nên xuất Excel nhật ký trước nếu cần lưu lại.',confirmLabel:'Xóa nhật ký',cancelLabel:'Hủy'}))return;
  if(!await reauthenticateCurrentUser({title:'Xác thực xóa nhật ký',message:'Nhập lại mật khẩu trước khi xóa toàn bộ nhật ký hoạt động.'}))return;
  state.activity=[];state.activityAnchor='';
  logAct('Xóa nhật ký hoạt động',`Đã xóa vĩnh viễn ${count} dòng nhật ký trước đó`,'Nhật ký');
  auditQ='';auditFrom='';auditTo='';auditPage=1;
  save({clearDerived:false});rerender();
  await infoDialog('Đã xóa nhật ký hoạt động.',{type:'success'});
}
/* Lưu trữ CÓ CHỦ ĐÍCH nhật ký cũ: xuất CSV phần bị cắt TRƯỚC, chỉ khi file đã
   tạo xong mới gỡ khỏi state — khác với xoay vòng tự động (auditRotateOverflow),
   đường này không mất dữ liệu. CSV giữ nguyên cột PrevHash/Hash để phần đã lưu
   trữ kiểm chứng độc lập được: hash dòng cuối file phải khớp tipHash trong dòng
   checkpoint ghi lại sau khi cắt. */
function archiveActivityLog(){
  if(!requireAdmin())return;
  const total=(state.activity||[]).length;if(!total)return;
  openModal(modalTemplate({title:'Lưu trữ nhật ký cũ',body:`
      <div class="hint">Nhật ký hiện có <b>${total}</b> dòng. Các dòng cũ hơn mốc chọn sẽ được <b>xuất ra file CSV</b> (kèm PrevHash/Hash), sau đó mới bị gỡ khỏi hệ thống — hash dòng cuối file trở thành điểm nối vào chuỗi còn lại nên phần lưu trữ vẫn kiểm chứng được.</div>
      <label style="margin-top:12px">Chỉ giữ lại nhật ký trong</label>
      <select id="auditArchiveMonths" aria-label="Mốc tuổi nhật ký được giữ lại">
        <option value="12">12 tháng gần nhất</option>
        <option value="24" selected>24 tháng gần nhất</option>
        <option value="36">36 tháng gần nhất</option>
      </select>
    `,footer:btn('Hủy','closeModal()','ghost')+btn('Xuất CSV và lưu trữ','confirmArchiveActivityLog()','teal')}));
}
async function confirmArchiveActivityLog(){
  if(!requireAdmin())return;
  const months=Math.max(1,Math.floor(Number((document.getElementById('auditArchiveMonths')||{}).value)||24));
  const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-months);
  const{segment,retained,tipHash}=auditArchiveCut(state.activity,cutoff.toISOString());
  if(!segment.length){closeModal();await infoDialog('Không có dòng nhật ký nào cũ hơn mốc đã chọn.');return;}
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Lưu trữ nhật ký cũ',message:`Xuất CSV rồi gỡ ${segment.length} dòng nhật ký cũ hơn ${months} tháng?`,detail:`Còn lại ${retained.length} dòng trong hệ thống. File CSV giữ nguyên PrevHash/Hash từng dòng và nối tiếp được vào chuỗi còn lại.`,confirmLabel:'Lưu trữ',cancelLabel:'Hủy'}))return;
  /* Gỡ vĩnh viễn hàng chục nghìn dòng audit nặng ngang các thao tác trọng yếu khác
     (duyệt hành động, khóa kỳ, ghi Mean/SD) nên đi cùng một cổng xác thực. */
  if(!await reauthenticateCurrentUser({title:'Xác thực lưu trữ nhật ký',message:'Nhập lại mật khẩu trước khi gỡ nhật ký cũ khỏi hệ thống.'}))return;
  try{downloadCSV('Luu_tru_nhat_ky_QCLab_'+cutoff.toISOString().slice(0,10)+'.csv',activityCSVRows(segment));}
  catch(e){await infoDialog('Không tạo được file CSV lưu trữ. Nhật ký chưa bị thay đổi.');return;}
  /* downloadCSV() chỉ tạo blob rồi a.click(): trình duyệt chặn tải, người dùng bấm Hủy
     ở hộp lưu file hay đĩa đầy đều KHÔNG ném lỗi. Vì vậy phải để người dùng tự xác nhận
     đã thấy file — try/catch ở trên một mình không đảm bảo được điều đó. */
  if(!await confirmDialog({kicker:'Kiểm tra trước khi gỡ',title:'Đã có file CSV lưu trữ chưa?',message:'Mở thư mục Tải xuống và kiểm tra file vừa tải có mở được và đủ dòng.',detail:'Chỉ bấm "Đã kiểm tra" khi bạn thực sự thấy file — sau bước này các dòng cũ bị gỡ khỏi hệ thống.',confirmLabel:'Đã kiểm tra, gỡ khỏi hệ thống',cancelLabel:'Chưa, giữ nguyên'}))return;
  /* Cắt prefix + đặt neo, KHÔNG relink: giữ nguyên hash gốc của phần còn lại nên file
     CSV vừa xuất nối thẳng vào chuỗi đang sống bằng mật mã (hash dòng cuối file chính
     là neo), và thao tác thành O(1) thay vì băm lại toàn chuỗi. */
  state.activity=retained;
  state.activityAnchor=tipHash||'';
  logAct('Lưu trữ nhật ký hoạt động',`Đã xuất CSV và gỡ ${segment.length} dòng cũ hơn ${months} tháng (mốc ${vnDate(cutoff.toISOString().slice(0,10))}), còn lại ${retained.length} dòng. Hash đỉnh phần lưu trữ: ${tipHash||'—'}`,'Nhật ký');
  auditPage=1;save({clearDerived:false});closeModal();rerender();
  await infoDialog(`Đã lưu trữ ${segment.length} dòng nhật ký cũ — file CSV đã được tải xuống.`,{type:'success'});
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
  const roleSelect=`<select id="editUserRole" aria-label="Vai trò" onchange="syncUserPermChecks('editUserPerms',this.value)"><option value="admin" ${u.role==='admin'?'selected':''}>Quản trị</option><option value="technician" ${u.role==='technician'?'selected':''}>KTV</option><option value="viewer" ${u.role==='viewer'?'selected':''}>Chỉ xem</option></select>`;
  openModal(`<div class="modal"><div class="modal-h"><h3>Sửa quyền người dùng</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="hint"><b>${esc(u.name||u.username)}</b> · @${esc(u.username)}</div>
      <label>Vai trò</label>${roleSelect}
      <label style="margin-top:12px">Thẻ được phép dùng</label>${userPermChecks(u.pagePerms,'editUserPerms',u.role)}
      <div class="hint" style="margin-top:10px">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào.</div>
    </div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Lưu quyền',`applyUserPerms('${id}')`,'teal')}</div></div>`);
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
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Lưu mật khẩu',`applyResetPass('${id}')`,'teal')}</div></div>`);
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
async function ensureAdmin(){if(!state.users||!state.users.length){state.users=[{id:uid(),username:'admin',name:'Quản trị viên',role:'admin',passHash:await legacyHashPass('admin'),active:true,mustChangePassword:true}];save({cloud:false,clearDerived:false});}}
function blankAppState(users){
  return{lab:{name:'',dept:'',address:'',brandTitle:'QC Lab',brandSub:'Nội kiểm xét nghiệm',logoText:'QC',logoData:''},tests:[],machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],activityAnchor:'',users:Array.isArray(users)?users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT},westgardProfileVersion:2,configMigrationVersion:1,schemaVersion:STATE_SCHEMA_VERSION};
}
async function resetAllData(){
  if(!requireAdmin())return;
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa sạch dữ liệu test',message:'Xóa sạch toàn bộ dữ liệu test?',detail:'Nhật ký hoạt động sẽ được giữ lại và ghi nhận thao tác này.',confirmLabel:'Tiếp tục',cancelLabel:'Hủy'}))return;
  if(!await confirmDialog({kicker:'Xác nhận lần cuối',title:'Xóa sạch dữ liệu test',message:'Dữ liệu QC, cấu hình, lô, panel và khắc phục sẽ bị xóa.',detail:'Nhật ký audit vẫn được giữ. Nếu đang bật đám mây, trạng thái trắng cũng sẽ được đồng bộ lên Firebase.',confirmLabel:'Xóa sạch dữ liệu',cancelLabel:'Hủy'}))return;
  if(typeof backupCurrentData==='function'&&!backupCurrentData('truoc-xoa')){await infoDialog('Không tạo được bản backup an toàn. Dữ liệu chưa bị xóa.');return;}
  const keepUsers=(state.users||[]).length?state.users:[];
  /* Neo chuoi hash di kem nhat ky: giu nhat ky ma bo neo thi auditVerifyChain() se
     bao "audit bi sua" gia ngay o dong dau tien neu lab da tung luu tru. */
  const keepActivity=[...(state.activity||[])],keepAnchor=state.activityAnchor||'';
  localStorage.removeItem('qclab');localStorage.removeItem('qclab_boot');if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);if(typeof LocalStore!=='undefined')LocalStore.clear().catch(()=>{});
  state=blankAppState(keepUsers);
  state.activity=keepActivity;state.activityAnchor=keepAnchor;
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
    ${btn('Tải dữ liệu gốc xuống','downloadStartupData()','teal','',{attrs:{style:'width:100%;margin-top:16px'}})}
    ${btn('Tạo dữ liệu mới','resetStartupData()','ghost','',{attrs:{style:'width:100%;margin-top:8px'}})}
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
  const trialLine=trial&&trial.active?`<div class="auth-hint" style="color:${trial.daysLeft<=7?'#c77a1f':'#0b747d'}">Bản dùng thử: còn ${trial.daysLeft}/${trial.totalDays} ngày</div>`:'';
  ov.innerHTML=`<div class="auth-card"><div class="auth-brand">QC Lab</div><div class="auth-sub">Quản lý nội kiểm chất lượng xét nghiệm</div>
    <label>Tên đăng nhập</label><input id="liUser" autocomplete="username" autofocus>
    <label>Mật khẩu</label><input id="liPass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
    ${msg?`<div class="auth-err">${esc(msg)}</div>`:''}
    ${btn('Đăng nhập','doLogin()','teal','',{attrs:{style:'width:100%;margin-top:16px'}})}
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
    ${btn('Lưu mật khẩu mới','changeRequiredPassword()','teal','',{attrs:{style:'width:100%;margin-top:16px'}})}
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
