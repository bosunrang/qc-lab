type Value=Record<string,any>;
type LotTransitionCommand={checkRemoval:(input:any)=>Value;remove:(input:any)=>Value};
export type ManageLotTransitionWorkflowCommand=Readonly<{checkRemoval:(input:{id:string})=>Value;remove:(input:{id:string})=>Value}>;
export function createManageLotTransitionWorkflowCommand(deps:{current:()=>Value;transition:LotTransitionCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;render:()=>void}):ManageLotTransitionWorkflowCommand{
  const checkRemoval=(input:{id:string})=>deps.transition.checkRemoval({state:deps.current(),...input});
  const remove=(input:{id:string})=>{
    const result=deps.transition.remove({state:deps.current(),...input});
    if(!result.ok)return result;
    result.effects.audit.forEach((a:Value)=>deps.log(a.action,a.detail,a.target));
    deps.saveState(result.effects.save);deps.render();
    return result;
  };
  return Object.freeze({checkRemoval,remove});
}
