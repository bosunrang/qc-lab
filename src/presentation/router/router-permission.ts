export function createRouterPermission(deps: { currentUser: () => any; infoDialog: (message: string) => unknown; roles: () => readonly string[] }) {
  const role = () => deps.currentUser() ? deps.currentUser().role : 'viewer';
  const canWrite = () => role() === 'admin' || role() === 'technician';
  /* requireWrite()/requireAdmin() stay synchronous on purpose — 68 call sites
     across the app do `if(!requireWrite())return;`, and making that async would
     force `await` onto every one of them just to reskin a permission-denied
     message. infoDialog() is fired without awaiting: it opens immediately
     (synchronous DOM write inside), the caller still gets its boolean back the
     same tick either way. */
  const requireWrite = (message = 'Bạn không có quyền sửa dữ liệu.') => {
    if (canWrite()) return true;
    deps.infoDialog(message);
    return false;
  };
  const requireAdmin = (message = 'Chỉ quản trị mới được thực hiện thao tác này.') => {
    if (role() === 'admin') return true;
    deps.infoDialog(message);
    return false;
  };
  const roleLabel = (r: string) => r === 'admin' ? 'Quản trị' : r === 'technician' ? 'KTV' : 'Chỉ xem';
  const roleSelectOptions = (selected: string) => deps.roles().map(r => `<option value="${r}" ${r === selected ? 'selected' : ''}>${roleLabel(r)}</option>`).join('');
  return { role, canWrite, requireWrite, requireAdmin, roleLabel, roleSelectOptions };
}
