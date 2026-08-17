export type BackupInspectionCommand=Readonly<{inspectFile:(input:{text:string;size:number;confirmOversized:()=>Promise<boolean>})=>Promise<{status:'inspected';report:any}|{status:'cancelled'}>}>;

export function createBackupInspectionCommand(deps:{inspect:(text:string,bytes?:number)=>Promise<any>}):BackupInspectionCommand{
  const inspectFile=async(input:{text:string;size:number;confirmOversized:()=>Promise<boolean>})=>{
    if(!await input.confirmOversized())return{status:'cancelled'} as const;
    return{status:'inspected',report:await deps.inspect(input.text,input.size)} as const;
  };
  return Object.freeze({inspectFile});
}
