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

  const ok = validateTest({ name: 'Ure', instrumentId: 'I1', decimalPlaces: 3.7, tea: -1 }, knownIds, ['Glucose']);
  assert.equal(ok.ok, true);
  assert.equal(ok.data.decimalPlaces, 4, 'decimalPlaces phải làm tròn và giới hạn [0,6]');
  assert.equal(ok.data.tea, 0, 'tea âm phải bị kẹp về 0');
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

  // saveTestLevel la UPSERT theo (testId, level) - luu lai DUNG mot muc da
  // ton tai (vi du Muc 1 tu tao luc them xet nghiem) khong con bi coi la loi.
  const resave = validateTestLevel({ level: 1, mean: 6, sd: 0.3 });
  assert.equal(resave.ok, true);

  const ok = validateTestLevel({ level: 1, mean: 5, sd: 0.2 });
  assert.equal(ok.ok, true);
}

console.log('app-v2 manage-validation tests passed');
