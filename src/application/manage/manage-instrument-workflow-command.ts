type Value=Record<string,any>;
type InstrumentCommand={save:(input:any)=>Value;remove:(input:any)=>Value};
export type ManageInstrumentWorkflowCommand=Readonly<{save:(input:{id?:string;newId:string;data:Value})=>Value;remove:(input:{id:string})=>Value}>;

export function createManageInstrumentWorkflowCommand(deps:{current:()=>Value;instrument:InstrumentCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):ManageInstrumentWorkflowCommand{
  const commit=(result:Value,close=false)=>{if(!result.ok)return result;deps.log(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);if(close)deps.close();deps.saveState(result.effects.save);deps.render();return result;};
  const save=(input:{id?:string;newId:string;data:Value})=>commit(deps.instrument.save({state:deps.current(),...input}),true);
  const remove=(input:{id:string})=>commit(deps.instrument.remove({state:deps.current(),...input}));
  return Object.freeze({save,remove});
}
