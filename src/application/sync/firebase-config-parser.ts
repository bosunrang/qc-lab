export type FirebaseConfig = Record<string, unknown>;

const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];

export function validateFirebaseConfig(config: unknown): FirebaseConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Firebase config phải là một object.');
  const value = config as FirebaseConfig;
  const missing = requiredKeys.filter(key => !String(value[key] || '').trim());
  if (missing.length) throw new Error('Firebase config thiếu: ' + missing.join(', ') + '.');
  return value;
}

export function parseFirebaseConfig(raw: unknown): FirebaseConfig {
  const input = String(raw || '').trim();
  if (!input) throw new Error('Dán Firebase config trước khi kết nối.');
  try {
    return validateFirebaseConfig(JSON.parse(input));
  } catch {}
  const start = input.indexOf('{');
  const end = input.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Không tìm thấy object firebaseConfig. Hãy dán đoạn Config từ Firebase console.');
  const normalized = input.slice(start, end + 1)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, '$1');
  try {
    return validateFirebaseConfig(JSON.parse(normalized));
  } catch {
    throw new Error('Firebase config không hợp lệ. Có thể dán nguyên đoạn từ tab Config của Firebase console, ví dụ: const firebaseConfig = { ... };');
  }
}
