// Module này (manage-validation.ts) import chéo tới text-utils.ts trong CÙNG
// thư mục main/ — main process biên dịch sang CommonJS (extension-less
// import, đúng quy ước Node) nên KHÔNG thể import thẳng .ts qua ESM type-
// stripping của Node (cần đúng phần mở rộng .ts, xung đột với output
// CommonJS). Test các module có import chéo phải chạy qua bản ĐÃ BUILD
// (`npm run app-v2:build:main`), giống hệt quy ước `tsconfig.worker.json`
// của repo gốc (biên dịch trước, test bản build) — chỉ module KHÔNG import
// chéo (westgard-rules.ts, audit-chain.ts) mới test trực tiếp trên .ts được.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  prepareInstrument, validateInstrument, prepareTest, validateTest, prepareTestLevel, validateTestLevel,
  appendMeanSdHistory, validateLot, validateLotGroup, validatePanel, validateLotTransition,
} = require('../../app-v2-dist/main/domain/manage-validation.js');

// prepareInstrument
{
  const p = prepareInstrument({ name: '  Máy A  ', active: undefined });
  assert.equal(p.name, 'Máy A');
  assert.equal(p.active, true);
  assert.equal(prepareInstrument({ active: false }).active, false);
}

// validateInstrument
{
  const missing = validateInstrument({ name: '' }, []);
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'missing-name');

  const dup = validateInstrument({ name: 'máy a' }, ['Máy A']);
  assert.equal(dup.ok, false, 'trùng tên không phân biệt dấu/hoa-thường phải bị chặn');
  assert.equal(dup.code, 'duplicate-name');

  const ok = validateInstrument({ name: 'Máy B' }, ['Máy A']);
  assert.equal(ok.ok, true);
  assert.equal(ok.data.name, 'Máy B');
}

// validateTest
{
  const knownIds = new Set(['I1']);
  const noInstrument = validateTest({ name: 'Glucose', instrumentId: 'I2' }, knownIds, []);
  assert.equal(noInstrument.ok, false);
  assert.equal(noInstrument.code, 'missing-instrument');

  const dup = validateTest({ name: 'glucose', instrumentId: 'I1' }, knownIds, ['Glucose']);
  assert.equal(dup.ok, false);
  assert.equal(dup.code, 'duplicate-name');

  // TEa âm phải BỊ CHẶN rõ ràng ('invalid-tea'), không âm thầm kẹp về 0 —
  // port đúng `validateAssay()` app cũ ("TEa không được âm."). Trước đây
  // app-v2 kẹp về 0 và vẫn cho lưu, một bug thật tìm được khi audit.
  const negativeTea = validateTest({ name: 'Ure', instrumentId: 'I1', tea: -1 }, knownIds, ['Glucose']);
  assert.equal(negativeTea.ok, false);
  assert.equal(negativeTea.code, 'invalid-tea');

  const ok = validateTest({ name: 'Ure', instrumentId: 'I1', decimalPlaces: 3.7, tea: 5 }, knownIds, ['Glucose']);
  assert.equal(ok.ok, true);
  assert.equal(ok.data.decimalPlaces, 4, 'decimalPlaces phải làm tròn và giới hạn [0,6]');
  assert.equal(ok.data.tea, 5);

  const sameAnalyte = validateTest(
    { name: 'GLU', instrumentId: 'I1', teaRefKey: 'qclab-glucose' },
    knownIds,
    ['Tên hoàn toàn khác'],
    ['qclab-glucose'],
  );
  assert.equal(sameAnalyte.ok, false, 'cùng analyte trên cùng máy phải bị chặn dù tên khác');
  assert.equal(sameAnalyte.code, 'duplicate-name');

  // CUSUM k/h ≤0 hoặc không hợp lệ phải rơi về ĐÚNG mặc định (0.5/4), không
  // phải clamp về 0 — clamp về 0 làm CUSUM vô nghĩa mà không báo gì.
  const cusumInvalid = prepareTest({ name: 'Ure', instrumentId: 'I1', cusumK: -2, cusumH: 0 });
  assert.equal(cusumInvalid.cusumK, 0.5, 'k <=0 phai roi ve mac dinh 0.5');
  assert.equal(cusumInvalid.cusumH, 4, 'h <=0 phai roi ve mac dinh 4');
  const cusumValid = prepareTest({ name: 'Ure', instrumentId: 'I1', cusumK: 1.5, cusumH: 6 });
  assert.equal(cusumValid.cusumK, 1.5);
  assert.equal(cusumValid.cusumH, 6);
}

