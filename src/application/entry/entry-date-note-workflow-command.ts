type Value=Record<string,any>;
type EntryDateNoteCommand={updateDateNoteCommand:(state:Value,input:any)=>Value};
export type EntryDateNoteWorkflowCommand=Readonly<{save:(input:{testId:string;date:string;value:string})=>Value}>;
export function createEntryDateNoteWorkflowCommand(deps:{current:()=>Value;entry:EntryDateNoteCommand;formatDate:(date:string)=>string;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void}):EntryDateNoteWorkflowCommand{
  const save=(input:{testId:string;date:string;value:string})=>{
    const result=deps.entry.updateDateNoteCommand(deps.current(),{testId:input.testId,date:input.date,value:input.value,formatDate:deps.formatDate});
    if(!result.ok)return result;
    deps.log(result.effects.audit.action,result.effects.audit.detail,result.effects.audit.target);
    deps.saveState(result.effects.save);
    return result;
  };
  return Object.freeze({save});
}
