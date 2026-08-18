type Value=Record<string,any>;
type TeaReferenceService={
  edit:(state:Value,name:any,field:string,val:any)=>Value;
  restoreOrRemove:(state:Value,refKey:any,isDefault:boolean)=>Value;
  addCustomReference:(state:Value,input:any)=>Value;
  saveLabProfile:(state:Value,refKey:any,profile:any)=>Value;
  removeLabProfile:(state:Value,refKey:any,isDefault:boolean)=>Value;
};
export type TeaReferenceWorkflowCommand=Readonly<{
  edit:(input:{name:any;field:string;val:any})=>Value;
  remove:(input:{refKey:any;isDefault:boolean})=>Value;
  addCustom:(input:{data:Value})=>Value;
  saveLabProfile:(input:{refKey:any;profile:Value})=>Value;
  removeLabProfile:(input:{refKey:any;isDefault:boolean})=>Value;
}>;
/* Sửa/xóa/thêm TEa tham chiếu ảnh hưởng TEa% của nhiều xét nghiệm đang track Sigma
   cùng lúc — mỗi thao tác đều gọi lại reconcileSigmaTea() SAU khi service ghi state
   nhưng TRƯỚC khi save/render, để Sigma không hiển thị TEa cũ tới khi ai đó tình cờ
   mở lại trang đó. Chuỗi audit dựng từ KẾT QUẢ trả về (before/record đã cập nhật),
   không phải input, vì TeaReferenceService tự tính version/nguồn stamp — chỉ định
   dạng ngày (formatDate) là việc của adapter JS nên được tiêm vào thay vì tính cứng. */
export function createTeaReferenceWorkflowCommand(deps:{current:()=>Value;service:TeaReferenceService;reconcileSigmaTea:()=>void;formatDate:(iso:string)=>string;log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):TeaReferenceWorkflowCommand{
  const commit=(save:Value,close=false)=>{deps.reconcileSigmaTea();if(close)deps.close();deps.saveState(save);deps.render();};
  const edit=(input:{name:any;field:string;val:any})=>{
    const result=deps.service.edit(deps.current(),input.name,input.field,input.val);
    const e=result.record;
    deps.log('Cập nhật TEa tham chiếu',`${e.name} · ${input.field.toUpperCase()}: ${result.before??'—'} → ${e[input.field]??'—'} · ${result.source.version||'không phiên bản'}`,'Bảng TEa');
    commit({clearDerived:false});
    return result;
  };
  const remove=(input:{refKey:any;isDefault:boolean})=>{
    const result=deps.service.restoreOrRemove(deps.current(),input.refKey,input.isDefault);
    const label=(result.record&&result.record.name)||input.refKey;
    deps.log(input.isDefault?'Khôi phục TEa mặc định':'Xóa TEa tự thêm',label,'Bảng TEa');
    commit({clearDerived:false});
    return result;
  };
  const addCustom=(input:{data:Value})=>{
    const result=deps.service.addCustomReference(deps.current(),input.data);
    const e=result.record;
    deps.log('Thêm TEa tham chiếu',`${e.name} · CLIA ${e.clia??'—'} · Ricos ${e.ricos??'—'}`,'Bảng TEa');
    commit({},true);
    return result;
  };
  const saveLabProfile=(input:{refKey:any;profile:Value})=>{
    const result=deps.service.saveLabProfile(deps.current(),input.refKey,input.profile);
    const before=result.before,row=result.record,p=input.profile;
    deps.log(before==null?'Thiết lập TEa chuẩn hóa':'Cập nhật TEa chuẩn hóa',
      `${row.name} · ${before??'—'}% → ${p.value}% · ${p.sourceLabel} · ${p.reference} · Hiệu lực ${deps.formatDate(p.effective)} · Xây dựng: ${p.prepared} · Phê duyệt: ${p.approved} (${deps.formatDate(p.approvedDate)})${p.nextReview?' · Xem xét lại '+deps.formatDate(p.nextReview):''} · Lý do: ${p.reason}`,
      'Bảng TEa');
    commit({clearDerived:false},true);
    return result;
  };
  const removeLabProfile=(input:{refKey:any;isDefault:boolean})=>{
    const result=deps.service.removeLabProfile(deps.current(),input.refKey,input.isDefault);
    deps.log('Xóa TEa chuẩn hóa',`${result.record.name} · ${result.before}%`,'Bảng TEa');
    commit({clearDerived:false},true);
    return result;
  };
  return Object.freeze({edit,remove,addCustom,saveLabProfile,removeLabProfile});
}
