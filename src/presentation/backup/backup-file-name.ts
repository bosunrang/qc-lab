export function createBackupFileName(formatDate:(value:any)=>string){return(value:any)=>'qclab-backup-'+formatDate(value).replace(/\//g,'-')+'.json';}
