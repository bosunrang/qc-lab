'use strict';
/**
 * Tests for scripts/lis-config.js.
 *
 * Mapping cua LIS Gateway noi `qclabTestId` — ID NOI BO do app sinh (uid()), khong hien o
 * bat ky man hinh nao. Chep sai mot ky tu thi gateway VAN khoi dong binh thuong, chi co
 * moi ket qua cua xet nghiem do lang le roi vao `held / UNMAPPED_TEST`. An toan, nhung
 * khong ai biet vi sao. Ca script nay ton tai de bien loai loi im lang do thanh loi on ao,
 * nen phan --check moi la thu dang chot, khong phai phan sinh khung.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState, testRows, buildSkeleton, checkConfig, PLACEHOLDER_ANALYZER, PLACEHOLDER_CODE } = require('../scripts/lis-config');

const state = {
  tests: [
    { id: 'T-NA', name: 'Sodium (Na)', unit: 'mmol/L', machine: 'EasyLyte' },
    { id: 'T-GLU', displayName: 'Glucose', name: 'GLU', unit: 'mmol/L', machine: 'AU480' },
    { id: 'T-OFF', name: 'Da tat', unit: 'g/L', active: false },
  ],
};
const good = () => ({
  staleMinutes: 90,
  allowedOrigins: ['http://127.0.0.1:8080'],
  mappings: [
    { analyzerId: 'EASYLYTE-01', testCode: 'NA', qclabTestId: 'T-NA', expectedUnit: 'mmol/L' },
    { analyzerId: 'AU480-01', testCode: 'GLU', qclabTestId: 'T-GLU', expectedUnit: 'mmol/L' },
  ],
});
const only = (config, kind) => checkConfig(state, config)[kind];

/* --- Nhan ca goi backup moi lan state tho cu --- */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qclab-lisconf-'));
  try {
    const packed = path.join(dir, 'goi.json'), raw = path.join(dir, 'tho.json'), rac = path.join(dir, 'rac.json');
    fs.writeFileSync(packed, JSON.stringify({ format: 'qclab-backup', formatVersion: 1, data: state }));
    fs.writeFileSync(raw, JSON.stringify(state));
    fs.writeFileSync(rac, JSON.stringify({ chang: 'phai backup' }));
    assert.deepEqual(readState(packed).tests.map(t => t.id), ['T-NA', 'T-GLU', 'T-OFF']);
    assert.deepEqual(readState(raw).tests.map(t => t.id), ['T-NA', 'T-GLU', 'T-OFF'], 'backup cu khong co header van phai doc duoc');
    assert.throws(() => readState(rac), /khong phai backup/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/* --- Khung: bo xet nghiem da tat, uu tien displayName, va KHONG duoc dung ngay --- */
{
  const rows = testRows(state);
  assert.deepEqual(rows.map(r => r.qclabTestId), ['T-GLU', 'T-NA'], 'xep theo ten tieng Viet, bo xet nghiem active:false');
  assert.equal(rows[0].ten, 'Glucose', 'displayName duoc uu tien hon name');

  const skeleton = buildSkeleton(state);
  assert.equal(skeleton.mappings.length, 2);
  assert.equal(skeleton.staleMinutes, 90);
  /* Khung sinh ra PHAI khong dat --check: neu no dat luon thi nguoi dung chay gateway voi
     ma may gia va moi ket qua bi giu lai ma khong hieu tai sao. */
  const errs = only(skeleton, 'errors');
  assert.equal(errs.filter(e => /chua dien ma may that/.test(e)).length, 2, 'moi dong khung deu phai bi bat vi con gia tri mau');
  /* Va them mot lop bao ve nua: tu 2 xet nghiem tro len, cac dong khung dung CHUNG ma mau
     nen trung khoa — gateway tu choi khoi dong han thay vi chay voi mapping gia. */
  assert.ok(errs.some(e => /tu choi khoi dong/.test(e)), 'khung nhieu dong phai lam gateway tu choi khoi dong, khong chay nua voi ma mau');
}

/* --- Config dung thi sach --- */
{
  const result = checkConfig(state, good());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.mappings, 2);
  assert.equal(result.tests, 2, 'chi dem xet nghiem dang bat');
}

/* --- Bon lop loi cau hinh, moi lop tu no quyet dinh --- */
{
  const stale = good(); stale.mappings[0].qclabTestId = 'T-DA-XOA';
  const e = only(stale, 'errors');
  assert.equal(e.length, 1);
  assert.match(e[0], /T-DA-XOA.*khong co trong backup/, 'ID khong ton tai la loi im lang nhat — phai bat');
}
{
  const unit = good(); unit.mappings[0].expectedUnit = 'mg/dL';
  assert.match(only(unit, 'errors')[0], /UNIT_MISMATCH/, 'don vi lech lam moi ket qua bi giu lai');
}
{
  const dup = good(); dup.mappings.push({ ...dup.mappings[0] });
  assert.match(only(dup, 'errors')[0], /tu choi khoi dong/, 'mapping trung phai bat bang chinh buildMappingIndex() cua gateway');
}
{
  const missing = good(); missing.mappings.pop();
  const result = checkConfig(state, missing);
  assert.deepEqual(result.errors, [], 'thieu mapping khong phai loi — gateway van giu ket qua lai');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Glucose.*T-GLU/, 'nhung phai canh bao dung ten xet nghiem bi bo sot');
}

/* --- Canh bao ve cau hinh nguy hiem nhung hop le --- */
{
  const longStale = good(); longStale.staleMinutes = 720;
  assert.match(only(longStale, 'warnings')[0], /720/, 'cua so het han qua dai phai duoc nhac');
  const noOrigin = good(); noOrigin.allowedOrigins = [];
  assert.match(only(noOrigin, 'warnings')[0], /allowedOrigins/);
  assert.match(only({ mappings: [] }, 'errors')[0], /khong co mapping nao/);
}

console.log('LIS config helper tests passed');
