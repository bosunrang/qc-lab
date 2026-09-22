// Kiểm chứng end-to-end THỨ TỰ LẤY TEa của từng mức QC trong kỳ Six Sigma.
//
// Vì sao cần test riêng: Sigma = (TEa − |Bias|) / CV, và với tiêu chí CLIA
// dạng TUYỆT ĐỐI (Sodium ±4,0000 mmol/L) thì TEa% = |giới hạn / Mean| × 100 —
// tức MỖI MỨC phải ra một TEa khác nhau. Trước 2026-09-10, khi kỳ không có
// snapshot TEa theo mức, `computeLevel()` rơi thẳng về `sigma_data.tea` (một
// con số dùng chung cho cả kỳ) nên hai mức nhận cùng một TEa — chỉ có thể
// đúng tại đúng một Mean.
//
// Các con số kỳ vọng dưới đây được ĐO TỪ APP CŨ trên cùng bộ dữ liệu (bộ seed
// của gate `app:ui-parity`): app cũ `sgReconcileAllTeaSnapshots()` ĐIỀN
// snapshot còn thiếu từ nguồn đang khai tại Mean của từng mức
// (`sgSetLevelTeaSnapshot(..., force = false)` — có rồi thì không ghi đè), cho
// TEa 2,857%/4,000% và Sigma 0,29/0,56.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };
const round = (value, digits = 4) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits);

/** Sodium (Na), mmol/L: danh mục CLIA CHỈ có giới hạn tuyệt đối ±4 mmol/L
 * (không có giới hạn %), Ricos 0,73%. Hai mức Mean 140 và 100 như bộ seed của
 * gate parity. Kỳ được ghi KHÔNG kèm TEa theo mức — đúng hình dạng bản ghi cũ
 * (v1) hoặc bản ghi do một caller IPC không truyền `levels[].tea`. */
function scenario({ source = 'clia', periodTea = 10, levelTea } = {}) {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const sigma = createSigmaHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: inst.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 140, sd: 2.5 } }, actor);
  config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 100, sd: 2.2 } }, actor);
  sigma.saveTeaConfig({ testId: test.id, source, tea: periodTea }, actor);
  const saved = sigma.savePeriod({
    testId: test.id, period: '2026-09', tea: periodTea, teaSource: source,
    levels: [
      { level: 1, cv: 3, biasEqa: 2, ...(levelTea == null ? {} : { tea: levelTea }) },
      { level: 2, cv: 4.5, biasEqa: -1.5, ...(levelTea == null ? {} : { tea: levelTea }) },
    ],
  }, actor);
  assert.equal(saved.ok, true, 'luu ky Sigma phai thanh cong');
  // New writes now persist resolved per-level snapshots. Explicitly model
  // the legacy rows under review here instead of relying on the old writer.
  if (levelTea == null) {
    const row = db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(saved.data.id);
    const legacy = JSON.parse(row.lv_json).map(({ tea, teaBasis, ...level }) => level);
    db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(legacy), saved.data.id);
  }
  return { db, sigma, test, saved };
}

// 1) Thiếu snapshot theo mức + nguồn CLIA tuyệt đối → GIẢI theo Mean từng mức.
{
  const { sigma, test, saved } = scenario();
  for (const levels of [saved.data.levels, sigma.listPeriods(test.id)[0].levels]) {
    const [m1, m2] = levels;
    assert.equal(round(m1.tea), round(4 / 140 * 100), 'muc 1 (Mean 140) phai ra TEa 2.857%');
    assert.equal(round(m2.tea), round(4 / 100 * 100), 'muc 2 (Mean 100) phai ra TEa 4.000%');
    assert.equal(round(m1.sigma.sigma, 2), 0.29, 'Sigma muc 1 phai khop app cu');
    assert.equal(round(m2.sigma.sigma, 2), 0.56, 'Sigma muc 2 phai khop app cu');
  }
}

// 2) CÓ snapshot theo mức → KHÔNG được giải lại. Đây là nửa còn lại của hợp
//    đồng: kỳ đã chốt không bị kéo theo Bảng TEa tham chiếu/Mean hôm nay
//    (cùng nguyên tắc `force = false` của app cũ). Thiếu nhánh này thì một
//    hàm "luôn giải lại" cũng qua được mục 1.
{
  const { sigma, test } = scenario({ levelTea: 6 });
  const [m1, m2] = sigma.listPeriods(test.id)[0].levels;
  assert.equal(m1.tea, 6, 'snapshot cua muc phai thang moi thu');
  assert.equal(m2.tea, 6);
  assert.equal(round(m1.sigma.sigma, 4), round((6 - 2) / 3, 4));
}

// 3) Đổi Mean SAU KHI kỳ đã có snapshot → kỳ cũ giữ nguyên số đã ghi.
{
  const { db, sigma, test } = scenario({ levelTea: 6 });
  db.prepare('UPDATE test_levels SET mean=? WHERE test_id=? AND level=1').run(200, test.id);
  assert.equal(sigma.listPeriods(test.id)[0].levels[0].tea, 6, 'sua Mean hom nay khong duoc viet lai ky da chot');
}

