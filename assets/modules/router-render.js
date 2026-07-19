/* ===== ROUTER ===== */
const PAGES=[['dash','Bảng điều khiển'],['entry','Nhập QC & Biểu đồ'],['westgard','Phân tích Westgard'],['sigma','Six Sigma & Sai số'],['reagent','So sánh hóa chất'],['actions','Khắc phục sự cố'],['report','Báo cáo & Biểu mẫu'],['manage','Cấu hình chung'],['users','Người dùng'],['audit','Nhật ký hoạt động'],['settings','Cài đặt & Đám mây']];
const PERM={dash:['admin','technician','viewer'],entry:['admin','technician','viewer'],westgard:['admin','technician','viewer'],sigma:['admin','technician','viewer'],reagent:['admin','technician','viewer'],actions:['admin','technician'],report:['admin','technician','viewer'],manage:['admin'],users:['admin'],audit:['admin'],settings:['admin']};
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
function roleLabel(r){return r==='admin'?'Quản trị':r==='technician'?'KTV':'Chỉ xem';}
function rolePageIds(r=role()){return PAGES.map(x=>x[0]).filter(id=>PERM[id]&&PERM[id].includes(r));}
function userPageIds(u=currentUser){
  if(!u)return rolePageIds('viewer');
  const base=rolePageIds(u.role),picked=Array.isArray(u.pagePerms)?[...new Set(u.pagePerms)].filter(id=>base.includes(id)):base;
  return picked.length?picked:base.slice(0,1);
}
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
function canAccessPage(id,u=currentUser){return !!(PERM[id]&&userPageIds(u).includes(id));}
function firstAccessPage(u=currentUser){return(PAGES.find(([id])=>canAccessPage(id,u))||['dash'])[0];}
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
function dateBox(id,value='',cls='manage-date',attrs=''){
  const iso=vnPickerParse(value)||parseVN(value)||'';
  return `<span class="datebox ${cls}"><input id="${id}" class="date-text" inputmode="numeric" value="${escAttr(vnDate(value||''))}" placeholder="dd/mm/yyyy" ${attrs}><span class="datepick" title="Chọn ngày">${icoCal()}</span><input class="native-date" type="date" lang="vi" value="${escAttr(iso)}" title="Chọn ngày"></span>`;
}
const VN_DATE_MONTHS=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const VN_DATE_DAYS=['T2','T3','T4','T5','T6','T7','CN'];
let vnDatePicker={box:null,input:null,native:null,view:null,mode:'day'};
function vnPickerParse(s){s=String(s||'').trim();let m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s);if(m)return vnPickerValid(+m[3],+m[2],+m[1]);m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);return m?vnPickerValid(+m[1],+m[2],+m[3]):'';}
function vnPickerValid(y,m,d){const dt=new Date(y,m-1,d);return y>=1000&&dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';}
function vnPickerText(iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));return m?`${m[3]}/${m[2]}/${m[1]}`:'';}
function vnPickerOpen(datebox){
  const input=datebox.querySelector('.date-text'),native=datebox.querySelector('.native-date');if(!input)return;
  if(input.disabled||input.readOnly)return;
  const iso=vnPickerParse(input.value)||(native&&native.value)||isoToday(),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso),view=new Date(+m[1],+m[2]-1,1);
  vnDatePicker={box:datebox,input,native,view,mode:'day'};vnPickerRender();
}
function vnPickerClose(){const el=document.getElementById('vnDatePicker');if(el)el.remove();vnDatePicker={box:null,input:null,native:null,view:null,mode:'day'};}
function vnPickerMove(months){if(!vnDatePicker.view)return;vnDatePicker.view=new Date(vnDatePicker.view.getFullYear(),vnDatePicker.view.getMonth()+months,1);vnPickerRender();}
function vnPickerMode(mode){vnDatePicker.mode=mode==='month'?'month':'day';vnPickerRender();}
function vnPickerSetYear(year){year=Math.min(9999,Math.max(1000,parseInt(year)||new Date().getFullYear()));vnDatePicker.view=new Date(year,vnDatePicker.view.getMonth(),1);vnPickerRender();}
function vnPickerSetMonth(month){vnDatePicker.view=new Date(vnDatePicker.view.getFullYear(),month,1);vnDatePicker.mode='day';vnPickerRender();}
function vnPickerPick(iso){
  if(!vnDatePicker.input)return;
  vnDatePicker.input.value=vnPickerText(iso);
  if(vnDatePicker.native)vnDatePicker.native.value=iso;
  vnDatePicker.input.dispatchEvent(new Event('input',{bubbles:true}));
  vnDatePicker.input.dispatchEvent(new Event('change',{bubbles:true}));
  vnPickerClose();
}
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
document.addEventListener('click',e=>{
  const pickerBtn=e.target.closest&&e.target.closest('#vnDatePicker button');
  if(pickerBtn){
    e.preventDefault();e.stopPropagation();
    if(pickerBtn.dataset.mode)vnPickerMode(pickerBtn.dataset.mode);
    else if(pickerBtn.dataset.move)vnPickerMove(+pickerBtn.dataset.move);
    else if(pickerBtn.dataset.yearStep)vnPickerSetYear(vnDatePicker.view.getFullYear()+(+pickerBtn.dataset.yearStep));
    else if(pickerBtn.dataset.month!=null)vnPickerSetMonth(+pickerBtn.dataset.month);
    else if(pickerBtn.dataset.date)vnPickerPick(pickerBtn.dataset.date);
    else if(pickerBtn.dataset.today)vnPickerPick(isoToday());
    else if(pickerBtn.dataset.close)vnPickerClose();
    return;
  }
  const btn=e.target.closest&&e.target.closest('.datepick');
  if(btn){e.preventDefault();e.stopPropagation();vnPickerOpen(btn.closest('.datebox'));return;}
  if(!e.target.closest||(!e.target.closest('#vnDatePicker')&&!e.target.closest('.datebox')))vnPickerClose();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')vnPickerClose();
  if(e.key==='Enter'&&e.target&&e.target.id==='vnPickerYear'){e.preventDefault();vnPickerSetYear(e.target.value);}
});
document.addEventListener('change',e=>{if(e.target&&e.target.id==='vnPickerYear')vnPickerSetYear(e.target.value);});
function brandTitle(){return (state.lab&&state.lab.brandTitle)||'QC Lab';}
function brandSub(){return (state.lab&&state.lab.brandSub)||'Nội kiểm xét nghiệm';}
function brandMarkText(){return ((state.lab&&state.lab.logoText)||'QC').slice(0,4);}
function brandLogo(){return state.lab&&state.lab.logoData||'';}
function renderBrand(){
  const el=document.getElementById('brandBox');if(!el)return;
  const logo=brandLogo();
  el.innerHTML=`<div class="brand-mark">${logo?`<img src="${escAttr(logo)}" alt="">`:esc(brandMarkText())}</div><div>${esc(brandTitle())}<small>${esc(brandSub())}</small></div>`;
}
function nav(){const groups=[['Theo dõi',['dash','entry','westgard','sigma']],['Vận hành',['reagent','actions','report']],['Quản trị',['manage','users','audit','settings']]];
  document.getElementById('nav').innerHTML=groups.map(([g,ids])=>{const items=PAGES.filter(([id])=>ids.includes(id)&&canAccessPage(id));return items.length?`<div class="nav-group">${g}</div>`+items.map(([id,t])=>`<button class="${id===page?'active':''}" aria-current="${id===page?'page':'false'}" onclick="go('${id}')"><span class="ic" aria-hidden="true">${icon(id)}</span>${t}</button>`).join(''):'';}).join('');
}
/* Watermark tên lab được cấp phép (bản Electron có license). Chạy trong trình
   duyệt thường thì window.qcLicense không tồn tại nên bỏ qua — không ảnh hưởng. */
function licensedLabName(){const lic=window.qcLicense;return lic&&lic.lab?String(lic.lab):'';}
function sideFoot(){const el=document.getElementById('sideFoot');if(!el)return;const app=window.QCLAB_APP||{version:'dev',releaseDate:''};const lab=licensedLabName();const licLine=lab?`<div class="hint" style="margin-top:6px;color:#8ea3b2">Cấp phép cho: <b style="color:#c3d3dd">${esc(lab)}</b></div>`:'';el.innerHTML=`<div class="foot-panel"><div class="foot-title">Phiên bản</div><div><b>${esc(app.name||'QC Lab')} ${esc(app.version||'dev')}</b></div><div>${esc(app.releaseDate||'Bản phát triển')}</div><div class="hint" style="margin-top:6px;color:#8ea3b2">Nội kiểm xét nghiệm · chạy cục bộ</div>${licLine}</div>`;}
function go(p){if(!canAccessPage(p))return;page=p;nav();rerender();resetMainScroll();requestAnimationFrame(()=>{const main=document.getElementById('main');if(main)main.focus({preventScroll:true});});}
function resetMainScroll(){const m=document.querySelector('main');if(m)m.scrollTop=0;window.scrollTo(0,0);}
function topUserBox(){if(!currentUser)return '';const name=currentUser.name||currentUser.username;const initial=esc(String(name||'U').trim().charAt(0).toUpperCase()||'U');return `<div class="top-user"><div class="avatar">${initial}</div><div class="meta"><div class="name">${esc(name)}</div><div class="role">${roleLabel(currentUser.role)}</div></div><button onclick="logout()" title="Đăng xuất"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 5v14"/></svg>Đăng xuất</button></div>`;}
function headOnly(t,p,actions=''){return `<div class="head"><div><h1>${t}</h1>${p?`<p>${p}</p>`:''}</div><div class="head-actions">${actions}${topUserBox()}</div></div>`;}
function emptyState(title,body,actions=''){return `<div class="empty"><div class="empty-title">${title}</div><div>${body}</div>${actions?`<div class="empty-actions">${actions}</div>`:''}</div>`;}
function btn(label,onclick,cls='ghost sm',title=''){return `<button class="btn ${cls}" onclick="${onclick}"${title?` title="${escAttr(title)}"`:''}>${label}</button>`;}
function rangeActions(tid,level,eligible,applied){let h='';if(eligible)h+=btn('Workflow dải QC',`openRangeWorkflow('${tid}',${level})`,'teal sm','Xem điều kiện, dải đề xuất và phê duyệt');if(applied==='lab'&&canWrite())h+=btn('↶',`revertRange('${tid}',${level})`,'ghost icon','Về dải nhà sản xuất');return h?`<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${h}</div>`:'';}
function stateName(s){return s==='rej'?'Loại':s==='warn'?'Cảnh báo':s==='ok'?'Đạt':'Chưa có';}
function qcVerdictLabel(level){return level==='ok'?'Đạt':level==='warn'?'Cảnh báo':'Loại bỏ';}

/* ===== STATUS ===== */
/* ===== RENDER ===== */
function render(){statusMemo=new Map();if(!canAccessPage(page))page=firstAccessPage();const m=document.getElementById('main');const map={dash:pageDash,entry:pageEntry,westgard:pageWestgard,sigma:pageSigma,reagent:pageReagent,actions:pageActionsV4,report:pageReportV2,manage:pageManage,users:pageUsers,audit:pageAudit,settings:pageSettings};m.innerHTML=(map[page]||pageDash)();}
function restoreRouteFilters(){if(page==='dash'&&dashTestQ)dashTestFilter(dashTestQ);else if(page==='entry'&&entryQ)entryFilter(entryQ);}
/* render() gán lại #main.innerHTML nên scrollTop của <main> về 0 mỗi lần. Khi vẽ
   lại CÙNG một trang (vd Firebase dội bản đồng bộ về gọi rerender(), hoặc sau một
   thao tác sửa dữ liệu), giữ nguyên vị trí cuộn để trang không "nhảy" về đầu —
   trước đây trang Sigma bị giật do save() lúc render kéo theo rerender. Đổi trang
   đi qua go(), vốn tự gọi resetMainScroll() SAU rerender() nên vẫn reset đúng. */
function rerender(){const m=document.getElementById('main'),keepScroll=m?m.scrollTop:0;render();afterRender();restoreRouteFilters();if(m&&keepScroll)m.scrollTop=keepScroll;}

