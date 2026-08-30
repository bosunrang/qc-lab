/* Pha H lát 2 (2026-08-20): gom 6 đăng ký window/document listener top-level
   từng rải ở hai chỗ khác nhau trong src/compat/modular-pilot.global.ts (khối
   flush lưu cục bộ khi thoát trang, khối Firebase khi mạng/tiêu điểm đổi) vào
   một factory duy nhất — không đổi hành vi runtime, chỉ đổi nơi code sống, từ
   side effect rải trong một file 6000+ dòng sang một hàm có tên, nhận
   dependency, test được. `window`/`document` do adapter tự kiểm tra
   `typeof ... !== 'undefined'` rồi truyền vào (hoặc truyền `undefined`) —
   giữ file này không tự đọc global, đúng quy tắc domain/presentation trong
   CLAUDE.md. */
type BootstrapWindow = { addEventListener: (type: string, listener: () => void) => void };
type BootstrapDocument = { addEventListener: (type: string, listener: () => void) => void; visibilityState: string };

export function createAppBootstrap(deps: {
  window: BootstrapWindow | undefined;
  document: BootstrapDocument | undefined;
  lsFlush: () => void;
  fbPullOnce: () => void;
  scheduleFbPush: () => void;
  markSaved: (label: string, detail?: string) => void;
  isDirty: () => boolean;
  onPopState: () => void;
}) {
  const run = () => {
    if (deps.window) {
      deps.window.addEventListener('beforeunload', deps.lsFlush);
      deps.window.addEventListener('pagehide', deps.lsFlush);
      deps.window.addEventListener('focus', deps.fbPullOnce);
      deps.window.addEventListener('online', () => { if (deps.isDirty()) deps.scheduleFbPush(); else deps.fbPullOnce(); });
      deps.window.addEventListener('offline', () => { if (deps.isDirty()) deps.markSaved('cục bộ', 'Mạng ngoại tuyến · sẽ tự đồng bộ khi có mạng'); });
      /* Giai đoạn 6 (Router chuẩn): nút Back/Forward của trình duyệt bắn
         popstate — đồng bộ trang đang hiển thị theo hash MỚI (đã đổi rồi,
         không phải sự kiện để "xin phép" đổi) chứ không push thêm lịch sử. */
      deps.window.addEventListener('popstate', deps.onPopState);
    }
    if (deps.document) {
      deps.document.addEventListener('visibilitychange', () => {
        if (deps.document!.visibilityState === 'hidden') deps.lsFlush();
        else if (deps.document!.visibilityState === 'visible') deps.fbPullOnce();
      });
    }
  };
  return { run };
}
