import type { StoreChangedPayload } from './shared';

/**
 * Giữ phần tóm tắt Westgard đã tính của từng xét nghiệm (kế hoạch kiến trúc
 * E.6 bước 3). `listTestSummaries` được gọi sau gần như mọi thao tác ghi, từ
 * mọi máy đang mở Tổng quan hay Nhập QC; nhập một điểm chỉ đổi một xét
 * nghiệm nên chỉ tính lại xét nghiệm đó.
 *
 * Nguyên tắc: chỉ bỏ ĐÚNG xét nghiệm khi chắc chắn thay đổi gói trong nó;
 * chưa chắc thì bỏ hết. Tính thừa chỉ chậm, còn giữ nhầm kết quả cũ là sai
 * số liệu QC.
 */

/** Bảng mà mỗi dòng thuộc đúng một xét nghiệm, và mọi chỗ ghi các bảng này
 * báo kèm đủ `testIds` (đã rà từng lời gọi `notifyChanged`, 2026-09-26). */
export const SUMMARY_PER_TEST_TABLES: ReadonlySet<string> = new Set(['qc_points', 'test_levels', 'tests', 'actions']);

/** Bảng mà phần tóm tắt KHÔNG đọc tới (đã đối chiếu các câu SQL của
 * `listTestSummaries` và các hàm nó gọi). Bảng không có ở đây và cũng không ở
 * nhóm theo xét nghiệm — kể cả bảng mới thêm sau này — làm bỏ toàn bộ. */
export const SUMMARY_IGNORED_TABLES: ReadonlySet<string> = new Set([
  'activity', 'users', 'lab', 'tea_refs', 'reagent_tests', 'report_templates',
  'period_locks', 'sigma_data', 'planned_targets', 'lot_transitions',
]);

export class TestSummaryCache<T> {
  private readonly entries = new Map<string, T>();
  private day = '';
  /** Vừa có một thao tác ghi nhật ký mà chưa báo bảng nào đổi. Handler nào
   * quên `notifyChanged` thì lần đọc sau bỏ hết thay vì trả kết quả cũ. */
  private unreportedWrite = false;

  /** Nhận mọi lời báo `store:changed` của main. */
  onChanged(payload: StoreChangedPayload): void {
    const tables = payload.tables;
    // `writeAudit()` luôn tự báo `['activity']`, trước lời báo của handler.
    if (tables.length === 1 && tables[0] === 'activity') { this.unreportedWrite = true; return; }
    this.unreportedWrite = false;
    const relevant = tables.filter((table) => !SUMMARY_IGNORED_TABLES.has(table));
    if (!relevant.length) return;
    if (payload.testIds.length && relevant.every((table) => SUMMARY_PER_TEST_TABLES.has(table))) {
      for (const testId of payload.testIds) this.entries.delete(testId);
    } else {
      this.entries.clear();
    }
  }

  /** Kết quả đã giữ của `testId`, hoặc tính mới bằng `compute`. `today` đổi
   * (qua nửa đêm) thì tính lại hết vì số điểm "hôm nay" đổi theo. */
  get(testId: string, today: string, compute: () => T): T {
    if (this.unreportedWrite || today !== this.day) {
      this.entries.clear();
      this.unreportedWrite = false;
      this.day = today;
    }
    const cached = this.entries.get(testId);
    if (cached !== undefined) return cached;
    const value = compute();
    this.entries.set(testId, value);
    return value;
  }

  /** Bỏ xét nghiệm không còn trong danh sách (đã xoá). */
  retain(testIds: readonly string[]): void {
    const keep = new Set(testIds);
    for (const testId of this.entries.keys()) if (!keep.has(testId)) this.entries.delete(testId);
  }

  get size(): number { return this.entries.size; }
}
