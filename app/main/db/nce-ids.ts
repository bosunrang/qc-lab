import type { Db } from './sqlite-like';

/** Mã hồ sơ NCE kế tiếp trong ngày: `NCE-YYYYMMDD-NN`, lấy hậu tố LỚN NHẤT
 * cộng 1. Không dùng COUNT(*): khi đã có khoảng trống (còn 01 và 03 nhưng mất
 * 02, ví dụ sau khi phục hồi backup) thì COUNT+1 ra đúng mã 03 đang tồn tại.
 * Quét cả bảng `actions` cũ: hồ sơ đổi dải QC phiên bản cũ không được chuyển
 * sang `nce_records` nhưng mã của chúng vẫn không được dùng lại.
 * `date` phải là ngày ĐỊA PHƯƠNG (`isoLocalDate()`), không phải ngày UTC. */
export function nextNceId(db: Db, date: string): string {
  const prefix = `NCE-${date.replace(/-/g, '')}-`;
  const rows = db.prepare('SELECT nce_id FROM nce_records WHERE nce_id LIKE ? UNION ALL SELECT nce_id FROM actions WHERE nce_id LIKE ?').all(`${prefix}%`, `${prefix}%`) as { nce_id: string }[];
  const maxSuffix = rows.reduce((max, row) => {
    const suffix = row.nce_id.startsWith(prefix) ? Number(row.nce_id.slice(prefix.length)) : NaN;
    return Number.isInteger(suffix) && suffix > max ? suffix : max;
  }, 0);
  return `${prefix}${String(maxSuffix + 1).padStart(2, '0')}`;
}
