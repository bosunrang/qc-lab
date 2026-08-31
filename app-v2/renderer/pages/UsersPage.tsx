import { useEffect, useState } from 'react';
import { useUsersStore } from '../store/users-store';
import { useAuthStore } from '../store/auth-store';

const ROLES = ['admin', 'technician', 'viewer'] as const;

export function UsersPage() {
  const { users, error, load, create, update, resetPassword } = useUsersStore();
  const { user: me } = useAuthStore();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('technician');
  const [password, setPassword] = useState('');
  const [resetTarget, setResetTarget] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Người dùng (thí điểm)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Đặt lại mật khẩu</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}{u.id === me?.id ? ' (bạn)' : ''}</td>
              <td>{u.name}</td>
              <td>
                <select value={u.role} onChange={e => update(u.id, u.name, e.target.value, u.active)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>
                <label><input type="checkbox" checked={u.active} onChange={e => update(u.id, u.name, u.role, e.target.checked)} /> Hoạt động</label>
                {u.mustChangePassword ? ' (chờ đổi mật khẩu)' : ''}
              </td>
              <td>
                <input placeholder="Mật khẩu mới" value={resetTarget[u.id] || ''} onChange={e => setResetTarget(v => ({ ...v, [u.id]: e.target.value }))} />
                <button onClick={() => { resetPassword(u.id, resetTarget[u.id] || ''); setResetTarget(v => ({ ...v, [u.id]: '' })); }}>Đặt lại</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <h2>Thêm người dùng</h2>
        <input placeholder="Tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} />
        <input placeholder="Họ tên" value={name} onChange={e => setName(e.target.value)} />
        <select value={role} onChange={e => setRole(e.target.value)}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="password" placeholder="Mật khẩu (≥8 ký tự)" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={async () => { await create(username, name, role, password); setUsername(''); setName(''); setPassword(''); }}>Thêm</button>
      </div>
    </div>
  );
}
