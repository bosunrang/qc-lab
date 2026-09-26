// Người dùng: trang quản lý tài khoản có ba điểm cấu trúc chính:
//   1. Form "Thêm người dùng" nằm ngang phía trên danh sách. Thông tin tài
//      khoản và các màn hình truy cập dùng chung một panel, không lồng thẻ.
//   2. Bảng danh sách có 4 cột (Người dùng / Vai trò / Trạng thái / Hành
//      động) với cụm nút trên từng dòng, không phải select+checkbox inline.
//   3. `pagePerms` — quyền theo từng trang.
//      Vai trò là trần trên, lưới checkbox chỉ thu hẹp thêm. Chặn thật ở
//      main (`auth-handlers.ts` gọi `selectUserPermissions`), lưới này chỉ
//      là giao diện.
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
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

/** Khi tạo tài khoản, chỉ hiện các màn hình của vai trò đã chọn. Hộp sửa quyền
 * vẫn hiện toàn bộ để quản trị viên thấy rõ những màn hình bị giới hạn. */
function PermGrid({ groupId, labelledBy, role, selected, onToggle, availableOnly = false }: {
  groupId: string; labelledBy: string; role: string; selected: ReadonlySet<string>; onToggle: (id: string, on: boolean) => void; availableOnly?: boolean;
}) {
  const allowed = useMemo(() => new Set(rolePageIds(role)), [role]);
  return (
    <div id={groupId} className="user-perm-grid" role="group" aria-labelledby={labelledBy}>
      {PAGE_DEFS.filter((page) => !availableOnly || allowed.has(page.id)).map((page) => {
        const enabled = allowed.has(page.id);
        return (
          <label key={page.id} className={enabled ? (selected.has(page.id) ? 'selected' : '') : 'disabled'} title={enabled ? undefined : 'Vai trò này không có thẻ này'}>
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
  const { create } = useUsersStore(useShallow((s) => ({ create: s.create })));
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('technician');
  const [password, setPassword] = useState('');
  // Mặc định tick sẵn toàn bộ thẻ của vai trò — khớp `userPermChecks()` app
  // cũ khi chưa có lựa chọn nào (`selectedIds` rỗng → dùng `rolePageIds`).
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rolePageIds('technician')));
  const availableCount = rolePageIds(role).length;
  const initials = initialsFromName(name);

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
    <div className="panel users-create-panel">
      <h2 className="panel-title">Thêm người dùng</h2>
      <div className="user-create-layout">
        <section className="user-create-section" aria-labelledby="userAccountTitle">
          <h3 id="userAccountTitle">Thông tin tài khoản</h3>
          <div className="user-create-fields">
            <div className="field"><label htmlFor="uUser">Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="field"><label htmlFor="uName">Họ tên</label><input id="uName" aria-label="Họ tên" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="uRole">Vai trò</label><RoleSelect id="uRole" value={role} onChange={changeRole} /></div>
            <div className="field"><label htmlFor="uPass">Mật khẩu tạm</label><input id="uPass" aria-label="Mật khẩu tạm" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="user-initials-preview">Mã viết tắt tự tạo <span className="pill">{initials || '—'}</span></div>
          </div>
        </section>
        <section className="user-create-section user-create-perms" aria-labelledby="newUserPermsLabel">
          <div className="user-perm-heading">
            <h3 id="newUserPermsLabel">Màn hình truy cập</h3>
            <span className="pill">{selected.size}/{availableCount} đã chọn</span>
          </div>
          <PermGrid groupId="newUserPerms" labelledBy="newUserPermsLabel" role={role} selected={selected} availableOnly
            onToggle={(id, on) => setSelected((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; })} />
        </section>
      </div>
      <div className="user-create-footer">
        <p>Vai trò quyết định quyền sửa dữ liệu. Người dùng mới phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
        <button className="btn teal" onClick={submit}>Tạo tài khoản</button>
      </div>
    </div>
  );
}

function UserActions({ user, current, onPerms, onReset }: {
  user: PublicUser; current: boolean; onPerms: () => void; onReset: () => void;
}) {
  const { update, remove } = useUsersStore(useShallow((s) => ({ update: s.update, remove: s.remove })));

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
  const { users, load } = useUsersStore(useShallow((s) => ({ users: s.users, load: s.load })));
  const { user: me } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const [permsFor, setPermsFor] = useState<PublicUser | null>(null);
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);

  useEffect(() => { load(); }, [load]);
  useStoreInvalidation(['users'], undefined, load);

  return (
    <>
      <PageHeader title="Quản lý người dùng" subtitle="Phân quyền thao tác và kiểm soát tài khoản" />
      <div className="users-layout">
        <CreatePanel />
        <div className="panel users-list-panel">
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
      </div>

      {permsFor && <PermsModal user={permsFor} onClose={() => setPermsFor(null)} />}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
    </>
  );
}

/** "Sửa quyền" — modal của hệ thống (`UserPermissionsModal.tsx`): 1 select vai
 * trò + lưới thẻ. KHÔNG sửa được tên/mật khẩu ở đây, đúng phạm vi hệ thống. */
function PermsModal({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { update } = useUsersStore(useShallow((s) => ({ update: s.update })));
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
        <label id="editUserPermsLabel">Thẻ được phép dùng</label>
        <PermGrid groupId="editUserPerms" labelledBy="editUserPermsLabel" role={role} selected={selected}
          onToggle={(id, on) => setSelected((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; })} />
      </div>
      <div className="hint">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào.</div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { resetPassword } = useUsersStore(useShallow((s) => ({ resetPassword: s.resetPassword })));
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

