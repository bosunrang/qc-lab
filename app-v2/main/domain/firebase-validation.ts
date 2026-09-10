// Xác thực dữ liệu cấu hình Firebase ở main process. Không tin dữ liệu từ
// renderer: URL được dùng để gửi cả dữ liệu QC nên chỉ chấp nhận RTDB chính
// thức qua HTTPS; mã phòng cũng được giới hạn để không tạo path bất ngờ.
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
  [key: string]: unknown;
}

const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'] as const;

export function parseFirebaseConfig(raw: unknown): FirebaseConfig {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Dán Firebase config trước khi kết nối.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Không tìm thấy object firebaseConfig. Hãy dán đoạn Config từ Firebase Console.');
    const normalized = text.slice(start, end + 1)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1');
    try { value = JSON.parse(normalized); } catch { throw new Error('Firebase config không hợp lệ. Có thể dán nguyên đoạn Config từ Firebase Console.'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Firebase config phải là một object.');
  const config = value as Record<string, unknown>;
  const missing = requiredKeys.filter((key) => !String(config[key] || '').trim());
  if (missing.length) throw new Error(`Firebase config thiếu: ${missing.join(', ')}.`);
  const databaseURL = String(config.databaseURL);
  let url: URL;
  try { url = new URL(databaseURL); } catch { throw new Error('databaseURL của Firebase không hợp lệ.'); }
  if (url.protocol !== 'https:' || !(/\.firebaseio\.com$/i.test(url.hostname) || /\.firebasedatabase\.app$/i.test(url.hostname))) {
    throw new Error('databaseURL phải là địa chỉ HTTPS của Firebase Realtime Database.');
  }
  return {
    ...config,
    apiKey: String(config.apiKey), authDomain: String(config.authDomain), databaseURL: url.origin,
    projectId: String(config.projectId), appId: String(config.appId),
  };
}

export function cleanLabCode(value: unknown): string {
  const code = String(value || '').trim() || 'khoaXN';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) throw new Error('Mã phòng chỉ gồm chữ, số, dấu gạch nối hoặc gạch dưới (tối đa 64 ký tự).');
  return code;
}

export function cleanFirebaseEmail(value: unknown): string {
  const email = String(value || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Nhập email Firebase Authentication hợp lệ.');
  return email;
}
