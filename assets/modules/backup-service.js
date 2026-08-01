/* ===== BACKUP / RESTORE SERVICE ===== */
const BACKUP_IMPORT_MAX_BYTES=128*1024*1024;
const BACKUP_IMPORT_WARN_BYTES=96*1024*1024;
function validateBackup(x){return QCCore.validateBackup(x);}
/* JSON gọn giảm ~39% ở bộ dữ liệu 10 năm; format vẫn là JSON chuẩn nên mọi
   backup cũ có thụt lề tiếp tục nhập được. */
function serializeBackupData(value){return JSON.stringify(value);}
function backupTextBytes(text){if(typeof Blob!=='undefined')return new Blob([String(text)]).size;if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(String(text)).length;return unescape(encodeURIComponent(String(text))).length;}
function backupSizeMB(size){return(Number(size||0)/1024/1024).toFixed(1);}
function backupImportSizeError(size){return Number(size)>BACKUP_IMPORT_MAX_BYTES?`File backup vượt quá giới hạn ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`:'';}
function backupSizeWarning(size){return Number(size)>=BACKUP_IMPORT_WARN_BYTES?`File backup đã đạt ${backupSizeMB(size)} MB, gần giới hạn ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB. Nên lưu trữ dữ liệu cũ hoặc giảm kích thước trước kỳ sao lưu tiếp theo.`:'';}
async function backupChecksum(text){
  if(typeof crypto!=='undefined'&&crypto.subtle&&typeof TextEncoder!=='undefined'){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));return[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  if(typeof auditSha256==='function'&&backupTextBytes(text)<=16*1024*1024)return auditSha256(String(text));
  return'';
}
async function createBackupPackage(value,meta={}){
  const payload=serializeBackupData(value),checksum=await backupChecksum(payload),header={format:'qclab-backup',formatVersion:1,type:meta.type==='year-archive'?'year-archive':'full',createdAt:new Date().toISOString(),appVersion:typeof window!=='undefined'&&window.QCLAB_APP?window.QCLAB_APP.version||'':'',schemaVersion:Number(value&&value.schemaVersion||QCCore.STATE_SCHEMA_VERSION),year:meta.year||'',checksum};
  if(header.type==='year-archive'&&!checksum)throw new Error('Trình duyệt không hỗ trợ tạo checksum SHA-256 cho archive.');
  const text=JSON.stringify(header).slice(0,-1)+',"data":'+payload+'}';return{text,bytes:backupTextBytes(text),meta:header};
}
async function parseBackupPackage(text){
  const parsed=JSON.parse(String(text));
  if(!parsed||parsed.format!=='qclab-backup'||!parsed.data)return{incoming:parsed,meta:{type:'legacy',formatVersion:0,checksumStatus:'legacy'}};
  if(Number(parsed.formatVersion)!==1)throw new Error('Phiên bản gói backup chưa được hỗ trợ.');
  const payload=serializeBackupData(parsed.data),actual=parsed.checksum?await backupChecksum(payload):'';
  if(parsed.checksum&&(!actual||actual!==parsed.checksum))throw new Error('Checksum SHA-256 không khớp; file có thể đã hỏng hoặc bị thay đổi.');
  return{incoming:parsed.data,meta:{type:parsed.type||'full',formatVersion:1,createdAt:parsed.createdAt||'',appVersion:parsed.appVersion||'',schemaVersion:parsed.schemaVersion,year:parsed.year||'',checksum:parsed.checksum||'',checksumStatus:parsed.checksum?(actual?'verified':'unavailable'):'missing'}};
}
function prepareBackupState(incoming){
  const errors=validateBackup(incoming);if(errors.length)throw new Error(errors.join('\n'));
  const next=QCCore.sanitizeBackup(incoming,{owned:true}),invariantErrors=QCCore.validateStateInvariants(next,{sanitized:true});
  if(invariantErrors.length)throw new Error('Backup sau chuẩn hóa không đạt kiểm tra dữ liệu:\n'+invariantErrors.join('\n'));
  return next;
}
async function prepareBackupImport(text){const parsed=await parseBackupPackage(text);if(parsed.meta.type==='year-archive')throw new Error('Đây là archive theo năm, không phải backup đầy đủ. Hãy dùng chức năng Kiểm tra backup/archive.');return prepareBackupState(parsed.incoming);}
async function inspectBackupText(text,size=0){const parsed=await parseBackupPackage(text),next=prepareBackupState(parsed.incoming),summary=typeof ArchiveService!=='undefined'?ArchiveService.summarize(next,parsed.meta.year):{points:Object.values(next.data||{}).reduce((n,rows)=>n+(rows||[]).length,0),configuredTests:(next.tests||[]).length};return{meta:parsed.meta,summary,state:next,size:Number(size)||backupTextBytes(text)};}
async function exportData(){logAct('Xuất backup','Xuất toàn bộ dữ liệu JSON có checksum','Dữ liệu');save({clearDerived:false});let pack;try{pack=await createBackupPackage(state);}catch(e){await infoDialog('Không tạo được file backup:\n'+(e&&e.message?e.message:'Lỗi không xác định.'));return;}const sizeError=backupImportSizeError(pack.bytes);if(sizeError){await infoDialog(sizeError+' Không xuất file không thể phục hồi; hãy lưu trữ bớt dữ liệu cũ.');return;}const warning=backupSizeWarning(pack.bytes);if(warning&&!await confirmDialog({kicker:'Dung lượng backup lớn',title:'Vẫn xuất backup?',message:warning,detail:'File hiện tại vẫn nhập được, nhưng dung lượng dự phòng còn ít.',confirmLabel:'Xuất backup',cancelLabel:'Hủy'}))return;const ok=downloadBackupText('qclab-backup-'+vnDate(isoToday()).replaceAll('/','-')+'.json',pack.text);if(!ok){await infoDialog('Không tạo được file backup. Dữ liệu chưa được xem là đã sao lưu.');return;}markBackupDone(pack.bytes);updateBackupBanner();}
function downloadBackupText(name,json){try{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}catch(e){return false;}}
async function backupCurrentData(prefix='before-change'){
  const stamp=new Date().toISOString().replace(/[T:]/g,'-').replace(/\.\d{3}Z$/,'Z');
  let pack;try{pack=await createBackupPackage(state);}catch(e){return false;}if(backupImportSizeError(pack.bytes))return false;
  const ok=downloadBackupText(`qclab-${prefix}-${stamp}.json`,pack.text);
  if(ok){markBackupDone(pack.bytes);updateBackupBanner();}
  return ok;
}
async function importData(e){
  if(!requireAdmin('Chỉ quản trị mới được nhập backup.')){if(e&&e.target)e.target.value='';return;}
  const f=e.target.files[0];if(!f)return;try{const sizeError=backupImportSizeError(f.size);if(sizeError)throw new Error(sizeError);
    const sizeWarning=backupSizeWarning(f.size),oldActivity=[...(state.activity||[])],incoming=await prepareBackupImport(await f.text());
    if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Nhập backup',message:`Nhập backup "${f.name}"?`,detail:'Dữ liệu nghiệp vụ hiện tại sẽ được thay thế; nhật ký cũ được giữ lại.'+(sizeWarning?' '+sizeWarning:''),confirmLabel:'Nhập backup',cancelLabel:'Hủy'}))return;
    if(!await backupCurrentData('truoc-nhap'))throw new Error('Không tạo được bản backup an toàn trước khi nhập. Dữ liệu hiện tại chưa bị thay thế.');
    const previousState=state;
    state=incoming;ensureShape({sanitized:true});
    const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length){state=previousState;throw new Error('Backup sau hoàn thiện cấu trúc không đạt kiểm tra dữ liệu:\n'+invariantErrors.join('\n'));}
    if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);
    if(!state.users.length)await ensureAdmin();
    const importedActivity=(state.activity||[]).map(a=>{const{hash,prevHash,...rest}=a;return{...rest,seq:0};});
    state.activity=[...oldActivity,...importedActivity];
    logAct('Nhập backup','Nhập dữ liệu đã kiểm tra từ file '+f.name,'Dữ liệu');
    save();rerender();await infoDialog('Đã nhập và kiểm tra backup.',{type:'success'});
  }catch(err){await infoDialog('Không thể nhập backup:\n'+(err&&err.message?err.message:'File không hợp lệ.'));}finally{if(e&&e.target)e.target.value='';}
}
function registerVerifiedArchive(report,filename){const m=report.meta,s=report.summary,user=typeof currentUser!=='undefined'&&currentUser?currentUser:null,result=ArchiveService.register(state,{year:m.year,filename,checksum:m.checksum,sizeBytes:report.size,points:s.points,tests:s.tests,minDate:s.minDate,maxDate:s.maxDate,createdAt:m.createdAt,verifiedAt:new Date().toISOString(),verifiedBy:user&&(user.name||user.username)||'',appVersion:m.appVersion,schemaVersion:m.schemaVersion,testCounts:s.testCounts});if(result.added){logAct('Xác minh archive năm',`${m.year}: ${s.points} điểm QC · ${m.checksum.slice(0,12)}…`,'Dữ liệu');save({clearDerived:false});}return result;}
async function verifyBackupFile(e){const f=e&&e.target&&e.target.files&&e.target.files[0];if(!f)return;try{const sizeError=backupImportSizeError(f.size);if(sizeError)throw new Error(sizeError);const report=await inspectBackupText(await f.text(),f.size),m=report.meta,s=report.summary,type=m.type==='year-archive'?`Archive năm ${m.year}`:m.type==='legacy'?'Backup JSON cũ':'Backup đầy đủ',checksum=m.checksumStatus==='verified'?'SHA-256 hợp lệ':m.checksumStatus==='legacy'?'File cũ chưa có checksum':'Không có checksum';let registry='';if(m.type==='year-archive'&&m.checksumStatus==='verified'){const registered=registerVerifiedArchive(report,f.name);registry=registered.added?' Archive đã được ghi nhận vào danh mục đồng bộ.':' Archive này đã có trong danh mục.';}await infoDialog(`${type} hợp lệ.\n${checksum}.${registry}\nDung lượng: ${backupSizeMB(report.size)} MB.\nĐiểm QC: ${s.points||0}; xét nghiệm cấu hình: ${s.configuredTests||0}.\nKhoảng ngày: ${s.minDate||'—'} đến ${s.maxDate||'—'}.`,{type:'success'});}catch(err){await infoDialog('File không đạt kiểm tra:\n'+(err&&err.message?err.message:'File không hợp lệ.'));}finally{if(e&&e.target)e.target.value='';}}
async function exportYearArchive(){if(!requireAdmin('Chỉ quản trị mới được xuất archive.'))return;const el=document.getElementById('archiveYear'),year=el&&el.value,result=ArchiveService.build(state,year);if(result.error){await infoDialog(result.error==='empty-year'?'Năm đã chọn không có điểm QC.':'Năm lưu trữ không hợp lệ.');return;}try{const pack=await createBackupPackage(result.state,{type:'year-archive',year:result.year}),sizeError=backupImportSizeError(pack.bytes);if(sizeError)throw new Error(sizeError);if(!downloadBackupText(`qclab-archive-${result.year}.json`,pack.text))throw new Error('Không tạo được file archive.');logAct('Xuất archive năm',`${result.year}: ${result.summary.points} điểm QC, SHA-256 ${pack.meta.checksum.slice(0,12)}…`,'Dữ liệu');save({clearDerived:false});await infoDialog(`Đã tạo archive năm ${result.year}: ${result.summary.points} điểm QC, ${backupSizeMB(pack.bytes)} MB. Dữ liệu đang vận hành chưa bị xóa.`,{type:'success'});}catch(err){await infoDialog('Không thể xuất archive:\n'+(err&&err.message?err.message:'Lỗi không xác định.'));}}
function archiveCleanupOpenNces(pointIds){return(state.actions||[]).filter(a=>pointIds.has(String(a&&a.pointId||''))&&!(typeof actionCancelled==='function'&&actionCancelled(a))&&(!(typeof actionWorkflowStatus==='function')||!actionWorkflowStatus(a).complete));}
function archiveCleanupGuard(archiveState,year){const comparison=ArchiveService.compareYear(state,archiveState,year);if(!comparison.ok)throw new Error(`Điểm QC không khớp archive: hiện tại ${comparison.currentPoints||0}, archive ${comparison.archivePoints||0}, thiếu ${comparison.missing&&comparison.missing.length||0}, dư ${comparison.extra&&comparison.extra.length||0}, thay đổi ${comparison.changed&&comparison.changed.length||0}.`);const affected=Object.values(state.data||{}).flatMap(rows=>(rows||[]).filter(p=>ArchiveService.pointYear(p)===year)),locked=PeriodService.lockedPoints(state,affected);if(locked.count)throw new Error(`Có ${locked.count} điểm thuộc kỳ đã khóa (${locked.periods.join(', ')}). Phải mở khóa từng kỳ với lý do trước.`);const openNces=archiveCleanupOpenNces(comparison.pointIds);if(openNces.length)throw new Error(`Có ${openNces.length} hồ sơ NCE đang mở tham chiếu điểm của năm ${year}. Phải khép hoặc hủy đúng quy trình trước.`);return comparison;}
async function cleanupYearFromArchive(e){if(!requireAdmin('Chỉ quản trị mới được dọn dữ liệu lưu trữ.')){if(e&&e.target)e.target.value='';return;}const f=e&&e.target&&e.target.files&&e.target.files[0];if(!f)return;try{const report=await inspectBackupText(await f.text(),f.size),m=report.meta;if(m.type!=='year-archive'||m.checksumStatus!=='verified')throw new Error('Phải chọn archive năm có checksum SHA-256 hợp lệ.');if(report.summary.years.length!==1||report.summary.years[0]!==m.year)throw new Error('Nội dung archive không giới hạn đúng một năm '+m.year+'.');const registry=(state.archiveRegistry||[]).find(x=>x.year===m.year&&x.checksum===m.checksum);if(!registry)throw new Error('Archive chưa có trong danh mục đã xác minh. Hãy dùng “Kiểm tra backup / archive” trước.');if(registry.cleanedAt)throw new Error(`Dữ liệu năm ${m.year} đã được dọn ngày ${formatDateTimeVN(registry.cleanedAt)||registry.cleanedAt}.`);let comparison=archiveCleanupGuard(report.state,m.year);if(!await confirmDialog({kicker:'Dọn dữ liệu đã lưu trữ',title:`Dọn ${comparison.currentPoints} điểm năm ${m.year}?`,message:'Archive đã khớp checksum và từng điểm QC.',detail:`File ${f.name} · SHA-256 ${m.checksum.slice(0,16)}… Dữ liệu Sigma, NCE và audit vẫn được giữ.`,confirmLabel:'Tiếp tục',cancelLabel:'Hủy'}))return;if(!await backupCurrentData('truoc-don-'+m.year))throw new Error('Không tạo được backup đầy đủ trước khi dọn. Dữ liệu chưa thay đổi.');if(!await confirmDialog({kicker:'Xác nhận lần cuối',title:'Xóa điểm QC khỏi dữ liệu đang vận hành',message:`${comparison.currentPoints} điểm năm ${m.year} sẽ chỉ còn trong archive đã xác minh.`,detail:'Thao tác được ghi audit và không tự xóa file archive.',confirmLabel:'Dọn dữ liệu',cancelLabel:'Hủy'}))return;comparison=archiveCleanupGuard(report.state,m.year);const removal=ArchiveService.removeYearPoints(state,m.year),oldRegistry={cleanedAt:registry.cleanedAt,cleanedBy:registry.cleanedBy,removedPoints:registry.removedPoints};registry.cleanedAt=new Date().toISOString();registry.cleanedBy=currentUser&&(currentUser.name||currentUser.username)||'';registry.removedPoints=removal.removed;const invariantErrors=QCCore.validateStateInvariants(state);if(invariantErrors.length){ArchiveService.restoreRemovedPoints(state,removal);Object.assign(registry,oldRegistry);throw new Error('Dữ liệu sau khi dọn không đạt invariant:\n'+invariantErrors.join('\n'));}logAct('Dọn dữ liệu archive năm',`${m.year}: xóa ${removal.removed} điểm khỏi state · SHA-256 ${m.checksum.slice(0,16)}…`,'Dữ liệu');save({testIds:removal.testIds});rerender();await infoDialog(`Đã dọn ${removal.removed} điểm QC năm ${m.year}. Archive và bằng chứng registry được giữ nguyên.`,{type:'success'});}catch(err){await infoDialog('Không thể dọn dữ liệu:\n'+(err&&err.message?err.message:'Lỗi không xác định.'));}finally{if(e&&e.target)e.target.value='';}}
async function checkStorageUsage(){const points=Object.values(state.data||{}).reduce((n,rows)=>n+(rows||[]).length,0);try{const estimate=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null;if(!estimate||!estimate.quota)throw new Error('Trình duyệt không cung cấp quota.');await infoDialog(`Điểm QC hiện tại: ${points}.\nĐã dùng: ${backupSizeMB(estimate.usage)} MB.\nHạn mức trình duyệt: ${backupSizeMB(estimate.quota)} MB.\nTỷ lệ sử dụng: ${(estimate.usage/estimate.quota*100).toFixed(1)}%.`,{type:estimate.usage/estimate.quota>=.8?'warn':'success'});}catch(e){await infoDialog(`Điểm QC hiện tại: ${points}. Trình duyệt không cung cấp thông tin dung lượng lưu trữ.`);}}
function viewRegisteredArchive(id){const r=(state.archiveRegistry||[]).find(x=>x.id===id);if(!r){infoDialog('Không tìm thấy metadata archive.');return;}const rows=(r.testCounts||[]).map(x=>`<tr><td>${esc(x.name||x.testId)}</td><td>${Number(x.points)||0}</td></tr>`).join('')||'<tr><td colspan="2">Không có thống kê theo xét nghiệm.</td></tr>',cleanup=r.cleanedAt?`<div class="alert ok">Đã dọn ${Number(r.removedPoints)||0} điểm khỏi dữ liệu vận hành: ${esc(formatDateTimeVN(r.cleanedAt)||r.cleanedAt)} · ${esc(r.cleanedBy||'—')}</div>`:'<div class="alert warn">Điểm QC của năm này chưa được ghi nhận là đã dọn khỏi dữ liệu vận hành.</div>';openDialogOverlay(`<div class="modal wide" aria-labelledby="archiveViewerTitle"><div class="modal-h"><div><h3 id="archiveViewerTitle">Archive năm ${esc(r.year)}</h3><div class="hint">Chỉ đọc · ${esc(r.filename||'Không có tên file')}</div></div>${modalCloseButton('closeDialogOverlay()')}</div><div class="modal-b" tabindex="0"><div class="stats"><div><b>${Number(r.points)||0}</b><span>Điểm QC</span></div><div><b>${Number(r.tests)||0}</b><span>Xét nghiệm</span></div><div><b>${backupSizeMB(r.sizeBytes)} MB</b><span>Dung lượng</span></div></div><div class="alert ok">SHA-256: <code>${esc(r.checksum)}</code><br>Đã xác minh: ${esc(formatDateTimeVN(r.verifiedAt)||r.verifiedAt||'—')} · ${esc(r.verifiedBy||'—')}<br>Khoảng ngày: ${esc(r.minDate||'—')} đến ${esc(r.maxDate||'—')}</div>${cleanup}<div class="table-wrap"><table><thead><tr><th>Xét nghiệm</th><th>Số điểm</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`);}

