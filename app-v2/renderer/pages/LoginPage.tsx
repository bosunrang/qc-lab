import { useState } from 'react';
import { useAuthStore } from '../store/auth-store';

export function LoginPage() {
  const { status, error, bootstrapAdmin, login, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  if (status === 'needs-bootstrap') {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 360 }}>
        <h1>Khởi tạo tài khoản quản trị</h1>
        <p>Chưa có tài khoản nào trong hệ thống — tạo tài khoản quản trị đầu tiên để bắt đầu.</p>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div><input placeholder="Tên đăng nhập" value={username} onChange={e => { clearError(); setUsername(e.target.value); }} /></div>
        <div style={{ marginTop: 8 }}><input placeholder="Họ tên" value={name} onChange={e => { clearError(); setName(e.target.value); }} /></div>
        <div style={{ marginTop: 8 }}><input type="password" placeholder="Mật khẩu (≥8 ký tự)" value={password} onChange={e => { clearError(); setPassword(e.target.value); }} /></div>
        <button style={{ marginTop: 12 }} onClick={() => bootstrapAdmin(username, name, password)}>Tạo tài khoản quản trị</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 360 }}>
      <h1>Đăng nhập QC Lab</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div><input placeholder="Tên đăng nhập" value={username} onChange={e => { clearError(); setUsername(e.target.value); }} /></div>
      <div style={{ marginTop: 8 }}>
        <input type="password" placeholder="Mật khẩu" value={password}
          onChange={e => { clearError(); setPassword(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') login(username, password); }} />
      </div>
      <button style={{ marginTop: 12 }} onClick={() => login(username, password)}>Đăng nhập</button>
    </div>
  );
}
