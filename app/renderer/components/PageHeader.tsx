// Topbar Clinical Precision dùng chung: ngữ cảnh trang ở trái, tài khoản và
// hành động phiên ở phải. Component nằm trong từng route để sticky theo vùng
// cuộn nội dung; avatar giữ đủ tương tác chuột và bàn phím.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/auth-store';
import { AvatarModal } from './AvatarModal';
import { SoftwareLicenseExpiryNotice } from './SoftwareLicenseExpiry';

function roleLabel(role?: string): string {
  if (role === 'admin') return 'Quản trị';
  if (role === 'technician') return 'KTV';
  return 'Chỉ xem';
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  const [avatarOpen, setAvatarOpen] = useState(false);
  const name = user?.name || user?.username || '';
  const initials = user?.initials?.slice(0, 3) || name.trim().charAt(0).toLocaleUpperCase('vi') || 'U';

  return (
    <><div className="head">
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      {user && (
        <div className="top-user">
          <button type="button" className="avatar" aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện" aria-haspopup="dialog" onClick={() => setAvatarOpen(true)}>
            {user.avatar ? <img src={user.avatar} alt="" /> : initials}
          </button>
          <div className="meta">
            <div className="name" title={name}>{name}</div>
            <div className="role">{roleLabel(user.role)}</div>
          </div>
          <button type="button" className="logout" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
              <path d="M9 12h12m-4-4 4 4-4 4" />
            </svg>
          </button>
        </div>
      )}
      {avatarOpen && <AvatarModal initials={initials} onClose={() => setAvatarOpen(false)} />}
    </div>
    <SoftwareLicenseExpiryNotice /></>
  );
}


