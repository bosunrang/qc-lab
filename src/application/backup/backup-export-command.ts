type BackupPackage={text:string;bytes:number};
type BackupExportDeps={current:()=>Record<string,any>;log:()=>void;save:()=>void;create:(state:Record<string,any>)=>Promise<BackupPackage>;confirmOversized:(bytes:number,detail:any)=>Promise<boolean>;warning:(bytes:number)=>any;confirm:(dialog:any)=>Promise<boolean>;download:(name:string,text:string)=>boolean;mark:(bytes:number)=>void;update:()=>void;};
type BackupExportResult={status:'done'|'cancelled'|'create-error'|'download-error';error?:unknown};
export type BackupExportCommand=Readonly<{exportFull:(name:string,oversizeDetail:any)=>Promise<BackupExportResult>;snapshot:(prefix:string)=>Promise<boolean>}>;

export function createBackupExportCommand(deps:BackupExportDeps):BackupExportCommand{
  const snapshot=async(prefix:string)=>{let pack:BackupPackage;try{pack=await deps.create(deps.current());}catch(error){return false;}const ok=deps.download(prefix,pack.text);if(ok){deps.mark(pack.bytes);deps.update();}return ok;};
  const exportFull=async(name:string,oversizeDetail:any)=>{deps.log();deps.save();let pack:BackupPackage;try{pack=await deps.create(deps.current());}catch(error){return {status:'create-error',error} as const;}if(!await deps.confirmOversized(pack.bytes,oversizeDetail))return {status:'cancelled'} as const;const dialog=deps.warning(pack.bytes);if(dialog&&!await deps.confirm(dialog))return {status:'cancelled'} as const;if(!deps.download(name,pack.text))return {status:'download-error'} as const;deps.mark(pack.bytes);deps.update();return {status:'done'} as const;};
  return Object.freeze({exportFull,snapshot});
}
