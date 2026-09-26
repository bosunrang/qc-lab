// Bài đo sát thực tế (kế hoạch kiến trúc, mục E.4). Bài đo 500.000 điểm cũ
// dồn mọi điểm vào một xét nghiệm, một lô; ở đây dữ liệu trải như một phòng
// xét nghiệm dùng app 5 năm: 60 xét nghiệm trên 3 máy, 2–3 mức, 2 lần chạy mỗi
// ngày, lô QC đổi mỗi 6 tháng qua chuyển tiếp lô đã chấp nhận. CSDL là tệp
// thật ở chế độ WAL như bản Electron, không phải CSDL trong bộ nhớ.
//
// Kết quả dùng để quyết định có cần tối ưu các màn tổng hợp và có cần đưa
// phép tính ra khỏi luồng chính (E.5) hay không. Ngưỡng mặc định rộng để bài
// đo chỉ chặn hồi quy lớn; con số cần đọc là dòng `PERF-REAL` in ra cuối.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { levelsOf, seedRealisticDataset } from './helpers/realistic-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');

const TESTS = Number(process.env.QC_PERF_TESTS || 60);
const DAYS = Number(process.env.QC_PERF_DAYS || 5 * 365);
const MAX_SCREEN_MS = Number(process.env.QC_PERF_MAX_SCREEN_MS || 30_000);

function elapsed(work) {
  const started = performance.now();
  const value = work();
  return { value, ms: performance.now() - started };
}

test('hiệu năng với dữ liệu 60 xét nghiệm × 5 năm', { timeout: 600_000 }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-perf-real-'));
  const dbPath = path.join(dir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  try {
    const seed = elapsed(() => seedRealisticDataset(db, { tests: TESTS, days: DAYS }));
    const { RUNS_PER_DAY, LOT_PERIODS } = seed.value;
    const totalPoints = db.prepare('SELECT COUNT(*) AS n FROM qc_points').get().n;
    const expected = Array.from({ length: TESTS }, (_, t) => levelsOf(t)).reduce((a, b) => a + b, 0) * DAYS * RUNS_PER_DAY;
    assert.equal(totalPoints, expected);
    // Gộp -wal như khi app chạy lâu (tự động theo ngưỡng trang) để phép đo
    // đọc từ tệp chính.
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

    const entry = createEntryHandlers(db);
    const westgard = createWestgardHandlers(db);
    const sigma = createSigmaHandlers(db);
    // Xét nghiệm 3 mức, bật CUSUM: trường hợp nặng nhất khi mở một xét nghiệm.
    const heavy = 'test-0';

    const results = {};
    const measure = (label, work) => {
      const run = elapsed(work);
      results[label] = run.ms;
      assert.ok(run.ms <= MAX_SCREEN_MS, `${label} mất ${run.ms.toFixed(0)} ms, vượt ngưỡng ${MAX_SCREEN_MS} ms.`);
      return run.value;
    };

    // Tổng quan, cây Nhập QC và trang Westgard đều mở bằng lệnh này.
    const summaries = measure('tongQuan', () => westgard.listTestSummaries());
    assert.equal(summaries.length, TESTS);
    const perLevel = summaries[1].levels[0].pointCount;
    assert.ok(perLevel > 0 && perLevel <= (DAYS / LOT_PERIODS + 1) * RUNS_PER_DAY, 'chỉ đếm điểm của lô đang vận hành');
    measure('tongQuanLan2', () => westgard.listTestSummaries());
    // Nhập một điểm rồi mở lại Tổng quan: chỉ xét nghiệm vừa nhập được tính
    // lại (E.6 bước 3); các xét nghiệm khác lấy kết quả đã giữ.
    const today = db.prepare("SELECT date('now','localtime') AS d").get().d;
    const added = entry.addPoint({ data: { testId: heavy, level: 1, date: today, runId: `${today}-9`, val: summaries[0].levels[0].mean } }, { userId: 'perf', username: 'perf', name: 'Perf', role: 'admin', clientId: 'perf' });
    assert.equal(added.ok, true, JSON.stringify(added.error));
    const afterEntry = measure('tongQuanSauNhap', () => westgard.listTestSummaries());
    assert.deepEqual(afterEntry, createWestgardHandlers(db).listTestSummaries(), 'kết quả giữ lại trùng lượt tính mới');

    const analysis = measure('westgardMuc', () => westgard.analyzeLevel(heavy, 1));
    assert.equal(analysis.points.length, afterEntry[0].levels[0].pointCount);
    const lotBlocks = measure('westgardLoCu', () => westgard.listPreviousLotBlocks(heavy));
    assert.equal(new Set(lotBlocks.map((b) => b.lotId)).size, (LOT_PERIODS - 1) * 3, 'đủ mọi lô cũ của 3 mức');

    const points = measure('nhapQcMuc', () => entry.queryPoints(heavy, 1));
    assert.equal(points.length, afterEntry[0].levels[0].pointCount);
    measure('nhapQcLoCu', () => entry.listPreviousLotSeries(heavy));

    const period = db.prepare("SELECT strftime('%Y-%m', date('now','localtime','start of month','-1 month')) AS p").get().p;
    measure('sigmaThang', () => sigma.listCohorts(heavy, period, [1, 2, 3]));

    const bytes = statSync(dbPath).size;
    const heapMb = process.memoryUsage().heapUsed / 1024 / 1024;
    const fmt = (ms) => `${ms.toFixed(0)} ms`;
    console.log([
      `PERF-REAL | ${TESTS} XN × ${DAYS} ngày × ${RUNS_PER_DAY} lần/ngày, ${LOT_PERIODS} kỳ lô | ${totalPoints} điểm | tệp ${(bytes / 1024 / 1024).toFixed(0)} MB | tạo dữ liệu ${fmt(seed.ms)}`,
      `  Tổng quan/Westgard (listTestSummaries): ${fmt(results.tongQuan)} (lần 2: ${fmt(results.tongQuanLan2)}; sau khi nhập 1 điểm: ${fmt(results.tongQuanSauNhap)})`,
      `  Westgard một mức (analyzeLevel): ${fmt(results.westgardMuc)} | lô cũ: ${fmt(results.westgardLoCu)}`,
      `  Nhập QC một mức (queryPoints): ${fmt(results.nhapQcMuc)} | lô cũ: ${fmt(results.nhapQcLoCu)}`,
      `  Sigma một tháng (listCohorts): ${fmt(results.sigmaThang)}`,
      `  heap: ${heapMb.toFixed(0)} MB`,
    ].join('\n'));
  } finally {
    db.close();
  }
});
