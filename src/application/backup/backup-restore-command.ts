export type BackupRestoreCommand=Readonly<{restore:(input:{incoming:any;fileName:string;oldActivity:any[]})=>Promise<void>}>;

export function createBackupRestoreCommand(deps:{current:()=>any;replace:(state:any)=>void;normalize:()=>void;invariantErrors:()=>string[];clearSigmaDraft:()=>void;ensureAdmin:()=>unknown;setActivity:(activity:any[])=>void;logImported:(fileName:string)=>void;save:()=>void;render:()=>void}):BackupRestoreCommand{
  const restore=async(input:{incoming:any;fileName:string;oldActivity:any[]})=>{const previous=deps.current();deps.replace(input.incoming);deps.normalize();const errors=deps.invariantErrors();if(errors.length){deps.replace(previous);throw new Error('Backup sau hoàn thiện cấu trúc không đạt kiểm tra dữ liệu:\n'+errors.join('\n'));}deps.clearSigmaDraft();if(!deps.current().users.length)await deps.ensureAdmin();const imported=(deps.current().activity||[]).map((entry:any)=>{const{hash,prevHash,...rest}=entry;return{...rest,seq:0};});deps.setActivity([...input.oldActivity,...imported]);deps.logImported(input.fileName);deps.save();deps.render();};
  return Object.freeze({restore});
}
