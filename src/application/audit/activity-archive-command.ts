type AuditEntry=Record<string,any>;
type AuditState={activity?:AuditEntry[];activityAnchor?:string};
type Dialog=Record<string,any>;
export type ActivityArchiveCommand=Readonly<{execute:(rawMonths:unknown)=>Promise<{status:'empty'|'cancelled'|'done'|'download-error'}>}>

export function createActivityArchiveCommand(deps:{current:()=>AuditState;window:(value:unknown)=>{months:number;cutoffIso:string};cut:(activity:AuditEntry[],cutoffIso:string)=>{segment:AuditEntry[];retained:AuditEntry[];tipHash:string};confirm:(dialog:Dialog)=>Promise<boolean>;reauthenticate:(input:Dialog)=>Promise<boolean>;download:(name:string,rows:AuditEntry[])=>void;log:(type:string,detail:string,target:string)=>void;save:()=>void;close:()=>void;render:()=>void;info:(message:string,options?:Dialog)=>Promise<unknown>;dateLabel:(iso:string)=>string}):ActivityArchiveCommand{
  const execute=async(rawMonths:unknown)=>{
    const window=deps.window(rawMonths),cut=deps.cut(deps.current().activity||[],window.cutoffIso);
    if(!cut.segment.length){deps.close();await deps.info('Không có dòng nhật ký nào cũ hơn mốc đã chọn.');return {status:'empty'} as const;}
    if(!await deps.confirm({kicker:'Thao tác không thể hoàn tác',title:'Lưu trữ nhật ký cũ',message:`Xuất CSV rồi gỡ ${cut.segment.length} dòng nhật ký cũ hơn ${window.months} tháng?`,detail:`Còn lại ${cut.retained.length} dòng trong hệ thống. File CSV giữ nguyên PrevHash/Hash từng dòng và nối tiếp được vào chuỗi còn lại.`,confirmLabel:'Lưu trữ',cancelLabel:'Hủy'}))return {status:'cancelled'} as const;
    if(!await deps.reauthenticate({title:'Xác thực lưu trữ nhật ký',message:'Nhập lại mật khẩu trước khi gỡ nhật ký cũ khỏi hệ thống.'}))return {status:'cancelled'} as const;
    try{deps.download('Luu_tru_nhat_ky_QCLab_'+window.cutoffIso.slice(0,10)+'.csv',cut.segment);}catch{await deps.info('Không tạo được file CSV lưu trữ. Nhật ký chưa bị thay đổi.');return {status:'download-error'} as const;}
    if(!await deps.confirm({kicker:'Kiểm tra trước khi gỡ',title:'Đã có file CSV lưu trữ chưa?',message:'Mở thư mục Tải xuống và kiểm tra file vừa tải có mở được và đủ dòng.',detail:'Chỉ bấm "Đã kiểm tra" khi bạn thực sự thấy file — sau bước này các dòng cũ bị gỡ khỏi hệ thống.',confirmLabel:'Đã kiểm tra, gỡ khỏi hệ thống',cancelLabel:'Chưa, giữ nguyên'}))return {status:'cancelled'} as const;
    const state=deps.current();state.activity=cut.retained;state.activityAnchor=cut.tipHash||'';
    deps.log('Lưu trữ nhật ký hoạt động',`Đã xuất CSV và gỡ ${cut.segment.length} dòng cũ hơn ${window.months} tháng (mốc ${deps.dateLabel(window.cutoffIso.slice(0,10))}), còn lại ${cut.retained.length} dòng. Hash đỉnh phần lưu trữ: ${cut.tipHash||'—'}`,'Nhật ký');
    deps.save();deps.close();deps.render();await deps.info(`Đã lưu trữ ${cut.segment.length} dòng nhật ký cũ — file CSV đã được tải xuống.`,{type:'success'});
    return {status:'done'} as const;
  };
  return Object.freeze({execute});
}
