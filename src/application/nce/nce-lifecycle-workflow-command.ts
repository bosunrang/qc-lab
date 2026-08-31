type Value=Record<string,any>;
type Lifecycle={execute:(input:any)=>Value};
export type NceLifecycleWorkflowCommand=Readonly<{execute:(input:Value&{audit:(record:Value)=>{action:string;detail:string;target:string}})=>Value}>;

export function createNceLifecycleWorkflowCommand(deps:{current:()=>{actions?:Value[]};lifecycle:Lifecycle;log:(action:string,detail:string,target:string)=>void;save:()=>void;render:()=>void}):NceLifecycleWorkflowCommand{
  const execute=(input:Value&{audit:(record:Value)=>{action:string;detail:string;target:string}})=>{
    const state=deps.current(),actions=state.actions||[];
    const result=deps.lifecycle.execute({...input,actions});
    if(!result.ok)return result;
    /* Giai doan 7 (state immutable, nhom actions/NCE, 2026-08-31): action-
       escalation-service.ts's createFollowUp() khong con tu push - gan lai
       state.actions bang mang MOI o day (noi DUY NHAT co tham chieu state
       that) khi vua tao follow-up record moi (kind==='escalate' thanh cong). */
    if(input.kind==='escalate')state.actions=[...actions,result.record];
    const audit=input.audit(result.record),record=audit&&audit;
    deps.log(record.action,record.detail,record.target);deps.save();deps.render();
    return result;
  };
  return Object.freeze({execute});
}
