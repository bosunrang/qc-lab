import type { FirebaseConfig } from './firebase-validation';

/** `idToken` sống khoảng 1 giờ (`expiresAt`, ms); `refreshToken` dùng để xin
 * token mới mà không cần mật khẩu (GV6). */
export interface FirebaseSession { idToken: string; refreshToken: string; uid: string; expiresAt: number; }

/** Lỗi đổi token cho thấy phiên không dùng lại được nữa (refresh token hết hạn,
 * bị thu hồi, tài khoản bị khoá/xoá): phải kết nối lại bằng mật khẩu. */
export class FirebaseSessionExpiredError extends Error {}
export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** `expiresIn` (giây, dạng chuỗi) → mốc hết hạn; thiếu thì coi như 1 giờ. */
function expiresAtOf(expiresIn: string | undefined, now = Date.now()): number {
  const seconds = Number(expiresIn);
  return now + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000;
}

function errorMessage(prefix: string, body: string, status: number): Error {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message || body;
  } catch { /* response không phải JSON vẫn báo được trạng thái */ }
  return new Error(`${prefix}${message ? `: ${message}` : ` (HTTP ${status})`}`);
}

/** REST client nhỏ cho RTDB + Identity Toolkit. Chạy ở main process nên token
 * không bao giờ đi qua renderer; SDK Firebase browser không cần được nhúng. */
export function createFirebaseClient(fetchImpl: FetchLike = fetch as unknown as FetchLike) {
  async function signIn(config: FirebaseConfig, email: string, password: string): Promise<FirebaseSession> {
    const response = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const text = await response.text();
    if (!response.ok) throw errorMessage('Không thể đăng nhập Firebase', text, response.status);
    let result: { idToken?: string; localId?: string; refreshToken?: string; expiresIn?: string };
    try { result = JSON.parse(text); } catch { throw new Error('Firebase trả về dữ liệu xác thực không hợp lệ.'); }
    if (!result.idToken || !result.localId) throw new Error('Firebase không trả về token xác thực.');
    return { idToken: result.idToken, uid: result.localId, refreshToken: result.refreshToken || '', expiresAt: expiresAtOf(result.expiresIn) };
  }

  /** Đổi refresh token lấy idToken mới (Secure Token API). Lỗi 400/401/403 là
   * phiên hỏng hẳn; lỗi khác (mạng, 5xx) để lần sau thử lại. */
  async function refresh(config: FirebaseConfig, refreshToken: string): Promise<FirebaseSession> {
    const response = await fetchImpl(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    const text = await response.text();
    if (!response.ok) {
      const error = errorMessage('Không thể làm mới phiên Firebase', text, response.status);
      throw [400, 401, 403].includes(response.status) ? new FirebaseSessionExpiredError(error.message) : error;
    }
    let result: { id_token?: string; refresh_token?: string; user_id?: string; expires_in?: string };
    try { result = JSON.parse(text); } catch { throw new Error('Firebase trả về dữ liệu làm mới phiên không hợp lệ.'); }
    if (!result.id_token || !result.user_id) throw new Error('Firebase không trả về token mới.');
    return { idToken: result.id_token, uid: result.user_id, refreshToken: result.refresh_token || refreshToken, expiresAt: expiresAtOf(result.expires_in) };
  }

  const urlOf = (config: FirebaseConfig, labCode: string, token: string) =>
    `${config.databaseURL}/qclab-shared/${encodeURIComponent(labCode)}.json?auth=${encodeURIComponent(token)}`;

  async function read(config: FirebaseConfig, labCode: string, token: string): Promise<unknown> {
    const response = await fetchImpl(urlOf(config, labCode, token));
    const text = await response.text();
    if (!response.ok) throw errorMessage('Không thể đọc Firebase Realtime Database', text, response.status);
    try { return JSON.parse(text); } catch { throw new Error('Firebase trả về JSON không hợp lệ.'); }
  }

  /** Ghi một chuỗi JSON đã dựng sẵn (đã đo cỡ trước khi gửi, xem
   * `sync/firebase-payload.ts`), không stringify lại lần nữa. */
  async function writeJson(config: FirebaseConfig, labCode: string, token: string, json: string): Promise<void> {
    const response = await fetchImpl(urlOf(config, labCode, token), {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: json,
    });
    const text = await response.text();
    if (!response.ok) throw errorMessage('Không thể ghi Firebase Realtime Database', text, response.status);
  }

  return { signIn, refresh, read, writeJson, uploadUrl: urlOf };
}


