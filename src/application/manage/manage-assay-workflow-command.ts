type Value=Record<string,any>;
type AssayCommand={execute:(input:any)=>Value};
export type ManageAssayWorkflowCommand=Readonly<{save:(input:{id?:string;newId:string;data:Value})=>Value}>;
export function createManageAssayWorkflowCommand(deps:{current:()=>Value;assay:AssayCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):ManageAssayWorkflowCommand{
  const save=(input:{id?:string;newId:string;data:Value})=>{
    const result=deps.assay.execute({state:deps.current(),...input});
    if(!result.ok)return result;
    const a=result.effects.audit;deps.log(a.action,a.detail,a.target);
    deps.close();deps.saveState(result.effects.save);deps.render();
    return result;
  };
  return Object.freeze({save});
}
