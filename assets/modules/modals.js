/* ===== MODAL chung ===== */
let modalReturnFocus=null;
function modalFocusable(modal){return[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);}
function modalCloseButton(action='closeModal()'){return `<button class="modal-close" onclick="${escAttr(action)}" aria-label="Đóng hộp thoại">✕</button>`;}
function modalTemplate({title='',body='',footer='',cls='',closeAction='closeModal()',bodyClass='modal-b',footerClass='modal-f'}={}){
  const classes=['modal',cls].filter(Boolean).join(' ');
  return `<div class="${escAttr(classes)}"><div class="modal-h"><h3>${title}</h3>${modalCloseButton(closeAction)}</div>${bodyClass?`<div class="${escAttr(bodyClass)}">${body}</div>`:body}${footer?`<div class="${escAttr(footerClass)}">${footer}</div>`:''}</div>`;
}
function modalKeydown(event){
  const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();closeModal();return;}
  if(event.key!=='Tab')return;
  const items=modalFocusable(modal);if(!items.length){event.preventDefault();modal.focus();return;}
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
function closeModal(){
  const r=document.getElementById('modalRoot'),restore=modalReturnFocus;
  document.removeEventListener('keydown',modalKeydown);if(r)r.innerHTML='';modalReturnFocus=null;
  if(restore&&restore.isConnected&&restore.focus)requestAnimationFrame(()=>restore.focus({preventScroll:true}));
}
function openModal(html){
  const r=document.getElementById('modalRoot');if(!r)return;
  modalReturnFocus=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
  r.innerHTML=`<div class="modal-bg" role="presentation" onclick="if(event.target===this)closeModal()">${html}</div>`;
  const modal=r.querySelector('.modal');if(!modal)return;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
  const title=modal.querySelector('.modal-h h3');if(title){if(!title.id)title.id='modalTitle';modal.setAttribute('aria-labelledby',title.id);}
  modal.querySelectorAll('.modal-close').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Đóng hộp thoại');});
  document.removeEventListener('keydown',modalKeydown);document.addEventListener('keydown',modalKeydown);
  requestAnimationFrame(()=>{const preferred=modal.querySelector('[autofocus]'),first=preferred||modalFocusable(modal)[0];(first||modal).focus({preventScroll:true});});
}
/* ===== DIALOG OVERLAY (confirmDialog/infoDialog — thay confirm()/alert() gốc) =====
   Render vào #dialogRoot, KHÔNG dùng #modalRoot: confirmDialog()/infoDialog()
   thường được gọi từ một guard kiểm tra dữ liệu bên trong modal form đang mở
   (vd "Sửa Panel QC"). Nếu dùng chung #modalRoot, mở hộp thoại sẽ xóa mất DOM
   của modal form đó — và innerHTML chỉ phản ánh giá trị ATTRIBUTE ban đầu của
   input/textarea, không phải giá trị người dùng vừa gõ (property), nên dựng
   lại form từ innerHTML cũ sẽ mất trắng những gì họ đã nhập. Có lớp riêng thì
   modal form phía dưới không bao giờ bị đụng tới, dù người dùng trả lời gì.
   Chỉ một hộp thoại loại này mở cùng lúc nên chỉ cần giữ một resolver. */
let dialogReturnFocus=null,pendingDialogResolve=null;
function dialogFocusable(box){return[...box.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);}
function dialogKeydown(event){
  const box=document.querySelector('#dialogRoot .modal');if(!box)return;
  if(event.key==='Escape'){event.preventDefault();closeDialogOverlay();return;}
  if(event.key!=='Tab')return;
  const items=dialogFocusable(box);if(!items.length){event.preventDefault();box.focus();return;}
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
function closeDialogOverlay(result){
  const r=document.getElementById('dialogRoot'),restore=dialogReturnFocus,resolve=pendingDialogResolve;
  document.removeEventListener('keydown',dialogKeydown);if(r)r.innerHTML='';dialogReturnFocus=null;pendingDialogResolve=null;
  if(restore&&restore.isConnected&&restore.focus)requestAnimationFrame(()=>restore.focus({preventScroll:true}));
  if(resolve)resolve(result);
}
function openDialogOverlay(html,resolve){
  const r=document.getElementById('dialogRoot');if(!r)return;
  dialogReturnFocus=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
  pendingDialogResolve=resolve;
  r.innerHTML=`<div class="modal-bg" role="presentation" onclick="if(event.target===this)closeDialogOverlay()">${html}</div>`;
  const box=r.querySelector('.modal');if(!box)return;
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.tabIndex=-1;
  const title=box.querySelector('.confirm-modal-title, .confirm-modal-text b');if(title){if(!title.id)title.id='dialogTitle';box.setAttribute('aria-labelledby',title.id);}
  box.querySelectorAll('.modal-close').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Đóng hộp thoại');});
  document.removeEventListener('keydown',dialogKeydown);document.addEventListener('keydown',dialogKeydown);
  requestAnimationFrame(()=>{const preferred=box.querySelector('[autofocus]'),first=preferred||dialogFocusable(box)[0];(first||box).focus({preventScroll:true});});
}
function confirmDialogAnswer(result){closeDialogOverlay(result);}
function confirmDialog(opts){
  const{kicker='',title='',message='',detail='',confirmLabel='Xác nhận',cancelLabel='Hủy',danger=true}=opts||{};
  return new Promise(resolve=>{
    openDialogOverlay(`<div class="modal confirm-modal">
      <div class="confirm-modal-h">${kicker?`<div class="confirm-modal-kicker">${esc(kicker)}</div>`:'<div></div>'}${modalCloseButton('confirmDialogAnswer(false)')}</div>
      <h3 class="confirm-modal-title">${esc(title)}</h3>
      <div class="confirm-modal-body"><div class="confirm-modal-icon${danger?'':' info'}" aria-hidden="true">!</div><div class="confirm-modal-text"><b>${esc(message)}</b>${detail?`<p>${esc(detail)}</p>`:''}</div></div>
      <div class="confirm-modal-actions">${btn(esc(cancelLabel),'confirmDialogAnswer(false)','ghost')}${btn(esc(confirmLabel),'confirmDialogAnswer(true)',danger?'danger':'teal')}</div>
    </div>`,resolve);
  });
}
/* infoDialog(): thay alert() — 1 nút, không có lựa chọn Hủy. type='warn' (mặc
   định, phần lớn alert() cũ là cảnh báo/chặn thao tác không hợp lệ) hoặc
   'success' (thao tác vừa hoàn tất, vd "Đã xóa..."). */
function infoDialogAnswer(){closeDialogOverlay();}
function infoDialog(message,opts={}){
  const{title='',type='warn'}=opts||{};
  const glyph=type==='success'?'✓':'!';
  return new Promise(resolve=>{
    openDialogOverlay(`<div class="modal confirm-modal info-modal">
      <div class="confirm-modal-h"><div></div>${modalCloseButton('infoDialogAnswer()')}</div>
      ${title?`<h3 class="confirm-modal-title">${esc(title)}</h3>`:''}
      <div class="confirm-modal-body"><div class="confirm-modal-icon info-modal-icon ${type}" aria-hidden="true">${glyph}</div><div class="confirm-modal-text"><b>${esc(message)}</b></div></div>
      <div class="confirm-modal-actions">${btn('Đã hiểu','infoDialogAnswer()','teal')}</div>
    </div>`,resolve);
  });
}

