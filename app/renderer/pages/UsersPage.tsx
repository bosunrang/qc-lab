// Người dùng: trang quản lý tài khoản có ba điểm cấu trúc chính:
//   1. Form "Thêm người dùng" nằm ngang phía trên danh sách. Thông tin tài
//      khoản và các màn hình truy cập dùng chung một panel, không lồng thẻ.
//   2. Bảng danh sách có 4 cột (Người dùng / Vai trò / Trạng thái / Hành
//      động) với cụm nút trên từng dòng, không phải select+checkbox inline.
//   3. `pagePerms` — quyền theo từng trang.
//      Vai trò là trần trên, lưới checkbox chỉ thu hẹp thêm. Chặn thật ở
//      main (`auth-handlers.ts` gọi `selectUserPermissions`), lưới này chỉ
//      là giao diện.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUsersStore } from '../store/users-store';
import { useAuthStore } from '../store/auth-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { RowActionButton } from '../components/RowActionButton';
import { confirmDialog, infoDialog, errorDialog } from '../state/dialog-store';
import { PAGE_DEFS, ROLE_LIST, canWrite, rolePageIds, roleLabel } from '../lib/permissions';
import { initialsFromName } from '../../main/domain/name-initials';
import type { PublicUser } from '../../shared/qc-api';
import { AsyncButton } from '../components/AsyncButton';
import { formError, formErrorFrom, type FieldErrorMap, type FormError } from '../lib/field-error';
import { useInvalidField } from '../lib/useInvalidField';

/** Mã lỗi `createUser` / `resetPassword` (`auth-validation.ts`) → ô cần sửa.
 * Các ô dùng state, không nằm trong `<form>`, nên tìm qua `data-field`. */
const USER_FIELD_ERRORS: FieldErrorMap = {
  'missing-username': 'username', 'invalid-username': 'username', 'duplicate-username': 'username',
  'missing-name': 'name', 'weak-password': 'password', 'missing-page-perms': 'pagePerms',
};

/** Quyền nghiệp vụ cấp riêng cho KTV (danh sách mã ở `domain/capabilities.ts`;
 * main kiểm ở `ipc/shared.ts` và `domain/nce/permissions.ts`). */
