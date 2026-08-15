type Value=Record<string,any>;
export function createManageAssayCommand(deps:{saveAssay:(state:Value,input:Value)=>Value}){
  const execute=(input:{state:Value;id?:string;newId:string;data:Value})=>{const result=deps.saveAssay(input.state,{id:input.id||'',newId:input.newId,data:input.data});if(result.error)return{ok:false as const,...result};const record=result.record;return{ok:true as const,...result,effects:{audit:{action:result.created?'Thêm xét nghiệm':'Cập nhật xét nghiệm',detail:`${result.inst.name} · ${(record.levels||[]).length} mức QC`,target:record.name},save:{}}};};
  return Object.freeze({execute});
}
export type ManageAssayCommand=ReturnType<typeof createManageAssayCommand>;
