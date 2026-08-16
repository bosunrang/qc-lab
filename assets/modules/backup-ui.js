/* ===== BACKUP / RESTORE UI ===== */
async function confirmOversizedBackup(size,{title,detail}){
  const dialog=globalThis.backupSizeConfirmation({bytes:size,title,detail});
  return dialog?await confirmDialog(dialog):true;
}
async function exportData(){const result=await globalThis.BackupExportCommand.exportFull(globalThis.backupFileName(isoToday()),globalThis.backupOversizeConfirmation.exportFull(),bytes=>backupImportSizeError(bytes)?null:globalThis.backupSizeWarningConfirmation({bytes}));if(result.status==='create-error'){await infoDialog(globalThis.backupExportMessage.createError(result.error));return;}if(result.status==='download-error')await infoDialog(globalThis.backupExportMessage.downloadError);}
function downloadBackupText(name,json){try{if(globalThis.blobDownload){globalThis.blobDownload(name,new Blob([json],{type:'application/json'}));return true;}return false;}catch(e){return false;}}
async function backupCurrentData(prefix='before-change'){return globalThis.BackupExportCommand.snapshot(globalThis.backupSnapshotFileName(prefix));}
async function importData(e){
  if(!requireAdmin('Chỉ quản trị mới được nhập backup.')){if(e&&e.target)e.target.value='';return;}
  const f=e.target.files[0];if(!f)return;try{if(!await confirmOversizedBackup(f.size,globalThis.backupOversizeConfirmation.importFile(f.name)))return;
    const sizeWarning=backupSizeWarning(f.size),oldActivity=[...(state.activity||[])],incoming=await prepareBackupImport(await f.text());
    if(!await confirmDialog(globalThis.backupImportConfirmation({name:f.name,sizeWarning})))return;
    if(!await reauthenticateCurrentUser({title:'Xác thực nhập backup',message:'Nhập lại mật khẩu trước khi thay thế dữ liệu nghiệp vụ hiện tại.'}))return;
    if(!await backupCurrentData('truoc-nhap'))throw new Error(globalThis.backupImportMessage.preImportSnapshotFailure);
    await globalThis.BackupRestoreCommand.restore({incoming,fileName:f.name,oldActivity});await infoDialog(globalThis.backupImportMessage.success,{type:'success'});
  }catch(err){await infoDialog(globalThis.backupImportMessage.invalid(err));}finally{if(e&&e.target)e.target.value='';}
}
async function verifyBackupFile(e){if(!requireAdmin('Chỉ quản trị mới được kiểm tra file backup.')){if(e&&e.target)e.target.value='';return;}const f=e&&e.target&&e.target.files&&e.target.files[0];if(!f)return;try{if(!await confirmOversizedBackup(f.size,globalThis.backupOversizeConfirmation.inspectFile(f.name)))return;const report=await inspectBackupText(await f.text(),f.size);await infoDialog(globalThis.backupInspectionSummary(report),{type:'success'});}catch(err){await infoDialog(globalThis.backupInspectionMessage.invalid(err));}finally{if(e&&e.target)e.target.value='';}}

/* Nhắc backup theo thiết bị; Firebase ready được xem là đã có bản sao từ xa. */
var BACKUP_REMIND_DAYS=7;
function markBackupDone(bytes){globalThis.backupLocalMarker.mark(bytes);}
function lastBackupInfo(){
  return globalThis.backupReminderService.lastBackupInfo(globalThis.backupLocalMarker.lastRaw());
}
function backupStatusText(){
  var i=lastBackupInfo();
  return globalThis.backupReminderService.statusText(typeof fb!=='undefined'&&fb&&fb.ready,i);
}
function backupCapacityText(){var bytes=globalThis.backupLocalMarker.bytes();return globalThis.backupReminderService.capacityText(bytes,BACKUP_IMPORT_MAX_BYTES,backupSizeMB,backupSizeWarning);}
function backupOverdue(){var i=lastBackupInfo();return globalThis.backupReminderService.overdue(typeof fb!=='undefined'&&fb&&fb.ready,i,BACKUP_REMIND_DAYS);}
function updateBackupBanner(){
  var dot=document.getElementById('backupDot');if(!dot)return;
  var model=globalThis.backupReminderService.banner(typeof fb!=='undefined'&&fb&&fb.ready,typeof currentUser==='undefined'?null:currentUser,lastBackupInfo(),BACKUP_REMIND_DAYS);dot.hidden=model.hidden;if(!model.hidden){dot.className=model.className;dot.textContent=model.text;dot.title=model.title;}
}
