// Main KHÔNG được tin kết luận cohort IQC do renderer gửi lên.
//
// `cohortStatus` quyết định một mức có được dùng cho gợi ý thiết kế QC hay
// không (`SigmaPage.tsx` lọc `cohortStatus === 'eligible'`). Trước 2026-09-11
// `savePeriod()` chỉ `cleanText()` chuỗi đó rồi lưu, và chỉ kiểm `cohortN` là
// số nguyên không âm — nghĩa là một lời gọi
// `window.qcApi.saveSigmaPeriod({ ... cohortStatus: 'eligible', cohortN: 999 })`
// là qua được. App đóng gói Electron bật F12 (xem CLAUDE.md, `electron/` —
// "F12 toggles DevTools"), nên đây không phải giả thuyết API từ xa.
//
// Hợp đồng mới: người dùng CHỌN lô (`sourceLot`); mọi con số mô tả nhóm đó do
// main tự dựng lại từ `qc_points`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = require('../../app-v2-dist/main/ipc/sigma-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };
const PERIOD = '2026-08';

/** 1 xét nghiệm 1 mức, `n` điểm QC trong kỳ trên cùng một lô. */
function scenario(n, { lot = 'L1' } = {}) {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  for (let i = 0; i < n; i++) {
    const day = String((i % 28) + 1).padStart(2, '0');
    ins.run(`p${i}`, test.id, 1, `${PERIOD}-${day}`, `run${i}`, 100 + ((i % 5) - 2) * 0.4, lot, 100, 2);
  }
  return { db, test, sigma: createSigmaHandlers(db) };
}

const save = (sigma, test, level) => sigma.savePeriod({ testId: test.id, period: PERIOD, teaSource: 'clia', tea: 10, levels: [level] }, actor);
const savedLevel = (sigma, test) => sigma.listPeriods(test.id).find((p) => p.period === PERIOD).levels[0];

// 1) Mạo `cohortStatus`/`cohortN`: phải lưu số THẬT, không lưu số gửi lên.
{
  const { sigma, test } = scenario(3);
  const res = save(sigma, test, {
    level: 1, cv: 0.5, cvSource: 'iqc-cohort', sourceLot: 'L1',
    cohortN: 999, sourceStart: '1999-01-01', sourceEnd: '1999-12-31', cohortStatus: 'eligible',
  });
  assert.equal(res.ok, true, res.ok ? '' : res.error.message);
  const lv = savedLevel(sigma, test);
  assert.equal(lv.cohortStatus, 'insufficient', 'chỉ 3 điểm thì không thể là "eligible"');
  assert.equal(lv.cohortN, 3, 'số điểm phải lấy từ qc_points, không lấy từ payload');
  assert.equal(lv.sourceStart, `${PERIOD}-01`, 'khoảng ngày phải là của nhóm thật');
  assert.notEqual(lv.sourceEnd, '1999-12-31');
}

// 2) Đủ 30 điểm sạch thì "eligible" là kết luận của CHÍNH main, không phải
//    của client — đối chứng để mục 1 không phải "luôn trả insufficient".
{
  const { sigma, test } = scenario(30);
  const res = save(sigma, test, { level: 1, cv: 0.5, cvSource: 'iqc-cohort', sourceLot: 'L1', cohortStatus: 'unstable', cohortN: 1 });
  assert.equal(res.ok, true, res.ok ? '' : res.error.message);
  const lv = savedLevel(sigma, test);
  assert.equal(lv.cohortStatus, 'eligible');
  assert.equal(lv.cohortN, 30);
}

// 3) Khai lô KHÔNG tồn tại: từ chối hẳn, không lưu một nhóm ảo.
{
  const { sigma, test } = scenario(30);
  const res = save(sigma, test, { level: 1, cv: 0.5, cvSource: 'iqc-cohort', sourceLot: 'LO-KHONG-CO', cohortStatus: 'eligible' });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'cohort-not-found');
  assert.equal(sigma.listPeriods(test.id).length, 0, 'lần lưu bị từ chối không được để lại bản ghi');
}

// 4) CV nhập tay thì KHÔNG được mang theo mô tả nhóm IQC.
{
  const { sigma, test } = scenario(30);
  const res = save(sigma, test, {
    level: 1, cv: 1.23, cvSource: 'manual', sourceLot: 'L1', cohortN: 30,
    sourceStart: `${PERIOD}-01`, sourceEnd: `${PERIOD}-28`, cohortStatus: 'eligible',
  });
  assert.equal(res.ok, true, res.ok ? '' : res.error.message);
  const lv = savedLevel(sigma, test);
  assert.equal(lv.cvSource, 'manual');
  assert.equal(lv.cv, 1.23, 'CV nhập tay vẫn giữ nguyên');
  assert.equal(lv.cohortStatus, '', 'không được khoe trạng thái nhóm khi CV là nhập tay');
  assert.equal(lv.cohortN, null);
  assert.equal(lv.sourceLot, '');
}

// 5) Đường dùng THẬT không đổi giá trị: gửi đúng những gì `listCohorts()` trả
//    về (chính là những gì SigmaPage gán) thì lưu lại y nguyên.
{
  const { sigma, test } = scenario(30);
  const cohort = sigma.listCohorts(test.id, PERIOD, [1]).find((c) => c.lot === 'L1');
  assert.ok(cohort, 'phải có nhóm để đối chứng');
  const res = save(sigma, test, {
    level: 1, cv: cohort.cv, cvSource: 'iqc-cohort', sourceLot: cohort.lot,
    cohortN: cohort.n, sourceStart: cohort.start, sourceEnd: cohort.end, cohortStatus: cohort.status,
  });
  assert.equal(res.ok, true, res.ok ? '' : res.error.message);
  const lv = savedLevel(sigma, test);
  assert.equal(lv.cv, cohort.cv);
  assert.equal(lv.cohortN, cohort.n);
  assert.equal(lv.sourceStart, cohort.start);
  assert.equal(lv.sourceEnd, cohort.end);
  assert.equal(lv.cohortStatus, cohort.status);
}

// 6) CV cũng phải là CV của nhóm thật, không phải số gửi lên — nếu không,
//    Sigma tính từ một CV bịa mà vẫn mang nhãn "lấy từ lô IQC".
{
  const { sigma, test } = scenario(30);
  const cohort = sigma.listCohorts(test.id, PERIOD, [1]).find((c) => c.lot === 'L1');
  const res = save(sigma, test, { level: 1, cv: 0.01, cvSource: 'iqc-cohort', sourceLot: 'L1', cohortStatus: 'eligible' });
  assert.equal(res.ok, true, res.ok ? '' : res.error.message);
  assert.equal(savedLevel(sigma, test).cv, cohort.cv, 'CV phải tính lại từ nhóm thật');
}

console.log('app-v2: main tự dựng lại cohort IQC, không tin payload — tests passed');
