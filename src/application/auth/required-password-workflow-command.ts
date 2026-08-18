type Value=Record<string,any>;
type RequiredPasswordCommand={complete:(input:any)=>Promise<Value>};
export type RequiredPasswordWorkflowCommand=Readonly<{complete:(input:{user:Value|undefined;password:string;confirmation:string;cloud:boolean})=>Promise<Value>}>;
export function createRequiredPasswordWorkflowCommand(deps:{command:RequiredPasswordCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void}):RequiredPasswordWorkflowCommand{
  const complete=async(input:{user:Value|undefined;password:string;confirmation:string;cloud:boolean})=>{
    const result=await deps.command.complete(input);
    if(result.status==='updated'){
      deps.log('Đổi mật khẩu','Người dùng cập nhật mật khẩu','Tài khoản');
      deps.saveState({cloud:input.cloud,clearDerived:false});
    }
    return result;
  };
  return Object.freeze({complete});
}
