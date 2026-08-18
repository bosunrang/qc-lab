export function createModalTemplate(deps:{escapeAttr:(value:unknown)=>string}){
  const modalCloseButton=(action:string='closeModal()')=>`<button class="modal-close" onclick="${deps.escapeAttr(action)}" aria-label="Đóng hộp thoại">✕</button>`;
  const modalTemplate=(options:{title?:string;body?:string;footer?:string;cls?:string;closeAction?:string;bodyClass?:string;footerClass?:string}={})=>{
    const{title='',body='',footer='',cls='',closeAction='closeModal()',bodyClass='modal-b',footerClass='modal-f'}=options;
    const classes=['modal',cls].filter(Boolean).join(' ');
    return `<div class="${deps.escapeAttr(classes)}"><div class="modal-h"><h3>${title}</h3>${modalCloseButton(closeAction)}</div>${bodyClass?`<div class="${deps.escapeAttr(bodyClass)}">${body}</div>`:body}${footer?`<div class="${deps.escapeAttr(footerClass)}">${footer}</div>`:''}</div>`;
  };
  return{modalTemplate,modalCloseButton};
}
