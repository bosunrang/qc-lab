import { createPrivateKey } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coveredIps, createLanCa, issueServerCredentials, lanCaFrom, type LanCa, type ServerCredentials } from './tls-certs';

/**
 * Mã hoá khoá bí mật của CA khi lưu xuống đĩa. App dùng `safeStorage` của
 * Electron (DPAPI trên Windows): tệp chép sang máy khác hay tài khoản Windows
 * khác không giải được. Test truyền bản giả.
 */
export interface KeyProtector { encrypt(plain: Buffer): Buffer; decrypt(sealed: Buffer): Buffer; }

/** Phần của `safeStorage` (Electron) mà app dùng. */
export interface StringSealer {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(sealed: Buffer): string;
}

const SEALED_TAG = Buffer.from('S1');
const PLAIN_TAG = Buffer.from('P1');

/**
 * Bọc `safeStorage`: tệp khoá mở đầu bằng 2 byte cho biết cách lưu. Hệ điều
 * hành không cho mã hoá (hiếm trên Windows) thì lưu thường, `sealed = false`
 * để main ghi cảnh báo — HTTPS vẫn chạy, chỉ khoá CA không được DPAPI bảo vệ.
 */
export function sealedKeyProtector(sealer: StringSealer): KeyProtector & { sealed: boolean } {
  const sealed = sealer.isEncryptionAvailable();
  return {
    sealed,
    encrypt: (plain) => sealed
      ? Buffer.concat([SEALED_TAG, sealer.encryptString(plain.toString('utf8'))])
      : Buffer.concat([PLAIN_TAG, plain]),
    decrypt: (data) => {
      const tag = data.subarray(0, 2);
      if (tag.equals(SEALED_TAG)) return Buffer.from(sealer.decryptString(data.subarray(2)), 'utf8');
      if (tag.equals(PLAIN_TAG)) return data.subarray(2);
      throw new Error('Tệp khoá CA không đúng định dạng.');
    },
  };
}

const CERT_FILE = 'ca-cert.pem';
const KEY_FILE = 'ca-key.bin';
/** CA hết hạn trong khoảng này thì tạo CA mới ngay khi app mở. */
const CA_RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
/** Chứng chỉ máy chủ còn dưới khoảng này thì cấp lại. */
const SERVER_RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;

function writeAtomic(path: string, content: Buffer | string): void {
  const temp = `${path}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, path);
}

export interface LoadedCa { ca: LanCa; created: boolean; reason?: string; }

/**
 * Đọc CA đã lưu ở `dir`; thiếu, hỏng, không giải mã được hoặc sắp hết hạn
 * thì tạo CA mới. CA mới nghĩa là máy nhân viên phải cài lại chứng chỉ gốc,
 * nên trả kèm lý do để main ghi log.
 */
export function loadOrCreateCa(dir: string, protector: KeyProtector, now = new Date()): LoadedCa {
  let reason = 'chưa có CA';
  try {
    const certPem = readFileSync(join(dir, CERT_FILE), 'utf8');
    const key = createPrivateKey(protector.decrypt(readFileSync(join(dir, KEY_FILE))));
    const ca = lanCaFrom(certPem, key);
    if (new Date(ca.cert.validTo).getTime() - now.getTime() > CA_RENEW_BEFORE_MS) return { ca, created: false };
    reason = 'CA sắp hết hạn';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') reason = `không đọc được CA đã lưu (${error instanceof Error ? error.message : String(error)})`;
  }
  const ca = createLanCa(now);
  mkdirSync(dir, { recursive: true });
  // Khoá trước, chứng chỉ sau: nếu app dừng giữa chừng, lần sau chứng chỉ
  // cũ không khớp khoá mới và CA được tạo lại, không dùng nhầm cặp lệch.
  writeAtomic(join(dir, KEY_FILE), protector.encrypt(Buffer.from(String(ca.key.export({ type: 'pkcs8', format: 'pem' })))));
  writeAtomic(join(dir, CERT_FILE), ca.certPem);
  return { ca, created: true, reason };
}

/**
 * Giữ chứng chỉ máy chủ đang dùng; cấp lại khi tập địa chỉ IP đổi hoặc chứng
 * chỉ sắp hết hạn. Khoá của chứng chỉ máy chủ chỉ nằm trong bộ nhớ.
 */
export class LanTlsIdentity {
  private current: ServerCredentials;
  constructor(readonly ca: LanCa, ips: readonly string[], private readonly now = () => new Date()) {
    this.current = issueServerCredentials(ca, withLoopback(ips), now());
  }
  get credentials(): ServerCredentials { return this.current; }

  /** Trả `true` nếu vừa cấp chứng chỉ mới (máy chủ cần nạp lại). So theo các
   * địa chỉ CA được phép cấp, không theo danh sách thô: địa chỉ ngoài dải nội
   * bộ có đổi cũng không làm chứng chỉ khác đi. */
  refresh(ips: readonly string[]): boolean {
    const now = this.now();
    const wanted = withLoopback(ips);
    const sameIps = coveredIps(wanted).join(',') === this.current.ips.join(',');
    const expiring = this.current.notAfter.getTime() - now.getTime() < SERVER_RENEW_BEFORE_MS;
    if (sameIps && !expiring) return false;
    this.current = issueServerCredentials(this.ca, wanted, now);
    return true;
  }
}

/** Luôn kèm 127.0.0.1 để mở được ngay trên máy chính. */
function withLoopback(ips: readonly string[]): string[] { return [...new Set(['127.0.0.1', ...ips])]; }