function pageDash(){
  const tests=operationalTests(),missingWestgard=tests.filter(t=>!wgMemo.has(t.id));
  if(missingWestgard.length&&scheduleWestgardPrewarm(missingWestgard))return pageDashLoading(tests,missingWestgard.length);
  const today=isoToday();
  const urgent=[],watch=[],exp=[];
  const dashItems=tests.map(t=>{
    const wg=activeWestgard(t);
    const summary=WestgardViewModel.summarizeTestStatus({views:wg.views,verdicts:wg.byPoint,today});
    const s=summary.status,todayCount=summary.todayCount,totalPoints=summary.totalPoints;
    const levelData=[],lastPoints=summary.lastPoints.slice();
    summary.alerts.forEach(alert=>{const item={t,l:alert.levelConfig,p:alert.point,rules:alert.rules};(alert.level==='rej'?urgent:watch).push(item);});
    wg.views.forEach(v=>{
      const l=v.l,pts=v.pts,todayLevel=pts.some(p=>p.date===today),st=stats(pts.map(p=>p.val));
      levelData.push({l,pts,st,todayLevel});
      const d=daysToExp(l.exp);if(d!=null&&d<=30)exp.push({t,l,d});
    });
    const latest=lastPoints.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''),'vi',{numeric:true})||pointRunNo(a)-pointRunNo(b)).slice(-1)[0];
    const search=searchText([t.name,t.machine,t.section,t.method,t.unit,...levelData.map(x=>`M${x.l.level} ${x.l.lot||''}`)].join(' '));
    statusMemo.set(t.id,s);
    return{t,s,levelData,todayCount,totalPoints,latest,search,missingToday:todayCount<levelData.length};
  });
  const totalPts=dashItems.reduce((n,x)=>n+x.totalPoints,0),todayPts=dashItems.reduce((n,x)=>n+x.todayCount,0);
  const rej=dashItems.filter(x=>x.s==='rej').length,warn=dashItems.filter(x=>x.s==='warn').length,missingToday=dashItems.filter(x=>x.missingToday).map(x=>x.t);
  /* Nhiều xét nghiệm có thể dùng chung 1 lô (VD panel điện giải) -> gộp theo
     lô+mức, chỉ hiện 1 dòng/lô kèm số xét nghiệm dùng chung, thay vì lặp lại
     dòng cảnh báo hết hạn cho từng xét nghiệm riêng lẻ. */
  const expByLot=new Map();
  exp.forEach(e=>{const key=e.l.qcLotId||(e.l.lot||'')+'|'+e.l.level;const cur=expByLot.get(key);if(!cur||e.d<cur.d)expByLot.set(key,{...e,count:(cur?cur.count:0)+1});else cur.count++;});
  const shiftItem=(o,cls)=>`<div class="shift-item ${cls}"><div><b>${esc(o.t.name)} · M${o.l.level}</b><div class="meta">${vnDate(o.p.date)} · ${fmt(o.p.val)} ${esc(o.t.unit||'')} · ${o.rules.join(', ')||'—'}</div></div><button class="btn ghost sm" onclick="entrySel={testId:'${o.t.id}',level:${o.l.level}};entryStart=null;entryEnd=null;go('entry')">Xem</button></div>`;
  const urgentHtml=urgent.slice(0,5).map(o=>shiftItem(o,'rej')).join('');
  const watchHtml=watch.slice(0,4).map(o=>shiftItem(o,'warn')).join('');
  const followHtml=urgentHtml||watchHtml?`<div class="dash-list">${urgentHtml}${watchHtml}</div>`:'<div class="alert ok">Không có điểm bị loại/cảnh báo cần xử lý ngay.</div>';
  const expHtml=[...expByLot.values()].sort((a,b)=>a.d-b.d).slice(0,5).map(e=>`<div class="shift-item ${e.d<0?'rej':'warn'}"><div><b>Lô ${esc(e.l.lot||'?')} · M${e.l.level}</b><div class="meta">${e.count>1?e.count+' xét nghiệm · ':''}${e.d<0?'Hết hạn '+(-e.d)+' ngày':'Còn '+e.d+' ngày'}</div></div><span class="tag ${e.d<0?'rej':'warn'}">${e.d<0?'HSD':'Sắp hết'}</span></div>`).join('')||'<div class="hint">Không có lô sắp hết hạn trong 30 ngày.</div>';
  const dashStatusMatch=(item,key=dashTestStatus)=>{
    if(key==='all')return true;
    if(key==='missing')return item.missingToday;
    return item.s===key;
  };
  const dashStatusTabs=[['all','Tất cả'],['missing','Chưa QC'],['rej','Loại bỏ'],['warn','Cảnh báo'],['ok','Đạt']].map(([key,label])=>{
    const count=key==='all'?dashItems.length:dashItems.filter(item=>dashStatusMatch(item,key)).length;
    return `<button class="${dashTestStatus===key?'on':''}" onclick="dashTestSetStatus('${key}')">${label}<b>${count}</b></button>`;
  }).join('');
  const statusItems=dashItems.filter(item=>dashStatusMatch(item));
  const testRows=statusItems.map(item=>{const {t,s,levelData,todayCount,totalPoints,latest,search}=item,lvls=levelData.map(x=>x.l);
    const statusTag=s==='rej'?'<span class="tag rej">Loại bỏ</span>':s==='warn'?'<span class="tag warn">Cảnh báo</span>':s==='ok'?'<span class="tag ok">Đạt</span>':'<span class="pill">chưa có</span>';
    const todayTag=todayCount>=lvls.length&&lvls.length?'<span class="tag ok">Đủ hôm nay</span>':todayCount?`<span class="tag warn">${todayCount}/${lvls.length} mức</span>`:'<span class="tag none">Chưa QC</span>';
    const levels=levelData.map(x=>`<span class="dash-level-pill ${x.todayLevel?'done':''}">M${x.l.level}${x.l.lot?` · ${esc(x.l.lot)}`:''}${x.st?` · CV ${fmt(x.st.cv)}%`:''}</span>`).join('');
    const latestText=latest?`${vnDate(latest.date)} · M${latest._level} · ${fmt(latest.val)}`:'Chưa có điểm';
    const rank=s==='rej'?0:s==='warn'?1:todayCount<lvls.length?2:s==='ok'?3:4;
    return{rank,name:t.name,html:`<tr class="${s}" data-search="${escAttr(search)}"><td><div class="dash-test-name">${esc(t.name)}</div><div class="dash-test-sub">${esc(t.machine||'Chưa gán máy')}</div></td><td><div class="dash-level-list">${levels}</div></td><td>${todayTag}</td><td class="num"><b>${totalPoints}</b></td><td>${statusTag}</td><td><span class="dash-latest">${latestText}</span></td><td><button class="btn ghost sm" onclick="entrySel={testId:'${t.id}',level:${lvls[0].level}};entryStart=null;entryEnd=null;go('entry')">Xem QC</button></td></tr>`};
  }).sort((a,b)=>a.rank-b.rank||String(a.name||'').localeCompare(String(b.name||''),'vi')).map(x=>x.html).join('');
  const testListHtml=statusItems.length?`<div class="dash-test-list"><table><thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th class="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th></th></tr></thead><tbody>${testRows}</tbody></table></div><div id="dashTestEmpty" class="dash-test-empty" style="display:none">Không tìm thấy xét nghiệm phù hợp.</div>`:`<div class="dash-test-empty">Không tìm thấy xét nghiệm phù hợp.</div>`;
  const done=todayPts,doneTests=Math.max(0,tests.length-missingToday.length),pct=tests.length?Math.round(doneTests/tests.length*100):0;
  const mood=rej?'Cần xử lý ngay':warn?'Có cảnh báo cần theo dõi':missingToday.length?'Còn QC cần nhập':'Đang trong kiểm soát';
  const moodText=rej?'Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục.':warn?'Có tín hiệu cảnh báo, nên xem lại biểu đồ và xu hướng trước khi trả kết quả.':missingToday.length?'Một số xét nghiệm chưa đủ QC hôm nay, nên hoàn tất trước giờ chạy mẫu.':'Không có cảnh báo trọng yếu trong dữ liệu hiện tại.';
  return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${esc(state.lab.name||'Khoa Xét nghiệm')}${state.lab.dept?' · '+esc(state.lab.dept):''}</p></div>${topUserBox()}</div>
   <div class="dash-hero">
     <div class="dash-status"><div class="eyebrow">Trạng thái trực ca · ${vnDate(today)}</div><h2>${mood}</h2><p>${moodText}</p>
       <div class="dash-progress"><span style="width:${pct}%"></span></div><div class="hint" style="margin-top:8px">${doneTests}/${tests.length||0} xét nghiệm đã đủ QC hôm nay · ${pct}% hoàn tất</div></div>
     <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${totalPts}</div></div>
       <div class="dash-kpi"><div class="k">Vi phạm</div><div class="v" style="color:var(--red)">${rej}</div></div><div class="dash-kpi"><div class="k">QC hôm nay</div><div class="v" style="color:var(--teal)">${done}</div></div></div>
   </div>
   <div class="dash-main">
     <div class="panel"><h3>Cần xử lý / Theo dõi</h3>${followHtml}</div>
     <div class="panel"><h3>Lô & hạn dùng</h3><div class="dash-list">${expHtml}</div></div>
   </div>
    <div class="panel">${tests.length?`<div class="dash-test-toolbar"><h3>Danh sách xét nghiệm</h3><div class="dash-test-search"><input id="dashTestSearch" type="search" placeholder="Tìm xét nghiệm, máy, lô..." value="${escAttr(dashTestQ)}" oninput="dashTestFilter(this.value)"><span id="dashTestCount">${statusItems.length}/${statusItems.length}</span></div></div><div class="dash-test-filterbar">${dashStatusTabs}</div>${testListHtml}`:emptyState('Chưa có xét nghiệm đang vận hành','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi theo dõi.')}</div>`;
}

function dashTestFilter(value){
  dashTestQ=value;
  liveRowFilter('.dash-test-list tbody tr',dashTestQ,{countId:'dashTestCount',emptyId:'dashTestEmpty'});
}
function dashTestSetStatus(value){
  dashTestStatus=['all','missing','rej','warn','ok'].includes(value)?value:'all';
  rerender();
}
function entryWindowFor(testId,level,endOverride,startOverride){return EntryService.buildEntryWindow({points:pointsOf(testId,level),days:entryDays,start:startOverride,end:endOverride,today:isoToday()});}
function entryWindow(){return entryWindowFor(entrySel.testId,entrySel.level,entryEnd,entryStart);}
function entryLotLabels(levels){const lots=(levels||[]).map(x=>String(x.lot||'').trim()).filter(Boolean);return lots.join(' / ')||'Chưa gán lô';}
const ENTRY_TABLE_INITIAL_ROWS=180;
function entryRowsWindow(rows,key){const all=rows||[],expanded=entryExpandedTables.has(key),visible=expanded?all:all.slice(-ENTRY_TABLE_INITIAL_ROWS);return{rows:visible,total:all.length,limited:visible.length<all.length,expanded};}
function entryToggleRows(key){
  if(entryExpandedTables.has(key))entryExpandedTables.delete(key);
  else{
    entryExpandedTables.add(key);
    while(entryExpandedTables.size>24)entryExpandedTables.delete(entryExpandedTables.values().next().value);
  }
  entryRenderKeepScroll();
}
function pageEntry(rightOnly=false){
  const today=isoToday();
  if(!state.tests.length)return headOnly('Nhập QC','')+`<div class="panel">${emptyState('Chưa có xét nghiệm','Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.',role()==='admin'?btn('Thêm xét nghiệm',`go('manage')`,'teal'):'')}</div>`;
  const entryTests=operationalTests();
  if(!entryTests.length)return headOnly('Nhập QC','')+`<div class="panel">${emptyState('Chưa có xét nghiệm sẵn sàng nhập','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi nhập kết quả.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`;
  if(!entrySheetMonth)entrySheetMonth=isoMonth();
  let selT=entrySel&&entryTests.find(t=>t.id===entrySel.testId);
  if(!selT||!operationalLevels(selT).some(l=>l.level===entrySel.level)){selT=entryTests[0];const l0=operationalLevels(selT)[0];entrySel={testId:selT.id,level:l0.level};entryAutoOpenKey=null;}
  let tree='';
  if(!rightOnly){
    const byMAll=EntryService.groupByMachine(entryTests),machinesAll=[...byMAll.keys()],selM=selT.machine||'(Chưa gán máy)';
    if(entryMachine!=='all'&&!machinesAll.includes(entryMachine))entryMachine='all';
    // Tự mở một lần khi đổi test; sau đó để người dùng tự thu/mở cây.
    const selGroup=operationalLotGroupForTest(selT),autoKey=selM+'|'+selGroup.key+'|'+entrySel.testId;if(entryAutoOpenKey!==autoKey){treeOpen.add('m:'+selM);treeOpen.add('lg:'+selM+'|'+selGroup.key);entryAutoOpenKey=autoKey;}
    const byM=EntryService.groupByMachine(entryTests.filter(t=>entryMachine==='all'||(t.machine||'(Chưa gán máy)')===entryMachine)),machines=[...byM.keys()];
    const machineOpts=['<option value="all">Tất cả máy</option>'].concat(machinesAll.map(m=>`<option value="${escAttr(m)}" ${entryMachine===m?'selected':''}>${esc(m)}</option>`)).join('');
    tree=`<h4>Danh mục nội kiểm</h4><div class="tree-tools"><input id="entrySearch" aria-label="Tìm xét nghiệm, máy hoặc lô" placeholder="Tìm test, máy hoặc lô..." value="${escAttr(entryQ)}" oninput="entryFilter(this.value)"><select aria-label="Lọc theo máy xét nghiệm" onchange="entrySetMachine(this.value)">${machineOpts}</select></div>`;
    if(!machines.length)tree+='<div class="tree-empty">Không có xét nghiệm phù hợp.</div>';
    machines.forEach(mc=>{const mk='m:'+mc,mo=treeOpen.has(mk);
    tree+=`<div class="tnode tn-machine" data-tree-role="machine" data-key="${escAttr(mk)}" role="treeitem" tabindex="0" aria-expanded="${mo}" onclick="treeToggle('${jsq(mk)}')" onkeydown="entryTreeKey(event)"><span class="caret" aria-hidden="true">${mo?'−':'+'}</span>${esc(mc)}</div>`;
    const groups=new Map();byM.get(mc).forEach(t=>{const g=operationalLotGroupForTest(t);if(!groups.has(g.key))groups.set(g.key,{name:g.name,tests:[],order:operationalTestOrder(t)});const grp=groups.get(g.key);grp.tests.push(t);grp.order=Math.min(grp.order,operationalTestOrder(t));});
    [...groups.entries()].sort((a,b)=>a[1].order-b[1].order||a[1].name.localeCompare(b[1].name,'vi')).forEach(([groupKey,grp])=>{
        const gk='lg:'+mc+'|'+groupKey,go=treeOpen.has(gk),ord={none:-1,ok:0,warn:1,rej:2};let groupWorst='none';
        const rows=grp.tests.sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b)).map(t=>{const levels=operationalLevels(t),on=entrySel.testId===t.id,preferred=levels.find(x=>entrySel.level===x.level)||levels[0],wg=activeWestgard(t);let worst='none';
          levels.forEach(l=>{const pts=pointsForLot(t.id,l.level,l.lot||''),lastPoint=pts[pts.length-1],last=lastPoint&&wg.byPoint.get(lastPoint.id)||null,lastLevel=last?last.level:'none';if(ord[lastLevel]>ord[worst])worst=lastLevel;});
          if(ord[worst]>ord[groupWorst])groupWorst=worst;
          const s=searchText([t.name,t.machine,grp.name,...levels.map(l=>l.lot)].join(' '));
          return `<div class="tnode tn-config ${on?'on':''}" data-tree-role="assay" data-test-id="${escAttr(t.id)}" data-search="${escAttr(s)}" role="treeitem" tabindex="0" aria-current="${on?'true':'false'}" style="${mo&&go?'':'display:none'}" onclick="entryPick('${t.id}',${preferred?preferred.level:1})" onkeydown="entryTreeKey(event)"><span class="config-name">${esc(t.name)}</span><span class="state ${worst==='none'?'':worst}">${stateName(worst)}</span></div>`;});
        tree+=`<div class="tnode tn-test ${go?'open':''}" data-tree-role="group" data-key="${escAttr(gk)}" data-search="${escAttr(searchText(grp.name+' '+grp.tests.map(t=>t.name).join(' ')))}" role="treeitem" tabindex="0" aria-expanded="${go}" style="${mo?'':'display:none'}" onclick="treeToggle('${jsq(gk)}')" onkeydown="entryTreeKey(event)"><span class="caret" aria-hidden="true">${go?'−':'+'}</span>${esc(grp.name)}<span class="state ${groupWorst==='none'?'':groupWorst}">${stateName(groupWorst)}</span></div>`;
        tree+=rows.join('');
      });
    });
  }
  // panel phải
  const t=selT,l=lvlCfg(t,entrySel.level),opLevels=operationalLevels(t),entryWG=activeWestgard(t),acceptedCache=new Map();
  const acceptedForLevel=level=>{const key=String(level);if(!acceptedCache.has(key))acceptedCache.set(key,acceptedLotPoints(t,level));return acceptedCache.get(key);};
  const W0=entryWindow(),acceptedSelected=acceptedForLevel(entrySel.level);const W={...W0,all:acceptedSelected.filter(p=>(p.lot||'')===(l.lot||'')),pts:acceptedSelected.filter(p=>p.date>=W0.start&&p.date<=W0.end&&(p.lot||'')===(l.lot||''))};
  // thống kê toàn bộ + dải QC
  const allSt=stats(W.all.map(p=>p.val));const cand=rangeCandidate(t.id,l.level),candStats=cand&&cand.c;
  const eligible=cand&&cand.eligible;
  const rangeSummary=allSt?`n=${allSt.n} · Mean thực=${fmt(allSt.m)} · SD thực=${fmt(allSt.sd,3)} · CV=${fmt(allSt.cv)}%`:'Chưa có dữ liệu';
  const rangeSource=l.applied==='lab'?'PXN tự xây dựng':'Nhà sản xuất';
  const rangeBox=`<div class="panel range-summary-panel"><h3><span>Thống kê toàn bộ &amp; Dải kiểm soát</span><small>${rangeSummary}</small></h3>
     <div class="range-band-note"><div class="range-band-label">Dải đang dùng:</div><div class="range-band-source">${rangeSource}</div><div class="range-band-body">· Mean=${fmt(l.mean)} SD=${fmt(l.sd,3)}.
       ${eligible?` Đủ điều kiện lập dải mới (${candStats?candStats.n:0} kết quả / ${cand.days} ngày độc lập). Dải đề xuất: Mean=${candStats?fmt(candStats.m):'—'} SD=${candStats?fmt(candStats.sd,3):'—'} CV=${candStats?fmt(candStats.cv):'—'}%.`:` Cần ≥20 kết quả trên ≥20 ngày độc lập, không có điểm vi phạm/cảnh báo chưa xử lý — hiện ${candStats?candStats.n:0} kết quả / ${cand?cand.days:0} ngày.`}</div></div>
     ${rangeActions(t.id,l.level,eligible,l.applied)}</div>`;
  const levelViews=opLevels.map(x=>{const prevSeries=previousLotSeries(t,x.level),prevLot=entryPrevOpen.get(t.id+'|'+x.level)||'';return{x,prevView:prevSeries.find(s=>(s.lot||'')===prevLot)};});
  const tableCards=levelViews.map(({x,prevView})=>{
    const lvlMean=prevView?prevView.mean:x.mean,lvlSd=prevView?prevView.sd:x.sd,lvlLot=prevView?prevView.lot:x.lot;
    const allIdx=prevView?prevView.pts:operationalLotPoints(t,x.level,true),allPtsIdx=prevView?allIdx:allIdx.filter(p=>p.date>=W.start&&p.date<=W.end),tableKey=`${t.id}|${x.level}|${lvlLot||''}|${W.start}|${W.end}`,rowWindow=entryRowsWindow(allPtsIdx,tableKey),ptsIdx=rowWindow.rows,cumulativePts=prevView?allIdx:allIdx.filter(p=>p.date<=W.end),cumulativeSt=stats(cumulativePts.map(p=>p.val));
    const prevWg=prevView?QCCore.westgardByPoint(ptsIdx,lvlMean,lvlSd,rule=>testRuleOnWithin(t,rule)):null;
    const rows=ptsIdx.map((p,i)=>{const rawPrev=prevView&&prevWg.F[i],verdict=prevView?(rawPrev?{...rawPrev,level:ruleResultLevel(t,rawPrev.rules||[]),z:prevWg.zs[i]}:{level:'ok',rules:[]}):(entryWG.byPoint.get(p.id)||{level:'ok',rules:[]}),view=EntryService.buildPointView({point:p,verdict,mean:lvlMean,sd:lvlSd,previousLot:prevView?prevView.lot:undefined}),lv=qcVerdictLabel(view.level),rowCls=view.level==='rej'?' class="qc-point-rej"':view.level==='warn'?' class="qc-point-warn"':'',voidBtn=canWrite()?btn('Hủy',`voidQcPoint('${t.id}','${p.id}')`,'danger sm','Hủy điểm QC có ghi lý do'):'',rulesHtml=[...new Set(view.rules)].map(r=>`<span class="pill">${r}</span>`).join('')||'—';
      return `<tr${rowCls}><td>${vnDate(p.date)}</td><td class="num"><b>${fmt(p.val)}</b></td><td class="num">${view.z>=0?'+':''}${fmt(view.z)}s</td><td><span class="tag ${view.level}">${lv}</span></td><td>${rulesHtml}</td><td class="qc-row-actions">${voidBtn}</td></tr>`;}).join('');
    const cumulative=`<div class="qc-cumulative" title="Tính từ đầu LOT đến ${vnDate(W.end)}">
      <div><span>N tích lũy</span><b>${cumulativeSt?cumulativeSt.n:0}</b></div>
      <div><span>Mean tích lũy</span><b>${cumulativeSt?fmt(cumulativeSt.m):'—'}</b></div>
      <div><span>SD tích lũy</span><b>${cumulativeSt?fmt(cumulativeSt.sd,3):'—'}</b></div>
      <div><span>CV tích lũy</span><b>${cumulativeSt?fmt(cumulativeSt.cv)+'%':'—'}</b></div>
    </div>`;
    const rowControl=rowWindow.limited?`<div class="table-window-note">Đang hiển thị ${rowWindow.rows.length}/${rowWindow.total} điểm gần nhất. <button class="btn ghost sm" onclick="entryToggleRows('${jsq(tableKey)}')">Hiện toàn bộ</button></div>`:rowWindow.expanded&&rowWindow.total>ENTRY_TABLE_INITIAL_ROWS?`<div class="table-window-note">Đang hiển thị toàn bộ ${rowWindow.total} điểm. <button class="btn ghost sm" onclick="entryToggleRows('${jsq(tableKey)}')">Thu gọn</button></div>`:'';
    return `<div class="qc-table-card" role="region" aria-label="Điểm QC mức ${x.level}, lô ${escAttr(lvlLot||'?')}" tabindex="0"><h4><span>Mức ${x.level} · ${prevView?'Lô cũ':'Lô'} ${esc(lvlLot||'?')}</span><span class="hint">${allPtsIdx.length} điểm trong khoảng</span></h4>${cumulative}${ptsIdx.length?`<table><thead><tr><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật</th><th></th></tr></thead><tbody>${rows}</tbody></table>${rowControl}`:'<div class="empty">Chưa có điểm nào trong khoảng này.</div>'}</div>`;}).join('');
  const prevLotByLevel=new Map(levelViews.filter(v=>v.prevView).map(v=>[v.x.level,v.prevView.lot]));
  const voidedRows=(state.data[t.id]||[]).filter(p=>{if(!p.voided)return false;const pv=prevLotByLevel.get(p.level);return pv!=null?(p.lot||'')===pv:(p.date>=W.start&&p.date<=W.end);}).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||pointRunNo(a)-pointRunNo(b)).map(p=>`<tr><td>${vnDate(p.date)}</td><td>Mức ${p.level} · Lô ${esc(p.lot||'?')}</td><td class="num">${fmt(p.val)}</td><td>${esc(p.runId||'—')}</td><td>${esc(p.voidedBy||'')}</td><td>${esc(p.voidReason||'')}</td></tr>`).join('');
  const voidedBox=voidedRows?`<div class="qc-voided-box"><h4>Điểm đã hủy trong khoảng</h4><table class="qc-voided-table"><thead><tr><th>Ngày</th><th>Mức / lô</th><th class="num">Giá trị</th><th>Lần chạy</th><th>Người hủy</th><th>Lý do</th></tr></thead><tbody>${voidedRows}</tbody></table></div>`:'';
  const pointsInView=`<div class="panel qc-points-panel"><h3>Điểm trong khoảng xem</h3>
    <div class="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT đến ${vnDate(W.end)}; bảng bên dưới hiển thị từ ${vnDate(W.start)} đến ${vnDate(W.end)}.</div>
    <div class="qc-table-grid">${tableCards}</div>${voidedBox}</div>`;
  const dayBtn=n=>`<button class="${!entryStart&&entryDays===n?'on':''}" onclick="entrySetDays(${n})">${n} ngày</button>`;
  entryLjRenderCache={testId:t.id,start:W.start,end:W.end,levels:new Map()};
  const ljStack=opLevels.map(x=>{const on=x.level===entrySel.level,curPts=acceptedForLevel(x.level).filter(p=>p.date>=W.start&&p.date<=W.end&&(p.lot||'')===(x.lot||'')),prevSeries=previousLotSeries(t,x.level),prevLot=entryPrevOpen.get(t.id+'|'+x.level)||'',prevView=prevSeries.find(s=>(s.lot||'')===prevLot),chartPts=prevView?prevView.pts:curPts,chartLot=prevView?prevView.lot:x.lot,chartMean=prevView?prevView.mean:x.mean,chartSd=prevView?prevView.sd:x.sd,st=stats(chartPts.map(p=>p.val)),lo2=chartMean-2*chartSd,hi2=chartMean+2*chartSd;
    entryLjRenderCache.levels.set(`${x.level}|${chartLot||''}`,chartPts);
    const metric=(k,v,control=false)=>`<div class="lj-qc-stat${control?' control':''}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const strip=metric('Số điểm','N = '+chartPts.length)+metric('Mean thực',st?fmt(st.m):'—')+metric('SD thực',st?fmt(st.sd,3):'—')+metric('CV thực',st?fmt(st.cv)+'%':'—')+metric('Mean mục tiêu',fmt(chartMean),true)+metric('SD mục tiêu',fmt(chartSd,3),true)+metric('Khoảng ±2SD',fmt(lo2)+' – '+fmt(hi2),true)+metric('LOT / Hạn dùng',esc(chartLot||'?')+' · '+(prevView?'Đã chuyển tiếp':(x.exp?vnDate(x.exp):'Chưa nhập')),true);
    const prevBtn=prevSeries.length?(prevView?`<button class="btn teal sm" onclick="event.stopPropagation();entryShowCurrentLot(${x.level})">Xem lô mới</button>`:`<button class="btn ghost sm" onclick="event.stopPropagation();entryShowPrevLot(${x.level},'${jsq(prevSeries[0].lot||'')}')">Xem lô cũ</button>`):`<span class="hint">${x.applied==='lab'?'Dải PXN':'Dải NSX'}</span>`;
    return `<div class="lj-mini ${on?'on':''}" onclick="entryFocusLevel(${x.level})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();entryFocusLevel(${x.level})}" role="button" tabindex="0" aria-label="Chọn mức ${x.level}, lô ${escAttr(chartLot||'?')}"><div class="lj-mini-h"><b>Mức ${x.level} · ${prevView?'Lô cũ':'Lô'} ${esc(chartLot||'?')}</b>${prevBtn}</div><div class="lj-qc-strip">${strip}</div><div class="chart-scroll"><canvas class="entryLJStack" data-test="${t.id}" data-level="${x.level}" data-lot="${escAttr(chartLot||'')}" data-mean="${escAttr(chartMean)}" data-sd="${escAttr(chartSd)}" data-start="${W.start}" data-end="${W.end}" width="1400" height="380"></canvas></div></div>`;}).join('');
  const levelHead=opLevels.map(x=>`<th>Mức ${x.level} · Lô ${esc(x.lot||'?')}</th>`).join('');
  const sheetCalendar=EntryService.buildSheetCalendar(entrySheetMonth,isoToday()),activeSheetMonth=sheetCalendar.activeMonth;
  entrySheetMonth=activeSheetMonth;
  const sheetYear=sheetCalendar.year,sheetMonthNo=sheetCalendar.month,sheetStart=sheetCalendar.start,sheetEnd=sheetCalendar.end;
  const sheetMonthOptions=Array.from({length:12},(_,i)=>`<option value="${i+1}" ${sheetMonthNo===i+1?'selected':''}>Tháng ${i+1}</option>`).join('');
  const sheetYearOptions=Array.from({length:sheetCalendar.yearMax-sheetCalendar.yearMin+1},(_,i)=>sheetCalendar.yearMin+i).map(y=>`<option value="${y}" ${sheetYear===y?'selected':''}>${y}</option>`).join('');
  const prevPtsByLevel={},pointsByLevel={};
  opLevels.forEach(x=>{prevPtsByLevel[x.level]=previousLotSeries(t,x.level).flatMap(s=>s.pts.map(p=>({...p,_prevLot:s.lot})));pointsByLevel[x.level]=operationalLotPoints(t,x.level,true);});
  const sheetDays=sheetCalendar.days;
  const sheetRowsData=EntryService.buildSheetRowsData({levels:opLevels,sheetStart,sheetEnd,sheetDays,pointsByLevel,previousPointsByLevel:prevPtsByLevel,pointRunNo});
  const sheetRows=sheetRowsData.map(dayGroup=>{
    const firstRunNo=()=>EntryService.sheetFirstRunNo(dayGroup);
    const levelRuns=x=>EntryService.sheetLevelRuns(dayGroup,x.level);
    const daySummary=EntryService.summarizeRunStatus(opLevels.map(x=>dayGroup.runs.map(g=>g.levels[x.level]).filter(Boolean).sort((a,b)=>pointRunNo(a)-pointRunNo(b)||(a._idx||0)-(b._idx||0))),entryWG.byPoint);
    const {worst,rulesAll,warnRules,rejRules,hasPoint}=daySummary;
    const shouldShowEmptyRun=(x,g)=>{
      const runs=levelRuns(x);
      if(!runs.length)return g.runNo===firstRunNo();
      const prev=[...runs].reverse().find(r=>r.runNo<g.runNo);
      if(!prev)return false;
      if(g.runNo!==prev.runNo+1)return false;
      if(entryExtraRun.has(`${t.id}|${x.level}|${g.date}|${g.runNo}`))return true;
      const f=entryWG.byPoint.get(prev.levels[x.level].id)||{level:'ok'};
      return f.level==='rej';
    };
    const cells=opLevels.map((x,levelIdx)=>{let levelHasPoint=false,emptyShown=false;
      const levelRunNos=levelRuns(x).map(r=>r.runNo),nextLevelRunNo=levelRunNos.length?Math.max(...levelRunNos)+1:1;
       const runInputs=dayGroup.runs.map(g=>{const p=g.levels[x.level],runArg=jsq(g.runId||'');if(!p){if(!shouldShowEmptyRun(x,g))return '';emptyShown=true;return canWrite()?`<div class="qc-run-slot"><input class="qc-inline-input empty" type="text" inputmode="decimal" autocomplete="off" placeholder="--" title="Dùng phím mũi tên để chuyển ô" aria-label="Nhập QC ngày ${vnDate(g.date)}, mức ${x.level}, lần ${g.runNo}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" data-focus-date="${escAttr(g.date)}" data-focus-run="${g.runNo}" data-focus-level="${levelIdx}" onkeydown="entrySheetKey(event)" onchange="entryInlineSave('${t.id}',${x.level},'${g.date}',this.value,'${runArg}')"></div>`:`<div class="qc-run-slot muted"><b>—</b></div>`;}levelHasPoint=true;
        const isPrev=!!p._prevLot,pMean=isPrev&&Number.isFinite(+p.qcMean)?+p.qcMean:x.mean,pSd=isPrev&&Number.isFinite(+p.qcSd)?+p.qcSd:x.sd;
        const verdict=isPrev?{level:'ok',rules:[]}:(entryWG.byPoint.get(p.id)||{level:'ok',rules:[]}),view=EntryService.buildPointView({point:p,verdict,mean:pMean,sd:pSd,previousLot:isPrev?p._prevLot:undefined}),lv=qcVerdictLabel(view.level);
        return `<div class="qc-run-slot${isPrev?' prev-lot-slot':''}"><b class="qc-value-chip ${view.valueClass}" title="${isPrev?'Lô cũ '+escAttr(p._prevLot)+' · đã chuyển tiếp · chỉ đọc':'Đã lưu, không sửa trực tiếp'}">${fmt(p.val)}</b><small>${view.z>=0?'+':''}${fmt(view.z)}s · ${isPrev?'Lô '+esc(p._prevLot):lv}</small></div>`;}).join('');
      const addRunBtn=canWrite()&&levelHasPoint&&!emptyShown?`<button type="button" class="qc-add-run-btn" title="Thêm lần chạy bổ sung" onclick="entryUnlockExtraRun('${t.id}',${x.level},'${dayGroup.date}',${levelIdx},${nextLevelRunNo})"><span class="qc-add-run-icon">+</span><span class="qc-add-run-label">Thêm</span></button>`:'';
      return `<td class="num qc-run-cell"><div class="qc-run-grid${addRunBtn?' has-add-btn':''}">${runInputs}</div>${addRunBtn}</td>`;}).join('');
    const staff=[...new Map(dayGroup.runs.flatMap(g=>Object.values(g.levels)).map(p=>pointStaff(p)).filter(x=>x.code).map(x=>[x.code,x])).values()];
    const staffCell=staff.length?staff.map(x=>`<span class="qc-staff" title="${escAttr(x.name||x.code)}">${esc(x.code)}</span>`).join('<span class="qc-staff-sep">/</span>'):'—';
    const status=!hasPoint?'—':worst==='rej'?'<span class="tag rej">R</span>':worst==='warn'?'<span class="tag warn">W(A)</span>':'<span class="tag ok">A</span>';
    const autoNote=rulesAll.length?(worst==='rej'?errorType([...new Set(rejRules.length?rejRules:rulesAll)]):'Theo dõi / cảnh báo'):'';
    const datePoints=dayGroup.runs.flatMap(g=>Object.values(g.levels)).filter(Boolean);
    const manualNote=(datePoints.find(p=>String(p.note||'').trim())||{}).note||'';
    const note=hasPoint?(canWrite()?`<textarea class="qc-note-input" rows="1" placeholder="${escAttr(autoNote||'Nhập ghi chú...')}" onchange="entryDateNoteSave('${t.id}','${dayGroup.date}',this.value)">${esc(manualNote)}</textarea>`:(manualNote?esc(manualNote):(autoNote||'—'))):'—';
    const doneLevels=opLevels.filter(x=>dayGroup.runs.some(g=>g.levels[x.level])).length,rowCls=[dayGroup.date===today?'today':'',dayGroup.date<=today&&doneLevels<opLevels.length?'missing':'',hasPoint?'has-data':''].filter(Boolean).join(' ');
    return `<tr class="${rowCls}" data-date="${dayGroup.date}"><td><span>${dateObj(dayGroup.date).getDate()}</span>${dayGroup.date===today?'<b>Hôm nay</b>':''}</td>${cells}<td class="qc-staff-cell">${staffCell}</td><td>${[...new Set(warnRules)].join(', ')||'—'}</td><td>${[...new Set(rejRules)].join(', ')||'—'}</td><td>${status}</td><td>${note}</td></tr>`;}).join('');
  const worksheet=`<div class="panel qc-sheet-panel"><div class="qc-sheet-heading">
      <div class="qc-sheet-title"><span>Bảng nhập QC</span><strong>${esc(t.name)}</strong><small>Lô ${esc(entryLotLabels(opLevels))}</small></div>
      <div class="qc-month-area"><div class="qc-month-picker"><select aria-label="Chọn tháng" onchange="entrySetSheetPart('month',this.value)">${sheetMonthOptions}</select><select aria-label="Chọn năm" onchange="entrySetSheetPart('year',this.value)">${sheetYearOptions}</select><button class="btn ghost sm qc-current-month" onclick="entrySetSheetMonth(isoMonth())">Tháng hiện tại</button><button class="btn teal sm qc-today-jump" onclick="entryGoToday()">Tới hôm nay</button></div></div></div>
      <div class="qc-sheet-wrap" role="region" aria-label="Bảng nhập QC theo tháng" tabindex="0"><table class="qc-sheet"><thead><tr><th>Ngày</th>${levelHead}<th>NV thực hiện</th><th>Vi phạm cảnh báo</th><th>Vi phạm loại bỏ</th><th>Chấp nhận</th><th>Ghi chú</th></tr></thead>
       <tbody>${sheetRows||`<tr><td colspan="${6+opLevels.length}" class="empty-cell">Chưa có điểm nào trong khoảng này.</td></tr>`}</tbody></table></div>
      <div id="entryMsg" role="status" aria-live="polite" style="margin:12px 16px 16px">${entryLastMsg}</div></div>`;
  const right=`${worksheet}
   <div class="panel"><div class="lj-toolbar">
        <h3>Biểu đồ Levey-Jennings</h3>
        <div class="lj-filter"><label class="lj-date-field"><span class="hint">Từ ngày</span>${dateBox('entryStartDate',W.start,'','onchange="entrySetStart(this.value)"')}</label><label class="lj-date-field"><span class="hint">Đến ngày</span>${dateBox('entryEndDate',W.end,'','onchange="entrySetEnd(this.value)"')}</label><div class="dayseg">${dayBtn(7)}${dayBtn(14)}${dayBtn(30)}${dayBtn(60)}${dayBtn(90)}</div></div></div>
      <div class="hint lj-range">Khoảng xem: ${vnDate(W.start)} – ${vnDate(W.end)} · ${opLevels.length} mức QC</div>
      <div class="lj-stack">${ljStack}</div>
      <div class="legend"><span><span class="dot" style="background:#0e8f8f"></span> Trong ±2SD</span><span><span class="dot" style="background:#dd8b1f"></span> Cảnh báo 2–3SD</span><span><span class="dot" style="background:#c5221f"></span> Loại bỏ ngoài 3SD</span></div></div>
   ${pointsInView}
   ${rangeBox}`;
  entryPartialRenderCache={testId:t.id,right};
  if(rightOnly)return right;
  return headOnly('Nhập QC','Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành')+
   `<div class="entrygrid"><div class="tree" role="tree" aria-label="Danh mục nội kiểm">${tree}</div><div class="entry-main">${right}</div></div>`;
}
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/&/g,'\\u0026').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function entryRestoreTreeNode(datasetKey,value){requestAnimationFrame(()=>{const node=[...document.querySelectorAll('.tree .tnode')].find(el=>el.dataset[datasetKey]===String(value));if(node)node.focus({preventScroll:true});});}
function treeToggle(k){const restore=document.activeElement&&document.activeElement.dataset.key===String(k);if(treeOpen.has(k))treeOpen.delete(k);else treeOpen.add(k);rerender();if(restore)entryRestoreTreeNode('key',k);}
function entryTreeKey(event){
  const item=event.currentTarget,key=event.key;
  if(key==='Enter'||key===' '){event.preventDefault();item.click();return;}
  if((key==='ArrowRight'&&item.getAttribute('aria-expanded')==='false')||(key==='ArrowLeft'&&item.getAttribute('aria-expanded')==='true')){event.preventDefault();item.click();return;}
  if(key!=='ArrowDown'&&key!=='ArrowUp'&&key!=='Home'&&key!=='End')return;
  const items=[...document.querySelectorAll('.tree .tnode[tabindex="0"]')].filter(el=>el.offsetParent!==null),index=items.indexOf(item);if(index<0||!items.length)return;
  event.preventDefault();const next=key==='Home'?items[0]:key==='End'?items[items.length-1]:items[(index+(key==='ArrowDown'?1:-1)+items.length)%items.length];next.focus();
}
function entryFilter(v){
  entryQ=v;
  const q=searchText(entryQ),nodes=[...document.querySelectorAll('.tree .tnode')];
  if(!q){
    nodes.forEach(el=>el.style.display='');
    nodes.filter(el=>el.dataset.treeRole==='group'&&!treeOpen.has(el.dataset.key)).forEach(group=>{
      for(let n=group.nextElementSibling;n&&n.dataset.treeRole==='assay';n=n.nextElementSibling)n.style.display='none';
    });
    nodes.filter(el=>el.dataset.treeRole==='machine'&&!treeOpen.has(el.dataset.key)).forEach(machine=>{
      for(let n=machine.nextElementSibling;n&&n.dataset.treeRole!=='machine';n=n.nextElementSibling)n.style.display='none';
    });
    return;
  }
  nodes.forEach(el=>el.style.display='none');
  document.querySelectorAll('.tree .tn-config').forEach(row=>{
    if(!String(row.dataset.search||'').includes(q))return;
    row.style.display='';
    let group=row.previousElementSibling;
    while(group&&group.dataset.treeRole!=='group')group=group.previousElementSibling;
    if(group)group.style.display='';
    let machine=group&&group.previousElementSibling;
    while(machine&&machine.dataset.treeRole!=='machine')machine=machine.previousElementSibling;
    if(machine)machine.style.display='';
  });
}
function entrySetMachine(v){entryMachine=v;rerender();}
function entryPick(tid,level){const restore=document.activeElement&&document.activeElement.dataset.testId===String(tid);entrySel={testId:tid,level};entryStart=null;entryEnd=null;entryLastMsg='';rerender();if(restore)entryRestoreTreeNode('testId',tid);}
function entryFocusLevel(level){if(!entrySel)return;entrySel={testId:entrySel.testId,level};rerender();}
function entryShowPrevLot(level,lot){if(!entrySel)return;entryPrevOpen.set(entrySel.testId+'|'+level,lot);rerender();}
function entryShowCurrentLot(level){if(!entrySel)return;entryPrevOpen.delete(entrySel.testId+'|'+level);rerender();}
function entryFocusPendingSheet(){
  if(!entryPendingSheetFocus)return;
  const [date,level]=entryPendingSheetFocus.split('|');
  const cands=[...document.querySelectorAll('.qc-sheet .qc-inline-input')].filter(x=>x.dataset.focusDate===date&&x.dataset.focusLevel===level);
  // Prefer the still-empty slot for this date+level (a run just saved may have
  // shifted its run-id, so match on date+level rather than the old full key).
  const el=cands.find(x=>x.classList.contains('empty'))||cands[0];
  if(el){el.focus();el.select();entryPendingSheetFocus='';}
}
function entrySheetInputs(){return[...document.querySelectorAll('.qc-sheet .qc-inline-input')]
  .filter(el=>!el.disabled&&el.offsetParent!==null)
  .sort((a,b)=>String(a.dataset.focusDate||'').localeCompare(String(b.dataset.focusDate||''),'vi',{numeric:true})||
    (Number(a.dataset.focusRun||0)-Number(b.dataset.focusRun||0))||
    (Number(a.dataset.focusLevel||0)-Number(b.dataset.focusLevel||0)));}
function entrySheetTarget(inputs,current,key,shiftKey=false){
  const available=inputs||[];if(!available.length||!available.includes(current))return null;
  if(key==='ArrowLeft'||key==='ArrowRight'||key==='Tab'){
    const row=available.filter(el=>el.dataset.focusDate===current.dataset.focusDate&&el.dataset.focusRun===current.dataset.focusRun),ri=row.indexOf(current),step=key==='ArrowLeft'||(key==='Tab'&&shiftKey)?-1:1;
    if(ri<0||row.length<2)return null;
    return key==='Tab'?row[(ri+step+row.length)%row.length]:(row[ri+step]||null);
  }
  if(key==='ArrowUp'||key==='ArrowDown'||key==='Enter'){
    const column=available.filter(el=>el.dataset.focusLevel===current.dataset.focusLevel),ci=column.indexOf(current),step=key==='ArrowUp'?-1:1;
    if(ci<0||column.length<2)return null;
    return key==='Enter'?column[(ci+1)%column.length]:(column[ci+step]||null);
  }
  return null;
}
function entrySheetKey(event){
  if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
  const supported=['Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];if(!supported.includes(event.key))return;
  const cur=event.currentTarget,next=entrySheetTarget(entrySheetInputs(),cur,event.key,event.shiftKey);if(!next)return;
  event.preventDefault();
  entryPendingSheetFocus=`${next.dataset.focusDate}|${next.dataset.focusLevel}`;
  cur.blur();
  setTimeout(entryFocusPendingSheet,0);
}
function entryLatestTreeState(t){
  if(!t)return'none';
  const ord={none:-1,ok:0,warn:1,rej:2},wg=activeWestgard(t);let worst='none';
  operationalLevels(t).forEach(l=>{const pts=pointsForLot(t.id,l.level,l.lot||''),last=pts[pts.length-1],level=last&&(wg.byPoint.get(last.id)||{}).level||'none';if(ord[level]>ord[worst])worst=level;});
  return worst;
}
function entrySyncTreeState(testId){
  const row=[...document.querySelectorAll('.tree .tn-config[data-test-id]')].find(el=>el.dataset.testId===String(testId||''));if(!row)return;
  const apply=(el,value)=>{const badge=el&&el.querySelector('.state');if(!badge)return;badge.className='state'+(value==='none'?'':' '+value);badge.textContent=stateName(value);};
  apply(row,entryLatestTreeState(state.tests.find(t=>t.id===testId)));
  let group=row.previousElementSibling;while(group&&group.dataset.treeRole!=='group')group=group.previousElementSibling;if(!group)return;
  const ord={none:-1,ok:0,warn:1,rej:2};let worst='none';
  for(let item=group.nextElementSibling;item&&item.dataset.treeRole==='assay';item=item.nextElementSibling){const badge=item.querySelector('.state'),value=badge&&['ok','warn','rej'].find(x=>badge.classList.contains(x))||'none';if(ord[value]>ord[worst])worst=value;}
  apply(group,worst);
}
function entryRenderKeepScroll(){
  const pageX=window.scrollX,pageY=window.scrollY,wrap=document.querySelector('.qc-sheet-wrap'),sheetTop=wrap?wrap.scrollTop:0,sheetLeft=wrap?wrap.scrollLeft:0;
  const current=document.querySelector('.entry-main');
  if(page==='entry'&&current){
    statusMemo=new Map();pageEntry(true);
    if(entryPartialRenderCache&&entryPartialRenderCache.testId===entrySel.testId){
      current.innerHTML=entryPartialRenderCache.right;
      entrySyncTreeState(entrySel.testId);
      afterRender();
    }else rerender();
  }else rerender();
  requestAnimationFrame(()=>{
    window.scrollTo(pageX,pageY);
    const nextWrap=document.querySelector('.qc-sheet-wrap');
    if(nextWrap){nextWrap.scrollTop=sheetTop;nextWrap.scrollLeft=sheetLeft;}
    entryFocusPendingSheet();
  });
}
function entrySetLastMsg(html){
  entryLastMsg=html||'';
  const el=document.getElementById('entryMsg');
  if(el)el.innerHTML=entryLastMsg;
}
function entryUnlockExtraRun(tid,level,date,levelIdx,runNo){
  if(!requireWrite())return;
  entryExtraRun.add(`${tid}|${level}|${date}|${runNo}`);
  entryPendingSheetFocus=`${date}|${levelIdx}`;
  entryRenderKeepScroll();
}
async function entryDateNoteSave(tid,date,value){
  if(!requireWrite())return;
  if(!await requireUnlockedPeriod(date,'ghi chú QC'))return;
  const result=EntryService.saveDateNote(state,tid,date,value);
  if(result&&result.error==='period-locked'){entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể sửa ghi chú.</div>');return;}
  if(!result)return;
  const note=result.note;
  logAct('Ghi chú QC',`Ngày ${vnDate(date)}${note?' · '+note:' · xóa ghi chú'}`,(state.tests.find(t=>t.id===tid)||{}).name||'');
  save({clearDerived:false,testId:tid});
  entrySetLastMsg(note?`<div class="alert ok">✓ Đã lưu ghi chú ngày ${vnDate(date)}.</div>`:`<div class="alert ok">✓ Đã xóa ghi chú ngày ${vnDate(date)}.</div>`);
}
async function entryInlineSave(tid,level,date,value,runIdHint=''){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===tid),cfg=t&&lvlCfg(t,level);
  if(!t||!cfg||!canEnterQcForLevel(t,level)){entrySetLastMsg('<div class="alert warn">Nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>');return;}
  if(value==null||String(value).trim()==='')return;
  if(!await requireUnlockedPeriod(date,'nhập điểm QC'))return;
  const prepared=EntryService.preparePointInput({tid,level,date,value,runId:runIdHint,cfg});
  if(!prepared.ok){entrySetLastMsg('<div class="alert warn">Nhập giá trị QC hợp lệ.</div>');return;}
  const {val,runId}=prepared.point;
  const preIssues=qcPointWarnings(t,cfg,date,runId,val);
  if(preIssues.some(x=>x.includes('SD đang bằng 0'))){entrySetLastMsg('<div class="alert rej"><b>Không thể lưu.</b> '+esc(preIssues.join(' '))+'</div>');return;}
  if(preIssues.length){
    // Native confirm()/alert() dialogs leave the Electron renderer's input
    // unresponsive after close (until the window blurs/refocuses), so
    // unusual-data confirmation goes through the app's own modal instead.
    openModal(`<div class="modal">
      <div class="modal-h"><h3>Cảnh báo dữ liệu bất thường</h3><button class="modal-close" onclick="closeModal();entryRenderKeepScroll()">×</button></div>
      <div class="modal-b">${preIssues.map(x=>`<div class="alert warn">${esc(x)}</div>`).join('')}<div class="hint">Bạn vẫn muốn lưu điểm QC này?</div></div>
      <div class="modal-f"><button class="btn ghost" onclick="closeModal();entryRenderKeepScroll()">Hủy</button><button class="btn teal" onclick="closeModal();entryInlineSaveCommit('${jsq(tid)}',${level},'${jsq(date)}',${val},'${jsq(runId)}')">Vẫn lưu</button></div>
    </div>`);
    return;
  }
  entryInlineSaveCommit(tid,level,date,val,runId);
}
function entryInlineSaveCommit(tid,level,date,val,runId){
  const t=state.tests.find(x=>x.id===tid),cfg=t&&lvlCfg(t,level);
  // Kiểm tra lại tại thời điểm ghi vì nhóm lô có thể vừa bị dừng trong lúc hộp
  // thoại xác nhận dữ liệu bất thường đang mở hoặc vừa nhận đồng bộ từ máy khác.
  if(!t||!cfg||!canEnterQcForLevel(t,level)){entrySetLastMsg('<div class="alert warn">Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.</div>');entryRenderKeepScroll();return;}
  const recorded=EntryService.recordPoint(state,{tid,level,date,value:val,runId,cfg,staff:currentStaff(),id:uid()});
  if(!recorded.ok){
    if(recorded.error==='period-locked')entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể nhập điểm QC.</div>');
    else entrySetLastMsg('<div class="alert warn">Không thể lưu điểm QC không hợp lệ.</div>');
    return;
  }
  const saved=recorded.point;
  logAct('Thêm điểm QC',`Ngày ${vnDate(date)}, M${level}, giá trị ${fmt(val)}`,t.name);
  clearDerivedForTest(tid);
  const f=activeWestgard(t).byPoint.get(saved.id)||{level:'ok',rules:[]},rules=[...new Set(f.rules||[])];
  save({clearDerived:false,testId:tid});
  entrySel={testId:tid,level};entryEnd=date;entryLastMsg=f.level==='rej'?`<div class="alert rej"><b>⚠ Mức ${level} vi phạm — ${rules.join(', ')}</b></div>`:f.level==='warn'?`<div class="alert warn"><b>Mức ${level} cảnh báo — ${rules.join(', ')}</b></div>`:`<div class="alert ok">✓ Đã lưu Mức ${level} ngày ${vnDate(date)}.</div>`;
  entryRenderKeepScroll();
}
async function voidQcPoint(tid,pointId){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===tid),p=(state.data[tid]||[]).find(x=>x.id===pointId);
  if(!t||!p||p.voided)return;
  if(!await requireUnlockedPeriod(p.date,'hủy điểm QC'))return;
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Hủy điểm QC</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <div class="hint">Ngày ${vnDate(p.date)} · Mức ${p.level} · Giá trị ${fmt(p.val)}</div>
      <label>Lý do hủy (tối thiểu 5 ký tự)</label>
      <textarea id="voidReasonInput" placeholder="VD: Nhập nhầm giá trị, lỗi máy đo, hủy do lấy mẫu lại..." oninput="document.getElementById('voidReasonErr').style.display='none'"></textarea>
      <div id="voidReasonErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần ghi lý do hủy tối thiểu 5 ký tự.</div>
    </div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Đóng</button><button class="btn danger" onclick="confirmVoidQcPoint('${tid}','${pointId}')">Xác nhận hủy</button></div>
  </div>`);
  setTimeout(()=>{const e=document.getElementById('voidReasonInput');if(e)e.focus();},50);
}
async function confirmVoidQcPoint(tid,pointId){
  const t=state.tests.find(x=>x.id===tid),p=(state.data[tid]||[]).find(x=>x.id===pointId);
  if(!t||!p||p.voided){closeModal();return;}
  const input=document.getElementById('voidReasonInput');
  const clean=QCCore.cleanText(input?input.value:'',1000).trim();
  if(clean.length<5){
    const err=document.getElementById('voidReasonErr');
    if(err)err.style.display='';
    if(input)input.focus();
    return;
  }
  // confirmDialog() render vào #dialogRoot, tách khỏi #modalRoot đang giữ modal
  // "Hủy điểm QC" phía sau — nên Hủy ở đây không đụng gì tới modal đó, giữ nguyên
  // lý do người dùng đã gõ mà không cần dựng lại.
  if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Hủy điểm QC',message:'Hủy điểm QC này khỏi tính toán Westgard/thống kê?',detail:'Điểm vẫn được giữ trong nhật ký dữ liệu.',confirmLabel:'Hủy điểm QC',cancelLabel:'Quay lại'}))return;
  closeModal();
  const result=EntryService.voidPoint(state,{tid,pointId,reason:clean,staff:currentStaff(),nowIso:new Date().toISOString(),today:isoToday(),id:uid(),formatDate:vnDate,formatNumber:fmt});
  if(result&&result.error==='period-locked'){entrySetLastMsg('<div class="alert warn">Kỳ này đã chốt, không thể hủy điểm QC.</div>');return;}
  if(!result||result.error)return;
  clearDerivedForTest(tid);
  logAct('Hủy điểm QC',`Ngày ${vnDate(result.point.date)}, M${result.point.level}, giá trị ${fmt(result.point.val)} · ${result.reason}`,t.name);
  save({clearDerived:false,testId:tid});entryLastMsg=`<div class="alert warn">Đã hủy điểm QC ngày ${vnDate(result.point.date)}. Điểm không còn tham gia tính toán.</div>`;entryRenderKeepScroll();
}
function entrySetSheetMonth(v){if(!/^\d{4}-\d{2}$/.test(v))return;entrySheetMonth=v;entryLastMsg='';rerender();}
function entryGoToday(){entrySheetMonth=isoMonth();entryJumpToday=true;entryLastMsg='';rerender();}
function entrySetSheetPart(part,value){const m=/^(\d{4})-(\d{2})$/.exec(entrySheetMonth||isoMonth());let year=+m[1],month=+m[2];if(part==='year')year=+value;else month=+value;entrySetSheetMonth(`${year}-${String(month).padStart(2,'0')}`);}
function entrySetDays(n){entryDays=Math.min(90,n);entryStart=null;entryEnd=null;rerender();}
function entrySetStart(v){entryStart=parseVN(v)||null;rerender();}
function entrySetEnd(v){entryEnd=parseVN(v)||null;rerender();}
function wgMultiViews(t){
  const levels=operationalLevels(t).map(l=>({...l,pts:operationalLotPoints(t,l.level)}));
  const previousByLevel=new Map(levels.map(l=>[l.level,previousLotSeries(t,l.level)]));
  const openLevels=levels.filter(l=>wgPrevOpen.has(t.id+'|'+l.level)).map(l=>l.level);
  return WestgardViewModel.buildMultiViews({levels,previousByLevel,openLevels});
}
function wgTogglePrevLot(level){const k=selTest+'|'+level;if(wgPrevOpen.has(k))wgPrevOpen.delete(k);else wgPrevOpen.add(k);rerender();}
/* Nhóm lô "cũ" để xem lại Westgard: gồm cả nhóm lưu trữ THẬT (g.active===false, từ
   "Chấp nhận lô mới" ở Chuyển tiếp lô) lẫn nhóm chỉ bị đánh dấu "Đã dừng" thủ công/qua
   Kích hoạt nhóm khác (g.status==='stopped', vẫn active:true) — cả hai đều là nhóm không
   còn xét nghiệm nào đang dùng, người dùng cần xem lại chi tiết/biểu đồ như nhóm đang hoạt động. */
