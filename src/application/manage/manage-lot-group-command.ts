type Value=Record<string,any>;
export function createManageLotGroupCommand(deps:{save:(state:Value,input:Value)=>Value;remove:(state:Value,input:Value)=>Value;stop:(state:Value,input:Value)=>Value}){
  const save=(input:Value)=>{const r=deps.save(input.state,{id:input.id||'',newId:input.newId,data:input.data});return r.error?{ok:false as const,...r}:{ok:true as const,...r};};
  const remove=(input:Value)=>{const r=deps.remove(input.state,{id:input.id});return r.error?{ok:false as const,...r}:{ok:true as const,...r};};
  const stop=(input:Value)=>{const r=deps.stop(input.state,{id:input.id,stoppedAt:input.stoppedAt});return r.error?{ok:false as const,...r}:{ok:true as const,...r};};
  return Object.freeze({save,remove,stop});
}
export type ManageLotGroupCommand=ReturnType<typeof createManageLotGroupCommand>;
