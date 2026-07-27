window.QCLAB_APP = {
  name: 'QC Lab',
  version: '2.5.1',
  releaseDate: '2026-07-25',
  build: 'validated-operations'
};

// Bản phân phối không gắn sẵn Firebase project/labCode của bất kỳ đơn vị nào.
// Mỗi nơi tự nhập cấu hình trong "Cài đặt & Đám mây"; cấu hình được lưu cục bộ
// trên đúng máy đó. Bản OEM riêng vẫn có thể gán window.QCLAB_CLOUD trước file
// này với {labCode, anonymous:false, locked, config}.
window.QCLAB_CLOUD = window.QCLAB_CLOUD || null;
