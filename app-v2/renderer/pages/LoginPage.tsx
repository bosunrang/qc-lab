import { useState } from 'react';
import { useAuthStore } from '../store/auth-store';

// Bố cục giống hệt màn hình đăng nhập của app cũ (nền gradient xanh đậm +
// card trắng nổi giữa, brand-mark "QC" teal, tiêu đề/phụ đề) — xem
// CLAUDE.md mục "Đăng nhập/LoginPage" và app.css's `.auth-*`. Trước đây
// trang này chưa từng được style (chỉ `sans-serif`/input trần) vì nằm
// ngoài luồng AppRouter/AppShell bình thường (render TRƯỚC khi đăng nhập).
function BrandMark() {
  return <div className="brand-mark">QC</div>;
}

export function LoginPage() {
  const { status, error, bootstrapAdmin, login, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  if (status === 'needs-bootstrap') {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-head">
            <BrandMark />
            <div className="auth-head-text">
              <div className="auth-brand">QC Lab</div>
              <div className="auth-sub">Nội kiểm xét nghiệm</div>
            </div>
          </div>
          <p>Chưa có tài khoản nào trong hệ thống — tạo tài khoản quản trị đầu tiên để bắt đầu.</p>
          <div className="field"><label>Tên đăng nhập</label><input value={username} autoFocus onChange={(e) => { clearError(); setUsername(e.target.value); }} /></div>
          <div className="field"><label>Họ tên</label><input value={name} onChange={(e) => { clearError(); setName(e.target.value); }} /></div>
          <div className="field"><label>Mật khẩu (≥8 ký tự)</label><input type="password" value={password} onChange={(e) => { clearError(); setPassword(e.target.value); }} /></div>
          {error && <div className="auth-err">{error}</div>}
          <div className="auth-actions"><button className="btn teal" onClick={() => bootstrapAdmin(username, name, password)}>Tạo tài khoản quản trị</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-head">
          <BrandMark />
          <div className="auth-head-text">
            <div className="auth-brand">QC Lab</div>
            <div className="auth-sub">Nội kiểm xét nghiệm</div>
          </div>
        </div>
        <div className="field"><label>Tên đăng nhập</label><input value={username} autoFocus onChange={(e) => { clearError(); setUsername(e.target.value); }} /></div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={password}
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') login(username, password); }} />
        </div>
        {error && <div className="auth-err">{error}</div>}
        <div className="auth-actions"><button className="btn teal" onClick={() => login(username, password)}>Đăng nhập</button></div>
        <div className="auth-hint">QC Lab — kiến trúc app-v2</div>
      </div>
    </div>
  );
}
