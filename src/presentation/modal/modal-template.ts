import type { BtnAction } from '../shared/ui-primitives';

/* Pha H2 (2026-08-20): action nhận thêm dạng {action,args} — sinh
   data-action/data-args cho action-dispatcher.ts thay vì onclick="..." trần.
   Dạng string cũ vẫn còn dùng ở caller chưa chuyển (tương thích song song có
   chủ đích, giống btn() trong ui-primitives.ts). */
export function createModalTemplate(deps:{escapeAttr:(value:unknown)=>string}){
  const modalCloseButton=(action:string|BtnAction={ action: 'closeModal' })=>{
    const attr=typeof action==='string'?`onclick="${deps.escapeAttr(action)}"`:`data-action="${deps.escapeAttr(action.action)}"${action.args?.length?` data-args="${deps.escapeAttr(JSON.stringify(action.args))}"`:''}`;
    return `<button class="modal-close" ${attr} aria-label="Đóng hộp thoại">✕</button>`;
  };
  const modalTemplate=(options:{title?:string;body?:string;footer?:string;cls?:string;closeAction?:string|BtnAction;bodyClass?:string;footerClass?:string}={})=>{
    const{title='',body='',footer='',cls='',closeAction={ action: 'closeModal' },bodyClass='modal-b',footerClass='modal-f'}=options;
    const classes=['modal',cls].filter(Boolean).join(' ');
    return `<div class="${deps.escapeAttr(classes)}"><div class="modal-h"><h3>${title}</h3>${modalCloseButton(closeAction)}</div>${bodyClass?`<div class="${deps.escapeAttr(bodyClass)}">${body}</div>`:body}${footer?`<div class="${deps.escapeAttr(footerClass)}">${footer}</div>`:''}</div>`;
  };
  return{modalTemplate,modalCloseButton};
}
