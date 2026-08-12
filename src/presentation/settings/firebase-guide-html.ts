function firebaseGuideStep(number: number, title: string, body: string): string {
  return `<div class="fb-step"><div class="fb-num">${number}</div><div class="fb-step-body"><h4>${title}</h4>${body}</div></div>`;
}

export function firebaseGuideHtml(): string {
  return `<details class="firebase-guide"><summary>Hướng dẫn Firebase chi tiết</summary>
    <div class="firebase-guide-body">
      ${firebaseGuideStep(1, 'Bật đăng nhập Email/Password', '<p>Firebase Console → Authentication → Sign-in method: tắt <b>Anonymous</b>, bật <b>Email/Password</b>.</p>')}
      ${firebaseGuideStep(2, 'Tạo tài khoản, lấy UID', '<p>Authentication → Users → Add user — mỗi máy/người 1 tài khoản, sau đó copy <b>User UID</b>.</p>')}
      ${firebaseGuideStep(3, 'Thêm UID vào danh sách được phép', '<p>Realtime Database → Data, tạo đúng cấu trúc theo mã phòng (labCode) đang dùng:</p><pre>qclab-acl\n  khoaXN\n    UID_TAI_KHOAN_1: true\n    UID_TAI_KHOAN_2: true</pre><p>Đổi labCode thành <code>labA</code> thì ACL nằm ở <code>qclab-acl/labA/{uid}</code>.</p>')}
      ${firebaseGuideStep(4, 'Dán Rules', '<p>Realtime Database → Rules → dán nguyên nội dung khung <b>Firebase Rules</b> bên dưới → Publish. Không sửa <code>$labCode</code>/<code>$uid</code>.</p>')}
      ${firebaseGuideStep(5, 'Kết nối trong app', '<p>Thẻ Đồng bộ Đám mây → nhập labCode, email/mật khẩu, dán Firebase config → bấm <b>Lưu &amp; kết nối</b>.</p>')}
    </div>
  </details>`;
}
