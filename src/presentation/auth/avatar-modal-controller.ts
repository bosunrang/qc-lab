type AnyRec = any;

export function createAvatarModalController(deps: {
  document: Document;
  createImage: () => HTMLImageElement;
  createFileReader: () => FileReader;
  currentUser: () => AnyRec;
  avatarCommand: { setAvatar: (user: AnyRec, dataUrl: string) => AnyRec; clearAvatar: (user: AnyRec) => AnyRec };
  infoDialog: (message: string, opts?: AnyRec) => Promise<unknown>;
  openModal: (html: string) => void;
  closeModal: () => void;
  rerender: () => void;
  escapeAttr: (value: unknown) => string;
  html: { avatarModalHtml: (input: AnyRec) => string };
  btn: (label: string, onclick: AnyRec, cls?: string, title?: string, opts?: AnyRec) => string;
}) {
  const previewHtml = () => {
    const user = deps.currentUser();
    if (user && user.avatar) return `<img src="${deps.escapeAttr(user.avatar)}" alt="Ảnh đại diện">`;
    const initial = String((user && (user.name || user.username)) || 'U').trim().charAt(0).toUpperCase() || 'U';
    return `<div class="avatar-modal-initial">${initial}</div>`;
  };

  let pickedFileName = 'Chưa chọn ảnh nào';

  const renderModal = () => deps.openModal(deps.html.avatarModalHtml({
    previewHtml: previewHtml(),
    pickButtonHtml: deps.btn('Chọn tệp', { action: 'clickElementById', args: ['avatarPick'] }, 'ghost sm', '', { attrs: { type: 'button' } }),
    fileNameText: pickedFileName,
    clearButtonHtml: deps.btn('Xóa ảnh', { action: 'clearAvatarPhoto' }, 'ghost', '', { disabled: !(deps.currentUser() && deps.currentUser().avatar) }),
    closeButtonHtml: deps.btn('Đóng', { action: 'closeModal' }, 'teal'),
  }));

  const openAvatarModal = () => { if (!deps.currentUser()) return; pickedFileName = 'Chưa chọn ảnh nào'; renderModal(); };

  const pickAvatar = (e: AnyRec) => {
    const user = deps.currentUser();
    if (!user) return;
    const f = e && e.target && e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { void deps.infoDialog('Vui lòng chọn file ảnh.'); return; }
    pickedFileName = f.name;
    const r = deps.createFileReader();
    r.onload = () => {
      const img = deps.createImage();
      img.onload = () => {
        const size = 160, c = deps.document.createElement('canvas'), ctx = c.getContext('2d')!;
        c.width = size; c.height = size;
        const scale = Math.max(size / img.width, size / img.height), w = img.width * scale, h = img.height * scale, x = (size - w) / 2, y = (size - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        deps.avatarCommand.setAvatar(user, c.toDataURL('image/png'));
        renderModal();
        deps.rerender();
      };
      img.onerror = async () => { await deps.infoDialog('Không đọc được ảnh.'); };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  };

  const clearAvatarPhoto = () => {
    const user = deps.currentUser();
    if (!user) return;
    deps.avatarCommand.clearAvatar(user);
    renderModal();
    deps.rerender();
  };

  return { openAvatarModal, pickAvatar, clearAvatarPhoto };
}
