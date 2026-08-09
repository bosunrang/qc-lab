/* ===== BACKUP / RESTORE UI ===== */
async function confirmOversizedBackup(size,{title,detail}){
  const error=backupImportSizeError(size);
  if(!error)return true;
  return await confirmDialog({kicker:'Vượt giới hạn khuyến nghị',title,message:`${error} Dung lượng thực tế ${backupSizeMB(size)} MB.`,detail,confirmLabel:'Vẫn tiếp tục',cancelLabel:'Hủy'});
}
async function exportData(){logAct('Xuất backup','Xuất toàn bộ dữ liệu JSON có checksum','Dữ liệu');save({clearDerived:false});let pack;try{pack=await createBackupPackage(state);}catch(e){await infoDialog('Không tạo được file backup:\n'+(e&&e.message?e.message:'Lỗi không xác định.'));return;}if(!await confirmOversizedBackup(pack.bytes,{title:'Vẫn xuất backup đầy đủ?',detail:'File vẫn nhập lại được và app sẽ hỏi xác nhận khi nhập. Nên lưu ít nhất hai bản trên hai thiết bị hoặc vị trí khác nhau.'}))return;const warning=backupImportSizeError(pack.bytes)?'':backupSizeWarning(pack.bytes);if(warning&&!await confirmDialog({kicker:'Dung lượng backup lớn',title:'Vẫn xuất backup?',message:warning,detail:'File hiện tại vẫn nhập được, nhưng dung lượng dự phòng còn ít.',confirmLabel:'Xuất backup',cancelLabel:'Hủy'}))return;const ok=downloadBackupText('qclab-backup-'+vnDate(isoToday()).replaceAll('/','-')+'.json',pack.text);if(!ok){await infoDialog('Không tạo được file backup. Dữ liệu chưa được xem là đã sao lưu.');return;}markBackupDone(pack.bytes);updateBackupBanner();}
function downloadBackupText(name,json){try{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}catch(e){return false;}}
async function backupCurrentData(prefix='before-change'){
  const stamp=new Date().toISOString().replace(/[T:]/g,'-').replace(/\.\d{3}Z$/,'Z');
  let pack;try{pack=await createBackupPackage(state);}catch(e){return false;}
  const ok=downloadBackupText(`qclab-${prefix}-${stamp}.json`,pack.text);
  if(ok){markBackupDone(pack.bytes);updateBackupBanner();}
  return ok;
}
async function importData(e){
  if(!requireAdmin('Chỉ quản trị mới được nhập backup.')){if(e&&e.target)e.target.value='';return;}
  const f=e.target.files[0];if(!f)return;try{if(!await confirmOversizedBackup(f.size,{title:'Vẫn đọc file backup này?',detail:`File "${f.name}" lớn hơn khuyến nghị nên có thể mất vài giây để đọc và kiểm tra. Nếu đây đúng là backup do app xuất ra thì cứ tiếp tục.`}))return;
    const sizeWarning=backupSizeWarning(f.size),oldActivity=[...(state.activity||[])],incoming=await prepareBackupImport(await f.text());
    if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Nhập backup',message:`Nhập backup "${f.name}"?`,detail:'Dữ liệu nghiệp vụ hiện tại sẽ được thay thế; nhật ký cũ được giữ lại.'+(sizeWarning?' '+sizeWarning:''),confirmLabel:'Nhập backup',cancelLabel:'Hủy'}))return;
    if(!await reauthenticateCurrentUser({title:'Xác thực nhập backup',message:'Nhập lại mật khẩu trước khi thay thế dữ liệu nghiệp vụ hiện tại.'}))return;
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
async function verifyBackupFile(e){if(!requireAdmin('Chỉ quản trị mới được kiểm tra file backup.')){if(e&&e.target)e.target.value='';return;}const f=e&&e.target&&e.target.files&&e.target.files[0];if(!f)return;try{if(!await confirmOversizedBackup(f.size,{title:'Vẫn kiểm tra file này?',detail:`File "${f.name}" lớn hơn khuyến nghị nên việc tính checksum có thể mất vài giây. Thao tác này không đụng tới dữ liệu QC.`}))return;const report=await inspectBackupText(await f.text(),f.size),m=report.meta,s=report.summary,type=m.type==='legacy'?'Backup JSON cũ':'Backup đầy đủ',checksum=m.checksumStatus==='verified'?'SHA-256 hợp lệ':m.checksumStatus==='legacy'?'File cũ chưa có checksum':'Không có checksum';await infoDialog(`${type} hợp lệ.\n${checksum}.\nDung lượng: ${backupSizeMB(report.size)} MB.\nĐiểm QC: ${s.points||0}; xét nghiệm cấu hình: ${s.configuredTests||0}.\nKhoảng ngày: ${s.minDate||'—'} đến ${s.maxDate||'—'}.`,{type:'success'});}catch(err){await infoDialog('File không đạt kiểm tra:\n'+(err&&err.message?err.message:'File không hợp lệ.'));}finally{if(e&&e.target)e.target.value='';}}

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
  if(typeof fb!=='undefined'&&fb&&fb.ready)return 'Đang đồng bộ đám mây — đã có bản sao từ xa.';
  var i=lastBackupInfo();
  if(i.never)return 'Chưa sao lưu trên máy này.';
  if(i.days<=0)return 'Sao lưu gần nhất: hôm nay.';
  return 'Sao lưu gần nhất: '+i.days+' ngày trước.';
}
function backupCapacityText(){var bytes=0;try{bytes=Number(localStorage.getItem('qclab_lastbackup_bytes')||0);}catch(e){}if(!bytes)return`Khuyến nghị dưới ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`;return`Backup gần nhất ${backupSizeMB(bytes)} MB (khuyến nghị dưới ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB).`+(backupSizeWarning(bytes)?' Gần mức khuyến nghị.':'');}
function backupOverdue(){if(typeof fb!=='undefined'&&fb&&fb.ready)return false;return lastBackupInfo().days>=BACKUP_REMIND_DAYS;}
function updateBackupBanner(){
  var dot=document.getElementById('backupDot');if(!dot)return;
  if(typeof currentUser==='undefined'||!currentUser||!backupOverdue()){dot.hidden=true;return;}
  var i=lastBackupInfo();dot.hidden=false;dot.className='backup-dot'+(i.never?' crit':'');
  dot.textContent=i.never?'Chưa sao lưu':'Sao lưu: '+i.days+' ngày';
  dot.title=(i.never?'Bạn chưa sao lưu dữ liệu trên máy này.':('Đã '+i.days+' ngày chưa sao lưu dữ liệu.'))+' Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.';
}
