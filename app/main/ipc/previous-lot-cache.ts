import type { Db } from '../db/sqlite-like';
import type { ArchivedBlock } from '../../shared/qc-api';
import { createHistoricalWestgard } from '../db/historical-westgard';
import { listPreviousLotSeriesData, type PreviousLotSeriesData } from '../db/lot-lineage';
import { addChangeListener, type MainChangedPayload } from './shared';

/**
 * Giữ kết quả "lô cũ" (chuỗi điểm + phân tích Westgard của các lô trên chuỗi
 * chuyển tiếp đã chấp nhận) của từng xét nghiệm. Trang Nhập QC nạp phần này
 * sau MỖI lần nhập điểm; tính mới phải đọc lại toàn bộ điểm của mọi lô cũ
 * (đo 2026-11-03 trên bộ 5 năm: ~450 ms, ~10.000 điểm cho một xét nghiệm,
 * ~730 ms sau khi đã đổi cấu hình luật), trong khi điểm mới chỉ vào lô đang
 * vận hành hoặc lô song song — không bao giờ vào lô cũ.
 *
 * Nguyên tắc như `summary-cache.ts`: chỉ giữ khi chắc chắn thay đổi không
 * chạm tới lô cũ; chưa chắc thì bỏ. Riêng `qc_points` kèm `lots` (người ghi
 * biết đúng số lô vừa đổi) thì chỉ bỏ khi số lô đó là một lô cũ đang giữ.
 */

/** Bảng mà phần lô cũ KHÔNG đọc tới. Khác `SUMMARY_IGNORED_TABLES`: lô cũ
 * đọc `lot_transitions` để dựng chuỗi chuyển tiếp. */
export const PREVIOUS_LOT_IGNORED_TABLES: ReadonlySet<string> = new Set([
  'activity', 'users', 'lab', 'tea_refs', 'tea_ref_level_defaults', 'tea_ref_versions', 'qc_month_reviews', 'reagent_tests', 'report_templates',
  'period_locks', 'sigma_data', 'planned_targets',
  'nce_records', 'nce_runs', 'nce_actions', 'nce_decisions', 'nce_revisions',
  'eqa_programs', 'eqa_test_map', 'eqa_rounds', 'eqa_results', 'eqa_decisions', 'eqa_schedule', 'eqa_schedule_instruments',
]);

/** Bảng mà mỗi dòng thuộc đúng một xét nghiệm và mọi chỗ ghi đều báo kèm
 * `testIds` (cùng danh sách đã rà cho `SUMMARY_PER_TEST_TABLES`). */
export const PREVIOUS_LOT_PER_TEST_TABLES: ReadonlySet<string> = new Set(['qc_points', 'test_levels', 'tests', 'nce_cuts', 'rule_config_history']);

export interface PreviousLots {
  series: PreviousLotSeriesData[];
  blocks: ArchivedBlock[];
}

export class PreviousLotCache<T extends { series: { lot: string }[] }> {
  private readonly entries = new Map<string, T>();
  /** Vừa có thao tác ghi nhật ký mà chưa báo bảng nào đổi — bỏ hết ở lần đọc sau. */
  private unreportedWrite = false;

  onChanged(payload: MainChangedPayload): void {
    const tables = payload.tables;
    if (tables.length === 1 && tables[0] === 'activity') { this.unreportedWrite = true; return; }
    this.unreportedWrite = false;
    const relevant = tables.filter((table) => !PREVIOUS_LOT_IGNORED_TABLES.has(table));
    if (!relevant.length) return;
    if (!payload.testIds.length || !relevant.every((table) => PREVIOUS_LOT_PER_TEST_TABLES.has(table))) {
      this.entries.clear();
      return;
    }
    const onlyKnownLots = payload.lots?.length && relevant.every((table) => table === 'qc_points');
    for (const testId of payload.testIds) {
      const entry = this.entries.get(testId);
      if (!entry) continue;
      if (onlyKnownLots && !entry.series.some((series) => payload.lots!.includes(series.lot))) continue;
      this.entries.delete(testId);
    }
  }

  get(testId: string, compute: () => T): T {
    if (this.unreportedWrite) {
      this.entries.clear();
      this.unreportedWrite = false;
    }
    const cached = this.entries.get(testId);
    if (cached !== undefined) return cached;
    const value = compute();
    this.entries.set(testId, value);
    return value;
  }

  get size(): number { return this.entries.size; }
}

const cacheByDb = new WeakMap<Db, PreviousLotCache<PreviousLots>>();

/** Lô cũ của một xét nghiệm, dùng chung cho Nhập QC và Phân tích Westgard
 * (một bộ nhớ đệm cho mỗi CSDL). Kết quả trả về dùng chung giữa các lần gọi:
 * nơi gọi không được sửa tại chỗ. */
export function previousLotsOf(db: Db, testId: string): PreviousLots {
  let cache = cacheByDb.get(db);
  if (!cache) {
    const created = new PreviousLotCache<PreviousLots>();
    addChangeListener((payload) => created.onChanged(payload));
    cacheByDb.set(db, created);
    cache = created;
  }
  return cache.get(testId, () => {
    const series = listPreviousLotSeriesData(db, testId);
    return { series, blocks: createHistoricalWestgard(db).listPreviousLotBlocks(testId, series) };
  });
}
