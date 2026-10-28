// Đọc báo cáo PDF "Bản phân tích kết quả ngoại kiểm tra" của TTKCXN TP.HCM
// (`domain/eqa/pdf-report.ts`). Fixture là chữ kèm toạ độ do pdf.js trích từ
// báo cáo thật BC20C đợt 09 (đơn vị 10026, nhóm Beckman DxC 700 AU) — đúng
// dữ liệu renderer đưa vào bộ đọc, không phải file PDF.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseVeqasReport, splitVeqasTitle } = require('../../app-dist/main/domain/eqa/pdf-report.js');
const { checkEqaImport, eqaPairKey } = require('../../app-dist/main/domain/eqa/import.js');

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/veqas-bc20c-dot09.json', import.meta.url), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(FIXTURE));

test('tách tiêu đề thông số: mã là cụm ngoặc cuối, đơn vị sau nó', () => {
  assert.deepEqual(splitVeqasTitle('Alanine Aminotransferase (ALT (GPT)) U/L'), { name: 'Alanine Aminotransferase', code: 'ALT (GPT)', unit: 'U/L' });
  assert.deepEqual(splitVeqasTitle('LDL-Cholesterol (Pilot) (LDL) mmol/L'), { name: 'LDL-Cholesterol (Pilot)', code: 'LDL', unit: 'mmol/L' });
  assert.deepEqual(splitVeqasTitle('γ – Glutamyl Transferase (GGT) U/L'), { name: 'γ – Glutamyl Transferase', code: 'GGT', unit: 'U/L' });
});

test('đọc báo cáo thật: thông tin đợt, 16 thông số, nhóm so sánh, khớp trang tổng hợp', () => {
  const report = parseVeqasReport(FIXTURE);
  assert.deepEqual(report.errors, []);
  assert.equal(report.instrumentGroup, 'Beckman DxC 700 AU');
  assert.deepEqual(report.round, {
    program: 'CHƯƠNG TRÌNH NGOẠI KIỂM TRA SINH HÓA', provider: 'TRUNG TÂM KIỂM CHUẨN XÉT NGHIỆM TP.HCM', programCode: 'BC20C', unitCode: '10026',
    year: 2026, round: 'ĐỢT 09', reportCode: '200900161510', receivedDate: '', reportDate: '2026-10-15', assignedLevel: 'Nhóm thiết bị', enteredBy: '',
  });
  assert.match(report.warnings[0], /năm 2026 lấy theo ngày tạo file PDF/);
  assert.deepEqual(report.rows.map((r) => r.code), ['ALT (GPT)', 'ALB', 'AST (GOT)', 'BILI-D', 'BILI-T', 'Chloride', 'CHOL', 'CREA', 'GLUC', 'HDL', 'LDL', 'Potassium', 'Sodium', 'TRIG', 'URIC', 'GGT']);
  const alt = report.rows[0];
  assert.deepEqual([alt.unit, alt.result, alt.assigned, alt.sigmaP, alt.zProvider, alt.sample, alt.method, alt.peerGroup],
    ['U/L', 141, 141.069, 9.405, -0.01, '09-01', 'Beckman Mod. IFCC Ref. without P5P', 'Beckman DxC 700 AU']);
  assert.deepEqual(alt.peer, {
    all: { n: 8611, mean: 140.876, sd: 11.56, cv: 8 },
    method: { n: 1279, mean: 141.359, sd: 11.6, cv: 3.6 },
    instrument: { n: 1108, mean: 141.069, sd: 11.58, cv: 3.4 },
  });
  // "Tât cả phương pháp" (báo cáo gõ thiếu dấu) vẫn nhận là nhóm tất cả phương pháp.
  assert.equal(report.rows.find((r) => r.code === 'AST (GOT)').peer.all.n, 8577);
});

test('số liệu trang chi tiết khác trang tổng hợp là lỗi chặn; file không phải báo cáo bị từ chối', () => {
  const doc = clone();
  const page = doc.pages[1];
  const item = page.find((i) => i.str.trim() === '141.000' && i.x < 300);
  item.str = '114.000';
  assert.match(parseVeqasReport(doc).errors.join('\n'), /ALT \(GPT\) — số liệu trang 2 khác trang tổng hợp/);

  const empty = parseVeqasReport({ fileName: 'khac.pdf', pages: [[{ str: 'Hoá đơn', x: 10, y: 10 }]], creationDate: '' });
  assert.match(empty.errors.join('\n'), /không phải bản phân tích kết quả ngoại kiểm/);
  assert.match(empty.errors.join('\n'), /không xác định được năm/);
});

test('dòng đọc từ PDF đi qua đúng cổng kiểm của main: z app khớp z nhà cung cấp', () => {
  const report = parseVeqasReport(FIXTURE);
  // Renderer thay nhóm thiết bị bằng máy của PXN mà người dùng chọn.
  const rows = report.rows.map((r) => ({ ...r, instrument: 'DxC700' }));
  const tests = rows.map((r, i) => ({ id: `t${i}`, name: r.code, display_name: '', standard_name: '', abbreviation: '', aliases: [], instrument_id: 'dxc', instrument_name: 'DxC700', instrument_model: '', active: true }));
  const mapping = new Map(rows.map((r, i) => [eqaPairKey(r.code, 'DxC700'), `t${i}`]));
  const check = checkEqaImport({ round: report.round, rows }, { tests, mapping });
  assert.equal(check.blocking, 0, JSON.stringify(check.rows.filter((r) => r.errors.length).map((r) => r.errors)));
  assert.ok(check.rows.every((r) => r.providerCheck === 'match' || r.providerCheck === 'none'), 'z tính lại khớp z trên báo cáo');
  assert.ok(check.rows.every((r) => r.cls === 'ok'));
});
