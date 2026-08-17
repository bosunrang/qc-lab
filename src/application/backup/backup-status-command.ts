export type BackupStatusCommand=Readonly<{status:(cloudReady:boolean)=>string;capacity:()=>string;overdue:(cloudReady:boolean,days:number)=>boolean;banner:(input:{cloudReady:boolean;user:any;days:number})=>any}>;

export function createBackupStatusCommand(deps:{reminder:{lastBackupInfo:(raw:string|null)=>any;statusText:(cloudReady:boolean,info:any)=>string;capacityText:(bytes:number,maxBytes:number,size:(bytes:number)=>string,warning:(bytes:number)=>string)=>string;overdue:(cloudReady:boolean,info:any,days:number)=>boolean;banner:(cloudReady:boolean,user:any,info:any,days:number)=>any};marker:{lastRaw:()=>string|null;bytes:()=>number};maxBytes:number;size:(bytes:number)=>string;warning:(bytes:number)=>string}):BackupStatusCommand{
  const info=()=>deps.reminder.lastBackupInfo(deps.marker.lastRaw());
  return Object.freeze({status:cloudReady=>deps.reminder.statusText(cloudReady,info()),capacity:()=>deps.reminder.capacityText(deps.marker.bytes(),deps.maxBytes,deps.size,deps.warning),overdue:(cloudReady,days)=>deps.reminder.overdue(cloudReady,info(),days),banner:input=>deps.reminder.banner(input.cloudReady,input.user,info(),input.days)});
}
