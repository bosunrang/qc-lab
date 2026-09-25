// Quyết định điều hướng cho mọi cửa sổ của app: chỉ hiển thị trang của chính
// app; liên kết `https:` ra ngoài mở bằng trình duyệt hệ thống; mọi thứ khác
// bị chặn. Tách khỏi `index.ts` (không import `electron`) để test bằng Node.
//
// Trước đây cửa sổ chính không có `will-navigate` hay `setWindowOpenHandler`:
// một liên kết trong dữ liệu (tên xét nghiệm, ghi chú, nội dung LIS…) có thể
// đưa cửa sổ app, vốn có preload `qcApi`, sang một trang ngoài.

export type NavigationDecision = 'app' | 'external' | 'deny';

function parse(url: string): URL | null {
  try { return new URL(url); } catch { return null; }
}

function directoryOf(pathname: string): string {
  return pathname.slice(0, pathname.lastIndexOf('/') + 1).toLowerCase();
}

/** `appEntry` là URL trang chính đang nạp: `file:///…/renderer/index.html`
 * khi đóng gói, hoặc địa chỉ dev server khi phát triển.
 * - `app`: trang HTML nằm cùng thư mục với trang chính (vd `firebase-guide.html`),
 *   hoặc cùng origin với dev server;
 * - `external`: `https:` ra ngoài, mở bằng trình duyệt hệ thống;
 * - `deny`: mọi thứ còn lại (`http:` ngoài, `file:` khác thư mục, `javascript:`…). */
export function classifyNavigation(target: string, appEntry: string): NavigationDecision {
  const to = parse(target);
  const entry = parse(appEntry);
  if (!to || !entry) return 'deny';
  if (entry.protocol === 'file:') {
    if (to.protocol === 'file:' && to.host === entry.host
      && directoryOf(to.pathname) === directoryOf(entry.pathname) && to.pathname.toLowerCase().endsWith('.html')) return 'app';
  } else if (to.origin === entry.origin) {
    return 'app';
  }
  return to.protocol === 'https:' ? 'external' : 'deny';
}
