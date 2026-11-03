import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/auth-store';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { AuthBrand } from './LoginPage';
import type { LoginBrand } from '../../shared/qc-api';

// Màn bắt buộc đổi mật khẩu (GV5): tài khoản do admin tạo hoặc vừa được đặt
// lại mật khẩu (`must_change_password`). Main chặn mọi thao tác khác của tài
// khoản này cho tới khi đổi xong, nên app hiện màn này thay cho khung chính.
export function ChangePasswordPage() {
  const { user, refreshUser, logout } = useAuthStore(useShallow((s) => ({ user: s.user, refreshUser: s.refreshUser, logout: s.logout })));
  const [brand, setBrand] = useState<LoginBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.qcApi.getLoginBrand().then((value) => { if (!cancelled) setBrand(value); }).catch(() => { /* Dùng nhận diện mặc định. */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <AuthBrand brand={brand} />
        <div className="auth-setup">
          <span className="auth-kicker">Đổi mật khẩu</span>
          <p>Tài khoản <b>{user?.username}</b> đang dùng mật khẩu do quản trị viên đặt. Đặt mật khẩu của riêng bạn trước khi tiếp tục.</p>
        </div>
        <div className="auth-form">
          <ChangePasswordForm submitLabel="Đổi mật khẩu và tiếp tục" onDone={refreshUser} />
        </div>
        <div className="auth-hint"><button type="button" className="btn ghost sm" onClick={() => void logout()}>Đăng xuất</button></div>
      </div>
    </div>
  );
}
