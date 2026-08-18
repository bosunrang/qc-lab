type Value=Record<string,any>;
type LotCommand={preview:(input:any)=>Value;execute:(input:any)=>Value;checkRemoval:(input:any)=>Value;remove:(input:any)=>Value};
export type ManageLotWorkflowCommand=Readonly<{preview:(input:{id?:string;data:Value})=>Value;execute:(input:{id?:string;newId:string;data:Value})=>Value;checkRemoval:(input:{id:string})=>Value;remove:(input:{id:string})=>Value}>;
export function createManageLotWorkflowCommand(deps:{current:()=>Value;lot:LotCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):ManageLotWorkflowCommand{
  const commit=(result:Value,close=false)=>{if(!result.ok)return result;(result.effects.audit||[]).forEach((a:Value)=>deps.log(a.action,a.detail,a.target));if(close)deps.close();deps.saveState(result.effects.save);deps.render();return result;};
  const preview=(input:{id?:string;data:Value})=>deps.lot.preview({state:deps.current(),...input});
  const execute=(input:{id?:string;newId:string;data:Value})=>commit(deps.lot.execute({state:deps.current(),...input}),true);
  const checkRemoval=(input:{id:string})=>deps.lot.checkRemoval({state:deps.current(),...input});
  const remove=(input:{id:string})=>commit(deps.lot.remove({state:deps.current(),...input}));
  return Object.freeze({preview,execute,checkRemoval,remove});
}
