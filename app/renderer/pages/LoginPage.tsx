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
        <AuthBrand brand={brand} />
        <div className="field"><label>Tên đăng nhập</label><input value={username} autoFocus onChange={(e) => { clearError(); setUsername(e.target.value); }} /></div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={password}
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') login(username, password); }} />
        </div>
        {error && <div className="auth-err">{error}</div>}
        <div className="auth-actions"><button className="btn teal" onClick={() => login(username, password)}>Đăng nhập</button></div>
        <div className="auth-hint">Phiên bản {import.meta.env.VITE_APP_VERSION}</div>
      </div>
    </div>
  );
}


