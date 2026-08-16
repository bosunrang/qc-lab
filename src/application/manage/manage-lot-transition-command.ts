type Value=Record<string,any>;
type AuditEntry={action:string;detail:string;target:string};
/* Transaction hồ sơ chuyển tiếp lô (Wave 3): prepare() kiểm tra + dựng data và cờ
   needsReauth để adapter xác thực lại TRƯỚC khi ghi; acceptanceGate() chặn chấp nhận
   lô mới khi còn xét nghiệm thiếu Mean/SD; execute() lưu hồ sơ, áp vào cấu hình/nhóm
   lô và đồng bộ khóa lô đã hết, trả effect audit/save để adapter không tự quyết nghiệp
   vụ. Đọc DOM (bảng Mean/SD nhúng), re-auth và dialog vẫn ở adapter JS. */
export function createManageLotTransitionCommand(deps:{
  validate:(state:Value,input:Value)=>Value;
  prepareData:(input:Value)=>Value;
  inspect:(state:Value,transition:Value)=>Value;
  save:(state:Value,input:Value)=>Value;
  applyAccepted:(transition:Value)=>number;
  syncDepletion:(state:Value)=>unknown;
  removal:(state:Value,input:Value)=>Value;
  removeRecord:(state:Value,input:Value)=>Value;
  findLot:(state:Value,id:string)=>Value|undefined;
  lotLabel:(id:string)=>string;
  panelName:(id:string)=>string;
  statusText:(status:string)=>string;
  testName:(test:Value)=>string;
}){
  const prepare=(input:{state:Value;id?:string;panelId:string;fromLotId:string;toLotId:string;status:string;startDate:string;today:string;approvedBy:string;approvedAt:string})=>{
    const checked=deps.validate(input.state,{id:input.id||'',panelId:input.panelId,fromLotId:input.fromLotId,toLotId:input.toLotId,status:input.status});
    if(checked.error)return{ok:false as const,...checked};
    const finalChanged=!!checked.finalChanged;
    const data=deps.prepareData({old:checked.old,panelId:input.panelId,fromLotId:input.fromLotId,toLotId:input.toLotId,startDate:input.startDate,status:input.status,finalChanged,today:input.today,approvedBy:finalChanged?input.approvedBy:'',approvedAt:finalChanged?input.approvedAt:''});
    return{ok:true as const,data,fromLot:checked.fromLot,toLot:checked.toLot,finalChanged,needsReauth:finalChanged};
  };
  const acceptanceGate=(input:{state:Value;data:Value;finalChanged:boolean})=>{
    if(input.data.status!=='accepted'||!input.finalChanged)return{ok:true as const};
    const check=deps.inspect(input.state,input.data);
    if(!check.rows||!check.rows.length)return{ok:false as const,message:'Panel đã chọn không có xét nghiệm nào đang sử dụng lô cũ. Hãy kiểm tra lại Panel và lô chuyển tiếp.'};
    if(check.missing&&check.missing.length){
      const toLot=deps.findLot(input.state,input.data.toLotId);
      return{ok:false as const,missing:check.missing,
        message:`Chưa thể chấp nhận lô mới: ${check.missing.map((row:Value)=>deps.testName(row.test)).join(', ')} chưa có Mean/SD hợp lệ cho lô ${(toLot&&toLot.lotNo)||''}. Hãy điền đủ ở bảng Mean/SD phía trên rồi lưu lại.`};
    }
    return{ok:true as const};
  };
  const execute=(input:{state:Value;id?:string;newId:string;data:Value})=>{
    /* Chụp trạng thái "đã hết QC" TRƯỚC khi đồng bộ: chỉ syncDepletion() mới đổi cờ
       depleted, nên so trước/sau cho ra đúng sự kiện khóa/mở lô để ghi nhật ký. */
    const wasDepleted=!!((deps.findLot(input.state,input.data.fromLotId))||{}).depleted;
    const saved=deps.save(input.state,{id:input.id||'',newId:input.newId,data:input.data});
    if(saved.error)return{ok:false as const,...saved};
    const tr=saved.record,switched=deps.applyAccepted(tr)||0;
    deps.syncDepletion(input.state);
    const nowDepleted=!!((deps.findLot(input.state,tr.fromLotId))||{}).depleted;
    const audit:AuditEntry[]=[];
    if(nowDepleted&&!wasDepleted)audit.push({action:'Khóa lô đã hết',detail:`${deps.lotLabel(tr.fromLotId)} · chuyển tiếp sang ${deps.lotLabel(tr.toLotId)}`,target:'Lô QC'});
    else if(!nowDepleted&&wasDepleted)audit.push({action:'Mở lại lô QC',detail:deps.lotLabel(tr.fromLotId),target:'Lô QC'});
    if(switched)audit.push({action:'Áp dụng chuyển tiếp lô',detail:`${deps.panelName(tr.panelId)} · ${deps.lotLabel(tr.fromLotId)} → ${deps.lotLabel(tr.toLotId)} · ${switched} xét nghiệm`,target:'Chuyển tiếp lô'});
    audit.push({action:saved.created?'Thêm chuyển lô QC':'Cập nhật chuyển lô QC',detail:`${deps.panelName(tr.panelId)}: ${deps.lotLabel(tr.fromLotId)} → ${deps.lotLabel(tr.toLotId)} · ${deps.statusText(tr.status)}`,target:'Chuyển tiếp lô'});
    return{ok:true as const,record:tr,created:!!saved.created,switched,effects:{audit,save:{}}};
  };
  const checkRemoval=(input:{state:Value;id:string})=>deps.removal(input.state,{id:input.id});
  const remove=(input:{state:Value;id:string})=>{
    const checked=deps.removal(input.state,{id:input.id});
    if(checked.error)return{ok:false as const,...checked};
    const result=deps.removeRecord(input.state,{id:input.id});
    if(result.error)return{ok:false as const,...result};
    deps.syncDepletion(input.state);
    return{ok:true as const,record:result.record,
      effects:{audit:[{action:'Xóa chuyển tiếp lô',detail:`${deps.lotLabel(result.record.fromLotId)} → ${deps.lotLabel(result.record.toLotId)}`,target:'Chuyển tiếp lô'}],save:{}}};
  };
  return Object.freeze({prepare,acceptanceGate,execute,checkRemoval,remove});
}
export type ManageLotTransitionCommand=ReturnType<typeof createManageLotTransitionCommand>;
