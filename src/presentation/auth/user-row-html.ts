type UserRow = Record<string, any>;

type UserRowHtmlInput = {
  user: UserRow;
  currentUserId: unknown;
  esc: (value: unknown) => string;
  roleLabel: (role: unknown) => string;
  btn: (label: string, action: string, classes: string) => string;
};

export function createUserRowHtml() {
  return ({ user, currentUserId, esc, roleLabel, btn }: UserRowHtmlInput) => {
    const isCurrent = Boolean(user.current || (currentUserId && user.id === currentUserId));
    const actions = isCurrent
      ? `<span class="hint">(bạn)</span> ${btn('Đổi mật khẩu', `resetPass('${user.id}')`, 'ghost sm')}`
      : `${btn('Sửa quyền', `openUserPerms('${user.id}')`, 'ghost sm')} ${btn('Đặt lại MK', `resetPass('${user.id}')`, 'ghost sm')} ${btn(user.active === false ? 'Mở khóa' : 'Khóa', `toggleUser('${user.id}')`, 'ghost sm')} ${btn('Xóa', `delUser('${user.id}')`, 'danger sm')}`;
    return `<tr>
    <td><b>${esc(user.name || user.username)}</b><div class="hint">@${esc(user.username)}${user.initials ? ' · ' + esc(user.initials) : ''}</div></td>
    <td>${roleLabel(user.role)}</td>
    <td>${user.active === false ? '<span class="tag rej">Khóa</span>' : '<span class="tag ok">Hoạt động</span>'}</td>
    <td><div class="user-row-actions">${actions}</div></td></tr>`;
  };
}
