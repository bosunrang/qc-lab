import{queryFocusable,createFocusTrapKeydown}from'./modal-focus-trap';

/* confirmDialog()/infoDialog() thay confirm()/alert() gốc, render vào
   #dialogRoot (không phải #modalRoot — xem modal-controller.ts). Chỉ một hộp
   thoại loại này mở cùng lúc nên chỉ cần giữ một resolver. */
type Action=string|{action:string;args?:unknown[]};
export function createDialogOverlayController(deps:{document:Document;requestFrame:(work:()=>void)=>unknown;modalCloseButton:(action?:Action)=>string;escape:(value:unknown)=>string;button:(label:string,action:Action,cls?:string)=>string}){
  let dialogReturnFocus:Element|null=null;
  let pendingDialogResolve:((result?:unknown)=>void)|null=null;
  const dialogRoot=()=>deps.document.getElementById('dialogRoot');
  const activeDialog=()=>deps.document.querySelector('#dialogRoot .modal');
  const closeDialogOverlay=(result?:unknown)=>{
    const r=dialogRoot(),restore=dialogReturnFocus,resolve=pendingDialogResolve;
    deps.document.removeEventListener('keydown',dialogKeydown);
    if(r)r.innerHTML='';
    dialogReturnFocus=null;pendingDialogResolve=null;
    if(restore&&(restore as HTMLElement).isConnected&&(restore as HTMLElement).focus)deps.requestFrame(()=>(restore as HTMLElement).focus({preventScroll:true}));
    if(resolve)resolve(result);
  };
  const dialogKeydown=createFocusTrapKeydown({activeContainer:activeDialog,activeElement:()=>deps.document.activeElement,onEscape:()=>closeDialogOverlay()});
  const openDialogOverlay=(html:string,resolve:(result?:unknown)=>void)=>{
    const r=dialogRoot();if(!r)return;
    dialogReturnFocus=deps.document.activeElement&&deps.document.activeElement!==deps.document.body?deps.document.activeElement:null;
    pendingDialogResolve=resolve;
    r.innerHTML=`<div class="modal-bg" role="presentation" data-action="closeDialogOverlay" data-action-self-only>${html}</div>`;
    const box=r.querySelector('.modal');if(!box)return;
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');(box as HTMLElement).tabIndex=-1;
    const title=box.querySelector('.confirm-modal-title, .confirm-modal-text b');if(title){if(!title.id)title.id='dialogTitle';box.setAttribute('aria-labelledby',title.id);}
    box.querySelectorAll('.modal-close').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Đóng hộp thoại');});
    deps.document.removeEventListener('keydown',dialogKeydown);deps.document.addEventListener('keydown',dialogKeydown);
    deps.requestFrame(()=>{const preferred=box.querySelector('[autofocus]') as HTMLElement|null,first=preferred||queryFocusable(box)[0];(first||(box as HTMLElement)).focus({preventScroll:true});});
  };
  const confirmDialogAnswer=(result?:unknown)=>closeDialogOverlay(result);
  const confirmDialog=(opts:{kicker?:string;title?:string;message?:string;detail?:string;confirmLabel?:string;cancelLabel?:string;danger?:boolean}={})=>{
    const{kicker='',title='',message='',detail='',confirmLabel='Xác nhận',cancelLabel='Hủy',danger=true}=opts;
    return new Promise<boolean>(resolve=>{
      openDialogOverlay(`<div class="modal confirm-modal">
        <div class="confirm-modal-h">${kicker?`<div class="confirm-modal-kicker">${deps.escape(kicker)}</div>`:'<div></div>'}${deps.modalCloseButton({action:'confirmDialogAnswer',args:[false]})}</div>
        <h3 class="confirm-modal-title">${deps.escape(title)}</h3>
        <div class="confirm-modal-body"><div class="confirm-modal-icon${danger?'':' info'}" aria-hidden="true">!</div><div class="confirm-modal-text"><b>${deps.escape(message)}</b>${detail?`<p>${deps.escape(detail)}</p>`:''}</div></div>
        <div class="confirm-modal-actions">${deps.button(deps.escape(cancelLabel),{action:'confirmDialogAnswer',args:[false]},'ghost')}${deps.button(deps.escape(confirmLabel),{action:'confirmDialogAnswer',args:[true]},danger?'danger':'teal')}</div>
      </div>`,resolve as (result?:unknown)=>void);
    });
  };
  const infoDialogAnswer=()=>closeDialogOverlay();
  const infoDialog=(message:string,opts:{title?:string;type?:'warn'|'success'}={})=>{
    const{title='',type='warn'}=opts;
    const glyph=type==='success'?'✓':'!';
    return new Promise(resolve=>{
      openDialogOverlay(`<div class="modal confirm-modal info-modal">
        <div class="confirm-modal-h"><div></div>${deps.modalCloseButton({action:'infoDialogAnswer'})}</div>
        ${title?`<h3 class="confirm-modal-title">${deps.escape(title)}</h3>`:''}
        <div class="confirm-modal-body"><div class="confirm-modal-icon info-modal-icon ${type}" aria-hidden="true">${glyph}</div><div class="confirm-modal-text"><b>${deps.escape(message)}</b></div></div>
        <div class="confirm-modal-actions">${deps.button('Đã hiểu',{action:'infoDialogAnswer'},'teal')}</div>
      </div>`,resolve);
    });
  };
  return{openDialogOverlay,closeDialogOverlay,dialogKeydown,confirmDialog,confirmDialogAnswer,infoDialog,infoDialogAnswer};
}
