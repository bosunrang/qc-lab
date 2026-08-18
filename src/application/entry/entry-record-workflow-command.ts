type Value=Record<string,any>;
type RecordCommand={execute:(input:any)=>Value};
export type EntryRecordWorkflowCommand=Readonly<{execute:(input:Value&{audit:(result:Value)=>{action:string;detail:string;target:string}})=>Value}>;

export function createEntryRecordWorkflowCommand(deps:{current:()=>Value;record:RecordCommand;log:(action:string,detail:string,target:string)=>void;save:(options:Value)=>void}):EntryRecordWorkflowCommand{
  const execute=(input:Value&{audit:(result:Value)=>{action:string;detail:string;target:string}})=>{
    const result=deps.record.execute({...input,state:deps.current()});
    if(!result.ok)return result;
    const audit=input.audit(result);deps.log(audit.action,audit.detail,audit.target);deps.save(result.effects.save);
    return result;
  };
  return Object.freeze({execute});
}
