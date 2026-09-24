// Người dùng: trang quản lý tài khoản có ba điểm cấu trúc chính:
//   1. Form "Thêm người dùng" nằm NGAY TRONG TRANG (2 thẻ cạnh nhau: thông
//      tin tài khoản + lưới "Thẻ được phép dùng"), không phải modal.
//   2. Bảng danh sách có 4 cột (Người dùng / Vai trò / Trạng thái / Hành
//      động) với cụm nút trên từng dòng, không phải select+checkbox inline.
//   3. `pagePerms` — quyền theo từng trang.
//      Vai trò là trần trên, lưới checkbox chỉ thu hẹp thêm. Chặn thật ở
//      main (`auth-handlers.ts` gọi `selectUserPermissions`), lưới này chỉ
//      là giao diện.
import { useEffect, useMemo, useState } from 'react';
import { useUsersStore } from '../store/users-store';
import { useAuthStore } from '../store/auth-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { RowActionButton } from '../components/RowActionButton';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import { PAGE_DEFS, ROLE_LIST, rolePageIds, roleLabel } from '../lib/permissions';
import { initialsFromName } from '../../main/domain/name-initials';
import type { PublicUser } from '../../shared/qc-api';

/** Lưới "Thẻ được phép dùng" dùng state React. Khi đổi vai trò, thẻ không còn
 * hợp lệ bị bỏ chọn; thẻ mới được phép vẫn chờ quản trị viên chủ động chọn. */