function wgArchivedGroups(){return(state.lotGroups||[]).filter(g=>g.active===false||g.status==='stopped').sort((a,b)=>String(b.stoppedAt||'').localeCompare(String(a.stoppedAt||''))||String(a.name||'').localeCompare(String(b.name||''),'vi'));}
function wgSetViewMode(mode){wgViewMode=mode==='archived'?'archived':'current';rerender();}
function wgSetChartMode(mode){wgChartMode=mode==='cusum'?'cusum':'lj';rerender();}
function wgChartModeTabs(){
  return `<div class="dayseg wg-view-mode"><button class="${wgChartMode==='lj'?'on':''}" onclick="wgSetChartMode('lj')">Levey-Jennings</button><button class="${wgChartMode==='cusum'?'on':''}" onclick="wgSetChartMode('cusum')">Xu hướng CUSUM</button></div>`;
}
/* Biểu đồ CUSUM chỉ tham khảo xu hướng (không đổi trạng thái đạt/loại QC —
   xem cusumSeries()/testCusumConfig() trong qc-domain.js), nên tách hẳn khỏi
   danh sách khối per-level của Levey-Jennings thay vì chèn xen kẽ, và chỉ vẽ
   cho các mức đã bật CUSUM riêng ở modal cấu hình xét nghiệm. */
