type Value=Record<string,any>;
export function createManageAssayRemovalCommand(deps:{removeAssay:(state:Value,input:Value)=>Value}){
  const execute=(input:{state:Value;id:string})=>{const result=deps.removeAssay(input.state,{id:input.id});if(result.error)return{ok:false as const,...result};return{ok:true as const,...result,effects:{save:{},audit:{action:'Xóa test/lô',detail:`Xóa xét nghiệm và ${result.pointsCount} điểm QC`,target:result.record.name}}};};
  return Object.freeze({execute});
}
export type ManageAssayRemovalCommand=ReturnType<typeof createManageAssayRemovalCommand>;
