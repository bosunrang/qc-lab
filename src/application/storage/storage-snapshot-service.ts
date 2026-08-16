export type StorageSnapshotOptions={changed?:boolean;quiet?:boolean};
export type StorageSnapshotService=Readonly<{persist:(options?:StorageSnapshotOptions)=>boolean}>;

/* Điều phối một lần lưu snapshot. Service giữ luật quyết định của persistence:
   snapshot phân vùng được ưu tiên (và tự xử lý transaction A/B), localStorage
   luôn mirror sang IndexedDB khi dùng đường legacy, và chỉ xóa draft Sigma khi
   tối thiểu một đích đã nhận dữ liệu. Mutable runtime state vẫn do adapter giữ
   vì test sandbox cần quan sát trực tiếp các biến ls*. */
export function createStorageSnapshotService(deps:{
  markChanged:()=>void;
  dirty:()=>boolean;
  cancelScheduled:()=>void;
  clearDirty:()=>void;
  draftStamp:()=>number;
  usePartitioned:()=>boolean;
  writePartitioned:(input:{quiet:boolean;draftStamp:number})=>boolean;
  serialize:()=>string;
  writeLocal:(raw:string,savedAt:number,quiet:boolean)=>boolean;
  mirror:(raw:string)=>boolean;
  needsCloud:()=>boolean;
  clearDraftThrough:(stamp:number)=>void;
  resetFailures:()=>void;
  markDirty:()=>void;
  incrementFailures:()=>void;
  retry:()=>void;
  markSaved:(label:string,detail:string)=>void;
  now:()=>number;
}):StorageSnapshotService{
  const persist=(options:StorageSnapshotOptions={}):boolean=>{
    if(options.changed)deps.markChanged();
    if(!deps.dirty())return false;
    deps.cancelScheduled();deps.clearDirty();
    const draftStamp=deps.draftStamp(),quiet=!!options.quiet;
    if(deps.usePartitioned())return deps.writePartitioned({quiet,draftStamp});
    let raw:string;
    try{raw=deps.serialize();}
    catch{deps.markDirty();if(!quiet)deps.markSaved('lỗi lưu cục bộ','Không thể tạo snapshot');return false;}
    const localSaved=deps.writeLocal(raw,deps.now(),quiet),mirrored=deps.mirror(raw);
    if((localSaved||mirrored)&&!deps.needsCloud())deps.clearDraftThrough(draftStamp);
    if(localSaved||mirrored)deps.resetFailures();
    if(!localSaved&&!mirrored){deps.markDirty();deps.incrementFailures();deps.retry();}
    if(!localSaved&&mirrored&&!quiet)deps.markSaved('đã lưu dự phòng','IndexedDB');
    return localSaved||mirrored;
  };
  return Object.freeze({persist});
}