function PermGrid({ groupId, role, selected, onToggle }: {
  groupId: string; role: string; selected: ReadonlySet<string>; onToggle: (id: string, on: boolean) => void;
}) {
  const allowed = useMemo(() => new Set(rolePageIds(role)), [role]);
  return (
    <div id={groupId} className="user-perm-grid">
      {PAGE_DEFS.map((page) => {
        const enabled = allowed.has(page.id);
        return (
          <label key={page.id} className={enabled ? '' : 'disabled'}>
            <input type="checkbox" value={page.id} checked={enabled && selected.has(page.id)} disabled={!enabled}
              onChange={(e) => onToggle(page.id, e.target.checked)} />
            <span>{page.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function RoleSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <select id={id} aria-label="Vai trò" value={value} onChange={(e) => onChange(e.target.value)}>
      {ROLE_LIST.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
    </select>
  );
}

/** Bỏ chọn những thẻ vai trò mới không cho phép — `syncUserPermChecks()`. */
function narrowSelection(selected: ReadonlySet<string>, role: string): Set<string> {
  const allowed = new Set(rolePageIds(role));
  return new Set([...selected].filter((id) => allowed.has(id)));
}

function CreatePanel() {
  const { create } = useUsersStore();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('technician');
  const [password, setPassword] = useState('');
  // Mặc định tick sẵn toàn bộ thẻ của vai trò — khớp `userPermChecks()` app
  // cũ khi chưa có lựa chọn nào (`selectedIds` rỗng → dùng `rolePageIds`).
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rolePageIds('technician')));

  function changeRole(next: string) {
    setRole(next);
    setSelected((prev) => narrowSelection(prev, next));
  }

  async function submit() {
    const pagePerms = [...selected];
    if (!pagePerms.length) { await infoDialog('Cần chọn ít nhất một thẻ được phép dùng.'); return; }
    const result = await create({ username: username.trim().toLowerCase(), name, initials: initialsFromName(name), role, password, pagePerms });
    if (!result.ok) { await infoDialog(result.error.message); return; }
    setUsername(''); setName(''); setPassword('');
    setSelected(new Set(rolePageIds(role)));
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Thêm người dùng</h2>
      <div className="user-create-layout">
        <div className="user-create-card">
          <div className="user-create-card-title">Thông tin tài khoản</div>
          <div className="user-create-fields">
            <div className="field"><label htmlFor="uUser">Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="field"><label htmlFor="uName">Họ tên</label><input id="uName" aria-label="Họ tên" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="uInitials">Mã viết tắt</label><input id="uInitials" readOnly placeholder="NTL" value={initialsFromName(name)} title="Tự động lấy chữ cái đầu của họ tên" /></div>
            <div className="field"><label htmlFor="uRole">Vai trò</label><RoleSelect id="uRole" value={role} onChange={changeRole} /></div>
            <div className="field"><label htmlFor="uPass">Mật khẩu tạm</label><input id="uPass" aria-label="Mật khẩu tạm" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="user-create-actions"><button className="btn teal" onClick={submit}>Thêm</button></div>
          </div>
        </div>
        <div className="user-create-card">
          <div className="user-create-card-title">Thẻ được phép dùng</div>
          <div className="user-perm-block">
            <PermGrid groupId="newUserPerms" role={role} selected={selected}
              onToggle={(id, on) => setSelected((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; })} />
          </div>
        </div>
      </div>
      <div className="hint user-create-hint"><b>Vai trò</b> quyết định quyền sửa/quản trị trong các thẻ được tick. <b>KTV:</b> nhập/sửa dữ liệu vận hành · <b>Chỉ xem:</b> chỉ đọc. Người dùng mới sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</div>
    </div>
  );
}

function UserActions({ user, current, onPerms, onReset }: {
  user: PublicUser; current: boolean; onPerms: () => void; onReset: () => void;
}) {
  const { update, remove } = useUsersStore();

  async function toggle() {
    const result = await update(user.id, { name: user.name, role: user.role, active: !user.active });
    if (!result.ok) await infoDialog(result.error.message);
  }

  async function removeUser() {
    if (!(await confirmDialog(`Xoá tài khoản "${user.username}"? Nhật ký hoạt động của người này vẫn được giữ lại.`, { danger: true, confirmLabel: 'Xoá' }))) return;
    const result = await remove(user.id);
    if (!result.ok) await infoDialog(result.error.message);
  }

  if (current) {
    return <><span className="hint">(bạn)</span>{' '}<button className="btn ghost sm" onClick={onReset}>Đổi mật khẩu</button></>;
  }
  return (
    <>
      <RowActionButton kind="edit" label={`Sửa quyền ${user.name}`} onClick={onPerms} />{' '}
      <button className="btn ghost sm" onClick={onReset}>Đặt lại MK</button>{' '}
      <button className="btn ghost sm" onClick={toggle}>{user.active === false ? 'Mở khóa' : 'Khóa'}</button>{' '}
      <RowActionButton kind="delete" label={`Xóa người dùng ${user.name}`} onClick={removeUser} />
    </>
  );
}

export function UsersPage() {
  const { users, load } = useUsersStore();
  const { user: me } = useAuthStore();
  const [permsFor, setPermsFor] = useState<PublicUser | null>(null);
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);

  useEffect(() => { load(); }, [load]);
  useStoreInvalidation(['users'], undefined, load);

  return (
    <>
      <PageHeader title="Quản lý người dùng" subtitle="Phân quyền thao tác và kiểm soát tài khoản" />
      <CreatePanel />
      <div className="panel">
        <h2 className="panel-title">Danh sách người dùng</h2>
        <div className="user-table-wrap">
          <table className="user-table">
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><b>{user.name || user.username}</b><div className="hint">@{user.username}{user.initials ? ` · ${user.initials}` : ''}</div></td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{user.active === false ? <span className="tag rej">Khóa</span> : <span className="tag ok">Hoạt động</span>}</td>
                  <td><div className="user-row-actions">
                    <UserActions user={user} current={user.id === me?.id} onPerms={() => setPermsFor(user)} onReset={() => setResetFor(user)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {permsFor && <PermsModal user={permsFor} onClose={() => setPermsFor(null)} />}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
    </>
  );
}

/** "Sửa quyền" — modal của hệ thống (`UserPermissionsModal.tsx`): 1 select vai
 * trò + lưới thẻ. KHÔNG sửa được tên/mật khẩu ở đây, đúng phạm vi hệ thống. */
function PermsModal({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { update } = useUsersStore();
  const [role, setRole] = useState<string>(user.role);
  // `pagePerms` null = chưa thu hẹp → tick sẵn toàn bộ thẻ của vai trò.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(user.pagePerms ?? rolePageIds(user.role)));

  async function submit() {
    const pagePerms = [...selected];
    if (!pagePerms.length) { await infoDialog('Cần chọn ít nhất một thẻ được phép dùng.'); return; }
    const result = await update(user.id, { name: user.name, role, active: user.active, pagePerms });
    if (!result.ok) { await infoDialog(result.error.message); return; }
    onClose();
  }

  return (
    <Modal title="Sửa quyền người dùng" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Lưu quyền</button></>}>
      <div className="hint"><b>{user.name || user.username}</b> · @{user.username}</div>
      <div className="field">
        <label htmlFor="editUserRole">Vai trò</label>
        <RoleSelect id="editUserRole" value={role} onChange={(next) => { setRole(next); setSelected((prev) => narrowSelection(prev, next)); }} />
      </div>
      <div className="field">
        <label>Thẻ được phép dùng</label>
        <PermGrid groupId="editUserPerms" role={role} selected={selected}
          onToggle={(id, on) => setSelected((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; })} />
      </div>
      <div className="hint">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào.</div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { resetPassword } = useUsersStore();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    const result = await resetPassword(user.id, password);
    if (!result.ok) { setErr(result.error.message); return; }
    setDone(true);
  }

  return (
    <Modal title={`Đặt lại mật khẩu — ${user.username}`} onClose={onClose}
      footer={done ? <button className="btn teal" onClick={onClose}>Đóng</button> : <><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Đặt lại</button></>}>
      {err && <p className="field-error">{err}</p>}
      {done ? <p>Đã đặt lại mật khẩu — người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp.</p> : (
        <div className="field"><label>Mật khẩu mới (≥8 ký tự)</label><input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} /></div>
      )}
    </Modal>
  );
}