/* Nhắc backup theo thiết bị; Firebase ready được xem là đã có bản sao từ xa. */
var BACKUP_REMIND_DAYS=7;
function markBackupDone(bytes){try{localStorage.setItem('qclab_lastbackup',new Date().toISOString());if(Number(bytes)>0)localStorage.setItem('qclab_lastbackup_bytes',String(Number(bytes)));}catch(e){}}
function lastBackupInfo(){
  var raw=null;try{raw=localStorage.getItem('qclab_lastbackup');}catch(e){}
  if(!raw)return{never:true,days:Infinity};
  var t=new Date(raw).getTime();if(isNaN(t))return{never:true,days:Infinity};
  return{never:false,ts:t,days:Math.floor((Date.now()-t)/86400000)};
}
function backupStatusText(){
  if(typeof fb!=='undefined'&&fb&&fb.ready)return 'Đang đồng bộ đám mây (Firebase) — dữ liệu đã có bản sao từ xa.';
  var i=lastBackupInfo();
  if(i.never)return 'Chưa từng sao lưu trên máy này.';
  if(i.days<=0)return 'Sao lưu gần nhất: hôm nay.';
  return 'Sao lưu gần nhất: '+i.days+' ngày trước.';
}
function backupCapacityText(){var bytes=0;try{bytes=Number(localStorage.getItem('qclab_lastbackup_bytes')||0);}catch(e){}if(!bytes)return`Giới hạn phục hồi: ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`;return`Backup gần nhất: ${backupSizeMB(bytes)} MB / ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`+(backupSizeWarning(bytes)?' Dung lượng đang gần giới hạn.':'');}
function backupOverdue(){if(typeof fb!=='undefined'&&fb&&fb.ready)return false;return lastBackupInfo().days>=BACKUP_REMIND_DAYS;}
function updateBackupBanner(){
  var dot=document.getElementById('backupDot');if(!dot)return;
  if(typeof currentUser==='undefined'||!currentUser||!backupOverdue()){dot.hidden=true;return;}
  var i=lastBackupInfo();dot.hidden=false;dot.className='backup-dot'+(i.never?' crit':'');
  dot.textContent=i.never?'Chưa sao lưu':'Sao lưu: '+i.days+' ngày';
  dot.title=(i.never?'Bạn chưa sao lưu dữ liệu trên máy này.':('Đã '+i.days+' ngày chưa sao lưu dữ liệu.'))+' Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.';
}
