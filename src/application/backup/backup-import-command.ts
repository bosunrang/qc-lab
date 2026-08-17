export type BackupImportCommand=Readonly<{importFile:(input:{fileName:string;size:number;text:string;oldActivity:any[];confirmOversized:()=>Promise<boolean>;confirmImport:(input:{name:string;sizeWarning:string})=>Promise<boolean>;reauthenticate:()=>Promise<boolean>;snapshotFailureMessage:string})=>Promise<{status:'imported'|'cancelled'}>}>;

type BackupImportDeps={prepare:(text:string)=>Promise<any>;sizeWarning:(bytes:number)=>string;snapshot:(prefix:string)=>Promise<boolean>;restore:(input:{incoming:any;fileName:string;oldActivity:any[]})=>Promise<void>};

export function createBackupImportCommand(deps:BackupImportDeps):BackupImportCommand{
  const importFile=async(input:{fileName:string;size:number;text:string;oldActivity:any[];confirmOversized:()=>Promise<boolean>;confirmImport:(input:{name:string;sizeWarning:string})=>Promise<boolean>;reauthenticate:()=>Promise<boolean>;snapshotFailureMessage:string})=>{
    if(!await input.confirmOversized())return{status:'cancelled'} as const;
    const incoming=await deps.prepare(input.text),sizeWarning=deps.sizeWarning(input.size);
    if(!await input.confirmImport({name:input.fileName,sizeWarning}))return{status:'cancelled'} as const;
    if(!await input.reauthenticate())return{status:'cancelled'} as const;
    if(!await deps.snapshot('truoc-nhap'))throw new Error(input.snapshotFailureMessage);
    await deps.restore({incoming,fileName:input.fileName,oldActivity:input.oldActivity});
    return{status:'imported'} as const;
  };
  return Object.freeze({importFile});
}
