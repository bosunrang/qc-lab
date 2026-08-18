type Value=Record<string,any>;
type MuService={apply:(records:Value[],periodIds:string[],rows:Value[],reviewedBy:unknown,reviewedDate:unknown)=>Value};
/* sgMuApply() là hàm DUY NHẤT trong trang Sigma (assets/modules/sigma.js) có ghi
   audit log — mọi thao tác Sigma khác (sửa TEa, track/untrack test, sửa ô CV/Bias,
   thêm/xóa kỳ, áp Bias%, nhập CV theo lô) chỉ save()+rerender(), không logAct, vì
   đó là điều chỉnh PHÉP TÍNH phái sinh từ dữ liệu IQC/EQA đã audit ở nơi khác, không
   phải bản ghi QC gốc. Chỉ mục này đáng gộp theo đúng mẫu Manage/Auth/Range đã làm. */
export type SigmaMuWorkflowCommand=Readonly<{apply:(input:{records:Value[];periodIds:string[];rows:Value[];reviewedBy:unknown;reviewedDate:unknown;testName:string;sigmaTestId:string})=>Value}>;
export function createSigmaMuWorkflowCommand(deps:{service:MuService;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):SigmaMuWorkflowCommand{
  const apply=(input:{records:Value[];periodIds:string[];rows:Value[];reviewedBy:unknown;reviewedDate:unknown;testName:string;sigmaTestId:string})=>{
    const result=deps.service.apply(input.records,input.periodIds,input.rows,input.reviewedBy,input.reviewedDate);
    if(result.status==='missing-periods'||!result.applied)return result;
    const detail=`${result.applied} kỳ · ${input.rows.length} mức · u(cal) ${input.rows.map((r:Value)=>`M${r.level}=${String(r.uCal??'').trim()||'—'}`).join(', ')}`;
    deps.log('Cập nhật ngân sách MU',detail,input.testName);
    deps.close();deps.saveState({clearDerived:false,sigmaTestId:input.sigmaTestId});deps.render();
    return result;
  };
  return Object.freeze({apply});
}
