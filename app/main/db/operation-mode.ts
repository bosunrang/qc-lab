// Chế độ vận hành (GV3, kế hoạch khắc phục 2026-10-31): cờ một chiều trong
// `app_meta`. Khi đã bật, main chặn "Xoá sạch dữ liệu thử" — dữ liệu QC thật
// chỉ còn đổi qua các quy trình có nhật ký (huỷ điểm, lưu trữ nhật ký…).
// Không có thao tác tắt; phục hồi backup hay tải từ Firebase cũng giữ cờ này
// (xem `keepOperationMode`), để không thể "tắt" bằng cách nạp dữ liệu cũ.
import type { Db } from './sqlite-like';

const AT_KEY = 'operationModeAt';
const BY_KEY = 'operationModeBy';

export interface OperationModeState { enabledAt: string; enabledBy: string }

export function readOperationMode(db: Db): OperationModeState | null {
  const rows = db.prepare('SELECT key, value FROM app_meta WHERE key IN (?, ?)').all(AT_KEY, BY_KEY) as { key: string; value: string }[];
  const enabledAt = rows.find((row) => row.key === AT_KEY)?.value || '';
  if (!enabledAt) return null;
  return { enabledAt, enabledBy: rows.find((row) => row.key === BY_KEY)?.value || '' };
}

export function writeOperationMode(db: Db, state: OperationModeState): void {
  const upsert = db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  upsert.run(AT_KEY, state.enabledAt);
  upsert.run(BY_KEY, state.enabledBy);
}

/** Chạy `replaceAll` (phục hồi toàn bộ bảng) rồi ghi lại cờ đã có trước đó.
 * Gói dữ liệu cũ hơn lúc bật chế độ vận hành không mang cờ, nên nếu không giữ
 * thì một lần phục hồi sẽ mở lại đường xoá sạch. */
export function keepOperationMode<T>(db: Db, replaceAll: () => T): T {
  const before = readOperationMode(db);
  const result = replaceAll();
  if (before && !readOperationMode(db)) writeOperationMode(db, before);
  return result;
}
