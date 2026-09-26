import type { FirebaseConfig } from './firebase-validation';

export interface FirebaseSession { idToken: string; uid: string; }
export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

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
    let result: { idToken?: string; localId?: string };
    try { result = JSON.parse(text); } catch { throw new Error('Firebase trả về dữ liệu xác thực không hợp lệ.'); }
    if (!result.idToken || !result.localId) throw new Error('Firebase không trả về token xác thực.');
    return { idToken: result.idToken, uid: result.localId };
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

  return { signIn, read, writeJson, uploadUrl: urlOf };
}


