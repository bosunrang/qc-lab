import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/auth-store';
import type { LoginBrand } from '../../shared/qc-api';
import { useLoginBrand } from '../lib/useLoginBrand';

// Nhận diện dùng chung cho các màn xác thực. Trang đăng nhập đặt khung trắng
// trên mẫu nền Naviva, giữ các ô nhập và tiêu đề rõ ràng khi đổi cỡ màn hình.
export function AuthBrand({ brand }: { brand: LoginBrand | null }) {
  const title = brand?.brand_title || 'QC Lab';
  const sub = brand?.brand_sub || 'Nội kiểm xét nghiệm';
  const mark = (brand?.logo_text || 'QC').slice(0, 4);
  return <div className="auth-head">
    <div className="brand-mark">{brand?.logo_data ? <img src={brand.logo_data} alt="" /> : mark}</div>
    <div className="auth-head-text">
      <div className="auth-brand">{title}</div>
      <div className="auth-sub">{sub}</div>
    </div>
  </div>;
}

export function LoginPage() {
  const { status, error, bootstrapAdmin, login, clearError } = useAuthStore(useShallow((s) => ({ status: s.status, error: s.error, bootstrapAdmin: s.bootstrapAdmin, login: s.login, clearError: s.clearError })));
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const brand = useLoginBrand();
  const bootstrapErrorField = error && ({
    'missing-username': 'bootstrap-username', 'invalid-username': 'bootstrap-username', 'duplicate-username': 'bootstrap-username',
    'missing-name': 'bootstrap-name', 'weak-password': 'bootstrap-password',
  } as Record<string, string>)[error.code];
  const loginErrorField = error?.code === 'session-ended' ? null
    : error?.code === 'missing-credentials' && !username.trim() ? 'login-username' : error ? 'login-password' : null;

  if (status === 'needs-bootstrap') {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <AuthBrand brand={brand} />
          <div className="auth-setup">
            <span className="auth-kicker">Thiết lập ban đầu</span>
            <p>Chưa có tài khoản nào trong hệ thống. Tạo tài khoản quản trị đầu tiên để bắt đầu.</p>
          </div>
          <form className="auth-form" onSubmit={(event) => { event.preventDefault(); bootstrapAdmin(username, name, password); }}>
            <div className="field auth-field"><label htmlFor="bootstrap-username">Tên đăng nhập</label><input id="bootstrap-username" value={username} autoFocus aria-invalid={bootstrapErrorField === 'bootstrap-username' || undefined} aria-describedby={bootstrapErrorField === 'bootstrap-username' ? 'bootstrap-error' : undefined} onChange={(e) => { clearError(); setUsername(e.target.value); }} />{bootstrapErrorField === 'bootstrap-username' && <p id="bootstrap-error" className="field-error" role="alert">{error?.message}</p>}</div>
            <div className="field auth-field"><label htmlFor="bootstrap-name">Họ tên</label><input id="bootstrap-name" value={name} aria-invalid={bootstrapErrorField === 'bootstrap-name' || undefined} aria-describedby={bootstrapErrorField === 'bootstrap-name' ? 'bootstrap-error' : undefined} onChange={(e) => { clearError(); setName(e.target.value); }} />{bootstrapErrorField === 'bootstrap-name' && <p id="bootstrap-error" className="field-error" role="alert">{error?.message}</p>}</div>
            <div className="field auth-field"><label htmlFor="bootstrap-password">Mật khẩu <span>(tối thiểu 8 ký tự)</span></label><input id="bootstrap-password" type="password" value={password} aria-invalid={bootstrapErrorField === 'bootstrap-password' || undefined} aria-describedby={bootstrapErrorField === 'bootstrap-password' ? 'bootstrap-error' : undefined} onChange={(e) => { clearError(); setPassword(e.target.value); }} />{bootstrapErrorField === 'bootstrap-password' && <p id="bootstrap-error" className="field-error" role="alert">{error?.message}</p>}</div>
            {error && !bootstrapErrorField && <div className="auth-err" role="alert">{error.message}</div>}
            <div className="auth-actions"><button className="btn teal" type="submit">Tạo tài khoản quản trị</button></div>
          </form>
          <div className="auth-hint">Phiên bản {import.meta.env.VITE_APP_VERSION}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <AuthBrand brand={brand} />
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); login(username, password); }}>
          <div className="field auth-field"><label htmlFor="login-username">Tên đăng nhập</label><input id="login-username" value={username} autoFocus aria-invalid={loginErrorField === 'login-username' || undefined} aria-describedby={loginErrorField === 'login-username' ? 'login-error' : undefined} onChange={(e) => { clearError(); setUsername(e.target.value); }} />{loginErrorField === 'login-username' && <p id="login-error" className="field-error" role="alert">{error?.message}</p>}</div>
          <div className="field auth-field">
            <label htmlFor="login-password">Mật khẩu</label>
          <input type="password" value={password}
            id="login-password"
            aria-invalid={loginErrorField === 'login-password' || undefined}
            aria-describedby={loginErrorField === 'login-password' ? 'login-error' : undefined}
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
          />
          {loginErrorField === 'login-password' && <p id="login-error" className="field-error" role="alert">{error?.message}</p>}
          </div>
          {error && !loginErrorField && <div className="auth-err" role="alert">{error.message}</div>}
          <div className="auth-actions"><button className="btn teal" type="submit">Đăng nhập</button></div>
        </form>
        <div className="auth-hint">Phiên bản {import.meta.env.VITE_APP_VERSION}</div>
      </div>
    </div>
  );
}

