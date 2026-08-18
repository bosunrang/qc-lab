type Value=Record<string,any>;
type PeriodCommand={lock:(input:{state:Value;ym:string;lockedAt:string;lockedBy:string;id:string;label:string})=>Value;unlock:(input:{state:Value;ym:string;reason:string;label:string})=>Value};
export type ReportPeriodWorkflowCommand=Readonly<{lock:(input:{ym:string;lockedAt:string;lockedBy:string;id:string;label:string})=>Value;unlock:(input:{ym:string;reason:string;label:string})=>Value}>;

export function createReportPeriodWorkflowCommand(deps:{current:()=>Value;period:PeriodCommand;log:(type:string,detail:string,target:string)=>void;save:(options:Value)=>void;render:()=>void}):ReportPeriodWorkflowCommand{
  const commit=(result:Value)=>{if(!result.ok)return result;deps.log(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);deps.save(result.effects.save);deps.render();return result;};
  const lock=(input:{ym:string;lockedAt:string;lockedBy:string;id:string;label:string})=>commit(deps.period.lock({state:deps.current(),...input}));
  const unlock=(input:{ym:string;reason:string;label:string})=>commit(deps.period.unlock({state:deps.current(),...input}));
  return Object.freeze({lock,unlock});
}
