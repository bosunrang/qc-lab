// Quy tắc dữ liệu của bản sao lưu đám mây (Firebase, GV6). Hàm thuần: phần đẩy
// lên dùng khi dựng gói, phần kéo về dùng trước khi phục hồi.

type Rows = Record<string, unknown>[];
type TableData = Record<string, Rows | undefined>;

/** Khoá `app_meta` thuộc riêng từng máy, không rời máy và không bị bản đám mây
 * ghi đè: kết nối/trạng thái Firebase của máy này, và cấu hình LIS Gateway
 * (máy nối LIS, kèm token truy cập LIS) và giấy phép gắn với mã máy. */
export const MACHINE_LOCAL_META_KEYS: readonly string[] = [
  'firebaseConfig', 'firebaseEmail', 'firebaseLabCode', 'firebaseLastStatus', 'lisGatewaySettings', 'softwareLicense',
];

/** Dữ liệu đưa lên đám mây: bỏ các khoá riêng của máy (token LIS, kết nối
 * Firebase). Trạng thái đồng bộ đổi liên tục nên bỏ đi cũng giúp hai máy cùng
 * dữ liệu ra cùng checksum. */
export function cloudBackupData<T extends TableData>(data: T): T {
  if (!data.app_meta) return data;
  return { ...data, app_meta: data.app_meta.filter((row) => !MACHINE_LOCAL_META_KEYS.includes(String(row.key))) };
}

/** Tài khoản sau khi kéo bản đám mây về.
 *
 * Máy chưa có tài khoản nào nhận nguyên danh sách đám mây (dựng lại hệ thống).
 * Máy đã có tài khoản thì GIỮ NGUYÊN tài khoản của máy — mật khẩu, vai trò,
 * trạng thái không bị bản đám mây đổi. Tài khoản chỉ có trên đám mây được thêm
 * ở trạng thái khoá (`active = 0`) để admin xem rồi mới mở: kéo về không được
 * là đường cài một tài khoản đăng nhập được vào máy. */
export function mergeUsersForPull(local: Rows, remote: Rows): { users: Rows; addedLocked: string[] } {
  if (!local.length) return { users: remote, addedLocked: [] };
  const usernames = new Set(local.map((row) => String(row.username).toLocaleLowerCase('vi')));
  const ids = new Set(local.map((row) => String(row.id)));
  const added = remote.filter((row) => !usernames.has(String(row.username).toLocaleLowerCase('vi')) && !ids.has(String(row.id)));
  return {
    users: [...local, ...added.map((row) => ({ ...row, active: 0 }))],
    addedLocked: added.map((row) => String(row.username)),
  };
}
