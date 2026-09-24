// Topbar Clinical Precision dùng chung: ngữ cảnh trang ở trái, tài khoản và
// hành động phiên ở phải. Component nằm trong từng route để sticky theo vùng
// cuộn nội dung; avatar giữ đủ tương tác chuột và bàn phím.
import { useState } from 'react';
import { useAuthStore } from '../store/auth-store';
import { AvatarModal } from './AvatarModal';

function roleLabel(role?: string): string {
  if (role === 'admin') return 'Quản trị';
  if (role === 'technician') return 'KTV';
  return 'Chỉ xem';
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuthStore();
  const [avatarOpen, setAvatarOpen] = useState(false);
  return (
    <div className="head">
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      <div className="head-actions">
        {user && (
          <div className="top-user">
            <div className="avatar" role="button" tabIndex={0} aria-label="Đổi ảnh đại diện" onClick={() => setAvatarOpen(true)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAvatarOpen(true); } }}>
              {user.avatar ? <img src={user.avatar} alt="" /> : (user.name || user.username || 'U').trim().charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="meta">
              <div className="name">{user.name || user.username}</div>
              <div className="role">{roleLabel(user.role)}</div>
            </div>
            <button type="button" onClick={logout} title="Đăng xuất">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 5v14" /></svg>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
      {avatarOpen && <AvatarModal onClose={() => setAvatarOpen(false)} />}
    </div>
  );
}