const CAPABILITY_OPTIONS: readonly [string, string][] = [
  ['qc.config', 'Cấu hình tiêu chí QC (lập dải Mean/SD, TEa)'],
  ['nce.release', 'Cho phép hoạt động trở lại sau sự cố'],
  ['nce.approve', 'Duyệt đóng hồ sơ NCE'],
];

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
            <input type="checkbox" data-field="pagePerms" value={page.id} checked={enabled && selected.has(page.id)} disabled={!enabled}
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
  // Lỗi vẫn hiện bằng hộp thoại như cũ; đóng hộp thoại xong thì ô sai được
  // đánh dấu và nhận focus. Câu lỗi nằm trong một `span hidden` để ô có
  // `aria-describedby` trỏ tới mà giao diện không thêm dòng chữ nào.
  const [err, setErr] = useState<FormError | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const errorId = useInvalidField(panelRef, err);

  function changeRole(next: string) {
    setRole(next);
    setSelected((prev) => narrowSelection(prev, next));
  }

  async function submit() {
    const pagePerms = [...selected];
    if (!pagePerms.length) {
      await infoDialog('Cần chọn ít nhất một thẻ được phép dùng.');
      setErr(formError('Cần chọn ít nhất một thẻ được phép dùng.', 'pagePerms'));
      return;
    }
    const result = await create({ username: username.trim().toLowerCase(), name, initials: initialsFromName(name), role, password, pagePerms });
    if (!result.ok) { await errorDialog(result.error.message); setErr(formErrorFrom(result.error, USER_FIELD_ERRORS)); return; }
    setErr(null);
    setUsername(''); setName(''); setPassword('');
    setSelected(new Set(rolePageIds(role)));
  }

  return (
    <div className="panel users-create-panel" ref={panelRef}>
      <h2 className="panel-title">Thêm người dùng</h2>
      {err && <span id={errorId} hidden>{err.message}</span>}
      <div className="user-create-layout">
        <section className="user-create-section" aria-labelledby="userAccountTitle">
          <h3 id="userAccountTitle">Thông tin tài khoản</h3>
          <div className="user-create-fields">
            <div className="field"><label htmlFor="uUser">Tên đăng nhập</label><input id="uUser" data-field="username" placeholder="vd: lan.nt" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="field"><label htmlFor="uName">Họ tên</label><input id="uName" data-field="name" aria-label="Họ tên" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="uRole">Vai trò</label><RoleSelect id="uRole" value={role} onChange={changeRole} /></div>
            <div className="field"><label htmlFor="uPass">Mật khẩu tạm</label><input id="uPass" data-field="password" aria-label="Mật khẩu tạm" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
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
    if (!result.ok) await errorDialog(result.error.message);
  }

  async function removeUser() {
    if (!(await confirmDialog(`Xoá tài khoản "${user.username}"? Nhật ký hoạt động của người này vẫn được giữ lại.`, { danger: true, confirmLabel: 'Xoá' }))) return;
    const result = await remove(user.id);
    if (!result.ok) await errorDialog(result.error.message);
  }

  if (current) {
    return <><span className="hint">(bạn)</span>{' '}<button className="btn ghost sm" onClick={onReset}>Đổi mật khẩu</button></>;
  }
  return (
    <>
      <RowActionButton kind="edit" label={`Sửa quyền ${user.name}`} onClick={onPerms} />{' '}
      <button className="btn ghost sm" onClick={onReset}>Đặt lại MK</button>{' '}
      <button className="btn ghost sm" onClick={toggle}>{user.active === false ? 'Mở khoá' : 'Khoá'}</button>{' '}
      <RowActionButton kind="delete" label={`Xoá người dùng ${user.name}`} onClick={removeUser} />
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
      <PageHeader title="Người dùng" subtitle="Phân quyền thao tác và kiểm soát tài khoản" />
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
                    <td>{roleLabel(user.role)}{user.role !== 'admin' && user.capabilities.length > 0 && (
                      <div className="hint">{CAPABILITY_OPTIONS.filter(([id]) => user.capabilities.includes(id)).map(([, label]) => label).join(' · ')}</div>
                    )}</td>
                    <td>{user.active === false ? <span className="tag rej">Khoá</span> : <span className="tag ok">Hoạt động</span>}</td>
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

/** "Sửa quyền": 1 select vai trò + lưới thẻ. KHÔNG sửa được tên/mật khẩu ở
 * đây — modal này chỉ lo quyền. */
function PermsModal({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { update, setNceCapabilities } = useUsersStore(useShallow((s) => ({ update: s.update, setNceCapabilities: s.setNceCapabilities })));
  const [role, setRole] = useState<string>(user.role);
  const [grantedCaps, setGrantedCaps] = useState<Set<string>>(() => new Set(user.capabilities));
  // `pagePerms` null = chưa thu hẹp → tick sẵn toàn bộ thẻ của vai trò.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(user.pagePerms ?? rolePageIds(user.role)));

  async function submit() {
    const pagePerms = [...selected];
    if (!pagePerms.length) { await infoDialog('Cần chọn ít nhất một thẻ được phép dùng.'); return; }
    const result = await update(user.id, { name: user.name, role, active: user.active, pagePerms });
    if (!result.ok) { await errorDialog(result.error.message); return; }
    // Người chỉ xem không giữ quyền nghiệp vụ: đổi sang vai trò chỉ xem thì thu luôn.
    const caps = canWrite(role) ? [...grantedCaps].sort() : [];
    if (caps.join(',') !== [...user.capabilities].sort().join(',')) {
      const saved = await setNceCapabilities(user.id, caps);
      if (!saved.ok) { await errorDialog(saved.error.message); return; }
    }
    onClose();
  }

  return (
    <Modal title="Sửa quyền người dùng" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Huỷ</button><AsyncButton className="btn teal" onClick={submit}>Lưu quyền</AsyncButton></>}>
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
      <div className="field">
        <label id="editUserCapLabel">Quyền nghiệp vụ</label>
        {role === 'admin'
          ? <div className="hint">Quản trị viên mặc nhiên có mọi quyền nghiệp vụ.</div>
          : !canWrite(role)
            ? <div className="hint">Tài khoản chỉ xem không được cấp quyền nghiệp vụ.</div>
            : (
              <div className="user-perm-grid" role="group" aria-labelledby="editUserCapLabel">
                {CAPABILITY_OPTIONS.map(([id, label]) => (
                  <label key={id} className={grantedCaps.has(id) ? 'selected' : ''}>
                    <input type="checkbox" checked={grantedCaps.has(id)} onChange={(e) => setGrantedCaps((prev) => { const next = new Set(prev); if (e.target.checked) next.add(id); else next.delete(id); return next; })} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
      </div>
      <div className="hint">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào. Người duyệt hồ sơ NCE phải độc lập với người đã tham gia hồ sơ đó.</div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { resetPassword } = useUsersStore(useShallow((s) => ({ resetPassword: s.resetPassword })));
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<FormError | null>(null);
  const [done, setDone] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const errorId = useInvalidField(fieldRef, err);

  async function submit() {
    const result = await resetPassword(user.id, password);
    if (!result.ok) { setErr(formErrorFrom(result.error, USER_FIELD_ERRORS)); return; }
    setDone(true);
  }

  return (
    <Modal title={`Đặt lại mật khẩu — ${user.username}`} onClose={onClose}
      footer={done ? <button className="btn teal" onClick={onClose}>Đóng</button> : <><button className="btn ghost" onClick={onClose}>Huỷ</button><AsyncButton className="btn teal" onClick={submit}>Đặt lại</AsyncButton></>}>
      {err && <p id={errorId} className="field-error" role="alert">{err.message}</p>}
      {done ? <p>Đã đặt lại mật khẩu — người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp.</p> : (
        <div className="field" ref={fieldRef}><label htmlFor="resetUserPassword">Mật khẩu mới (≥8 ký tự)</label><input id="resetUserPassword" data-field="password" autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} /></div>
      )}
    </Modal>
  );
}