// 4) Nguồn dạng PHẦN TRĂM (Ricos) không phụ thuộc mức → hai mức cùng một số,
//    và đó là giá trị của danh mục (0,73%) chứ không phải `periodTea`.
{
  const { sigma, test } = scenario({ source: 'ricos' });
  const [m1, m2] = sigma.listPeriods(test.id)[0].levels;
  assert.equal(m1.tea, 0.73);
  assert.equal(m2.tea, 0.73);
}

// 5) Không giải được (đơn vị lệch nên giới hạn tuyệt đối không áp dụng được,
//    mà Sodium không có giới hạn CLIA dạng %) → mới rơi về `periodTea`.
{
  const { db, sigma, test } = scenario();
  db.prepare('UPDATE tests SET unit=? WHERE id=?').run('mg/dL', test.id);
  const [m1, m2] = sigma.listPeriods(test.id)[0].levels;
  assert.equal(m1.tea, 10, 'khong giai duoc thi moi dung TEa cap ky');
  assert.equal(m2.tea, 10);
}

// 6) Mức chưa có Mean → không được "đoán" TEa từ giới hạn tuyệt đối; rơi về
//    `periodTea` chứ không phải bịa một con số theo Mean của mức khác.
{
  const { db, sigma, test } = scenario();
  db.prepare('UPDATE test_levels SET mean=NULL, sd=NULL WHERE test_id=? AND level=2').run(test.id);
  const [m1, m2] = sigma.listPeriods(test.id)[0].levels;
  assert.equal(round(m1.tea), round(4 / 140 * 100), 'muc con Mean van giai duoc');
  assert.equal(m2.tea, 10, 'muc thieu Mean roi ve TEa cap ky');
}

// Kỳ được tạo lúc nguồn TEa CHƯA giải được (chọn "TEa chuẩn hóa của PXN" mà
// chưa có hồ sơ) chốt `tea = null`. Một snapshot NULL không phải lịch sử cần
// bảo vệ — nó có nghĩa "chưa bao giờ giải được". Trước 2026-09-11 kỳ đó ghim
// vĩnh viễn vào nguồn đã chốt, nên sau khi phòng xét nghiệm đổi nguồn sang
// Ricos thì panel "Thiết lập phân tích" hiện đúng 0,73% mà bảng kỳ vẫn báo
// "Thiếu TEa" — đúng lỗi người dùng báo.
{
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const sigma = createSigmaHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 140, sd: 2.5 } }, actor);

  // Nguồn "lab" nhưng KHÔNG có hồ sơ TEa PXN nào → không giải được.
  sigma.saveTeaConfig({ testId: test.id, source: 'lab' }, actor);
  const saved = sigma.savePeriod({
    testId: test.id, period: '2026-09', teaSource: 'lab',
    levels: [{ level: 1, cv: 0.21388015, biasEqa: 1.5 }],
  }, actor);
  assert.equal(saved.ok, true);
  assert.equal(saved.data.levels[0].tea, null, 'chua khai nguon thi TEa phai la null');
  assert.equal(saved.data.levels[0].sigma, null, 'thieu TEa thi khong co Sigma');

  // Phòng xét nghiệm đổi nguồn sang Ricos (Sodium: 0,73%).
  sigma.saveTeaConfig({ testId: test.id, source: 'ricos' }, actor);
  const after = sigma.listPeriods(test.id)[0].levels[0];
  assert.equal(after.tea, 0.73, 'ky khong co snapshot phai giai lai theo nguon DANG KHAI');
  assert.ok(after.sigma, 'Sigma phai tinh duoc sau khi da co TEa');
  assert.equal(round(after.sigma.sigma, 2), round((0.73 - 1.5) / 0.21388015, 2), 'Sigma dung cong thuc (TEa - |Bias|)/CV');
}

// Bậc fallback KHÔNG được kéo lại kỳ đã có snapshot thật — đó mới là lịch sử.
{
  const { sigma, test, db } = scenario({ source: 'clia', periodTea: 10, levelTea: 9 });
  sigma.saveTeaConfig({ testId: test.id, source: 'ricos' }, actor);
  assert.equal(sigma.listPeriods(test.id)[0].levels[0].tea, 9, 'snapshot theo muc phai thang moi bac khac');

  // Không có snapshot theo mức nhưng CÓ snapshot cấp kỳ: kỳ giữ con số đó,
  // không rơi xuống bậc fallback.
  db.prepare("UPDATE sigma_data SET tea_source=? WHERE test_id=?").run('lab', test.id);
  const rows = sigma.listPeriods(test.id)[0].levels;
  assert.equal(rows[0].tea, 9, 'van la snapshot theo muc');
  db.prepare("UPDATE sigma_data SET lv_json=? WHERE test_id=?")
    .run(JSON.stringify([{ level: 1, cv: 3, biasEqa: 2 }, { level: 2, cv: 4.5, biasEqa: -1.5 }]), test.id);
  assert.equal(sigma.listPeriods(test.id)[0].levels[0].tea, 10, 'snapshot cap ky phai thang bac fallback');
}
console.log('app sigma level-TEa end-to-end tests passed');
