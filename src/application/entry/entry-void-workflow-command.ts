type Value=Record<string,any>;
type VoidCommand={execute:(input:any)=>Value};
export type EntryVoidWorkflowCommand=Readonly<{execute:(input:Value&{audit:(result:Value)=>{action:string;detail:string;target:string}})=>Value}>;

export function createEntryVoidWorkflowCommand(deps:{current:()=>Value;voidCommand:VoidCommand;log:(action:string,detail:string,target:string)=>void;save:(options:Value)=>void}):EntryVoidWorkflowCommand{
  const execute=(input:Value&{audit:(result:Value)=>{action:string;detail:string;target:string}})=>{
    const result=deps.voidCommand.execute({...input,state:deps.current()});
    if(!result.ok)return result;
    const audit=input.audit(result);deps.log(audit.action,audit.detail,audit.target);deps.save(result.effects.save);
    return result;
  };
  return Object.freeze({execute});
}
