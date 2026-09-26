// Dữ liệu giống một phòng xét nghiệm dùng app nhiều năm: nhiều xét nghiệm
// trên 3 máy, 2–3 mức, lô QC đổi theo kỳ qua chuyển tiếp lô đã chấp nhận.
// Dùng cho bài đo `realistic-dataset-performance.perf.mjs` (cỡ đầy đủ) và
// test kế hoạch truy vấn `qc-points-index.test.mjs` (cỡ nhỏ).

const INSTRUMENTS = 3;

/** Số mức của xét nghiệm thứ `t`: cứ 4 xét nghiệm có 1 xét nghiệm 3 mức. */
export const levelsOf = (t) => (t % 4 === 0 ? 3 : 2);
const baseMean = (t, level) => 50 + t * 3 + level * 40;
/** Mỗi lô có Mean lệch nhẹ so với lô trước, như lô vật liệu QC thật. */
const lotMean = (t, level, k) => Number((baseMean(t, level) * (1 + 0.004 * ((k % 3) - 1))).toFixed(2));
const lotSd = (t, level) => Number((baseMean(t, level) * 0.025).toFixed(3));

/** Dựng cấu hình bằng SQL trực tiếp: danh mục, lô, chuyển tiếp và lịch sử
 * Mean/SD đúng hình dạng mà luồng chuyển tiếp lô của `config-handlers.ts` để
 * lại, nhưng không ghi hàng nghìn dòng nhật ký không liên quan tới phép đo. */
export function seedCatalog(db, { TESTS, DAYS, LOT_PERIODS }) {
  const insert = (sql) => db.prepare(sql);
  const instrument = insert('INSERT INTO instruments(id,name) VALUES (?,?)');
  const panel = insert('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)');
  const group = insert("INSERT INTO lot_groups(id,name,active,status,stopped_at,archived_lot_ids_json) VALUES (?,?,?,?,?,?)");
  const lot = insert('INSERT INTO qc_lots(id,group_id,lot_no,level,opened,depleted) VALUES (?,?,?,?,?,?)');
  const transition = insert("INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,start_date,status,approved_at,approved_by) VALUES (?,?,?,?,?,'accepted',?,'perf')");
  const testRow = insert('INSERT INTO tests(id,name,unit,decimal_places,instrument_id,cusum_on) VALUES (?,?,?,2,?,?)');
  const panelTest = insert('INSERT INTO qc_panel_tests(panel_id,test_id,position) VALUES (?,?,?)');
  const level = insert("INSERT INTO test_levels(id,test_id,level,qc_lot_id,mean,sd,applied,mean_sd_history_json,mean_sd_effective_from) VALUES (?,?,?,?,?,?,'mfg',?,?)");

  const periodStart = (k) => db.prepare("SELECT date('now','localtime',?) AS d").get(`-${DAYS - 1 - Math.floor((k * DAYS) / LOT_PERIODS)} days`).d;
  const lotId = (i, lv, k) => `lot-${i}-${lv}-${k}`;
  const lotNo = (i, lv, k) => `L${i}${lv}-${String(k).padStart(2, '0')}`;

  db.exec('BEGIN');
  for (let i = 0; i < INSTRUMENTS; i++) {
    instrument.run(`inst-${i}`, `Máy ${i + 1}`);
    panel.run(`panel-${i}`, `Panel máy ${i + 1}`, `inst-${i}`);
    for (let k = 0; k < LOT_PERIODS; k++) {
      const current = k === LOT_PERIODS - 1;
      const groupId = current ? `grp-${i}` : `grp-${i}-${k}`;
      const members = [1, 2, 3].map((lv) => lotId(i, lv, k));
      group.run(groupId, `Nhóm máy ${i + 1} kỳ ${k + 1}`, current ? 1 : 0, current ? '' : 'stopped', current ? '' : periodStart(k + 1), current ? '' : JSON.stringify(members));
      for (const lv of [1, 2, 3]) {
        lot.run(lotId(i, lv, k), groupId, lotNo(i, lv, k), lv, periodStart(k), current ? 0 : 1);
        if (k > 0) transition.run(`tr-${i}-${lv}-${k}`, `panel-${i}`, lotId(i, lv, k - 1), lotId(i, lv, k), periodStart(k), `${periodStart(k)}T08:00:00.000Z`);
      }
    }
  }
  for (let t = 0; t < TESTS; t++) {
    const i = t % INSTRUMENTS;
    testRow.run(`test-${t}`, `Xét nghiệm ${String(t + 1).padStart(2, '0')}`, 'mmol/L', `inst-${i}`, t % 3 === 0 ? 1 : 0);
    panelTest.run(`panel-${i}`, `test-${t}`, t);
    for (let lv = 1; lv <= levelsOf(t); lv++) {
      const history = [];
      for (let k = 0; k < LOT_PERIODS - 1; k++) {
        history.push({ mean: lotMean(t, lv, k), sd: lotSd(t, lv), low: null, high: null, qcLotId: lotId(i, lv, k), lot: lotNo(i, lv, k), effectiveFrom: periodStart(k), effectiveTo: periodStart(k + 1), source: 'mfg', savedAt: `${periodStart(k + 1)}T08:00:00.000Z` });
      }
      const k = LOT_PERIODS - 1;
      level.run(`test-${t}:${lv}`, `test-${t}`, lv, lotId(i, lv, k), lotMean(t, lv, k), lotSd(t, lv), JSON.stringify(history), periodStart(k));
    }
  }
  db.exec('COMMIT');

  // Bảng phụ cho câu sinh điểm: mỗi dòng là một (xét nghiệm, mức, kỳ lô).
  db.exec('CREATE TEMP TABLE perf_lot_period(test_id TEXT, level INTEGER, k INTEGER, lot TEXT, mean REAL, sd REAL, t INTEGER)');
  const period = db.prepare('INSERT INTO perf_lot_period VALUES (?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  for (let t = 0; t < TESTS; t++) {
    for (let lv = 1; lv <= levelsOf(t); lv++) {
      for (let k = 0; k < LOT_PERIODS; k++) period.run(`test-${t}`, lv, k, lotNo(t % INSTRUMENTS, lv, k), lotMean(t, lv, k), lotSd(t, lv), t);
    }
  }
  db.exec('COMMIT');
}

