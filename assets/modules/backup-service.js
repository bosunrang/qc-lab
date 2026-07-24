/* ===== BACKUP / RESTORE SERVICE ===== */
const BACKUP_IMPORT_MAX_BYTES=64*1024*1024;
function validateBackup(x){return QCCore.validateBackup(x);}
function serializeBackupData(value){return JSON.stringify(value,null,2);}
function backupImportSizeError(size){return Number(size)>BACKUP_IMPORT_MAX_BYTES?`File backup vượt quá giới hạn ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`:'';}
function prepareBackupImport(text){
  const incoming=JSON.parse(String(text)),errors=validateBackup(incoming);if(errors.length)throw new Error(errors.join('\n'));
  const next=QCCore.sanitizeBackup(incoming,{owned:true}),invariantErrors=QCCore.validateStateInvariants(next,{sanitized:true});
  if(invariantErrors.length)throw new Error('Backup sau chuẩn hóa không đạt kiểm tra dữ liệu:\n'+invariantErrors.join('\n'));
  return next;
}
async function exportData(){logAct('Xuất backup','Xuất toàn bộ dữ liệu JSON','Dữ liệu');save({clearDerived:false});const ok=downloadJsonFile('qclab-backup-'+vnDate(isoToday()).replaceAll('/','-')+'.json',state);if(!ok){await infoDialog('Không tạo được file backup. Dữ liệu chưa được xem là đã sao lưu.');return;}markBackupDone();updateBackupBanner();}
function downloadJsonFile(name,value){
  let json;try{json=serializeBackupData(value);}catch(e){return false;}
  try{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}catch(e){return false;}
}
function backupCurrentData(prefix='before-change'){
  const stamp=new Date().toISOString().replace(/[T:]/g,'-').replace(/\.\d{3}Z$/,'Z');
  const ok=downloadJsonFile(`qclab-${prefix}-${stamp}.json`,state);
  if(ok){markBackupDone();updateBackupBanner();}
  return ok;
}
async function importData(e){
  if(!requireAdmin('Chỉ quản trị mới được nhập backup.')){if(e&&e.target)e.target.value='';return;}
  const f=e.target.files[0];if(!f)return;const sizeError=backupImportSizeError(f.size);if(sizeError){await infoDialog(sizeError);e.target.value='';return;}
  const oldActivity=[...(state.activity||[])],fr=new FileReader();
  fr.onload=async()=>{try{
    const incoming=prepareBackupImport(fr.result);
    if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Nhập backup',message:`Nhập backup "${f.name}"?`,detail:'Dữ liệu nghiệp vụ hiện tại sẽ được thay thế; nhật ký cũ được giữ lại.',confirmLabel:'Nhập backup',cancelLabel:'Hủy'}))return;
    if(!backupCurrentData('truoc-nhap'))throw new Error('Không tạo được bản backup an toàn trước khi nhập. Dữ liệu hiện tại chưa bị thay thế.');
    const previousState=state;
    state=incoming;ensureShape({sanitized:true});
    const invariantErrors=QCCore.validateStateInvariants(state,{sanitized:true});if(invariantErrors.length){state=previousState;throw new Error('Backup sau hoàn thiện cấu trúc không đạt kiểm tra dữ liệu:\n'+invariantErrors.join('\n'));}
    if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);
    if(!state.users.length)await ensureAdmin();
    const importedActivity=(state.activity||[]).map(a=>{const{hash,prevHash,...rest}=a;return{...rest,seq:0};});
    state.activity=[...oldActivity,...importedActivity];
    logAct('Nhập backup','Nhập dữ liệu đã kiểm tra từ file '+f.name,'Dữ liệu');
    save();rerender();await infoDialog('Đã nhập và kiểm tra backup.',{type:'success'});
  }catch(err){await infoDialog('Không thể nhập backup:\n'+(err&&err.message?err.message:'File không hợp lệ.'));}finally{if(e&&e.target)e.target.value='';}};
  fr.onerror=async()=>{await infoDialog('Không đọc được file backup.');if(e&&e.target)e.target.value='';};fr.readAsText(f);
}

/* Nhắc backup theo thiết bị; Firebase ready được xem là đã có bản sao từ xa. */
var BACKUP_REMIND_DAYS=7;
function markBackupDone(){try{localStorage.setItem('qclab_lastbackup',new Date().toISOString());}catch(e){}}
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
function backupOverdue(){if(typeof fb!=='undefined'&&fb&&fb.ready)return false;return lastBackupInfo().days>=BACKUP_REMIND_DAYS;}
function updateBackupBanner(){
  var dot=document.getElementById('backupDot');if(!dot)return;
  if(typeof currentUser==='undefined'||!currentUser||!backupOverdue()){dot.hidden=true;return;}
  var i=lastBackupInfo();dot.hidden=false;dot.className='backup-dot'+(i.never?' crit':'');
  dot.textContent=i.never?'Chưa sao lưu':'Sao lưu: '+i.days+' ngày';
  dot.title=(i.never?'Bạn chưa sao lưu dữ liệu trên máy này.':('Đã '+i.days+' ngày chưa sao lưu dữ liệu.'))+' Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.';
}
