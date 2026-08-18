import{queryFocusable,createFocusTrapKeydown}from'./modal-focus-trap';

/* Lớp modal chung (#modalRoot) — form trang (Sửa Panel QC, sửa user...). Tách
   khỏi lớp dialog overlay (#dialogRoot, xem dialog-overlay-controller.ts) vì
   confirmDialog()/infoDialog() thường được gọi từ một guard bên trong modal
   form đang mở; dùng chung root sẽ xóa mất DOM của form đó khi mở hộp thoại. */
export function createModalController(deps:{document:Document;requestFrame:(work:()=>void)=>unknown}){
  let modalReturnFocus:Element|null=null;
  const modalRoot=()=>deps.document.getElementById('modalRoot');
  const activeModal=()=>deps.document.querySelector('#modalRoot .modal');
  const closeModal=()=>{
    const r=modalRoot(),restore=modalReturnFocus;
    deps.document.removeEventListener('keydown',modalKeydown);
    if(r)r.innerHTML='';
    modalReturnFocus=null;
    if(restore&&(restore as HTMLElement).isConnected&&(restore as HTMLElement).focus)deps.requestFrame(()=>(restore as HTMLElement).focus({preventScroll:true}));
  };
  const modalKeydown=createFocusTrapKeydown({activeContainer:activeModal,activeElement:()=>deps.document.activeElement,onEscape:closeModal});
  const openModal=(html:string)=>{
    const r=modalRoot();if(!r)return;
    modalReturnFocus=deps.document.activeElement&&deps.document.activeElement!==deps.document.body?deps.document.activeElement:null;
    r.innerHTML=`<div class="modal-bg" role="presentation" onclick="if(event.target===this)closeModal()">${html}</div>`;
    const modal=r.querySelector('.modal');if(!modal)return;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');(modal as HTMLElement).tabIndex=-1;
    const title=modal.querySelector('.modal-h h3');if(title){if(!title.id)title.id='modalTitle';modal.setAttribute('aria-labelledby',title.id);}
    modal.querySelectorAll('.modal-close').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Đóng hộp thoại');});
    deps.document.removeEventListener('keydown',modalKeydown);deps.document.addEventListener('keydown',modalKeydown);
    deps.requestFrame(()=>{const preferred=modal.querySelector('[autofocus]') as HTMLElement|null,first=preferred||queryFocusable(modal)[0];(first||(modal as HTMLElement)).focus({preventScroll:true});});
  };
  return{openModal,closeModal,modalKeydown};
}
