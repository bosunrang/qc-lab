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
/* DUNG LƯỢNG LÀ CẢNH BÁO, KHÔNG PHẢI RÀO CHẶN (2026-08-01).
   Trước đây BACKUP_IMPORT_MAX_BYTES chặn cứng cả ba đường và khóa phòng xét nghiệm lại:
   exportData() từ chối xuất, backupCurrentData() trả false, mà importData() lẫn
   resetAllData() đều hủy khi backup an toàn thất bại -> quá 128 MB thì không xuất được,
   không nhập được, không reset được, đúng lúc cần backup nhất. Lời khuyên kèm theo còn
   trỏ sang nút dọn dữ liệu đã bị gỡ khỏi UI, thành ngõ cụt hoàn toàn.
   Trần này vốn chỉ để chặn chọn nhầm file khổng lồ, không phải giới hạn kỹ thuật: đo
   được json_parse_state 447ms ở 78 MB, nên 128 MB không có gì nguy hiểm để phải cấm.
   Nguyên tắc mới: một file backup quá cỡ luôn tốt hơn KHÔNG có file nào, nên mọi đường
   ghi ra file chỉ hỏi xác nhận; mọi đường đọc vào cũng chỉ hỏi xác nhận để file vừa xuất
   chắc chắn nhập lại được. backupImportSizeError() vẫn giữ nguyên chữ ký/thông điệp vì
   nó là nguồn text cho các hộp thoại đó. */
