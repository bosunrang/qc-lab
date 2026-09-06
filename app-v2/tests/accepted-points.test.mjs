// Oracle cho `acceptedPoints()` — chuỗi điểm ĐƯỢC CHẤP NHẬN của 1 mức QC
// (Giai đoạn D3.5). Port từ `src/domain/qc/accepted-lot-points.ts` app cũ:
// điểm làm nổ luật LOẠI BỎ không được vào chuỗi VÀ không tính vào cửa sổ
// đánh giá các điểm sau — nhờ vậy 1 lần chạy bị loại không "làm bẩn" chuỗi.
//
// Dùng bản ĐÃ BUILD (CommonJS): `westgard-engine.ts` import chéo
// `westgard-rules` không có đuôi file nên Node's ESM type-stripping không
// resolve được — đúng quy ước đã ghi ở CLAUDE.md mục "Test".
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { acceptedPoints, westgard } = require('../../app-v2-dist/main/domain/westgard-engine.js');

const MEAN = 100;
const SD = 2;
const pt = (val, i) => ({ val, runId: `R${i}`, date: `2026-03-${String(i + 1).padStart(2, '0')}` });

// 1) Không có điểm nào vi phạm → giữ nguyên toàn bộ.
{
  const points = [100, 101, 99, 100.5, 99.5].map(pt);
  assert.equal(acceptedPoints(points, MEAN, SD).length, 5, 'chuoi sach thi giu nguyen');
}

// 2) Điểm ngoài 3SD (luật 1-3s) bị loại khỏi chuỗi.
{
  const points = [100, 101, 112, 99, 100.5].map(pt);
  const kept = acceptedPoints(points, MEAN, SD);
  assert.equal(kept.length, 4, 'diem >3SD phai bi loai khoi chuoi');
  assert.ok(!kept.some(p => p.val === 112), 'diem bi loai khong con trong chuoi');
}

// 3) Điểm bị loại KHÔNG làm bẩn chuỗi — tính chất cốt lõi của hàm này.
//    Ở bản đánh giá ĐẦY ĐỦ, điểm 104.5 bị loại vì nổ 2of3-2s CÙNG VỚI điểm
//    112 (cả hai đều >2SD cùng phía). Trong chuỗi được chấp nhận, 112 đã bị
//    bỏ nên 104.5 chỉ còn là cảnh báo 1-2s → vẫn được nhận.
{
  const points = [100, 112, 104.5].map(pt);
  const full = westgard(points, MEAN, SD);
  assert.equal(full.F[1].level, 'rej', 'diem 112 bi loai vi 1-3s');
  assert.equal(full.F[2].level, 'rej', 'ban day du: 104.5 cung bi loai vi 2of3-2s voi 112');
  const kept = acceptedPoints(points, MEAN, SD);
  assert.deepEqual(kept.map(p => p.val), [100, 104.5], 'chuoi chap nhan: bo 112, GIU 104.5');
}

// 4) Tắt luật thì điểm đó không còn bị loại (tôn trọng cấu hình luật).
{
  const points = [100, 112, 99].map(pt);
  assert.equal(acceptedPoints(points, MEAN, SD, () => true).length, 2, 'bat luat: loai diem 112');
  assert.equal(acceptedPoints(points, MEAN, SD, r => r !== '1-3s').length, 3, 'tat 1-3s: khong loai nua');
}

// 5) Mức chưa có Mean/SD hợp lệ → không đánh giá, giữ nguyên mọi điểm.
{
  const points = [100, 112, 99].map(pt);
  assert.equal(acceptedPoints(points, null, null).length, 3, 'thieu Mean/SD thi khong loai diem nao');
  assert.equal(acceptedPoints(points, MEAN, 0).length, 3, 'SD=0 thi khong loai diem nao');
}

// 6) Mảng rỗng/không hợp lệ không được ném lỗi.
assert.deepEqual(acceptedPoints([], MEAN, SD), []);

console.log('accepted-points: 6 nhom kiem tra dat.');
