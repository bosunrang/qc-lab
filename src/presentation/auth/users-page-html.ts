type UsersPageHtmlInput = {
  head: string;
  rows: string;
  roleOptions: string;
  permissionChecks: string;
  addButton: string;
};

export function createUsersPageHtml() {
  return ({ head, rows, roleOptions, permissionChecks, addButton }: UsersPageHtmlInput) => `${head}
   <div class="panel"><h2 class="panel-title">Thêm người dùng</h2><div class="user-create-layout">
     <div class="user-create-card">
       <div class="user-create-card-title">Thông tin tài khoản</div>
       <div class="user-create-fields">
       <div><label>Tên đăng nhập</label><input id="uUser" placeholder="vd: lan.nt"></div>
       <div><label>Họ tên</label><input id="uName" aria-label="Họ tên"></div>
       <div><label>Mã viết tắt</label><input id="uInitials" maxlength="12" placeholder="NTL"></div>
       <div><label>Vai trò</label><select id="uRole" aria-label="Vai trò" onchange="syncUserPermChecks('newUserPerms',this.value)">${roleOptions}</select></div>
       <div><label>Mật khẩu tạm</label><input id="uPass" aria-label="Mật khẩu tạm" type="password" autocomplete="new-password"></div>
       <div class="user-create-actions">${addButton}</div>
       </div>
     </div>
     <div class="user-create-card"><div class="user-create-card-title">Thẻ được phép dùng</div><div class="user-perm-block">${permissionChecks}</div></div>
     </div>
     <div class="hint user-create-hint"><b>Vai trò</b> quyết định quyền sửa/quản trị trong các thẻ được tick. <b>KTV:</b> nhập/sửa dữ liệu vận hành · <b>Chỉ xem:</b> chỉ đọc. Người dùng mới sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</div></div>
   <div class="panel"><h2 class="panel-title">Danh sách người dùng</h2>
     <div class="user-table-wrap"><table class="user-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
