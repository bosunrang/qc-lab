type Value=Record<string,any>;
/* Đổi dải QC (Mean/SD) tạo một hồ sơ "action" chờ duyệt trong CÙNG state.actions
   với hồ sơ NCE (rule/errorType/approvalStatus khớp shape action-workflow-service.js
   dùng) — đây là cách thay đổi dải xuất hiện trong danh sách "Khắc phục sự cố" chờ
   duyệt, không phải một bảng riêng. mean/sd/detail/actionText do JS tính trước khi
   gọi (giống confirmApplyNewRange gốc dùng c.m/c.sd chứ không đọc lại l.mean/l.sd
   sau khi assignTarget gán) — limitsFromTarget() chỉ Number() hóa mean/sd, không
   đổi giá trị, nên dùng giá trị JS đã biết trước là an toàn. */
export function createRangeTargetCommand(deps:{assignTarget:(config:Value,mean:number,sd:number,source:string)=>boolean}){
  const applyLab=(input:{state:Value;level:Value;testId:string;levelNo:number;lot:string;testName:string;mean:number;sd:number;cv:number;reason:string;gateNote:string;detail:string;actionText:string;historyId:string;actionId:string;today:string;createdAt:string;userId:string;username:string;userName:string})=>{
    const l=input.level;
    if(!deps.assignTarget(l,input.mean,input.sd,'lab'))return{ok:false as const,message:'Không áp dụng được dải mới.'};
    l.cvRef=input.cv;l.rangeDate=input.today;
    l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];
    l.meanSdHistory.push({id:input.historyId,qcLotId:l.qcLotId||'',lot:l.lot||'',mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:input.today,effectiveTo:l.exp||'',source:'lab',note:input.reason+input.gateNote});
    input.state.actions=input.state.actions||[];
    input.state.actions.push({id:input.actionId,date:input.today,createdAt:input.createdAt,createdByUserId:input.userId,createdByUsername:input.username,testId:input.testId,level:input.levelNo,lot:input.lot,rule:'Thiết lập dải QC mới',errorType:'Quản lý dải kiểm soát',action:input.actionText,by:input.userName,approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});
    return{ok:true as const,effects:{audit:{action:'Áp dụng dải QC',detail:input.detail,target:input.testName},save:{testId:input.testId}}};
  };
  const revertMfg=(input:{state:Value;level:Value;testId:string;levelNo:number;lot:string;testName:string;reason:string;detail:string;actionText:string;historyId:string;actionId:string;today:string;createdAt:string;userId:string;username:string;userName:string})=>{
    const l=input.level;
    if(!deps.assignTarget(l,l.mfgMean,l.mfgSd,'mfg'))return{ok:false as const,message:'Không tìm thấy Mean/SD nhà sản xuất hợp lệ để hoàn về.'};
    l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];
    l.meanSdHistory.push({id:input.historyId,qcLotId:l.qcLotId||'',lot:l.lot||'',mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:input.today,effectiveTo:l.exp||'',source:'mfg',note:input.reason});
    input.state.actions=input.state.actions||[];
    input.state.actions.push({id:input.actionId,date:input.today,createdAt:input.createdAt,createdByUserId:input.userId,createdByUsername:input.username,testId:input.testId,level:input.levelNo,lot:input.lot,rule:'Hoàn dải QC',errorType:'Quản lý dải kiểm soát',action:input.actionText,by:input.userName,approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});
    return{ok:true as const,effects:{audit:{action:'Hoàn dải QC',detail:input.detail,target:input.testName},save:{testId:input.testId}}};
  };
  return Object.freeze({applyLab,revertMfg});
}
export type RangeTargetCommand=ReturnType<typeof createRangeTargetCommand>;
