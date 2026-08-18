type Value=Record<string,any>;
type RangeTargetCommand={applyLab:(input:any)=>Value;revertMfg:(input:any)=>Value};
export type RangeWorkflowCommand=Readonly<{applyLab:(input:Value)=>Value;revertMfg:(input:Value)=>Value}>;
export function createRangeWorkflowCommand(deps:{current:()=>Value;target:RangeTargetCommand;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;render:()=>void}):RangeWorkflowCommand{
  const commit=(result:Value)=>{if(!result.ok)return result;deps.log(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);deps.saveState(result.effects.save);deps.render();return result;};
  const applyLab=(input:Value)=>commit(deps.target.applyLab({state:deps.current(),...input}));
  const revertMfg=(input:Value)=>commit(deps.target.revertMfg({state:deps.current(),...input}));
  return Object.freeze({applyLab,revertMfg});
}
