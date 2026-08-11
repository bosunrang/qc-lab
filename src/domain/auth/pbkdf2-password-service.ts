export const PASSWORD_HASH_ITERATIONS = 600000;

export function isPbkdf2PasswordHash(stored: unknown): boolean {
  return String(stored || '').startsWith('pbkdf2$');
}

export function passwordHashNeedsUpgrade(stored: unknown): boolean {
  if (!isPbkdf2PasswordHash(stored)) return true;
  return Number(String(stored).split('$')[1] || 0) < PASSWORD_HASH_ITERATIONS;
}

export type PasswordCrypto = Pick<Crypto, 'getRandomValues' | 'subtle'>;

export interface Pbkdf2PasswordService {
  hash(password: unknown): Promise<string>;
  verify(password: unknown, stored: unknown): Promise<boolean>;
}

export function passwordBytesHex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function passwordHexBytes(value: unknown): Uint8Array {
  return new Uint8Array((String(value || '').match(/.{1,2}/g) || []).map(hex => parseInt(hex, 16)));
}

export function createPbkdf2PasswordService(dependencies: { crypto: () => PasswordCrypto | null; textEncoder: () => TextEncoder }): Pbkdf2PasswordService {
  const secureCrypto = (): PasswordCrypto => {
    const value = dependencies.crypto();
    if (!value || !value.subtle) throw new Error('Trình duyệt không hỗ trợ mã hóa mật khẩu an toàn.');
    return value;
  };
  const derive = async (password: unknown, salt: Uint8Array, iterations: number): Promise<string> => {
    const crypto = secureCrypto();
    const key = await crypto.subtle.importKey('raw', dependencies.textEncoder().encode(String(password || '')), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations }, key, 256);
    return passwordBytesHex(new Uint8Array(bits));
  };
  return {
    async hash(password) {
      const crypto = secureCrypto();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${passwordBytesHex(salt)}$${await derive(password, salt, PASSWORD_HASH_ITERATIONS)}`;
    },
    async verify(password, stored) {
      const [, iterationsText, saltHex, expected] = String(stored || '').split('$');
      return (await derive(password, passwordHexBytes(saltHex), Number(iterationsText))) === expected;
    },
  };
}
