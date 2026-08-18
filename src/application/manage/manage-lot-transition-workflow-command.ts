type Value=Record<string,any>;
type LotTransitionCommand={checkRemoval:(input:any)=>Value;remove:(input:any)=>Value;execute:(input:any)=>Value};
export type ManageLotTransitionWorkflowCommand=Readonly<{checkRemoval:(input:{id:string})=>Value;remove:(input:{id:string})=>Value;execute:(input:{id?:string;newId:string;data:Value})=>Value}>;
export function createManageLotTransitionWorkflowCommand(deps:{current:()=>Value;transition:LotTransitionCommand;clearDerived:()=>void;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):ManageLotTransitionWorkflowCommand{
  const checkRemoval=(input:{id:string})=>deps.transition.checkRemoval({state:deps.current(),...input});
  const remove=(input:{id:string})=>{
    const result=deps.transition.remove({state:deps.current(),...input});
    if(!result.ok)return result;
    result.effects.audit.forEach((a:Value)=>deps.log(a.action,a.detail,a.target));
    deps.saveState(result.effects.save);deps.render();
    return result;
  };
  /* saveLotTransitionV2() vẫn tự gọi ManageLotTransitionCommand.prepare()/acceptanceGate()
     và áp Mean/SD "Dự kiến" (applyPlannedTarget, không audit riêng) TRƯỚC khi tới đây —
     execute() chỉ gói phần commit cuối (audit/clearDerived/đóng modal/save/render). */
  const execute=(input:{id?:string;newId:string;data:Value})=>{
    const result=deps.transition.execute({state:deps.current(),...input});
    if(!result.ok)return result;
    result.effects.audit.forEach((a:Value)=>deps.log(a.action,a.detail,a.target));
    deps.clearDerived();deps.close();deps.saveState(result.effects.save);deps.render();
    return result;
  };
  return Object.freeze({checkRemoval,remove,execute});
}