function pageWestgardCusum(t){
  const cfg=testCusumConfig(t);
  if(!cfg.on)return `<div class="panel">${emptyState('Chưa bật CUSUM cho xét nghiệm này','Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.',canWrite()?btn('Mở cấu hình xét nghiệm',`openConfigAssay('${t.id}')`,'teal'):'')}</div>`;
  const levels=operationalLevels(t);
  if(!levels.length)return `<div class="panel">${emptyState('Chưa có mức QC đang vận hành','Cần Panel QC, Nhóm lô QC và Mean/SD hợp lệ trước khi vẽ CUSUM.')}</div>`;
  return levels.map(l=>{
    const pts=operationalLotPoints(t,l.level);
    const title=`<h3><span class="wg-level-title"><span>Mức ${l.level}</span><span class="wg-lot-name">Lô ${esc(l.lot||'?')}</span></span><span class="wg-level-meta"><span>Mean ${fmt(l.mean)}</span><span>SD ${fmt(l.sd,3)}</span><span>${pts.length} điểm</span><span>k=${fmt(cfg.k,2)} · h=${fmt(cfg.h,2)}</span></span></h3>`;
    if(!pts.length)return `<div class="panel">${title}${emptyState('Chưa có dữ liệu','LOT đang dùng chưa có điểm QC.')}</div>`;
    return `<div class="panel">${title}
      <div class="hint" style="margin:12px 16px 8px">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score qua từng điểm; vượt vạch đứt ±h là dấu hiệu trôi/shift kéo dài. Đường xám mờ là trung bình động 5 điểm, chỉ để tham khảo hình dạng xu hướng.</div>
      <div class="chart-scroll"><canvas class="cusumChart" data-test="${t.id}" data-level="${l.level}" width="1400" height="430"></canvas></div></div>`;
  }).join('');
}
function wgSetArchivedGroup(id){wgArchivedGroupId=id;wgArchivedTestId='';rerender();}
function wgSetArchivedTest(id){wgArchivedTestId=id;rerender();}
function wgViewModeTabs(archivedGroups){
  return archivedGroups.length?`<div class="dayseg wg-view-mode"><button class="${wgViewMode==='current'?'on':''}" onclick="wgSetViewMode('current')">Xét nghiệm đang vận hành</button><button class="${wgViewMode==='archived'?'on':''}" onclick="wgSetViewMode('archived')">Nhóm lô đã dừng/lưu trữ (${archivedGroups.length})</button></div>`:'';
}
const WG_TABLE_INITIAL_ROWS=120;
function wgRowsWindow(rows,key){
  const all=rows||[],expanded=wgExpandedRows.has(key),visible=expanded?all:all.slice(-WG_TABLE_INITIAL_ROWS);
  return{rows:visible,total:all.length,expanded,limited:visible.length<all.length};
}
function wgToggleRows(key){if(wgExpandedRows.has(key))wgExpandedRows.delete(key);else wgExpandedRows.add(key);rerender();}
function wgRowsControl(view,key){
  if(view.total<=WG_TABLE_INITIAL_ROWS)return'';
  return `<div class="wg-row-window"><span>Đang hiển thị ${view.rows.length}/${view.total} điểm${view.expanded?'':' mới nhất'}</span><button class="btn ghost sm" onclick="wgToggleRows('${jsq(key)}')">${view.expanded?`Thu gọn còn ${WG_TABLE_INITIAL_ROWS} điểm`:`Xem toàn bộ ${view.total} điểm`}</button></div>`;
}
function wgPointRowsHtml(rows){return rows.map(row=>{const lv=qcVerdictLabel(row.level),err=row.rules.length?errorTypeDetailParts(row.rules):null,errHtml=err?`<div class="wg-error-type"><b>${esc(err.type)}</b>${err.desc?`<small>${esc(err.desc)}</small>`:''}</div>`:'—',support=(row.supportRules||[]).map(r=>`<span class="pill" title="Điểm lịch sử cấu thành quy tắc, không bị loại hồi tố">↳ ${r}</span>`).join('');
  return `<tr><td>${row.index}</td><td>${vnDate(row.date)}</td><td class="num">${fmt(row.value)}</td><td class="num">${row.z>=0?'+':''}${fmt(row.z)}s</td><td><span class="tag ${row.level}">${lv}</span></td><td>${row.rules.map(r=>`<span class="pill">${r}</span>`).join('')||support||'—'}${row.rules.length&&support?`<div class="hint" style="margin-top:4px">Bằng chứng: ${support}</div>`:''}</td><td class="hint">${errHtml}</td></tr>`;}).join('');}
