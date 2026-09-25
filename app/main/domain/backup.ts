import { createHash } from 'node:crypto';

/** Định dạng JSON cũ: vẫn dùng cho gói đồng bộ Firebase và vẫn phục hồi được
 * từ tệp .json đã xuất trước 2026-09-25. */
export const BACKUP_FORMAT = 'qclab-v2-backup';
export const BACKUP_FORMAT_VERSION = 1;
/** Định dạng tệp backup hiện tại: một tệp SQLite (tạo bằng `VACUUM INTO`) có
 * thêm bảng `backup_info` ghi dấu định dạng, phiên bản schema và thời điểm. */
export const BACKUP_FILE_FORMAT = 'qclab-v2-sqlite-backup';
export const BACKUP_FILE_FORMAT_VERSION = 1;

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
    return { ok: false, code: 'wrong-format', message: `File này không đúng định dạng backup được hỗ trợ (format="${String(env.format)}").` };
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


