type Value=Record<string,any>;
export function createManagePanelCommand(deps:{savePanel:(state:Value,input:Value)=>Value;removePanel:(state:Value,input:Value)=>Value}){
  const save=(input:{state:Value;id?:string;newId:string;data:Value})=>{const result=deps.savePanel(input.state,{id:input.id||'',newId:input.newId,data:input.data});if(result.error)return{ok:false as const,...result};return{ok:true as const,...result,effects:{audit:{action:result.created?'Thêm Panel QC':'Cập nhật Panel QC',detail:`${result.record.name} · ${result.record.testIds.length} xét nghiệm`,target:'Panel QC'},save:{clearDerived:false}}};};
  const remove=(input:{state:Value;id:string})=>{const result=deps.removePanel(input.state,{id:input.id});if(result.error)return{ok:false as const,...result};return{ok:true as const,...result,effects:{audit:{action:'Xóa Panel QC',detail:result.record.name,target:'Panel QC'},save:{clearDerived:false}}};};
  return Object.freeze({save,remove});
}
export type ManagePanelCommand=ReturnType<typeof createManagePanelCommand>;
