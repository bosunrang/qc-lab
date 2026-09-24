import { useRef, useState } from 'react';
import { useAuthStore } from '../store/auth-store';
import { Modal } from './Modal';

const AVATAR_SIZE = 160;

export function AvatarModal({ onClose }: { onClose: () => void }) {
  const { user, setAvatar, clearAvatar } = useAuthStore();
  const [fileName, setFileName] = useState('Chưa chọn ảnh nào');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE; canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Fit-cover: phóng ảnh sao cho luôn phủ hết khung vuông rồi canh
        // giữa — khớp đúng `avatar-modal-controller.ts`'s scale/x/y (khác
        // logo ở Cài đặt, nơi CẮT vuông theo cạnh ngắn nhất trước khi thu).
        const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (AVATAR_SIZE - w) / 2, (AVATAR_SIZE - h) / 2, w, h);
        setBusy(true);
        await setAvatar(canvas.toDataURL('image/png'));
        setBusy(false);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function clear() {
    setBusy(true);
    await clearAvatar();
    setBusy(false);
  }

  return (
    <Modal title="Ảnh đại diện" onClose={onClose}
      footer={<><button type="button" className="btn ghost" disabled={busy || !user?.avatar} onClick={clear}>Xóa ảnh</button><button type="button" className="btn teal" onClick={onClose}>Đóng</button></>}>
      <div className="avatar-modal-preview">
        {user?.avatar ? <img src={user.avatar} alt="Ảnh đại diện" /> : <div className="avatar-modal-initial">{(user?.name || user?.username || 'U').trim().charAt(0).toUpperCase() || 'U'}</div>}
      </div>
      <div className="field">
        <label htmlFor="avatarPick">Chọn ảnh mới</label>
        <div className="file-pick">
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => inputRef.current?.click()}>Chọn tệp</button>
          <span className="hint">{fileName}</span>
        </div>
        <input ref={inputRef} id="avatarPick" type="file" accept="image/*" style={{ display: 'none' }} aria-label="Chọn ảnh đại diện mới" onChange={pick} />
      </div>
      <div className="hint flow-note">Ảnh sẽ được cắt vuông và thu nhỏ tự động.</div>
    </Modal>
  );
}


