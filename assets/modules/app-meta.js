window.QCLAB_APP = {
  name: 'QC Lab',
  version: '2.5.1',
  releaseDate: '2026-07-25',
  build: 'validated-operations'
};

// Cấu hình đám mây khi deploy (tùy chọn).
// BẢO MẬT: KHÔNG bật anonymous cho dữ liệu thật. Với anonymous:false, mỗi máy
// chỉ tự nạp sẵn config; người dùng vẫn phải đăng nhập email/mật khẩu Firebase
// một lần trong "Cài đặt & Đám mây" (phiên được nhớ trên máy đó).
// locked:false nghĩa là người dùng có thể thay config/labCode ngay trong Cài đặt
// mà không sửa code. Đặt locked:true nếu muốn bản deploy cố định một kho Firebase.
// Đồng thời Firebase Rules phải giới hạn theo UID qua nhánh qclab-acl —
// xem firebase/database.rules.json và firebase/HUONG-DAN-FIREBASE-RULES.md.
window.QCLAB_CLOUD = window.QCLAB_CLOUD || {
  labCode: 'khoaXN',
  anonymous: false,
  locked: false,
  config: {
    apiKey: "AIzaSyBJvYHn1h8smBgP0WUXO2ZNppgFmt2Blus",
    authDomain: "qclab1102.firebaseapp.com",
    databaseURL: "https://qclab1102-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "qclab1102",
    storageBucket: "qclab1102.firebasestorage.app",
    messagingSenderId: "389167813426",
    appId: "1:389167813426:web:ebaea398d7b5d547477d2b"
  }
};
