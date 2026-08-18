type Value=Record<string,any>;
type TargetMatrixCommand={execute:(input:any)=>{result:Value;auditDetail:string}};
export type ManageTargetMatrixWorkflowCommand=Readonly<{commit:(input:{picked:Value[];group:Value;panelId:string;mode:string;overwrites:Value[];effectiveFrom:string})=>Value}>;
export function createManageTargetMatrixWorkflowCommand(deps:{current:()=>Value;matrix:TargetMatrixCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;render:()=>void}):ManageTargetMatrixWorkflowCommand{
  const commit=(input:{picked:Value[];group:Value;panelId:string;mode:string;overwrites:Value[];effectiveFrom:string})=>{
    const {result,auditDetail}=deps.matrix.execute({...input,panels:deps.current().qcPanels||[]});
    deps.log('Cập nhật Mean/SD',auditDetail,'Mean/SD');
    deps.saveState({});deps.render();
    return result;
  };
  return Object.freeze({commit});
}
