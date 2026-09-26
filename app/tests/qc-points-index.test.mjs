// Mọi câu đọc điểm QC theo LÔ phải dùng chỉ mục (test_id, level, lot, date).
// Bài đo 60 xét nghiệm × 5 năm (E.4, 2026-09-26): khi SQLite chọn chỉ mục
// theo ngày, mỗi mức phải đọc mọi điểm nhiều năm rồi mới lọc lô — Tổng quan
// 3,8 s, xem lô cũ 1,4–2,0 s; dùng đúng chỉ mục còn 0,6 s và 0,3–0,45 s.
//
// Test không chép lại câu SQL của handler: nó ghi lại MỌI câu `prepare()` mà
// các màn đọc thật phát ra, rồi hỏi SQLite kế hoạch của từng câu có lọc
// `lot`. Sửa câu truy vấn theo cách làm SQLite bỏ chỉ mục thì test này đỏ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { seedRealisticDataset } from './helpers/realistic-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

/** Bọc `prepare()` để ghi lại câu SQL, không đổi hành vi. */
function recordingDb(db) {
  const seen = new Set();
  const proxy = {
    prepare(sql) { seen.add(sql); return db.prepare(sql); },
    exec(sql) { return db.exec(sql); },
  };
  return { proxy, seen };
}

test('câu đọc điểm theo lô dùng chỉ mục có cột lot', () => {
  const db = openDatabase(':memory:');
  seedRealisticDataset(db, { tests: 4, days: 400 });
  const { proxy, seen } = recordingDb(db);
  const westgard = createWestgardHandlers(proxy);
  const entry = createEntryHandlers(proxy);

  assert.equal(westgard.listTestSummaries().length, 4);
  assert.ok(westgard.analyzeLevel('test-0', 1).points.length > 0);
  assert.ok(westgard.listPreviousLotBlocks('test-0').length > 0, 'bộ dữ liệu có lô cũ');
  assert.ok(entry.queryPoints('test-0', 1).length > 0);
  assert.ok(entry.listPreviousLotSeries('test-0').length > 0);

  // Câu đọc chuỗi điểm của một lô: FROM qc_points, có `lot=?`, lọc điểm chưa
  // huỷ. Câu fallback lấy Mean/SD chụp trên điểm (`lotMeanSd`, không lọc
  // `voided`) chỉ chạy khi thiếu lịch sử cấu hình, không thuộc đường nóng.
  const lotQueries = [...seen].filter((sql) => /FROM qc_points\b/.test(sql) && /\blot=\?/.test(sql) && /voided=0/.test(sql));
  assert.ok(lotQueries.length >= 3, `bắt được các câu đọc theo lô: ${lotQueries.length}`);
  for (const sql of lotQueries) {
    const params = (sql.match(/\?/g) || []).map(() => 'x');
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params).map((row) => row.detail).join(' | ');
    assert.match(plan, /idx_qc_points_lot_active/, `câu không dùng chỉ mục theo lô:\n${sql}\n→ ${plan}`);
  }
});