/* Một khối Westgard cho MỘT lô (đang dùng, đã chuyển tiếp, hoặc thuộc nhóm lô đã dừng/lưu
   trữ) — dùng chung cho cả "Xem lô cũ" (theo dòng đời của 1 xét nghiệm) và màn hình duyệt
   theo nhóm lô cũ. Chỉ bảng số liệu, không vẽ biểu đồ riêng từng mức — biểu đồ tổng hợp
   nhiều mức (Levey-Jennings) đã có riêng ở đầu trang (xem wgArchivedMultiViews()). */
function wgLotBlock(t,level,lotNo,mean,sd,pts,badge,titleMain,lotLabel,extraMeta=''){
  const title=`<h3><span class="wg-level-title"><span>${titleMain}</span><span class="wg-lot-name">${lotLabel}</span></span><span class="wg-level-meta"><span class="tag rej">${badge}</span><span>Mean ${fmt(mean)}</span><span>SD ${fmt(sd,3)}</span><span>${pts.length} điểm</span>${extraMeta}</span></h3>`;
  if(!pts.length)return `<div class="panel wg-prev-lot">${title}${emptyState('Chưa có dữ liệu','Không tìm thấy điểm QC nào cho lô này.')}</div>`;
  const wgP=QCCore.westgardByPoint(pts,mean,sd,rule=>testRuleOnWithin(t,rule));
  const rows=WestgardViewModel.buildPointRows({points:pts,verdicts:wgP.F.map(f=>({rules:f.rules,supportRules:f.supportRules,level:ruleResultLevel(t,f.rules)})),zs:wgP.zs,mean,sd}),key=`lot:${t.id}|${level}|${lotNo}`,view=wgRowsWindow(rows,key),rowsHtml=wgPointRowsHtml(view.rows);
  return `<div class="panel wg-prev-lot">${title}${wgRowsControl(view,key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}
/* Trang xem lại nhóm lô đã dừng/lưu trữ — cùng bố cục với pageWestgard() (mode "current"):
   chọn 1 nhóm lô rồi chọn 1 xét nghiệm trong nhóm đó, chỉ hiện các mức của xét nghiệm đang
   chọn (biểu đồ Levey-Jennings tổng hợp nếu có từ 2 mức trở lên, rồi từng khối wgLotBlock
   chỉ có bảng số liệu), thay vì dồn hết mọi xét nghiệm/mức của cả nhóm ra một lượt. */
/* Dữ liệu cho biểu đồ Levey-Jennings tổng hợp (nhiều mức quy về Z-score, canvas.wgLJMultiArchived
   ở after-render.js) của MỘT xét nghiệm trong nhóm lô đã dừng/lưu trữ — cùng dạng {level,lot,
   mean,sd,pts,label} như wgMultiViews() (dùng cho xét nghiệm đang vận hành) để tái dùng chung
   drawLJMultiZ(). */
function wgArchivedMultiViews(rows){
  return rows.map(r=>({level:r.l.level,lot:r.lot.lotNo,mean:r.mean,sd:r.sd,pts:lotPointsByNo(r.t.id,r.l.level,r.lot.lotNo),label:`M${r.l.level}·${r.lot.lotNo}`}));
}
/* Nhóm lô "khớp" ô Tìm nhanh: theo tên nhóm HOẶC số lô bên trong (để gõ số lô cũng nhảy
   được sang đúng nhóm), không chỉ khớp theo tên xét nghiệm như testEntries bên dưới. */
function wgArchivedGroupMatches(g,q){
  if(!q)return true;
  if(searchText(g.name).includes(q))return true;
  return (g.lotIds||[]).some(id=>{const l=state.qcLots.find(x=>x.id===id);return l&&searchText(l.lotNo).includes(q);});
}
function pageWestgardArchived(archivedGroups){
  const q=searchText(wgArchivedTestQ);
  const matchedGroups=archivedGroups.filter(g=>wgArchivedGroupMatches(g,q));
  const groupList=matchedGroups.length?matchedGroups:archivedGroups; // gõ tên xét nghiệm (không khớp nhóm nào) thì vẫn cho chọn đủ nhóm
  if(matchedGroups.length&&!matchedGroups.some(g=>g.id===wgArchivedGroupId)){wgArchivedGroupId=matchedGroups[0].id;wgArchivedTestId='';}
  else if(!wgArchivedGroupId||!archivedGroups.some(g=>g.id===wgArchivedGroupId))wgArchivedGroupId=archivedGroups[0].id;
  const group=archivedGroups.find(g=>g.id===wgArchivedGroupId);
  const groupOpts=groupList.map(g=>`<option value="${g.id}" ${g.id===wgArchivedGroupId?'selected':''}>${esc(g.name)}${g.active===false?' · đã lưu trữ':' · đã dừng'}${g.stoppedAt?' '+vnDate(g.stoppedAt):''}</option>`).join('');
  const badge=group.active===false?'Đã lưu trữ':'Đã dừng';
  const groupPicker=`<div><label>Nhóm lô đã dừng/lưu trữ <span class="hint">(${groupList.length}/${archivedGroups.length})</span></label><select onchange="wgSetArchivedGroup(this.value)">${groupOpts}</select></div>`;
  const searchBox=`<div><label>Tìm nhanh</label><input id="wgArchivedTestSearch" type="search" placeholder="Tên xét nghiệm, máy hoặc số lô..." value="${escAttr(wgArchivedTestQ)}" oninput="wgFilterArchivedTests(this.value)"></div>`;
  const rows=levelsForLotGroup(group);
  const byTest=new Map();
  rows.forEach(r=>{if(!byTest.has(r.t.id))byTest.set(r.t.id,{t:r.t,rows:[]});byTest.get(r.t.id).rows.push(r);});
  const testEntries=[...byTest.values()].sort((a,b)=>operationalTestOrder(a.t)-operationalTestOrder(b.t)||String(a.t.name||'').localeCompare(String(b.t.name||''),'vi'));
  if(!testEntries.length)return headOnly('Phân tích Westgard','Xem lại Westgard theo nhóm lô đã dừng/lưu trữ')+
    `<div class="panel"><h3>Thiết lập phân tích</h3>${wgViewModeTabs(archivedGroups)}<div class="wg-test-picker">${searchBox}${groupPicker}</div></div>
     <div class="panel">${emptyState('Không tìm thấy xét nghiệm nào','Nhóm lô này không gắn với xét nghiệm/mức nào có Mean/SD hợp lệ.')}</div>`;
  const matchedTests=testEntries.filter(e=>!q||searchText(e.t.name).includes(q)||searchText(instrumentName(e.t.instrumentId,e.t.machine)).includes(q));
  const testList=matchedTests.length?matchedTests:testEntries; // gõ số lô (không khớp tên xét nghiệm nào) thì vẫn cho chọn đủ xét nghiệm của nhóm vừa nhảy tới
  if(matchedTests.length&&!matchedTests.some(e=>e.t.id===wgArchivedTestId))wgArchivedTestId=matchedTests[0].t.id;
  else if(!testEntries.some(e=>e.t.id===wgArchivedTestId))wgArchivedTestId=testEntries[0].t.id;
  const testOpts=testList.map(e=>`<option value="${e.t.id}" ${e.t.id===wgArchivedTestId?'selected':''}>${esc(e.t.name)}</option>`).join('');
  const testPicker=`<div><label>Chọn xét nghiệm <span class="hint">(${testList.length}/${testEntries.length})</span></label><select onchange="if(this.value){wgSetArchivedTest(this.value)}">${testOpts}</select></div>`;
  const entry=testEntries.find(e=>e.t.id===wgArchivedTestId)||testEntries[0];
  const sortedRows=entry.rows.slice().sort((a,b)=>a.l.level-b.l.level);
  const multiChart=sortedRows.length>=2?`<div class="panel"><h3>Levey-Jennings tổng hợp</h3>
    <div class="hint" style="margin:12px 16px 8px">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm.</div>
    <div class="chart-scroll"><canvas class="wgLJMultiArchived" data-group="${group.id}" data-test="${entry.t.id}" width="1400" height="430"></canvas></div></div>`:'';
  const blocks=sortedRows.map(({t,l,lot,mean,sd})=>wgLotBlock(t,l.level,lot.lotNo,mean,sd,lotPointsByNo(t.id,l.level,lot.lotNo),badge,`Mức ${l.level}`,`Lô ${esc(lot.lotNo)}`)).join('');
  return headOnly('Phân tích Westgard','Xem lại Westgard theo nhóm lô đã dừng/lưu trữ')+
   `<div class="panel"><h3>Thiết lập phân tích</h3>${wgViewModeTabs(archivedGroups)}
     <div class="wg-test-picker wg-test-picker-3">${searchBox}${testPicker}${groupPicker}</div>
     <div class="hint" style="margin-top:8px">Đánh giá dưới đây dùng bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô này còn hoạt động.</div></div>${multiChart}${blocks}`;
}
function pageWestgard(){
  const tests=operationalTests(),archivedGroups=wgArchivedGroups();
  if(!tests.length&&!archivedGroups.length)return headOnly('Phân tích Westgard','')+`<div class="panel">${emptyState('Chưa có xét nghiệm đang vận hành','Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi phân tích Westgard.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`;
  if(wgViewMode==='archived'&&!archivedGroups.length)wgViewMode='current';
  if(wgViewMode==='current'&&!tests.length&&archivedGroups.length)wgViewMode='archived';
  if(wgViewMode==='archived')return pageWestgardArchived(archivedGroups);
  if(!selTest||!tests.find(t=>t.id===selTest))selTest=tests[0].id;
  const t=tests.find(t=>t.id===selTest);
  const q=searchText(wgTestQ),matched=tests.filter(x=>!q||searchText(testSelectLabel(x)).includes(q)),opts=matched.length?matched.map(x=>`<option value="${x.id}" ${x.id===selTest?'selected':''}>${esc(testSelectLabel(x))}</option>`).join(''):'<option value="">Không tìm thấy xét nghiệm phù hợp</option>';
  const wg=activeWestgard(t),levelViews=wg.views.map(v=>({l:v.l,pts:v.pts,cfg:{mean:v.l.mean,sd:v.l.sd},single:v.single,lotPicker:`<span class="wg-lot-name">Lô ${esc(v.l.lot||'?')}</span>`}));
  const multiChart=wgMultiViews(t).length>=2?`<div class="panel"><h3>Levey-Jennings tổng hợp</h3>
    <div class="hint" style="margin:12px 16px 8px">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm. Bật "Xem lô cũ" ở mức tương ứng để thêm đường của lô đã chuyển tiếp.</div>
    <div class="chart-scroll"><canvas class="wgLJMulti" data-test="${t.id}" width="1400" height="430"></canvas></div></div>`:'';
  const blocks=levelViews.map(v=>{const{l,pts,cfg,lotPicker}=v;
    const prevSeries=previousLotSeries(t,l.level),hasPrev=prevSeries.length>0,prevOpen=wgPrevOpen.has(t.id+'|'+l.level);
    const prevBtn=hasPrev?`<button class="btn ghost sm wg-prev-toggle" onclick="wgTogglePrevLot(${l.level})">${prevOpen?'Xem lô mới':'Xem lô cũ'}</button>`:'';
    if(prevOpen&&hasPrev){const s=prevSeries[0];return wgLotBlock(t,l.level,s.lot,s.mean,s.sd,s.pts,'Đã chuyển tiếp',`Mức ${l.level}`,`Lô cũ ${esc(s.lot)}`,prevBtn);}
    const title=`<h3><span class="wg-level-title"><span>Mức ${l.level}</span>${lotPicker}</span><span class="wg-level-meta"><span>Mean ${fmt(cfg.mean)}</span><span>SD ${fmt(cfg.sd,3)}</span><span>${pts.length} điểm</span>${prevBtn}</span></h3>`;
    if(!pts.length)return `<div class="panel">${title}${emptyState('Chưa có dữ liệu','LOT đang dùng chưa có điểm QC. Bạn có thể chọn LOT cũ hoặc nhập điểm mới.',btn('Nhập QC',`entrySel={testId:'${t.id}',level:${l.level}};entryStart=null;entryEnd=null;go('entry')`,'teal'))}</div>`;
    const{zs}=v.single,rows=WestgardViewModel.buildPointRows({points:pts,verdicts:wg.byPoint,zs,mean:cfg.mean,sd:cfg.sd}),key=`current:${t.id}|${l.level}|${l.lot||''}`,view=wgRowsWindow(rows,key),rowsHtml=wgPointRowsHtml(view.rows);
    return `<div class="panel">${title}${wgRowsControl(view,key)}<table class="wg-table"><thead><tr><th>#</th><th>Ngày</th><th class="num">Giá trị</th><th class="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;}).join('');
  const ruleToggles=WG_RULES.map(r=>`<span class="wg-rule-item"><label><input type="checkbox" ${wgOn(r)?'checked':''} ${!canWrite()?'disabled':''} onchange="wgSet('${r}',this.checked)"> <span class="pill">${r}</span></label></span>`).join('')+(canWrite()?`<div class="wg-rule-reset"><button class="btn ghost sm" onclick="wgReset()">Khôi phục mặc định</button></div>`:'');
  const ruleGuide=`<details class="wg-guide"><summary>Hướng dẫn nhanh luật Westgard</summary><div class="alert info" style="margin:10px 0">Ký hiệu ↳ trong bảng là điểm lịch sử cấu thành quy tắc. Điểm này chỉ là bằng chứng; trạng thái cảnh báo/loại được gắn cho lần chạy phát hiện hiện tại, không đổi hồi tố kết luận cũ.</div><div class="chart-scroll"><table><thead><tr><th>Luật</th><th>Điều kiện</th><th>Kết luận</th><th>Gợi ý xử lý</th></tr></thead><tbody>
    <tr><td>1-2s</td><td>1 điểm QC vượt ±2SD</td><td><span class="warn">Cảnh báo</span></td><td>Theo dõi điểm kế tiếp, chưa loại bỏ nếu không kèm luật khác.</td></tr>
    <tr><td>1-3s</td><td>1 điểm QC vượt ±3SD</td><td><span class="rej">Loại bỏ</span></td><td>Kiểm tra sai số ngẫu nhiên: thao tác, bọt khí, pipet, QC pha/bảo quản.</td></tr>
    <tr><td>2-2s</td><td>2 điểm liên tiếp hoặc 2 mức cùng lần chạy, cùng phía vượt ±2SD</td><td><span class="rej">Loại bỏ</span></td><td>Nghi sai số hệ thống: hiệu chuẩn, lô QC/hóa chất, nhiệt độ, máy.</td></tr>
    <tr><td>2of3-2s</td><td>Trong 3 kết quả, có ít nhất 2 điểm cùng phía vượt ±2SD</td><td><span class="rej">Loại bỏ</span></td><td>Nghi sai số hệ thống; đặc biệt hữu ích khi chạy 3 mức QC.</td></tr>
    <tr><td>R4s</td><td>Cùng lần chạy có 1 mức &gt; +2SD và 1 mức &lt; -2SD, chênh nhau trên 4SD</td><td><span class="rej">Loại bỏ</span></td><td>Nghi sai số ngẫu nhiên lớn: hút mẫu, bọt khí, thao tác, điện áp.</td></tr>
    <tr><td>3-1s</td><td>3 điểm liên tiếp hoặc 3 mức cùng phía vượt ±1SD</td><td><span class="rej">Loại bỏ</span></td><td>Nghi dịch chuyển hệ thống nhỏ; kiểm tra hiệu chuẩn và lô thuốc thử.</td></tr>
    <tr><td>4-1s</td><td>4 điểm liên tiếp cùng phía vượt ±1SD</td><td><span class="rej">Loại bỏ</span></td><td>Nghi lệch hệ thống nhẹ, kiểm tra xu hướng và hiệu chuẩn.</td></tr>
    <tr><td>6x</td><td>6 điểm liên tiếp nằm cùng một phía so với Mean</td><td><span class="warn">Cảnh báo</span></td><td>Phát hiện dịch chuyển sớm, khá nhạy khi gộp nhiều mức; xem lại Mean, hiệu chuẩn và lô mới. Có thể nâng thành loại bỏ theo SOP từng xét nghiệm.</td></tr>
    <tr><td>8x</td><td>8 điểm liên tiếp nằm cùng một phía so với Mean</td><td><span class="rej">Loại bỏ</span></td><td>Biến thể thường dùng khi chạy 2 hoặc 4 mức QC; nghi lệch hệ thống.</td></tr>
    <tr><td>9x</td><td>9 điểm liên tiếp nằm cùng một phía so với Mean</td><td><span class="rej">Loại bỏ</span></td><td>Biến thể phù hợp khi chạy 3 mức QC qua nhiều lần chạy.</td></tr>
    <tr><td>10x</td><td>10 điểm liên tiếp nằm cùng một phía so với mean</td><td><span class="rej">Loại bỏ</span></td><td>Nghi dịch chuyển nền, xem lại mean/SD, lô mới, hiệu chuẩn.</td></tr>
    <tr><td>12x</td><td>12 điểm liên tiếp nằm cùng một phía so với Mean</td><td><span class="rej">Loại bỏ</span></td><td>Biến thể ít nhạy hơn 8x/10x, dùng để theo dõi bias dài hơn.</td></tr>
    <tr><td>7T</td><td>7 điểm tăng dần hoặc giảm dần liên tiếp</td><td><span class="warn">Cảnh báo</span></td><td>Theo dõi xu hướng, kiểm tra bảo quản QC, thuốc thử, môi trường.</td></tr>
  </tbody></table></div></details>`;
  return headOnly('Phân tích Westgard','Đối chiếu luật theo mức QC, lô và lần chạy')+
   `<div class="panel"><h3>Thiết lập phân tích</h3>${wgViewModeTabs(archivedGroups)}<div class="wg-test-picker"><div><label>Tìm nhanh</label><input id="wgTestSearch" type="search" placeholder="Tên xét nghiệm, LOT hoặc máy..." value="${escAttr(wgTestQ)}" oninput="wgFilterTests(this.value)"></div><div><label>Chọn xét nghiệm <span id="wgTestCount" class="hint">(${matched.length}/${tests.length})</span></label><select id="wgTestSelect" ${matched.length?'':'disabled'} onchange="if(this.value){selTest=this.value;rerender()}">${opts}</select></div></div>
     <div class="wg-rules"><b style="font-size:12px">Cấu hình chung của luật</b><div style="margin-top:6px">${ruleToggles}</div></div>
     ${ruleGuide}${wgChartModeTabs()}</div>${wgChartMode==='cusum'?pageWestgardCusum(t):multiChart+blocks}`;
}
function wgFilterTests(v){
  wgTestQ=v;
  scheduleSearchRender(wgFilterTests,()=>{
    const q=searchText(wgTestQ),matches=operationalTests().filter(x=>!q||searchText(testSelectLabel(x)).includes(q));
    if(matches.length&&!matches.some(x=>x.id===selTest)){selTest=matches[0].id;rerender();return;}
    const select=document.getElementById('wgTestSelect'),count=document.getElementById('wgTestCount'),tests=operationalTests();
    replaceSelectItems(select,matches.map(x=>({value:x.id,label:testSelectLabel(x)})),'Không tìm thấy xét nghiệm phù hợp');
    if(select&&matches.some(x=>x.id===selTest))select.value=selTest;
    if(count)count.textContent=`(${matches.length}/${tests.length})`;
  },'wgTestSearch');
}

function pageDashLoading(tests,pending){
  const points=(tests||[]).reduce((sum,t)=>sum+(state.data[t.id]||[]).length,0);
  return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${esc(state.lab.name||'Khoa Xét nghiệm')}${state.lab.dept?' · '+esc(state.lab.dept):''}</p></div>${topUserBox()}</div>
    <div class="dash-hero dash-analysis-loading">
      <div class="dash-status"><div class="eyebrow">Đang chuẩn bị dữ liệu</div><h2>Phân tích Westgard chạy nền</h2><p>Bạn có thể tiếp tục sử dụng ứng dụng. Bảng điều khiển sẽ tự cập nhật khi phân tích hoàn tất.</p><div class="dash-loading-bar"><span></span></div></div>
      <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${points}</div></div><div class="dash-kpi"><div class="k">Đang xử lý</div><div class="v">${pending}</div></div><div class="dash-kpi"><div class="k">Giao diện</div><div class="v dash-ready-mark">✓</div></div></div>
    </div>
    <div class="panel dash-loading-panel"><div class="dash-spinner"></div><div><h3>Đang tính trạng thái kiểm soát chất lượng</h3><p class="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div></div>`;
}
function wgFilterArchivedTests(v){
  wgArchivedTestQ=v;
  scheduleSearchRender(wgFilterArchivedTests,()=>{rerender();},'wgArchivedTestSearch');
}
