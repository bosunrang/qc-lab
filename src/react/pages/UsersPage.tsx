import { useAppStore } from '../state/kernel';
import {
  usersList, roleLabel, roleSelectOptionsHtml, userPermChecksHtml, rolePageIds, headOnlyHtml,
  addUser, syncUserPermChecks, resetPass, openUserPerms, toggleUser, delUser,
  type UserRow,
} from '../bridge/usersBridge';

function Head() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: headOnlyHtml('Quản lý người dùng', 'Phân quyền thao tác và kiểm soát tài khoản') }} />;
}

/* <select> và khối checkbox quyền vẫn dùng HTML dựng sẵn (roleSelectOptions()/
   userPermChecks()) qua dangerouslySetInnerHTML thay vì viết lại bằng JSX —
   syncUserPermChecks()/collectUserPerms() (chưa đổi, vẫn ở modular-pilot.global.ts)
   đọc/ghi các checkbox này thẳng qua document.getElementById(...)
   .querySelectorAll(...), không quan tâm React hay chuỗi HTML tạo ra chúng,
   nên tái dùng nguyên vẹn là an toàn và đỡ trùng lặp logic. */
function RoleSelect() {
  return <select id="uRole" aria-label="Vai trò" onChange={e => syncUserPermChecks('newUserPerms', e.target.value)} dangerouslySetInnerHTML={{ __html: roleSelectOptionsHtml('technician') }} />;
}

function PermissionChecks() {
  return <div className="user-perm-block" dangerouslySetInnerHTML={{ __html: userPermChecksHtml(rolePageIds('technician'), 'newUserPerms', 'technician') }} />;
}

function UserActions({ user }: { user: UserRow }) {
  if (user.current) {
    return (
      <>
        <span className="hint">(bạn)</span>{' '}
        <button className="btn ghost sm" onClick={() => resetPass(user.id)}>Đổi mật khẩu</button>
      </>
    );
  }
  return (
    <>
      <button className="btn ghost sm" onClick={() => openUserPerms(user.id)}>Sửa quyền</button>{' '}
      <button className="btn ghost sm" onClick={() => resetPass(user.id)}>Đặt lại MK</button>{' '}
      <button className="btn ghost sm" onClick={() => toggleUser(user.id)}>{user.active === false ? 'Mở khóa' : 'Khóa'}</button>{' '}
      <button className="btn danger sm" onClick={() => delUser(user.id)}>Xóa</button>
    </>
  );
}

function UserRowView({ user }: { user: UserRow }) {
  return (
    <tr>
      <td><b>{user.name || user.username}</b><div className="hint">@{user.username}{user.initials ? ` · ${user.initials}` : ''}</div></td>
      <td>{roleLabel(user.role)}</td>
      <td>{user.active === false ? <span className="tag rej">Khóa</span> : <span className="tag ok">Hoạt động</span>}</td>
      <td><div className="user-row-actions"><UserActions user={user} /></div></td>
    </tr>
  );
}

export function UsersPage() {
  useAppStore();
  const users = usersList();

  return (
    <>
      <Head />
      <div className="panel">
        <h2 className="panel-title">Thêm người dùng</h2>
        <div className="user-create-layout">
          <div className="user-create-card">
            <div className="user-create-card-title">Thông tin tài khoản</div>
            <div className="user-create-fields">
              <div><label>Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt" /></div>
              <div><label>Họ tên</label><input id="uName" aria-label="Họ tên" /></div>
              <div><label>Mã viết tắt</label><input id="uInitials" maxLength={12} placeholder="NTL" /></div>
              <div><label>Vai trò</label><RoleSelect /></div>
              <div><label>Mật khẩu tạm</label><input id="uPass" aria-label="Mật khẩu tạm" type="password" autoComplete="new-password" /></div>
              <div className="user-create-actions"><button className="btn teal" onClick={addUser}>Thêm</button></div>
            </div>
          </div>
          <div className="user-create-card">
            <div className="user-create-card-title">Thẻ được phép dùng</div>
            <PermissionChecks />
          </div>
        </div>
        <div className="hint user-create-hint"><b>Vai trò</b> quyết định quyền sửa/quản trị trong các thẻ được tick. <b>KTV:</b> nhập/sửa dữ liệu vận hành · <b>Chỉ xem:</b> chỉ đọc. Người dùng mới sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</div>
      </div>
      <div className="panel">
        <h2 className="panel-title">Danh sách người dùng</h2>
        <div className="user-table-wrap">
          <table className="user-table">
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
            <tbody>{users.map(user => <UserRowView user={user} key={user.id} />)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
