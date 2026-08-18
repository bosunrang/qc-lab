type Value=Record<string,any>;
type ReagentComparisonCommand={create:(state:Value,input:any)=>Value;remove:(state:Value,input:any)=>Value};
export type ReagentComparisonWorkflowCommand=Readonly<{create:(input:{id:string;name:string;unit:string})=>Value;remove:(input:{id:string})=>Value}>;
export function createReagentComparisonWorkflowCommand(deps:{current:()=>Value;comparison:ReagentComparisonCommand;label:(comparison:Value)=>string;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void}):ReagentComparisonWorkflowCommand{
  const create=(input:{id:string;name:string;unit:string})=>{
    const result=deps.comparison.create(deps.current(),input);
    if(result.error)return result;
    const label=deps.label(result.comparison);
    deps.log('Tạo phép so sánh hóa chất',label,label);
    deps.saveState({clearDerived:false});
    return result;
  };
  const remove=(input:{id:string})=>{
    const result=deps.comparison.remove(deps.current(),input);
    if(result.error)return result;
    const label=deps.label(result.removed);
    deps.log('Xóa phép so sánh hóa chất',label,label);
    deps.saveState({clearDerived:false});
    return result;
  };
  return Object.freeze({create,remove});
}
