type Value=Record<string,any>;
export function createManageInstrumentCommand(deps:{saveInstrument:(state:Value,input:Value)=>Value;removeInstrument:(state:Value,input:Value)=>Value}){
  const save=(input:{state:Value;id?:string;newId:string;data:Value})=>{const result=deps.saveInstrument(input.state,{id:input.id||'',newId:input.newId,data:input.data});if(result.error)return{ok:false as const,...result};return{ok:true as const,...result,effects:{audit:{action:result.created?'Thêm máy xét nghiệm':'Cập nhật máy',detail:result.record.name,target:'Máy xét nghiệm'},save:{clearDerived:false}}};};
  const remove=(input:{state:Value;id:string})=>{const result=deps.removeInstrument(input.state,{id:input.id});if(result.error)return{ok:false as const,...result};return{ok:true as const,...result,effects:{audit:{action:'Xóa máy xét nghiệm',detail:result.record.name,target:'Máy xét nghiệm'},save:{clearDerived:false}}};};
  return Object.freeze({save,remove});
}
export type ManageInstrumentCommand=ReturnType<typeof createManageInstrumentCommand>;
