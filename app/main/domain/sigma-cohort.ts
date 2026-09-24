// Nhóm dữ liệu IQC phục vụ Six Sigma. CV phải được lấy từ các điểm QC cùng
// mức/cùng lô; không giới hạn theo tháng vì vòng đời lô có thể đi qua nhiều
// kỳ, nhưng một nhóm phải còn dữ liệu trong chính kỳ đang đánh giá.
export interface SigmaCohortPoint {
  id?: string;
  level: number; date: string; lot: string; val: number; voided?: number;
  qc_mean?: number | null; qc_sd?: number | null;
}

export type SigmaCohortStatus = 'insufficient' | 'provisional' | 'eligible' | 'unstable' | 'out-of-control';
export interface SigmaCohort {
  level: number; lot: string; n: number; cv: number | null; start: string; end: string;
  targetMean: number | null; targetSd: number | null; issues: string[];
  excluded: { voided: number; invalidValue: number };
  /** Điểm vượt ±3SD trong nhóm, và trong đó bao nhiêu điểm CHƯA có hồ sơ
   * khắc phục đã duyệt + kết luận hiệu quả. Không điểm nào bị loại khỏi CV. */
  outOfControl: { rejected: number; unresolved: number };
  status: SigmaCohortStatus;
}

/** `today` là THAM SỐ BẮT BUỘC, không có mặc định: mốc "hôm nay" phải theo
 * giờ địa phương (`main/domain/local-date.ts`), mà file này cố ý không import
 * module nào để test oracle nạp thẳng `.ts` qua ESM được. Để mặc định
 * `new Date().toISOString()` ở đây chính là chỗ đã lẻn vào ngày UTC. */
export function periodCutoff(period: string, today: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return '';
  const end = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).toISOString().slice(0, 10);
  return end < today ? end : today;
}

/** Ngày phải tồn tại thực trên lịch, không chỉ khớp `YYYY-MM-DD`. Một ngày
 * như `2026-02-31` làm `start`/`end` của cohort vô nghĩa và có thể kéo điểm
 * vào sai kỳ. */
function isCalendarDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** ISO/TS 20914 lấy u(Rw) từ dữ liệu IQC "đại diện cho hoạt động thường quy
 * ĐÃ ĐƯỢC thẩm định sau khi quản lý QC" — tức dữ liệu trong tầm kiểm soát,
 * mọi lần mất kiểm soát đã được điều tra và xử lý. Một nhóm 30 điểm có 1 điểm
 * +40 SD chưa ai đụng tới KHÔNG thoả điều kiện đó, nên không được `eligible`.
 *
 * CỐ Ý KHÔNG tự loại điểm mất kiểm soát ra khỏi CV: loại theo kết quả là
 * selection bias, CV sẽ đẹp giả và MU/Sigma lạc quan hơn thực tế. Điểm vẫn
 * nằm trong CV; thứ bị chặn là việc dùng nhóm đó để ĐỀ XUẤT thiết kế QC, cho
 * tới khi có hồ sơ khắc phục đã duyệt và kết luận hiệu quả. */
export function cohortStatus(n: number, issues: string[], unresolvedOutOfControl = 0): SigmaCohortStatus {
  if (unresolvedOutOfControl > 0) return 'out-of-control';
  if (issues.length) return 'unstable';
  if (n < 20) return 'insufficient';
  if (n < 30) return 'provisional';
  return 'eligible';
}

function uniqueFinite(points: SigmaCohortPoint[], key: 'qc_mean' | 'qc_sd', positive = false): number[] {
  const values: number[] = [];
  for (const point of points) {
    // Snapshot CHƯA GHI (`NULL` trong `qc_points`) phải bị BỎ QUA, không
    // được đi qua `Number()`: `Number(null)` là 0 và 0 là số hữu hạn, nên
    // một điểm thiếu snapshot tự đẻ ra giá trị mục tiêu thứ hai và cả nhóm bị
    // dán nhãn "Mean mục tiêu thay đổi" → `unstable` → không dùng được cho
    // Sigma. Nó cũng làm Mean mục tiêu 0 THẬT (base excess) lẫn với "chưa ghi".
    const raw = point[key];
    if (raw == null || String(raw).trim() === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value) && (!positive || value > 0) && !values.some((item) => Object.is(item, value))) values.push(value);
  }
  return values;
}

/** `resolvedPointIds` = id các điểm QC đã có hồ sơ NCE ĐƯỢC DUYỆT và kết luận
 * HIỆU QUẢ (`approval_status='approved'` + `effectiveness_status='effective'`,
 * hồ sơ chưa bị huỷ). Truyền từ handler vì file này cố ý không import gì —
 * xem ghi chú của `periodCutoff()`. */
