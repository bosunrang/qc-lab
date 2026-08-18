type Value=Record<string,any>;
type LotGroupCommand={save:(input:any)=>Value;remove:(input:any)=>Value;stop:(input:any)=>Value};
type LotGroupActivationCommand={preview:(input:any)=>Value;execute:(input:any)=>Value};
export type ManageLotGroupWorkflowCommand=Readonly<{
  save:(input:{id?:string;newId:string;data:Value})=>Value;
  remove:(input:{id:string})=>Value;
  stop:(input:{id:string;stoppedAt:string})=>Value;
  previewActivation:(input:{id:string})=>Value;
  executeActivation:(input:{group:Value;candidates:Value[];effectiveFrom:string;note:string})=>Value;
}>;
/* Mọi thao tác trên nhóm lô gộp chung 1 file, dù dùng 2 command cấp thấp khác nhau
   (ManageLotGroupCommand.save/remove/stop, ManageLotGroupActivationCommand).
   executeActivation() chỉ commit audit/save/render khi status==='applied'; 'already-active' vẫn
   cần save+render (applyActivation() đã âm thầm gỡ nhãn cũ dù không có gì mới để áp dụng), còn
   'unready' không đụng state nên không cần lưu — adapter JS chỉ còn chọn thông báo theo status. */
export function createManageLotGroupWorkflowCommand(deps:{current:()=>Value;group:LotGroupCommand;activation:LotGroupActivationCommand;reconcileSigma:()=>{pruned:number};log:(action:string,detail:string,target:string)=>void;saveState:(options:Value)=>void;close:()=>void;render:()=>void}):ManageLotGroupWorkflowCommand{
  const save=(input:{id?:string;newId:string;data:Value})=>{
    const result=deps.group.save({state:deps.current(),...input});
    if(!result.ok)return result;
    const sigmaSync=deps.reconcileSigma(),syncNote=sigmaSync.pruned?` · đã xóa ${sigmaSync.pruned} dữ liệu mức Sigma không còn trong nhóm`:'';
    deps.log(result.created?'Thêm nhóm lô':'Cập nhật nhóm lô',result.record.name+syncNote,'Nhóm lô');
    deps.close();deps.saveState({});deps.render();
    return result;
  };
  const remove=(input:{id:string})=>{
    const result=deps.group.remove({state:deps.current(),...input});
    if(!result.ok)return result;
    deps.log('Xóa nhóm lô',result.record.name,'Nhóm lô');
    deps.saveState({});deps.render();
    return result;
  };
  const stop=(input:{id:string;stoppedAt:string})=>{
    const result=deps.group.stop({state:deps.current(),...input});
    if(!result.ok)return result;
    deps.log('Dừng nhóm lô',result.record.name,'Nhóm lô');
    deps.saveState({});deps.render();
    return result;
  };
  const previewActivation=(input:{id:string})=>deps.activation.preview({state:deps.current(),...input});
  const executeActivation=(input:{group:Value;candidates:Value[];effectiveFrom:string;note:string})=>{
    const result=deps.activation.execute({state:deps.current(),...input});
    if(result.status==='applied'){result.effects.audit.forEach((a:Value)=>deps.log(a.action,a.detail,a.target));deps.saveState(result.effects.save);deps.render();}
    else if(result.status==='already-active'){deps.saveState({});deps.render();}
    return result;
  };
  return Object.freeze({save,remove,stop,previewActivation,executeActivation});
}
