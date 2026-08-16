type Value=Record<string,any>;

/* Command của thao tác khóa/mở khóa kỳ: service chỉ lo mutation cấp thấp,
   command chuẩn hóa effect audit/save để route không tự lặp lại nghiệp vụ. Re-auth
   và confirm vẫn nằm ở adapter UI vì đó là tương tác người dùng, không phải luật miền. */
export function createReportPeriodCommand(deps:{lock:(state:Value,input:Value)=>Value;unlock:(state:Value,input:Value)=>Value}){
  const lock=(input:{state:Value;ym:string;lockedAt:string;lockedBy:string;id:string;label:string})=>{
    const result=deps.lock(input.state,{ym:input.ym,lockedAt:input.lockedAt,lockedBy:input.lockedBy,id:input.id});
    if(result.error)return{ok:false as const,...result};
    return{ok:true as const,...result,effects:{audit:{action:'Khóa kỳ báo cáo',detail:input.label,target:'Kỳ báo cáo'},save:{clearDerived:false}}};
  };
  const unlock=(input:{state:Value;ym:string;reason:string;label:string})=>{
    const result=deps.unlock(input.state,{ym:input.ym,reason:input.reason});
    if(result.error)return{ok:false as const,...result};
    return{ok:true as const,...result,effects:{audit:{action:'Mở khóa kỳ báo cáo',detail:`${input.label} · Lý do: ${result.reason}`,target:'Kỳ báo cáo'},save:{clearDerived:false}}};
  };
  return Object.freeze({lock,unlock});
}
export type ReportPeriodCommand=ReturnType<typeof createReportPeriodCommand>;
