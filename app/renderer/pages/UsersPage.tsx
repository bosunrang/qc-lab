import { FormErrorMessage } from '../components/FormErrorMessage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUsersStore } from '../store/users-store';
import { useAuthStore } from '../store/auth-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { NavIcon } from '../components/NavIcon';
import { PageHeader } from '../components/PageHeader';
import { Pagination, pageBounds } from '../components/Pagination';
import { RowActionButton } from '../components/RowActionButton';
import { reportFormError, confirmDialog, infoDialog, errorDialog } from '../state/dialog-store';
import { PAGE_DEFS, ROLE_LIST, canWrite, userPageIds, rolePageIds, roleLabel } from '../lib/permissions';
import { initialsFromName } from '../../main/domain/name-initials';
import type { PublicUser } from '../../shared/qc-api';
import { AsyncButton } from '../components/AsyncButton';
import { formError, formErrorFrom, type FieldErrorMap, type FormError } from '../lib/field-error';
import { useInvalidField } from '../lib/useInvalidField';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { showToast } from '../state/toast-store';

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

const PAGE_SIZE = 12;
const PAGE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  dash: 'Theo dõi tình trạng QC và việc cần xử lý.',
  entry: 'Ghi kết quả QC và xem biểu đồ theo lô.',
  westgard: 'Xem vi phạm quy tắc và xu hướng nội kiểm.',
  sigma: 'Đánh giá Sigma từ CV, Bias và TEa.',
  reagent: 'Đối chiếu kết quả giữa hai lô hoá chất.',
  eqa: 'Theo dõi kết quả, lịch và báo cáo ngoại kiểm.',
  actions: 'Theo dõi hồ sơ sự cố và việc khắc phục.',
  report: 'Xem và xuất báo cáo, biểu mẫu QC.',
  manage: 'Quản lý máy, xét nghiệm, lô QC và tiêu chí.',
  users: 'Quản lý tài khoản và quyền truy cập.',
  audit: 'Tra cứu lịch sử thao tác trong ứng dụng.',
  settings: 'Quản lý sao lưu và kết nối của ứng dụng.',
};

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
          <label key={page.id} className={`choice-card user-perm-card${enabled ? (selected.has(page.id) ? ' is-selected' : '') : ' is-disabled'}`} title={enabled ? undefined : 'Vai trò này không có thẻ này'}>
            <span className="user-perm-icon" aria-hidden="true"><NavIcon id={page.id} /></span>
            <span className="user-perm-copy">
              <strong id={`${groupId}-${page.id}`}>{page.label}</strong>
              <small id={`${groupId}-${page.id}-description`}>{PAGE_DESCRIPTIONS[page.id]}</small>
            </span>
            <input type="checkbox" data-field="pagePerms" value={page.id} checked={enabled && selected.has(page.id)} disabled={!enabled}
              aria-labelledby={`${groupId}-${page.id}`} aria-describedby={`${groupId}-${page.id}-description`}
              onChange={(e) => onToggle(page.id, e.target.checked)} />
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

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const { create } = useUsersStore(useShallow((s) => ({ create: s.create })));
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('technician');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // Mặc định tick sẵn toàn bộ thẻ của vai trò — khớp `userPermChecks()` app
  // cũ khi chưa có lựa chọn nào (`selectedIds` rỗng → dùng `rolePageIds`).
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rolePageIds('technician')));
  const availableCount = rolePageIds(role).length;
  const initials = initialsFromName(name);
  const [err, setErr] = useState<FormError | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const errorId = useInvalidField(formRef, err);

  function changeRole(next: string) {
    setRole(next);
    setSelected((prev) => narrowSelection(prev, next));
  }

  async function submit() {
    if (password !== confirmation) {
      setErr(formError('Mật khẩu xác nhận chưa khớp.', 'confirmation'));
      return;
    }
    const pagePerms = [...selected];
    if (!pagePerms.length) {
      setErr(formError('Cần chọn ít nhất một thẻ được phép dùng.', 'pagePerms'));
      return;
    }
    const result = await create({ username: username.trim().toLowerCase(), name, initials: initialsFromName(name), role, password, pagePerms });
    if (!result.ok) { await reportFormError(formErrorFrom(result.error, USER_FIELD_ERRORS), setErr); return; }
    showToast('Đã tạo tài khoản.');
    onClose();
  }

  return (
    <Modal title="Thêm người dùng" size="lg" className="user-editor-modal" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Huỷ</button><AsyncButton className="btn teal" onClick={submit}>Lưu tài khoản</AsyncButton></>}>
      <div className="user-editor" ref={formRef}>
        <FormErrorMessage rootRef={formRef} error={err} id={errorId} />
        <div className="user-create-fields">
          <div className="field">
            <label htmlFor="uName">Họ tên</label>
            <input id="uName" data-field="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="uUser">Tên đăng nhập</label>
            <input id="uUser" data-field="username" placeholder="vd: lan.nt" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="uRole">Vai trò</label>
            <RoleSelect id="uRole" value={role} onChange={changeRole} />
          </div>
          <div className="field">
            <label htmlFor="uPass">Mật khẩu tạm</label>
            <input id="uPass" data-field="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="uConfirm">Xác nhận mật khẩu</label>
            <input id="uConfirm" data-field="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <div className="user-initials-preview">Mã viết tắt tự tạo <span className="pill">{initials || '—'}</span></div>
        </div>
        <p className="hint">Người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
        <section className="user-access-section" aria-labelledby="newUserPermsLabel">
          <div className="user-perm-heading">
            <h4 id="newUserPermsLabel">Thẻ được truy cập</h4>
            <span className="pill">{selected.size}/{availableCount} đã chọn</span>
          </div>
          <PermGrid groupId="newUserPerms" labelledBy="newUserPermsLabel" role={role} selected={selected} availableOnly
            onToggle={(id, on) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (on) next.add(id); else next.delete(id);
                return next;
              });
              if (on && err?.fields.includes('pagePerms')) setErr(null);
            }} />
        </section>
      </div>
    </Modal>
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
    return <RowActionButton kind="key" className="user-password-action" label="Đổi mật khẩu của bạn" onClick={onReset} />;
  }
  const locked = user.active === false;
  return (
    <>
      <RowActionButton kind="edit" label={`Sửa quyền ${user.name}`} onClick={onPerms} />
      <RowActionButton kind="key" className="user-password-action" label={`Đặt lại mật khẩu cho ${user.name}`} onClick={onReset} />
      <RowActionButton
        kind={locked ? 'unlock' : 'lock'}
        className={locked ? 'user-unlock-action' : 'user-lock-action'}
        label={locked ? `Mở khoá tài khoản ${user.name}` : `Khoá tài khoản ${user.name}`}
        onClick={toggle}
      />
      <RowActionButton kind="delete" label={`Xoá người dùng ${user.name}`} onClick={removeUser} />
    </>
  );
}