// prepareTestLevel / validateTestLevel
{
  const p = prepareTestLevel({ level: 9, mean: '5.5', sd: '0.1' });
  assert.equal(p.level, 6, 'level phải bị kẹp về tối đa 6');
  assert.equal(p.mean, 5.5);
  assert.equal(p.sd, 0.1);

  const missingSd = validateTestLevel({ level: 1, mean: 5 });
  assert.equal(missingSd.ok, false);
  assert.equal(missingSd.code, 'missing-sd');

  assert.equal(validateTestLevel({ level: 1, sd: 0.2 }).code, 'missing-mean');
  assert.equal(validateTestLevel({ level: 1, mean: 'abc', sd: 0.2 }).code, 'invalid-mean');
  assert.equal(validateTestLevel({ level: 1, mean: 5, sd: -1 }).code, 'invalid-sd');
  assert.equal(validateTestLevel({ level: 1, mean: 5, sd: 0.2, low: 4 }).code, 'invalid-range');
  assert.equal(validateTestLevel({ level: 1, mean: 5, sd: 0.2, low: 6, high: 4 }).code, 'invalid-range');
  assert.equal(validateTestLevel({ level: 1, qcLotId: 'L1' }).code, 'missing-target');

  // saveTestLevel la UPSERT theo (testId, level) - luu lai DUNG mot muc da
  // ton tai (vi du Muc 1 tu tao luc them xet nghiem) khong con bi coi la loi.
  const resave = validateTestLevel({ level: 1, mean: 6, sd: 0.3 });
  assert.equal(resave.ok, true);

  const ok = validateTestLevel({ level: 1, mean: 5, sd: 0.2 });
  assert.equal(ok.ok, true);
}

// appendMeanSdHistory — chỉ ghi lịch sử khi giá trị TRƯỚC ĐÓ thật sự có
// Mean/SD (không ghi lần đầu tạo, khi previous rỗng).
{
  const first = appendMeanSdHistory('[]', null, '2026-01-01');
  assert.deepEqual(JSON.parse(first), [], 'chưa có giá trị cũ thì chưa có gì để ghi lịch sử');

  const second = appendMeanSdHistory(first, { mean: 5, sd: 0.2, qcLotId: 'L1' }, '2026-02-01');
  const parsed = JSON.parse(second);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], { at: '2026-02-01', mean: 5, sd: 0.2, qcLotId: 'L1' });

  const third = appendMeanSdHistory(second, { mean: 6, sd: 0.3, qcLotId: 'L1' }, '2026-03-01');
  assert.equal(JSON.parse(third).length, 2, 'mỗi lần đổi thật sự phải cộng dồn, không ghi đè');
}

// validateLot
{
  const missing = validateLot({ lotNo: '' });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'missing-lot-no');

  const ok = validateLot({ lotNo: 'LOT-001', level: 9, exp: 'not-a-date' });
  assert.equal(ok.ok, true);
  assert.equal(ok.data.level, 6, 'level phải bị kẹp về tối đa 6');
  assert.equal(ok.data.exp, '', 'ngày sai định dạng phải bị bỏ qua, không lưu chuỗi rác');
}

// validateLotGroup — bắt buộc ít nhất 2 lô
{
  const oneLot = validateLotGroup({ name: 'Nhóm A', lotIds: ['L1'] });
  assert.equal(oneLot.ok, false);
  assert.equal(oneLot.code, 'not-enough-lots');

  const ok = validateLotGroup({ name: 'Nhóm A', lotIds: ['L1', 'L2', 'L1'] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data.lotIds, ['L1', 'L2'], 'phải loại trùng id');

  const automaticName = validateLotGroup({ lotIds: ['L1', 'L2'] }, '1101/1102');
  assert.equal(automaticName.ok, true);
  assert.equal(automaticName.data.name, '1101/1102', 'tên trống phải dùng tên tự sinh từ các số lô');
}

// validatePanel
{
  const knownIds = new Set(['I1']);
  const noInstrument = validatePanel({ name: 'Panel A' }, knownIds);
  assert.equal(noInstrument.ok, false);
  assert.equal(noInstrument.code, 'missing-instrument');

  const ok = validatePanel({ name: 'Panel A', instrumentId: 'I1', testIds: ['T1', 'T2'] }, knownIds);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data.testIds, ['T1', 'T2']);
}

// validateLotTransition
{
  const sameLot = validateLotTransition({ panelId: 'P1', fromLotId: 'L1', toLotId: 'L1' });
  assert.equal(sameLot.ok, false);
  assert.equal(sameLot.code, 'same-lot');

  const missing = validateLotTransition({ panelId: 'P1', fromLotId: 'L1', toLotId: '' });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'missing-lots');

  const ok = validateLotTransition({ panelId: 'P1', fromLotId: 'L1', toLotId: 'L2', startDate: '2026-01-01' });
  assert.equal(ok.ok, true);
}

console.log('app-v2 manage-validation tests passed');
