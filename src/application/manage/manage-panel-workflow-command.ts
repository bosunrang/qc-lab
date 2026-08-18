type Value=Record<string,any>;
type PanelCommand={save:(input:any)=>Value;remove:(input:any)=>Value};
export type ManagePanelWorkflowCommand=Readonly<{save:(input:{id?:string;newId:string;data:Value})=>Value;remove:(input:{id:string})=>Value}>;
export function createManagePanelWorkflowCommand(deps:{current:()=>Value;panel:PanelCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):ManagePanelWorkflowCommand{
  const commit=(result:Value,close=false)=>{if(!result.ok)return result;deps.log(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);if(close)deps.close();deps.saveState(result.effects.save);deps.render();return result;};
  return Object.freeze({save:input=>commit(deps.panel.save({state:deps.current(),...input}),true),remove:input=>commit(deps.panel.remove({state:deps.current(),...input}))});
}
