/* ===== ROUTER ===== */
/* Danh sách trang và chính sách quyền do TypeScript sở hữu. Bundle được nạp trước
   file này, nên route classic chỉ giữ các API global tương thích. */
const PAGES=globalThis.routerPagePolicy.pages;
const PERM=globalThis.routerPagePolicy.permissions;
let page='dash';
function role(){return currentUser?currentUser.role:'viewer';}
function canWrite(){return role()==='admin'||role()==='technician';}
/* requireWrite()/requireAdmin() stay synchronous on purpose — 68 call sites
   across the app do `if(!requireWrite())return;`, and making that async would
   force `await` onto every one of them just to reskin a permission-denied
   message. infoDialog() is fired without awaiting: it opens immediately
   (synchronous DOM write inside), the caller still gets its boolean back the
   same tick either way. */
function requireWrite(message='Bạn không có quyền sửa dữ liệu.'){if(canWrite())return true;infoDialog(message);return false;}
function requireAdmin(message='Chỉ quản trị mới được thực hiện thao tác này.'){if(role()==='admin')return true;infoDialog(message);return false;}
const ROLE_LIST=globalThis.routerPagePolicy.roles;
function roleLabel(r){return r==='admin'?'Quản trị':r==='technician'?'KTV':'Chỉ xem';}
function roleSelectOptions(selected){return ROLE_LIST.map(r=>`<option value="${r}" ${r===selected?'selected':''}>${roleLabel(r)}</option>`).join('');}
function rolePageIds(r=role()){return globalThis.routerPagePolicy.rolePageIds(r);}
function userPageIds(u=currentUser){return globalThis.routerPagePolicy.userPageIds(u);}
function setSearchCount(id,visible,total){const el=document.getElementById(id);if(el)el.textContent=visible+'/'+total;}
function showSearchEmpty(id,on){const el=document.getElementById(id);if(el)el.style.display=on?'':'none';}
function replaceSelectItems(select,items,emptyText){
  if(!select)return;
  const selected=select.value,options=(items||[]).map(item=>{const o=document.createElement('option');o.value=String(item.value??'');o.textContent=String(item.label??'');return o;});
  if(!options.length){const o=document.createElement('option');o.value='';o.textContent=emptyText||'Không có dữ liệu';options.push(o);}
  select.replaceChildren(...options);select.disabled=!(items&&items.length);
  if((items||[]).some(item=>String(item.value)===String(selected)))select.value=selected;
}
function liveRowFilter(selector,q,opts={}){
  q=searchText(q);
  let visible=0,total=0;
  document.querySelectorAll(selector).forEach(el=>{
    total++;
    const ok=!q||String(el.dataset.search||'').includes(q);
    el.style.display=ok?'':'none';
    if(ok)visible++;
  });
  if(opts.countId)setSearchCount(opts.countId,visible,total);
  if(opts.emptyId)showSearchEmpty(opts.emptyId,visible===0);
  return{visible,total};
}
function scheduleSearchRender(owner,apply,focusId,delay=180){
  clearTimeout(owner.searchTimer);
  owner.searchTimer=setTimeout(()=>{
    apply();
    if(focusId){
      const e=document.getElementById(focusId);
      if(e){e.focus({preventScroll:true});try{e.setSelectionRange(e.value.length,e.value.length);}catch(err){}}
    }
  },delay);
}
function canAccessPage(id,u=currentUser){return globalThis.routerPagePolicy.canAccessPage(id,u);}
function firstAccessPage(u=currentUser){return globalThis.routerPagePolicy.firstAccessPage(u);}
function icon(id){const p={
 dash:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.3"/>',
 entry:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
 westgard:'<path d="M4 3v18h17"/><path d="M7 7h13M7 12h13M7 17h13" opacity=".55"/><path d="m7 15 3-5 3 3 3-7 4 4"/><circle cx="7" cy="15" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="6" r=".8" fill="currentColor" stroke="none"/><circle cx="20" cy="10" r=".8" fill="currentColor" stroke="none"/>',
 sigma:'<path d="M16.5 5H8l5.2 7-5.2 7h8.5"/>',
 reagent:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
 actions:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"/>',
 report:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8.5 13h7"/><path d="M8.5 17h7"/>',
 manage:'<line x1="4.5" x2="4.5" y1="21" y2="14"/><line x1="4.5" x2="4.5" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="19.5" x2="19.5" y1="21" y2="16"/><line x1="19.5" x2="19.5" y1="12" y2="3"/><line x1="2.5" x2="6.5" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="17.5" x2="21.5" y1="16" y2="16"/>',
 users:'<path d="M16.5 21v-2a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7.5" r="3.8"/><path d="M21.5 21v-2a4 4 0 0 0-3-3.87"/><path d="M15.5 3.13a4 4 0 0 1 0 7.75"/>',
 audit:'<rect x="8" y="2.5" width="8" height="3.7" rx="1"/><path d="M16 4.3h1.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6.3a2 2 0 0 1 2-2H8"/><path d="M9 12.5h6"/><path d="M9 16.5h6"/>',
 settings:'<path d="M17.6 18.5H8.8a6.3 6.3 0 1 1 6-8.1h.7a4 4 0 1 1 0 8.1Z"/>'
 }[id]||'';
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;}
function icoCal(){return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';}
function icoDownload(){return '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';}
function icoPrint(){return '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>';}
/* Icon "dẫn tới" dùng thay ký tự ↳ (U+21B3) — font Manrope tự host chỉ có bộ
   glyph latin+vietnamese (xem tokens.css) nên trình duyệt fallback sang font hệ
   thống khác cho riêng ký tự này, làm nó trông lệch/khác cỡ giữa câu chữ. SVG
   không phụ thuộc font nên luôn hiển thị nhất quán. */
function icoRefArrow(){return '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0"><path d="M4 4v7a4 4 0 0 0 4 4h12"/><path d="M15 10l5 5-5 5"/></svg>';}
function dateBox(id,value='',cls='manage-date',attrs=''){
  const iso=vnPickerParse(value)||parseVN(value)||'';
  return `<span class="datebox ${cls}"><input id="${id}" class="date-text" inputmode="numeric" value="${escAttr(vnDate(value||''))}" placeholder="dd/mm/yyyy" ${attrs}><span class="datepick" title="Chọn ngày">${icoCal()}</span><input class="native-date" type="date" lang="vi" value="${escAttr(iso)}" title="Chọn ngày"></span>`;
}
const VN_DATE_MONTHS=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const VN_DATE_DAYS=['T2','T3','T4','T5','T6','T7','CN'];
let vnDatePicker={box:null,input:null,native:null,view:null,mode:'day'};
function vnPickerParse(s){return globalThis.vnDatePickerController.parse(s);}
function vnPickerValid(y,m,d){return globalThis.vnDatePickerController.valid(y,m,d);}
function vnPickerText(iso){return globalThis.vnDatePickerController.text(iso);}
function vnPickerOpen(datebox){return globalThis.vnDatePickerController.open(datebox);}
function vnPickerClose(){return globalThis.vnDatePickerController.close();}
function vnPickerMove(months){return globalThis.vnDatePickerController.move(months);}
function vnPickerMode(mode){return globalThis.vnDatePickerController.mode(mode);}
function vnPickerSetYear(year){return globalThis.vnDatePickerController.setYear(year);}
function vnPickerSetMonth(month){return globalThis.vnDatePickerController.setMonth(month);}
function vnPickerPick(iso){return globalThis.vnDatePickerController.pick(iso);}
function vnPickerRender(){
  if(!vnDatePicker.box||!vnDatePicker.input)return;
  let pop=document.getElementById('vnDatePicker');if(!pop){pop=document.createElement('div');pop.id='vnDatePicker';pop.className='vn-date-picker';document.body.appendChild(pop);}
  const view=vnDatePicker.view,y=view.getFullYear(),m=view.getMonth(),selected=vnPickerParse(vnDatePicker.input.value),today=isoToday();
  if(vnDatePicker.mode==='month'){
    pop.innerHTML=`<div class="vn-date-head"><button type="button" data-year-step="-1" title="Năm trước">‹</button><button type="button" class="vn-date-title" data-mode="day" title="Quay lại chọn ngày">Chọn tháng/năm</button><button type="button" data-year-step="1" title="Năm sau">›</button></div><div class="vn-year-row"><button type="button" data-year-step="-1">-</button><input id="vnPickerYear" type="number" min="1000" max="9999" value="${y}" inputmode="numeric"><button type="button" data-year-step="1">+</button></div><div class="vn-month-grid">${VN_DATE_MONTHS.map((name,i)=>`<button type="button" class="${i===m?'selected':''}" data-month="${i}">${name}</button>`).join('')}</div><div class="vn-date-foot"><button type="button" data-today="1">Hôm nay</button><button type="button" data-close="1">Đóng</button></div>`;
    const r=vnDatePicker.box.getBoundingClientRect(),w=258,left=Math.min(Math.max(8,r.left),window.innerWidth-w-8),top=Math.min(r.bottom+6,window.innerHeight-pop.offsetHeight-8);
    pop.style.left=left+'px';pop.style.top=Math.max(8,top)+'px';return;
  }
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7,cells=[];
  for(let i=0;i<offset;i++)cells.push('<button type="button" class="blank" tabindex="-1"></button>');
  for(let d=1;d<=days;d++){const iso=vnPickerValid(y,m+1,d),cls=[iso===selected?'selected':'',iso===today?'today':''].filter(Boolean).join(' ');cells.push(`<button type="button" class="${cls}" data-date="${iso}">${d}</button>`);}
  pop.innerHTML=`<div class="vn-date-head"><button type="button" data-move="-1" title="Tháng trước">‹</button><button type="button" class="vn-date-title" data-mode="month" title="Chọn nhanh tháng/năm">${VN_DATE_MONTHS[m]} ${y}</button><button type="button" data-move="1" title="Tháng sau">›</button></div><div class="vn-date-days">${VN_DATE_DAYS.map(d=>`<span>${d}</span>`).join('')}</div><div class="vn-date-grid">${cells.join('')}</div><div class="vn-date-foot"><button type="button" data-today="1">Hôm nay</button><button type="button" data-close="1">Đóng</button></div>`;
  const r=vnDatePicker.box.getBoundingClientRect(),w=258,left=Math.min(Math.max(8,r.left),window.innerWidth-w-8),top=Math.min(r.bottom+6,window.innerHeight-pop.offsetHeight-8);
  pop.style.left=left+'px';pop.style.top=Math.max(8,top)+'px';
}
globalThis.vnDatePickerController.bind();
function brandTitle(){return globalThis.routerShell.brandTitle();}
function brandSub(){return globalThis.routerShell.brandSub();}
function brandMarkText(){return globalThis.routerShell.brandMarkText();}
function brandLogo(){return globalThis.routerShell.brandLogo();}
function renderBrand(){return globalThis.routerShell.renderBrand();}
function nav(){return globalThis.routerShell.nav({page,user:currentUser,icon});}
/* Watermark tên lab được cấp phép (bản Electron có license). Chạy trong trình
   duyệt thường thì window.qcLicense không tồn tại nên bỏ qua — không ảnh hưởng. */
function licensedLabName(){return globalThis.routerShell.licensedLabName();}
/* Bản Electron chưa kích hoạt license nhưng còn hạn dùng thử 14 ngày (xem
   electron/license.js) truyền trạng thái này qua window.qcLicense.trial. Chạy
   trong trình duyệt thường hoặc bản đã có license thì trial luôn {active:false}. */
function trialInfo(){return globalThis.routerShell.trialInfo();}
function sideFoot(){return globalThis.routerShell.sideFoot();}
/* Ẩn/hiện thanh điều hướng bên trái: sở thích hiển thị riêng của máy này, không
   phải dữ liệu nghiệp vụ nên lưu localStorage thay vì state/sync. Script đồng bộ
   trong index.html đọc cùng khóa để áp trạng thái ngay khi tải trang, tránh nháy. */
function toggleSidebarNav(){return globalThis.routerShell.toggleSidebarNav();}
function go(p){if(!canAccessPage(p))return;page=p;nav();rerender();resetMainScroll();requestAnimationFrame(()=>{const main=document.getElementById('main');if(main)main.focus({preventScroll:true});});}
function resetMainScroll(){const m=document.querySelector('main');if(m)m.scrollTop=0;window.scrollTo(0,0);}
function topUserBox(){if(!currentUser)return '';const name=currentUser.name||currentUser.username;const initial=esc(String(name||'U').trim().charAt(0).toUpperCase()||'U');return `<div class="top-user"><div class="avatar">${initial}</div><div class="meta"><div class="name">${esc(name)}</div><div class="role">${roleLabel(currentUser.role)}</div></div><button onclick="logout()" title="Đăng xuất"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 5v14"/></svg>Đăng xuất</button></div>`;}
function headOnly(t,p,actions=''){return `<div class="head"><div><h1>${t}</h1>${p?`<p>${p}</p>`:''}</div><div class="head-actions">${actions}${topUserBox()}</div></div>`;}
function emptyState(title,body,actions=''){return `<div class="empty"><div class="empty-title">${title}</div><div>${body}</div>${actions?`<div class="empty-actions">${actions}</div>`:''}</div>`;}
function btn(label,onclick,cls='ghost sm',title='',opts={}){const{disabled=false,attrs={}}=opts,attrStr=Object.entries(attrs).map(([k,v])=>` ${k}="${escAttr(v)}"`).join('');return `<button class="btn ${cls}"${disabled?' disabled':''} onclick="${onclick}"${title?` title="${escAttr(title)}"`:''}${attrStr}>${label}</button>`;}
function rangeActions(tid,level,eligible,applied){let h='';if(eligible)h+=btn('Workflow dải QC',`openRangeWorkflow('${tid}',${level})`,'teal sm','Xem điều kiện, dải đề xuất và phê duyệt');if(applied==='lab'&&canWrite())h+=btn('↶',`revertRange('${tid}',${level})`,'ghost icon','Về dải nhà sản xuất');return h?`<div style="margin:8px 14px 0;display:flex;gap:6px;flex-wrap:wrap">${h}</div>`:'';}
function stateName(s){return globalThis.reportLabels.stateName(s);}
function qcVerdictLabel(level){return globalThis.reportLabels.verdictLabel(level);}

/* ===== STATUS ===== */
/* ===== RENDER ===== */
function render(){statusMemo=new Map();if(!canAccessPage(page))page=firstAccessPage();const m=document.getElementById('main');const map={dash:pageDash,entry:pageEntry,westgard:pageWestgard,sigma:pageSigma,reagent:pageReagent,actions:pageActionsV4,report:pageReportV2,manage:pageManage,users:pageUsers,audit:pageAudit,settings:pageSettings};m.innerHTML=(map[page]||pageDash)();}
function restoreRouteFilters(){if(page==='dash'&&dashTestQ)dashTestFilter(dashTestQ);else if(page==='entry'&&entryQ)entryFilter(entryQ);}
/* render() gán lại #main.innerHTML nên scrollTop của <main> về 0 mỗi lần. Khi vẽ
   lại CÙNG một trang (vd Firebase dội bản đồng bộ về gọi rerender(), hoặc sau một
   thao tác sửa dữ liệu), giữ nguyên vị trí cuộn để trang không "nhảy" về đầu —
   trước đây trang Sigma bị giật do save() lúc render kéo theo rerender. Đổi trang
   đi qua go(), vốn tự gọi resetMainScroll() SAU rerender() nên vẫn reset đúng. */
function rerender(){const m=document.getElementById('main'),keepScroll=m?m.scrollTop:0;render();afterRender(page);restoreRouteFilters();if(m&&keepScroll)m.scrollTop=keepScroll;}
