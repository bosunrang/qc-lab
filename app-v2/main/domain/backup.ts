// Giai đoạn C3 (docs/APP-V2-PLAN.md) — định dạng backup CỦA RIÊNG app-v2.
// CỐ Ý KHÔNG tương thích byte-for-byte với backup app cũ: dữ liệu app cũ là
// 1 object JS lồng nhau (state.tests/state.data/...), app-v2 là bảng SQLite
// quan hệ — 2 hình dạng khác hẳn nhau, "tương thích" thật sự (đọc được backup
// CŨ) là việc CỦA Giai đoạn C4 (di trú dữ liệu), cần lớp dịch riêng, không
// phải chỉ đổi tên field ở đây. C3 chỉ đảm bảo app-v2 tự sao lưu/phục hồi
// ĐÚNG dữ liệu CỦA CHÍNH NÓ, dùng lại đúng NGUYÊN TẮC checksum của bản cũ
// (SHA-256 thật trên JSON.stringify(data) nguyên văn, không canonical hoá —
// khác hẳn `auditCanonical`/`auditSha256` của audit-chain.ts, vốn dùng cho
// mục đích khác: chuỗi hash từng dòng audit log).
import { createHash } from 'node:crypto';

export const BACKUP_FORMAT = 'qclab-v2-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupEnvelope {
  format: string;
  formatVersion: number;
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  checksum: string;
  data: Record<string, Record<string, unknown>[]>;
}

export function computeChecksum(dataJson: string): string {
  return createHash('sha256').update(dataJson, 'utf8').digest('hex');
}

export function buildBackupEnvelope(data: Record<string, Record<string, unknown>[]>, schemaVersion: number, appVersion: string, now: string): BackupEnvelope {
  const dataJson = JSON.stringify(data);
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: now,
    appVersion,
    schemaVersion,
    checksum: computeChecksum(dataJson),
    data,
  };
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/** Kiểm tra vỏ bọc + checksum TRƯỚC khi đụng vào nội dung `data` — không xác
 * nhận cấu trúc từng bảng ở đây (đó là việc của handler, đọc theo đúng cột
 * SQLite hiện có qua PRAGMA table_info, không hard-code danh sách cột). */
export function validateBackupEnvelope(raw: unknown, currentSchemaVersion: number): ValidationResult<BackupEnvelope> {
  if (!raw || typeof raw !== 'object') return { ok: false, code: 'invalid-json', message: 'File backup không đúng định dạng JSON.' };
  const env = raw as Partial<BackupEnvelope>;
  if (env.format !== BACKUP_FORMAT) {
    return { ok: false, code: 'wrong-format', message: `File này không phải backup của app-v2 (format="${String(env.format)}"). Backup từ app cũ chưa được hỗ trợ ở bước này.` };
  }
  if (typeof env.schemaVersion !== 'number' || env.schemaVersion > currentSchemaVersion) {
    return { ok: false, code: 'unsupported-schema', message: 'Backup được tạo từ phiên bản mới hơn app hiện tại, không thể phục hồi.' };
  }
  if (!env.data || typeof env.data !== 'object' || Array.isArray(env.data)) {
    return { ok: false, code: 'missing-data', message: 'Backup thiếu dữ liệu.' };
  }
  const dataJson = JSON.stringify(env.data);
  const checksum = computeChecksum(dataJson);
  if (checksum !== env.checksum) {
    return { ok: false, code: 'checksum-mismatch', message: 'Checksum SHA-256 không khớp — file backup có thể đã bị sửa hoặc hỏng.' };
  }
  return { ok: true, data: env as BackupEnvelope };
}