export function UsersPage() {
  const { users, load } = useUsersStore(useShallow((s) => ({ users: s.users, load: s.load })));
  const { user: me } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [permsFor, setPermsFor] = useState<PublicUser | null>(null);
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);

  useEffect(() => { load(); }, [load]);
  useStoreInvalidation(['users'], undefined, load);

  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const { from, to } = pageBounds(currentPage, PAGE_SIZE, users.length);

  return (
    <>
      <PageHeader title="Người dùng" subtitle="Phân quyền truy cập và quản lý tài khoản" />
      <div className="users-layout">
        <section className="panel users-toolbar" aria-labelledby="users-heading">
          <span className="users-toolbar-icon" aria-hidden="true"><NavIcon id="users" /></span>
          <div className="users-toolbar-copy">
            <h2 id="users-heading">Tài khoản người dùng</h2>
            <p className="hint">{users.length} tài khoản</p>
          </div>
          <button type="button" className="btn teal" onClick={() => setCreating(true)}>+ Thêm người dùng</button>
        </section>
        <section aria-label="Danh sách người dùng" className="users-list-panel">
          {users.length === 0 ? <div className="panel"><EmptyState size="compact" title="Chưa có tài khoản trong danh sách" /></div> : <div className="user-table-wrap">
            <table className="user-table">
              <thead><tr>
                <th scope="col">Người dùng</th>
                <th scope="col">Tên đăng nhập</th>
                <th scope="col">Vai trò</th>
                <th scope="col">Thẻ được truy cập</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr></thead>
              <tbody>
                {users.slice(from - 1, to).map((user) => {
                  const access = new Set(userPageIds(user));
                  return (
                    <tr key={user.id}>
                      <td><b>{user.name || user.username}</b>{user.id === me?.id && <div className="hint">Đang đăng nhập</div>}</td>
                      <td>{user.username}{user.initials && <div className="hint">{user.initials}</div>}</td>
                      <td>{roleLabel(user.role)}{user.role !== 'admin' && user.capabilities.length > 0 && (
                        <div className="hint">{CAPABILITY_OPTIONS.filter(([id]) => user.capabilities.includes(id)).map(([, label]) => label).join(' · ')}</div>
                      )}</td>
                      <td>{access.size === PAGE_DEFS.length ? 'Toàn bộ thẻ' : PAGE_DEFS.filter((item) => access.has(item.id)).map((item) => item.label).join(', ')}</td>
                      <td>{user.active === false ? <span className="tag rej">Đã khoá</span> : <span className="tag ok">Đang hoạt động</span>}</td>
                      <td><div className="user-row-actions">
                        <UserActions user={user} current={user.id === me?.id} onPerms={() => setPermsFor(user)} onReset={() => setResetFor(user)} />
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
          <Pagination page={currentPage} pageCount={pageCount} from={from} to={to} total={users.length} unit="người dùng" label="Phân trang người dùng" onPageChange={setPage} />
        </section>
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {permsFor && <PermsModal user={permsFor} onClose={() => setPermsFor(null)} />}
      {resetFor && (resetFor.id === me?.id
        ? <OwnPasswordModal onClose={() => setResetFor(null)} />
        : <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />)}
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
    <Modal title="Sửa quyền người dùng" size="lg" className="user-editor-modal" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Huỷ</button><AsyncButton className="btn teal" onClick={submit}>Lưu quyền</AsyncButton></>}>
      <div className="user-editor">
        <p className="hint"><b>{user.name || user.username}</b> · @{user.username}</p>
        <div className="field">
          <label htmlFor="editUserRole">Vai trò</label>
          <RoleSelect id="editUserRole" value={role} onChange={(next) => { setRole(next); setSelected((prev) => narrowSelection(prev, next)); }} />
        </div>
        <div className="field">
          <label id="editUserPermsLabel">Thẻ được truy cập</label>
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
                <div className="user-capability-grid" role="group" aria-labelledby="editUserCapLabel">
                  {CAPABILITY_OPTIONS.map(([id, label]) => (
                    <label key={id} className={`choice-card${grantedCaps.has(id) ? ' is-selected' : ''}`}>
                      <input type="checkbox" checked={grantedCaps.has(id)} onChange={(e) => setGrantedCaps((prev) => { const next = new Set(prev); if (e.target.checked) next.add(id); else next.delete(id); return next; })} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
        </div>
        <div className="hint">Vai trò quyết định quyền sửa và quản trị; các thẻ quyết định màn hình được mở. Người duyệt hồ sơ NCE phải độc lập với người đã tham gia hồ sơ.</div>
      </div>
    </Modal>
  );
}

/** Tự đổi mật khẩu của chính mình: cần mật khẩu hiện tại, không bật cờ phải
 * đổi mật khẩu như khi admin đặt lại cho người khác. */
function OwnPasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Đổi mật khẩu của bạn" size="sm" onClose={onClose}>
      <ChangePasswordForm onDone={() => { showToast('Đã đổi mật khẩu.'); onClose(); }} />
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
    if (!result.ok) { await reportFormError(formErrorFrom(result.error, USER_FIELD_ERRORS), setErr); return; }
    setDone(true);
  }

  return (
    <Modal title={`Đặt lại mật khẩu — ${user.username}`} onClose={onClose}
      footer={done ? <button className="btn teal" onClick={onClose}>Đóng</button> : <><button className="btn ghost" onClick={onClose}>Huỷ</button><AsyncButton className="btn teal" onClick={submit}>Đặt lại</AsyncButton></>}>
      <FormErrorMessage rootRef={fieldRef} error={err} id={errorId} />
      {done ? <p>Đã đặt lại mật khẩu — người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp.</p> : (
        <div className="field" ref={fieldRef}><label htmlFor="resetUserPassword">Mật khẩu mới (≥8 ký tự)</label><input id="resetUserPassword" data-field="password" autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} /></div>
      )}
    </Modal>
  );
}

