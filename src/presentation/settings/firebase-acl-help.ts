export function firebaseAclHelp(labCode: unknown, uid: unknown): string {
  const code = String(labCode || '');
  const userId = String(uid || 'UID_TAI_KHOAN_FIREBASE');
  return `Đăng nhập Firebase đã thành công nhưng tài khoản chưa có quyền với mã phòng "${code}".\n\nVào Realtime Database → Data và tạo:\nqclab-acl/${code}/${userId} = true\n\nSau đó bấm Lưu & kết nối lại.`;
}
