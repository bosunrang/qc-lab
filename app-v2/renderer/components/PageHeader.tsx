// Tiêu đề trang — sao chép nguyên bố cục src/react/components/PageHeader.tsx
// bản cũ (tiêu đề+phụ đề bên trái, khối người dùng+nút đăng xuất bên phải,
// cùng 1 hàng `.head`, sticky theo CSS ở app.css). Mỗi trong 11 trang tự gọi
// component này ở đầu nội dung — KHÔNG đưa vào AppShell (bản cũ cũng không
// đưa vào 1 shell cố định, mà lặp lại y hệt ở đầu mỗi trang; giữ đúng cấu
// trúc đó để `.head` sticky theo scroll của TỪNG trang, không phải 1 topbar
// cố định toàn app).
//
// Avatar bấm được (2026-09-04) — trước đó chỉ còn `aria-hidden`, mất hẳn
// tính năng "Đổi ảnh đại diện" của app cũ (`role="button" tabIndex={0}` +
// onClick/onKeyDown mở `<AvatarModal>`, xem `PageHeader.tsx` app cũ).
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
