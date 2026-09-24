import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth-store';
import type { LoginBrand } from '../../shared/qc-api';

// Bố cục giống hệt màn hình đăng nhập của hệ thống (nền gradient xanh đậm +
// card trắng nổi giữa, brand-mark "QC" teal, tiêu đề/phụ đề) — xem
// trang này chưa từng được style (chỉ `sans-serif`/input trần) vì nằm
// ngoài luồng AppRouter/AppShell bình thường (render TRƯỚC khi đăng nhập).
function AuthBrand({ brand }: { brand: LoginBrand | null }) {
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
  const { status, error, bootstrapAdmin, login, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [brand, setBrand] = useState<LoginBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.qcApi.getLoginBrand().then((value) => { if (!cancelled) setBrand(value); }).catch(() => { /* Dùng nhận diện mặc định nếu API chưa sẵn sàng. */ });
    return () => { cancelled = true; };
  }, []);

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
            <div className="field auth-field"><label htmlFor="bootstrap-username">Tên đăng nhập</label><input id="bootstrap-username" value={username} autoFocus onChange={(e) => { clearError(); setUsername(e.target.value); }} /></div>
            <div className="field auth-field"><label htmlFor="bootstrap-name">Họ tên</label><input id="bootstrap-name" value={name} onChange={(e) => { clearError(); setName(e.target.value); }} /></div>
            <div className="field auth-field"><label htmlFor="bootstrap-password">Mật khẩu <span>(tối thiểu 8 ký tự)</span></label><input id="bootstrap-password" type="password" value={password} onChange={(e) => { clearError(); setPassword(e.target.value); }} /></div>
            {error && <div className="auth-err" role="alert">{error}</div>}
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
          <div className="field auth-field"><label htmlFor="login-username">Tên đăng nhập</label><input id="login-username" value={username} autoFocus onChange={(e) => { clearError(); setUsername(e.target.value); }} /></div>
          <div className="field auth-field">
            <label htmlFor="login-password">Mật khẩu</label>
          <input type="password" value={password}
            id="login-password"
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
          />
          </div>
          {error && <div className="auth-err" role="alert">{error}</div>}
          <div className="auth-actions"><button className="btn teal" type="submit">Đăng nhập</button></div>
        </form>
        <div className="auth-hint">Phiên bản {import.meta.env.VITE_APP_VERSION}</div>
      </div>
    </div>
  );
}

