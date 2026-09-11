// Oracle cho lớp giải TEa dùng khi tạo kỳ Six Sigma. Những giới hạn CLIA
// tuyệt đối là nghiệp vụ lâm sàng: chỉ quy đổi khi Mean + đơn vị hợp lệ và
// không được thay bằng nhánh Ricos một cách im lặng.
import assert from 'node:assert/strict';
import { findCatalog, resolveTea } from '../main/domain/sigma-tea-core.ts';

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

// Tên dạng `Tên (Viết tắt)` — ĐÚNG định dạng mà ô "Tên xét nghiệm" ở Cấu hình
// chung tự sinh khi gợi ý analyte. Trước 2026-09-11 nó KHÔNG tra được analyte
// của chính mình nếu `tea_ref_key` chưa được gán (vd xét nghiệm tạo trước khi
// có gợi ý, hoặc tên gõ tay), nên trang Six Sigma chỉ nói "chưa có" mà không
// nói vì sao — đúng lỗi người dùng báo.
{
  const display = { ...sodium, name: 'Sodium (Na)', tea_ref_key: '' };
  assert.equal(findCatalog(display, catalog)?.id, 'qclab-sodium', '"Sodium (Na)" phải tra được analyte Sodium');
  assert.equal(resolveTea(display, [], catalog, 'ricos', 140).value, 0.73);
  const clia = resolveTea(display, [], catalog, 'clia', 140);
  assert.ok(Math.abs(clia.value - (4 / 140) * 100) < 1e-12, `CLIA ±4 mmol/L tại Mean 140 phải ra ${(4 / 140) * 100}%, nhận được ${clia.value}`);

  // Hồ sơ TEa PXN của analyte CÓ SẴN được lưu theo `analyte_id` + tên danh mục
  // ("Sodium"), nên so tên trần với "Sodium (Na)" sẽ không bao giờ gặp nhau.
  const lab = resolveTea(display, [{ name: 'Sodium', analyte_id: 'qclab-sodium', lab: 2.5, lab_source: 'SOP-01' }], catalog, 'lab', 140);
  assert.equal(lab.value, 2.5, 'hồ sơ TEa PXN theo analyte_id phải khớp được xét nghiệm mang tên hiển thị');
}

// BẤT BIẾN KHÔNG ĐƯỢC NỚI: vẫn là khớp TUYỆT ĐỐI, không đoán theo tiền tố.
// Đây là lý do app-v2 cố ý khác app cũ (app cũ dùng exact-rồi-longest-prefix,
// nên "Glucose (huyết tương)" tự thừa hưởng TEa của "Glucose"). TEa là tiêu
// chí lâm sàng: thừa hưởng sai còn tệ hơn báo "chưa có".
{
  const two = [
    { id: 'qclab-ck', name: 'Creatine kinase', abbr: 'CK', unit: 'U/L', clia: 20, ricos: null },
    { id: 'qclab-ck-mb', name: 'Creatine kinase-MB', abbr: 'CK-MB', unit: 'U/L', clia: 25, ricos: null },
  ];
  const at = (name) => findCatalog({ name, tea_ref_key: '', unit: 'U/L', tea: 0 }, two)?.id ?? null;
  assert.equal(at('CK'), 'qclab-ck', 'viết tắt CK khớp đúng dòng CK');
  assert.equal(at('CK-MB'), 'qclab-ck-mb', 'CK-MB KHÔNG được nuốt bởi CK');
  assert.equal(at('Creatine kinase (CK)'), 'qclab-ck');
  assert.equal(at('Creatine kinase-MB (CK-MB)'), 'qclab-ck-mb');
  // Tên tự đặt của phòng xét nghiệm: KHÔNG được đoán ra analyte nào.
  assert.equal(at('Natri máy A'), null, 'tên tự đặt phải trả về không khớp, không đoán');
  assert.equal(at('Creatine kinase toàn phần'), null, 'không được khớp theo tiền tố');
}
console.log('app-v2 sigma-tea resolver oracle tests passed');
