/* ===== BACKUP / RESTORE UI ===== */
async function confirmOversizedBackup(size,{title,detail}){
  const dialog=globalThis.backupSizeConfirmation({bytes:size,title,detail});
  return dialog?await confirmDialog(dialog):true;
}
async function exportData(){const result=await globalThis.BackupExportCommand.exportFull(globalThis.backupFileName(isoToday()),globalThis.backupOversizeConfirmation.exportFull());if(result.status==='create-error'){await infoDialog(globalThis.backupExportMessage.createError(result.error));return;}if(result.status==='download-error')await infoDialog(globalThis.backupExportMessage.downloadError);}
function downloadBackupText(name,json){try{globalThis.blobDownload(name,new Blob([json],{type:'application/json'}));return true;}catch(e){return false;}}
async function backupCurrentData(prefix='before-change'){return globalThis.BackupExportCommand.snapshot(globalThis.backupSnapshotFileName(prefix));}
async function importData(e){
  if(!requireAdmin('Chỉ quản trị mới được nhập backup.')){if(e&&e.target)e.target.value='';return;}
  const f=e.target.files[0];if(!f)return;try{
    const result=await globalThis.BackupImportCommand.importFile({fileName:f.name,size:f.size,text:await f.text(),oldActivity:[...(state.activity||[])],confirmOversized:()=>confirmOversizedBackup(f.size,globalThis.backupOversizeConfirmation.importFile(f.name)),confirmImport:input=>confirmDialog(globalThis.backupImportConfirmation(input)),reauthenticate:()=>reauthenticateCurrentUser({title:'Xác thực nhập backup',message:'Nhập lại mật khẩu trước khi thay thế dữ liệu nghiệp vụ hiện tại.'}),snapshotFailureMessage:globalThis.backupImportMessage.preImportSnapshotFailure});
    if(result.status==='imported')await infoDialog(globalThis.backupImportMessage.success,{type:'success'});
  }catch(err){await infoDialog(globalThis.backupImportMessage.invalid(err));}finally{if(e&&e.target)e.target.value='';}
}
async function verifyBackupFile(e){if(!requireAdmin('Chỉ quản trị mới được kiểm tra file backup.')){if(e&&e.target)e.target.value='';return;}const f=e&&e.target&&e.target.files&&e.target.files[0];if(!f)return;try{const result=await globalThis.BackupInspectionCommand.inspectFile({text:await f.text(),size:f.size,confirmOversized:()=>confirmOversizedBackup(f.size,globalThis.backupOversizeConfirmation.inspectFile(f.name))});if(result.status==='inspected')await infoDialog(globalThis.backupInspectionSummary(result.report),{type:'success'});}catch(err){await infoDialog(globalThis.backupInspectionMessage.invalid(err));}finally{if(e&&e.target)e.target.value='';}}

/* Nhắc backup theo thiết bị; Firebase ready được xem là đã có bản sao từ xa. */
var BACKUP_REMIND_DAYS=7;
function markBackupDone(bytes){globalThis.backupLocalMarker.mark(bytes);}
function backupStatusText(){return globalThis.BackupStatusCommand.status(typeof fb!=='undefined'&&fb&&fb.ready);}
function backupCapacityText(){return globalThis.BackupStatusCommand.capacity();}
function backupOverdue(){return globalThis.BackupStatusCommand.overdue(typeof fb!=='undefined'&&fb&&fb.ready,BACKUP_REMIND_DAYS);}
function updateBackupBanner(){
  var dot=document.getElementById('backupDot');if(!dot)return;
  var model=globalThis.BackupStatusCommand.banner({cloudReady:typeof fb!=='undefined'&&fb&&fb.ready,user:typeof currentUser==='undefined'?null:currentUser,days:BACKUP_REMIND_DAYS});dot.hidden=model.hidden;if(!model.hidden){dot.className=model.className;dot.textContent=model.text;dot.title=model.title;}
}
