// Gói dữ liệu đẩy lên Firebase — dùng chung cho tiến trình phụ đẩy dữ liệu
// (`firebase-push-worker.ts`) và đường chạy tại chỗ (test, CSDL trong bộ nhớ).
// Firebase chỉ để sao lưu (kế hoạch kiến trúc B): một máy đẩy toàn bộ CSDL
// thành một backup có checksum, bọc trong vỏ RTDB `_format/_ts/_client`.
import type { Db } from '../db/sqlite-like';
import { SCHEMA_VERSION } from '../db/schema';
import { dumpAllTables } from '../db/table-io';
import { buildBackupEnvelope, type BackupEnvelope } from '../domain/backup';

export interface FirebasePayload { _format: 'qclab-firebase'; _ts: number; _client: string; backup: BackupEnvelope; }

/** Giới hạn cỡ MỘT lần ghi qua REST của Firebase Realtime Database. */
export const FIREBASE_MAX_WRITE_BYTES = 256 * 1024 * 1024;
/** Vượt tỉ lệ này thì cảnh báo trước khi chạm giới hạn. */
export const FIREBASE_WARN_RATIO = 0.8;

export function buildFirebasePayload(db: Db, now: Date = new Date()): FirebasePayload {
  return {
    _format: 'qclab-firebase', _ts: now.getTime(), _client: 'qclab-desktop',
    backup: buildBackupEnvelope(dumpAllTables(db), SCHEMA_VERSION, 'app', now.toISOString()),
  };
}

export type SizeVerdict = { kind: 'ok' | 'warn'; bytes: number; ratio: number } | { kind: 'too-large'; bytes: number; ratio: number };

export function sizeVerdict(bytes: number): SizeVerdict {
  const ratio = bytes / FIREBASE_MAX_WRITE_BYTES;
  if (bytes > FIREBASE_MAX_WRITE_BYTES) return { kind: 'too-large', bytes, ratio };
  return { kind: ratio >= FIREBASE_WARN_RATIO ? 'warn' : 'ok', bytes, ratio };
}

export interface PushRequest {
  dbPath: string;
  /** URL ghi của RTDB (đã kèm token), do main dựng; `null` = chỉ dựng và đo. */
  uploadUrl: string | null;
}
export type PushResponse =
  | { ok: true; bytes: number; ts: number; checksum: string; ratio: number }
  | { ok: false; code: 'too-large' | 'build-failed' | 'upload-failed'; message: string; bytes?: number; ratio?: number };
export type PushRunner = (request: PushRequest) => Promise<PushResponse>;

export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