export function buildSigmaCohorts(points: SigmaCohortPoint[], period: string, levels: number[], today: string, resolvedPointIds?: ReadonlySet<string>): SigmaCohort[] {
  const cutoff = periodCutoff(period, today);
  const start = `${period}-01`;
  if (!cutoff) return [];
  const wanted = new Set(levels);
  const groups = new Map<string, SigmaCohortPoint[]>();
  for (const point of points) {
    if (!wanted.has(point.level) || !isCalendarDate(String(point.date || '')) || point.date > cutoff) continue;
    const lot = String(point.lot || '').trim();
    const key = `${point.level}\u0000${lot}`;
    const rows = groups.get(key) || [];
    rows.push(point); groups.set(key, rows);
  }
  const out: SigmaCohort[] = [];
  for (const [key, rows] of groups) {
    const [levelText, lot] = key.split('\u0000');
    const excluded = { voided: 0, invalidValue: 0 };
    const valid: SigmaCohortPoint[] = [];
    for (const point of rows) {
      if (point.voided) { excluded.voided++; continue; }
      // `Number('')` là 0 nên một giá trị rỗng sẽ lọt vào CV như một điểm 0
      // thật; phải loại trước khi kiểm tra số hữu hạn.
      if (point.val == null || String(point.val).trim() === '' || !Number.isFinite(Number(point.val))) { excluded.invalidValue++; continue; }
      valid.push(point);
    }
    valid.sort((a, b) => a.date.localeCompare(b.date));
    // Nhóm chỉ liên quan tới kỳ nếu có ít nhất một điểm từ đầu kỳ tới cutoff.
    if (!valid.some((point) => point.date >= start)) continue;
    const values = valid.map((point) => Number(point.val));
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : 0;
    // Mất kiểm soát dạng THÔ: |z| ≥ 3 theo chính snapshot Mean/SD của điểm
    // (tiêu chí 1-3s). CỐ Ý không chạy toàn bộ multirule ở đây — file này
    // không import engine Westgard để test oracle nạp thẳng `.ts` được, và
    // cổng này chỉ nhằm chặn nhóm có điểm lệch thô chưa xử lý. Một nhóm qua
    // được cổng VẪN cần người phụ trách rà soát biểu đồ trước khi dùng.
    const outOfControl = { rejected: 0, unresolved: 0 };
    for (const point of valid) {
      const mean = point.qc_mean, sd = point.qc_sd;
      if (mean == null || sd == null || String(mean).trim() === '' || String(sd).trim() === '') continue;
      const m = Number(mean), s = Number(sd);
      if (!Number.isFinite(m) || !Number.isFinite(s) || s <= 0) continue;
      // `> 3` CHỨ KHÔNG `>= 3` — phải khớp đúng ngưỡng `1-3s` của
      // `westgard-engine.ts` (`a > 3`). Bản trước dùng `< 3` để bỏ qua, tức
      // đếm cả điểm có |z| ĐÚNG BẰNG 3; điểm đó Westgard chỉ kết luận "Cảnh
      // báo" nên không ai mở NCE cho nó, mà `resolvedPointIds` chỉ nhận điểm
      // có NCE duyệt xong + hiệu quả — nhóm IQC vì thế kẹt vĩnh viễn ở
      // `out-of-control`, chỉ gỡ được bằng cách huỷ điểm, tức phải làm sai
      // quy trình.
      if (Math.abs((Number(point.val) - m) / s) <= 3) continue;
      outOfControl.rejected++;
      const id = String(point.id || '');
      if (!id || !resolvedPointIds?.has(id)) outOfControl.unresolved++;
    }
    const targetMeans = uniqueFinite(valid, 'qc_mean');
    const targetSds = uniqueFinite(valid, 'qc_sd', true);
    const issues: string[] = [];
    if (!lot) issues.push('Thiếu mã lô QC');
    if (valid.some(point => point.qc_mean == null || point.qc_sd == null || String(point.qc_mean).trim() === '' || String(point.qc_sd).trim() === '' || !Number.isFinite(Number(point.qc_mean)) || !Number.isFinite(Number(point.qc_sd)) || Number(point.qc_sd) <= 0)) issues.push('Thiếu snapshot Mean/SD hợp lệ; chưa xác định được trạng thái kiểm soát');
    if (targetMeans.length > 1) issues.push('Mean mục tiêu thay đổi');
    if (targetSds.length > 1) issues.push('SD mục tiêu thay đổi');
    if (outOfControl.unresolved > 0) issues.push(`${outOfControl.unresolved} điểm vượt ±3SD chưa có hồ sơ khắc phục hiệu quả`);
    out.push({
      level: Number(levelText), lot, n: values.length,
      cv: mean ? sd / Math.abs(mean) * 100 : null,
      start: valid[0]?.date || '', end: valid[valid.length - 1]?.date || '',
      targetMean: targetMeans.length === 1 ? targetMeans[0] : null,
      targetSd: targetSds.length === 1 ? targetSds[0] : null,
      issues, excluded, outOfControl, status: cohortStatus(values.length, issues, outOfControl.unresolved),
    });
  }
  return out.sort((a, b) => a.level - b.level || a.start.localeCompare(b.start) || a.lot.localeCompare(b.lot, 'vi'));
}


