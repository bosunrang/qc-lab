// Oracle test cho eqaRoundsStats() (Bias% RMS từ nhiều vòng EQA/EQC) — hàm
// MỚI của app-v2, không có sẵn trong assets/core.js bản cũ để đối chiếu trực
// tiếp (bản cũ tính RMS ở sgBiasStats(), một hàm trình bày không tách rời
// được để require() độc lập) — nên đối chiếu bằng số tính tay, không phải
// so với QCCore. sigma-metrics.ts không import chéo module khác trong main/
// nên import thẳng .ts qua ESM được (giống các test khác của file này).
import assert from 'node:assert/strict';
import { eqaRoundsStats } from '../main/domain/sigma-metrics.ts';

// `biasSem` (trước 11/09 tên là `biasRefU`) là SAI SỐ CHUẨN của chính ước
// lượng bias — SD giữa các vòng / căn(n). Nó KHÔNG phải u(Cref): Nordtest
// TR 537 định nghĩa u(Cref) là độ không đảm bảo của GIÁ TRỊ GÁN do nhà cung
// cấp EQA/CRM công bố, không suy được từ chuỗi bias của chính mình. Đổi tên
// để chỗ gọi không tưởng đây là u(Cref) rồi nạp thẳng vào ngân sách MU.
//
// 1 vòng duy nhất: rms=mean=giá trị đó, biasSem=null (không tính được SD
// giữa các vòng với n=1).
{
  const r = eqaRoundsStats([2]);
  assert.equal(r.rms, 2);
  assert.equal(r.mean, 2);
  assert.equal(r.n, 1);
  assert.equal(r.biasSem, null);
  assert.equal(r.mixedSigns, false);
}

// 1 vòng ÂM: giữ nguyên dấu (khớp SigmaBiasService.stats() app cũ) — Sigma/MU
// lấy |bias| nên số không đổi, nhưng bảng phải cho thấy hướng lệch.
{
  const r = eqaRoundsStats([-2]);
  assert.equal(r.rms, -2, '1 vòng âm phải giữ dấu, không được biến thành +2');
  assert.equal(r.mean, -2);
  assert.equal(r.mixedSigns, false);
}

// 2 vòng cùng dấu: rms = sqrt((1^2+3^2)/2) = sqrt(5) ~ 2.236
{
  const r = eqaRoundsStats([1, 3]);
  assert.ok(Math.abs(r.rms - Math.sqrt(5)) < 1e-9);
  assert.equal(r.mean, 2);
  assert.equal(r.mixedSigns, false);
  // SD mau (n-1) cua [1,3]: mean=2, variance=((1-2)^2+(3-2)^2)/1=2, sd=sqrt(2)
  // bias RefU = sd/sqrt(2)
  assert.ok(Math.abs(r.biasSem - Math.sqrt(2) / Math.sqrt(2)) < 1e-9);
}

// Dấu trái nhau: trung bình cộng CÓ THỂ về gần 0 (dễ gây nhầm "không lệch"),
// nhưng RMS vẫn phản ánh đúng độ lớn sai số — đây là lý do Sigma dùng RMS,
// không dùng trung bình cộng có dấu.
{
  const r = eqaRoundsStats([-2, 2]);
  assert.equal(r.mean, 0, 'trung bình cộng có dấu triệt tiêu nhau — chỉ mang tính tham khảo');
  assert.ok(Math.abs(r.rms - 2) < 1e-9, 'RMS phải vẫn phản ánh đúng độ lớn 2, không bị triệt tiêu như mean');
  assert.equal(r.mixedSigns, true);
}

// Bỏ qua giá trị không hợp lệ (NaN/chuỗi rác), không throw.
{
  const r = eqaRoundsStats([1, 'x', NaN, 3]);
  assert.equal(r.n, 2);
}

// Mảng rỗng -> null (không có gì để tính).
{
  assert.equal(eqaRoundsStats([]), null);
}

console.log('app-v2 eqa-rounds-stats oracle tests passed');
