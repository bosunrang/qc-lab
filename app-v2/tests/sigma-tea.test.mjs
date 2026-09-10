// Oracle cho lớp giải TEa dùng khi tạo kỳ Six Sigma. Những giới hạn CLIA
// tuyệt đối là nghiệp vụ lâm sàng: chỉ quy đổi khi Mean + đơn vị hợp lệ và
// không được thay bằng nhánh Ricos một cách im lặng.
import assert from 'node:assert/strict';
import { findCatalog, resolveTea } from '../renderer/lib/sigma-tea-core.ts';

const sodium = {
  id: 't-na', name: 'Sodium', tea_ref_key: '', unit: 'mmol/L', tea: 0,
};
const catalog = [{ id: 'qclab-sodium', name: 'Sodium', abbr: 'Na', unit: 'mmol/L', clia: null, ricos: 0.73, cliaAbsolute: 4, cliaAbsoluteUnit: 'mmol/L' }];

assert.equal(findCatalog(sodium, catalog)?.id, 'qclab-sodium');
const cliaAt100 = resolveTea(sodium, [], catalog, 'clia', 100);
assert.equal(cliaAt100.value, 4, '±4 mmol/L ở Mean 100 phải thành 4%');
assert.match(cliaAt100.criterion, /±4 mmol\/L/);
const cliaAt200 = resolveTea(sodium, [], catalog, 'clia', 200);
assert.equal(cliaAt200.value, 2, 'cùng giới hạn tuyệt đối ở Mean 200 phải thành 2%, không được dùng TEa của mức 1');

const customClia = resolveTea(
  { id: 't-custom', name: 'Custom marker', tea_ref_key: 'marker-x', unit: 'liter', tea: 0 },
  [{ name: 'Marker X', aliases_json: '["marker-x"]', lab: null, lab_source: '', clia: 3, clia_rule: 'greater-of', clia_absolute: 0.05, clia_absolute_unit: 'L' }], [],
  'clia', 1,
);
assert.equal(customClia.value, 5, 'hồ sơ CLIA tự khai phải dùng alias, chuẩn hóa liter/L và giới hạn tuyệt đối');
assert.equal(findCatalog({ ...sodium, name: 'CK-MB', tea_ref_key: '' }, [{ id: 'ck', name: 'Creatine kinase', abbr: 'CK', unit: 'U/L', clia: 20, ricos: null }]), null, 'không được ghép mơ hồ CK-MB vào CK');

const cliaNoMean = resolveTea(sodium, [], catalog, 'clia', null);
assert.equal(cliaNoMean.value, null, 'không được đoán TEa% từ giới hạn tuyệt đối khi thiếu Mean');
assert.match(cliaNoMean.note || '', /Cần Mean/);

const mismatch = resolveTea({ ...sodium, unit: 'mg/dL' }, [], catalog, 'clia', 100);
assert.equal(mismatch.value, null, 'đơn vị lệch không được áp dụng giới hạn tuyệt đối');
assert.match(mismatch.note || '', /không khớp/);

const ricos = resolveTea(sodium, [], catalog, 'ricos', 100);
assert.equal(ricos.value, 0.73);

const lab = resolveTea(sodium, [{ name: 'Sodium', lab: 2.5, lab_source: 'SOP-01' }], catalog, 'lab', 100);
assert.equal(lab.value, 2.5);

console.log('app-v2 sigma-tea resolver oracle tests passed');