async function confirmOversizedBackup(size,{title,detail}){
  const error=backupImportSizeError(size);
  if(!error)return true;
  return await confirmDialog({kicker:'Vượt giới hạn khuyến nghị',title,message:`${error} Dung lượng thực tế ${backupSizeMB(size)} MB.`,detail,confirmLabel:'Vẫn tiếp tục',cancelLabel:'Hủy'});
}
async function backupChecksum(text){
  if(typeof crypto!=='undefined'&&crypto.subtle&&typeof TextEncoder!=='undefined'){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));return[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  if(typeof auditSha256==='function'&&backupTextBytes(text)<=16*1024*1024)return auditSha256(String(text));
  return'';
}
async function createBackupPackage(value){
  const payload=serializeBackupData(value),checksum=await backupChecksum(payload),header={format:'qclab-backup',formatVersion:1,type:'full',createdAt:new Date().toISOString(),appVersion:typeof window!=='undefined'&&window.QCLAB_APP?window.QCLAB_APP.version||'':'',schemaVersion:Number(value&&value.schemaVersion||QCCore.STATE_SCHEMA_VERSION),checksum};
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
/* CHẶN FILE ARCHIVE THEO NĂM — không phải code chết. Chức năng lưu trữ theo năm đã bị gỡ
   (2026-08-01, chưa từng phát hành), nhưng các máy đã chạy thử vẫn còn file
   `qclab-archive-YYYY.json` trong thư mục tải về. Nhập nhầm một file như vậy sẽ thay state
   bằng lát dữ liệu của ĐÚNG MỘT NĂM, tức xóa trắng mọi năm khác mà không có gì báo. Giữ
   rào này lại cho tới khi chắc chắn không còn file nào ngoài kia. */
async function prepareBackupImport(text){const parsed=await parseBackupPackage(text);if(parsed.meta.type==='year-archive')throw new Error('File này là archive theo năm của bản thử nghiệm cũ, không phải backup đầy đủ — nhập vào sẽ mất dữ liệu các năm khác.');return prepareBackupState(parsed.incoming);}
function backupSummary(next){let points=0,minDate='',maxDate='';Object.values(next&&next.data||{}).forEach(rows=>(rows||[]).forEach(p=>{const date=String(p&&p.date||'');points++;if(date&&(!minDate||date<minDate))minDate=date;if(date&&(!maxDate||date>maxDate))maxDate=date;}));return{points,minDate,maxDate,configuredTests:(next&&next.tests||[]).length};}
async function inspectBackupText(text,size=0){const parsed=await parseBackupPackage(text);if(parsed.meta.type==='year-archive')throw new Error('File này là archive theo năm của bản thử nghiệm cũ, không phải backup đầy đủ và không còn được hỗ trợ.');const next=prepareBackupState(parsed.incoming);return{meta:parsed.meta,summary:backupSummary(next),state:next,size:Number(size)||backupTextBytes(text)};}
async function exportData(){logAct('Xuất backup','Xuất toàn bộ dữ liệu JSON có checksum','Dữ liệu');save({clearDerived:false});let pack;try{pack=await createBackupPackage(state);}catch(e){await infoDialog('Không tạo được file backup:\n'+(e&&e.message?e.message:'Lỗi không xác định.'));return;}if(!await confirmOversizedBackup(pack.bytes,{title:'Vẫn xuất backup đầy đủ?',detail:'File vẫn nhập lại được và app sẽ hỏi xác nhận khi nhập. Nên lưu ít nhất hai bản trên hai thiết bị hoặc vị trí khác nhau.'}))return;const warning=backupImportSizeError(pack.bytes)?'':backupSizeWarning(pack.bytes);/* quá trần đã hỏi ở trên rồi, đừng hỏi tiếp lần hai cùng một chuyện */if(warning&&!await confirmDialog({kicker:'Dung lượng backup lớn',title:'Vẫn xuất backup?',message:warning,detail:'File hiện tại vẫn nhập được, nhưng dung lượng dự phòng còn ít.',confirmLabel:'Xuất backup',cancelLabel:'Hủy'}))return;const ok=downloadBackupText('qclab-backup-'+vnDate(isoToday()).replaceAll('/','-')+'.json',pack.text);if(!ok){await infoDialog('Không tạo được file backup. Dữ liệu chưa được xem là đã sao lưu.');return;}markBackupDone(pack.bytes);updateBackupBanner();}
function downloadBackupText(name,json){try{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}catch(e){return false;}}
async function backupCurrentData(prefix='before-change'){
  const stamp=new Date().toISOString().replace(/[T:]/g,'-').replace(/\.\d{3}Z$/,'Z');
  /* KHÔNG có rào dung lượng ở đây. Đây là bản backup an toàn chạy TRƯỚC nhập backup và
     trước xóa sạch dữ liệu; cả hai đường đó hủy thao tác khi hàm này trả false. Chặn theo
     dung lượng nghĩa là dữ liệu càng lớn thì càng không nhập/không reset được — vòng khóa
     mà chính nó gây ra. Chỉ thất bại khi thật sự không tạo nổi file. */
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
/* requireAdmin dù trang Cài đặt đã admin-only (PERM.settings): mọi hàm khác trong panel
   Quản trị dữ liệu đều có guard riêng, để sót một hàm trần ở đây nghĩa là nếu PERM đổi
   sau này thì chỗ này thủng im lặng. Hàm CHỈ ĐỌC: không chạm state, không ghi audit. */
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
  if(typeof fb!=='undefined'&&fb&&fb.ready)return 'Đang đồng bộ đám mây (Firebase) — dữ liệu đã có bản sao từ xa.';
  var i=lastBackupInfo();
  if(i.never)return 'Chưa từng sao lưu trên máy này.';
  if(i.days<=0)return 'Sao lưu gần nhất: hôm nay.';
  return 'Sao lưu gần nhất: '+i.days+' ngày trước.';
}
function backupCapacityText(){var bytes=0;try{bytes=Number(localStorage.getItem('qclab_lastbackup_bytes')||0);}catch(e){}if(!bytes)return`Dung lượng khuyến nghị: dưới ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`;return`Backup gần nhất: ${backupSizeMB(bytes)} MB / khuyến nghị ${BACKUP_IMPORT_MAX_BYTES/1024/1024} MB.`+(backupSizeWarning(bytes)?' Dung lượng đang gần mức khuyến nghị.':'');}
function backupOverdue(){if(typeof fb!=='undefined'&&fb&&fb.ready)return false;return lastBackupInfo().days>=BACKUP_REMIND_DAYS;}
function updateBackupBanner(){
  var dot=document.getElementById('backupDot');if(!dot)return;
  if(typeof currentUser==='undefined'||!currentUser||!backupOverdue()){dot.hidden=true;return;}
  var i=lastBackupInfo();dot.hidden=false;dot.className='backup-dot'+(i.never?' crit':'');
  dot.textContent=i.never?'Chưa sao lưu':'Sao lưu: '+i.days+' ngày';
  dot.title=(i.never?'Bạn chưa sao lưu dữ liệu trên máy này.':('Đã '+i.days+' ngày chưa sao lưu dữ liệu.'))+' Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.';
}
