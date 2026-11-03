import type { QcApi } from '../../shared/qc-api';
import { exportTableXlsxInBrowser, printHtmlToPdfInBrowser } from '../lib/browser-export';
import { announceSessionEnded } from '../lib/session-events';

/** Lỗi khi gọi máy chủ LAN; `code` lấy từ phản hồi để nơi gọi phân biệt. */
export class LanRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

/** Cùng hợp đồng QcApi với preload Electron; chỉ thay transport thành HTTP.
 *
 * Xử lý phản hồi (GV5, Q1). Trước đây client trả thẳng `response.json()` nên:
 * - 401 (phiên hết hạn, tài khoản bị khoá) thành `{ok:false}` ở chỗ trang chờ
 *   mảng, `.map` hỏng và cả trang rơi vào màn lỗi;
 * - thao tác đọc bị lỗi cũng thành `{ok:false}` như vậy.
 * Nay 401 báo phiên kết thúc để app về màn đăng nhập; thao tác đọc lỗi
 * (`readFailed` từ máy chủ) thì ném lỗi như ở máy chính. */
export function createLanHttpApi(fetcher: Fetcher = (path, init) => fetch(path, init), events: (url: string) => EventSource = (url) => new EventSource(url)): QcApi {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetcher(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(init?.headers || {}) }, ...init });
    // Thao tác đọc có thể trả đúng `null` (vd hồ sơ không còn), nên phân biệt
    // "không đọc được JSON" bằng một giá trị riêng.
    const UNREADABLE = Symbol('unreadable');
    const parsed: unknown = await response.json().catch(() => UNREADABLE);
    if (parsed === UNREADABLE) throw new LanRequestError('bad-response', `Máy chủ trả phản hồi không đọc được (HTTP ${response.status}).`);
    const body = parsed as { ok?: boolean; readFailed?: boolean; error?: { code?: string; message?: string } } | null;
    // Đăng nhập sai cũng trả 401 nhưng chưa có phiên nào để kết thúc.
    if (response.status === 401 && path !== '/api/auth/login') {
      announceSessionEnded();
      throw new LanRequestError('unauthenticated', body?.error?.message || 'Phiên đăng nhập đã kết thúc.');
    }
    if (body?.readFailed) throw new LanRequestError(body.error?.code || 'read-failed', body.error?.message || 'Không đọc được dữ liệu từ máy chủ.');
    return body;
  }

  // Một luồng sự kiện cho mọi nơi nghe (Q2): trước đây mỗi trang mở một
  // `EventSource` riêng tới máy chủ. Đóng khi không còn ai nghe.
  const listeners = new Set<(payload: { tables: string[]; testIds: string[] }) => void>();
  let source: EventSource | null = null;
  function subscribe(callback: (payload: { tables: string[]; testIds: string[] }) => void): () => void {
    listeners.add(callback);
    if (!source) {
      source = events('/api/events');
      source.addEventListener('store-changed', (event) => {
        const payload = JSON.parse((event as MessageEvent).data);
        for (const listener of listeners) listener(payload);
      });
    }
    return () => {
      listeners.delete(callback);
      if (!listeners.size && source) { source.close(); source = null; }
    };
  }

  return new Proxy({} as QcApi, {
    get(_target, property: string) {
      if (property === 'onStoreChanged') return subscribe;
      // Màn đăng nhập hỏi trước khi có phiên. Máy trạm không bao giờ khởi tạo
      // tài khoản quản trị đầu tiên (chỉ làm trên máy chính), nên luôn coi là đã
      // có tài khoản thay vì gọi RPC rồi nhận 401.
      if (property === 'hasAnyUsers') return async () => true;
      // Ghi log lỗi renderer là thao tác của máy chính (`lan: false`); gửi qua LAN
      // chỉ nhận "không mở qua mạng nội bộ", hoặc 401 trước khi đăng nhập.
      if (property === 'reportClientError') return async () => ({ ok: true, data: null });
      if (property === 'login') return async (input: unknown) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
      if (property === 'logout') return async () => request('/api/auth/logout', { method: 'POST', body: '{}' });
      if (property === 'currentUser') return async () => {
        // Chưa đăng nhập là trạng thái bình thường của màn đăng nhập, không
        // phải "phiên kết thúc": hỏi trực tiếp, không qua `request()`.
        const response = await fetcher('/api/session', { credentials: 'same-origin' });
        if (!response.ok) return null;
        const result = await response.json() as { ok: boolean; data?: unknown };
        return result.ok ? result.data ?? null : null;
      };
      // Xuất Excel/in PDF trên máy chính mở hộp thoại lưu tệp CỦA MÁY CHÍNH nên
      // không mở qua LAN (`lan: false`); máy trạm tự làm bằng trình duyệt của nó.
      if (property === 'exportTableXlsx') return exportTableXlsxInBrowser;
      if (property === 'printHtmlToPdf') return ({ html }: { html: string }) => printHtmlToPdfInBrowser(html);
      if (property === 'getLoginBrand') return async () => request('/api/brand') as ReturnType<QcApi['getLoginBrand']>;
      return async (...args: unknown[]) => request('/api/rpc', { method: 'POST', body: JSON.stringify({ method: property, args }) });
    },
  });
}
