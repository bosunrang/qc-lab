// Giai đoạn C5: kiểm chứng hàm THUẦN của client LIS Gateway — không cần DB
// hay gateway thật. Pin đúng 2 nguyên tắc bắt buộc port từ bản cũ: allowlist
// origin, và ngày điểm QC suy từ GIỜ ĐỊA PHƯƠNG của measuredAt (không cắt
// chuỗi ISO UTC).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { normalizeGatewayUrl, resultToPointInput } = require('../../app-dist/main/domain/lis-client.js');

// 1) Allowlist origin — chỉ 2 origin cố định của gateway
assert.equal(normalizeGatewayUrl('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
assert.equal(normalizeGatewayUrl('http://localhost:8787/api/v1/status'), 'http://localhost:8787', 'giu path phai bi bo, chi lay origin');
assert.equal(normalizeGatewayUrl('https://example.com'), '');
assert.equal(normalizeGatewayUrl('http://127.0.0.1:9999'), '', 'sai port cung phai bi tu choi');
assert.equal(normalizeGatewayUrl('khong-phai-url'), '');
assert.equal(normalizeGatewayUrl(''), '');

// 2) Ngay dung GIO DIA PHUONG - khong cat chuoi ISO UTC. 23:05Z la 1 ngay
// khac o gio dia phuong dai duong (VN +7 -> 06:05 ngay hom sau); dung chinh
// cach tinh cua ham (local getters) de lam gia tri ky vong, tranh hardcode
// mui gio cu the (test phai chay dung tren moi may, moi mui gio).
function localYmd(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const record = {
  message: { messageId: 'm1', analyzerId: 'AU480', testCode: 'GLU', qcLevel: '1', value: 101, measuredAt: '2026-08-01T23:05:00Z', runId: 'r1', operator: 'ktv1' },
  resolved: { ok: true, code: 'RESOLVED', qclabTestId: 't1', level: 1, lot: 'L1', displayName: 'Glucose' },
};
const input = resultToPointInput(record);
assert.equal(input.date, localYmd('2026-08-01T23:05:00Z'), 'phai dung getter gio dia phuong, khong cat UTC');
assert.equal(input.testId, 't1');
assert.equal(input.level, 1);
assert.equal(input.val, 101);
assert.equal(input.runId, 'r1');
assert.equal(input.operatorName, 'ktv1');

// 3) measuredAt khong parse duoc -> null, KHONG fallback ve "hom nay"
assert.equal(resultToPointInput({ message: { measuredAt: 'khong-phai-ngay' }, resolved: { ok: true, qclabTestId: 't1', level: 1 } }), null);

// 4) Chi ban ghi da khop cau hinh (resolved.ok===true) moi tra ve input -
// ban ghi UNMAPPED_TEST/UNMAPPED_LEVEL/UNIT_MISMATCH phai tra null (khong
// tao diem QC voi testId/level rong)
assert.equal(resultToPointInput({ message: { measuredAt: '2026-08-01T00:00:00Z' }, resolved: { ok: false, code: 'UNMAPPED_TEST', reason: 'chua mapping' } }), null);

console.log('app lis-client oracle tests passed');
