type Value=Record<string,any>;
/* Transaction kích hoạt nhóm lô (Wave 3): preview() tính trước ứng viên Mean/SD và điểm
   rơi vào kỳ đã khóa (guard PeriodService) để adapter hỏi xác nhận ĐÚNG số liệu, rồi
   execute() áp hàng loạt sau khi xác nhận. Không đọc DOM/dialog; adapter JS chỉ giữ
   confirm + render. Hai pha dùng CHUNG danh sách candidates để hộp xác nhận không lệch
   với những gì thực sự được áp. */
export function createManageLotGroupActivationCommand(deps:{
  findGroup:(state:Value,id:string)=>Value|null;
  lotsOfGroup:(state:Value,group:Value)=>Value[];
  candidatesFor:(state:Value,group:Value,lots:Value[])=>Value[];
  backfillPoints:(state:Value,candidate:Value)=>Value[];
  lockedPoints:(state:Value,points:Value[])=>Value;
  applyActivation:(input:Value)=>Value;
}){
  const preview=(input:{state:Value;id:string})=>{
    const group=deps.findGroup(input.state,input.id);
    if(!group||group.active===false)return{ok:false as const,reason:'not-found' as const};
    const lots=deps.lotsOfGroup(input.state,group);
    if(!lots.length)return{ok:false as const,reason:'no-lots' as const};
    const candidates=deps.candidatesFor(input.state,group,lots);
    const backfilled=candidates.flatMap(candidate=>deps.backfillPoints(input.state,candidate));
    const locked=deps.lockedPoints(input.state,backfilled)||{};
    return{ok:true as const,group,candidates,locked:{count:locked.count||0,periods:locked.periods||[]}};
  };
  const execute=(input:{state:Value;group:Value;candidates:Value[];effectiveFrom:string;note:string})=>{
    const result=deps.applyActivation({group:input.group,candidates:input.candidates,groups:input.state.lotGroups||[],effectiveFrom:input.effectiveFrom,note:input.note});
    if(result.status!=='applied')return{ok:false as const,status:String(result.status),group:input.group};
    return{ok:true as const,status:'applied' as const,count:result.count,group:input.group,
      effects:{audit:[{action:'Kích hoạt nhóm lô',detail:`${input.group.name} · ${result.count} dòng`,target:'Nhóm lô'}],save:{}}};
  };
  return Object.freeze({preview,execute});
}
export type ManageLotGroupActivationCommand=ReturnType<typeof createManageLotGroupActivationCommand>;