/** Sinh điểm bằng một câu SQL. Giá trị gần phân phối chuẩn (tổng 3 số giả
 * ngẫu nhiên đều, xác định theo chỉ số) nên có cảnh báo 1-2s và thỉnh thoảng
 * vi phạm như dữ liệu thật; khoảng 0,5% điểm đã huỷ. */
export function seedPoints(db, { DAYS, RUNS_PER_DAY, LOT_PERIODS }) {
  db.exec(`
    BEGIN;
    WITH RECURSIVE day(d) AS (VALUES(0) UNION ALL SELECT d + 1 FROM day WHERE d < ${DAYS - 1}),
    run(r) AS (VALUES(1) UNION ALL SELECT r + 1 FROM run WHERE r < ${RUNS_PER_DAY}),
    slot AS (
      SELECT p.test_id, p.level, p.lot, p.mean, p.sd, p.t, day.d, run.r,
        ((p.t * 7919 + p.level * 104729 + day.d * 131 + run.r * 17) % 1000003) AS h
      FROM perf_lot_period p JOIN day JOIN run
      WHERE p.k = (day.d * ${LOT_PERIODS}) / ${DAYS}
    )
    INSERT INTO qc_points(id,test_id,level,date,run_id,lot,val,value_decimals,qc_mean,qc_sd,voided,void_reason)
    SELECT
      'p-' || test_id || '-' || level || '-' || d || '-' || r,
      test_id, level,
      date('now','localtime','-' || (${DAYS - 1} - d) || ' days'),
      printf('R%05d-%d', d, r),
      lot,
      round(mean + sd * 2 * (((h * 48271) % 1000003) / 1000003.0 + ((h * 69621) % 1000003) / 1000003.0 + ((h * 16807) % 1000003) / 1000003.0 - 1.5), 2),
      2, mean, sd,
      CASE WHEN h % 200 = 0 THEN 1 ELSE 0 END,
      CASE WHEN h % 200 = 0 THEN 'Đo lại do lỗi mẫu' ELSE '' END
    FROM slot;
    COMMIT;
  `);
}

/** Dựng toàn bộ dữ liệu; trả số điểm đã tạo. */
export function seedRealisticDataset(db, { tests, days, runsPerDay = 2 }) {
  const size = { TESTS: tests, DAYS: days, RUNS_PER_DAY: runsPerDay, LOT_PERIODS: Math.max(1, Math.round(days / 182.5)) };
  seedCatalog(db, size);
  seedPoints(db, size);
  return size;
}
