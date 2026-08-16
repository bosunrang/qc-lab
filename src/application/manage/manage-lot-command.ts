type Value=Record<string,any>;
/* Transaction lô QC (Wave 3): preview() kiểm tra + dựng kế hoạch đổi số lô (đếm điểm
   QC sẽ bị viết lại và soi kỳ đã khóa qua PeriodService) để adapter hỏi xác nhận TRƯỚC
   khi chạm state; execute() lưu lô và cascade đổi số lô hàng loạt. Đổi số lô là VIẾT
   LẠI HÀNG LOẠT bản ghi lịch sử (p.lot là chuỗi tĩnh) nên người dùng phải thấy con số
   trước khi làm — hai pha dùng chung input.data nên hộp xác nhận không lệch với những
   gì thực sự được ghi. Đọc DOM và dialog vẫn ở adapter JS. */
export function createManageLotCommand(deps:{
  validate:(state:Value,input:Value)=>Value;
  pointsToRename:(state:Value,level:number,lotNo:string)=>Value[];
  lockedPoints:(state:Value,points:Value[])=>Value;
  save:(state:Value,input:Value)=>Value;
  removal:(state:Value,input:Value)=>Value;
  removeRecord:(state:Value,input:Value)=>Value;
}){
  const preview=(input:{state:Value;id?:string;data:Value})=>{
    const check=deps.validate(input.state,{id:input.id||'',data:input.data});
    if(check.error)return{ok:false as const,...check};
    const old=check.record||null,oldLotNo=(old&&old.lotNo)||'',oldLevel=old?+old.level:+input.data.level||1;
    let rename:null|{oldLotNo:string;newLotNo:string;affected:number;locked:{count:number;periods:string[]}}=null;
    if(old&&oldLotNo&&oldLotNo!==input.data.lotNo){
      const affected=deps.pointsToRename(input.state,oldLevel,oldLotNo);
      if(affected.length){
        const locked=deps.lockedPoints(input.state,affected)||{};
        rename={oldLotNo,newLotNo:input.data.lotNo,affected:affected.length,locked:{count:locked.count||0,periods:locked.periods||[]}};
      }
    }
    return{ok:true as const,record:old,rename};
  };
  const execute=(input:{state:Value;id?:string;newId:string;data:Value})=>{
    const result=deps.save(input.state,{id:input.id||'',newId:input.newId,data:input.data});
    if(result.error)return{ok:false as const,...result};
    const renamed=result.renamedPoints||0;
    return{ok:true as const,record:result.record,created:!!result.created,renamedPoints:renamed,
      effects:{audit:[{action:result.created?'Thêm lô QC':'Cập nhật lô QC',
        detail:`${input.data.lotNo} · Mức ${input.data.level}`+(renamed?` · Đã cập nhật ${renamed} điểm QC cũ theo số lô mới`:''),target:'Lô QC'}],save:{}}};
  };
  const checkRemoval=(input:{state:Value;id:string})=>deps.removal(input.state,{id:input.id});
  const remove=(input:{state:Value;id:string})=>{
    const result=deps.removeRecord(input.state,{id:input.id});
    if(result.error)return{ok:false as const,...result};
    return{ok:true as const,record:result.record,
      effects:{audit:[{action:'Xóa lô QC',detail:result.record.lotNo,target:'Lô QC'}],save:{}}};
  };
  return Object.freeze({preview,execute,checkRemoval,remove});
}
export type ManageLotCommand=ReturnType<typeof createManageLotCommand>;
