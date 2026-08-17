'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','backup-ui.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const names=['backupLocalMarker','backupInspectionSummary','backupInspectionMessage','backupFileName','backupSnapshotFileName','backupSizeConfirmation','backupExportMessage','backupImportConfirmation','backupImportMessage','backupOversizeConfirmation','BackupImportCommand','BackupInspectionCommand','BackupStatusCommand'];
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Backup UI bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(route,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the Backup UI`);
}

console.log('Backup UI TypeScript bridge tests passed');
