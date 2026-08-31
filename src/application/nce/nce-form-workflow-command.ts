type Value=Record<string,any>;
type Form={submit:(input:any)=>Value};
export type NceFormWorkflowCommand=Readonly<{submit:(input:Value&{audit:(result:Value)=>{action:string;detail:string;target:string}})=>Value}>;

export function createNceFormWorkflowCommand(deps:{current:()=>{actions?:Value[]};form:Form;log:(action:string,detail:string,target:string)=>void;reset:()=>void;save:()=>void;render:()=>void}):NceFormWorkflowCommand{
  const submit=(input:Value&{audit:(result:Value)=>{action:string;detail:string;target:string}})=>{
    const state=deps.current(),actions=state.actions||(state.actions=[]),result=deps.form.submit({...input,actions});
    if(!result.ok)return result;
    /* Giai doan 7 (state immutable, nhom actions/NCE, 2026-08-31): action-record-
       service.ts's create() khong con tu push - gan lai state.actions bang mang
       MOI o day (noi DUY NHAT co tham chieu state that) khi vua tao NCE record moi. */
    if(result.mode==='create')state.actions=[...actions,result.record];
    const audit=input.audit(result);deps.log(audit.action,audit.detail,audit.target);deps.reset();deps.save();deps.render();
    return result;
  };
  return Object.freeze({submit});
}
