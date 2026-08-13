export function createBackupSnapshotFileName(now:()=>string){return(prefix:string)=>`qclab-${prefix}-${now().replace(/[T:]/g,'-').replace(/\.\d{3}Z$/,'Z')}.json`;}
