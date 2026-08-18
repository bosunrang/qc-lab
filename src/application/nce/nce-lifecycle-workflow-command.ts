type Value=Record<string,any>;
type Lifecycle={execute:(input:any)=>Value};
export type NceLifecycleWorkflowCommand=Readonly<{execute:(input:Value&{audit:(record:Value)=>{action:string;detail:string;target:string}})=>Value}>;

export function createNceLifecycleWorkflowCommand(deps:{current:()=>{actions?:Value[]};lifecycle:Lifecycle;log:(action:string,detail:string,target:string)=>void;save:()=>void;render:()=>void}):NceLifecycleWorkflowCommand{
  const execute=(input:Value&{audit:(record:Value)=>{action:string;detail:string;target:string}})=>{
    const result=deps.lifecycle.execute({...input,actions:deps.current().actions||[]});
    if(!result.ok)return result;
    const audit=input.audit(result.record),record=audit&&audit;
    deps.log(record.action,record.detail,record.target);deps.save();deps.render();
    return result;
  };
  return Object.freeze({execute});
}
