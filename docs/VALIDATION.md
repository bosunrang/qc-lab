# Thẩm định phần tính toán của QC Lab

Bộ ca đối chiếu dùng để phòng xét nghiệm thẩm định (validate) phần tính toán
nội kiểm của QC Lab trước khi dùng thật, và mỗi lần cập nhật phiên bản, theo
yêu cầu thẩm định phần mềm của ISO 15189.

## Chạy

```powershell
npm run validate
```

Lệnh build mã main rồi chạy toàn bộ ca trên một CSDL tạm, **không đụng CSDL
của người dùng**. Kết quả in ra màn hình và ghi biên bản Excel vào
`validation-output/QC-Lab-tham-dinh-<phiên bản>-<ngày>.xlsx`. Mã thoát khác 0
khi có ca không đạt.

Bộ ca cũng chạy trong `npm test` (`app/tests/validation-suite.test.mjs`), nên
một thay đổi làm lệch kết quả tính toán sẽ bị chặn ngay khi phát triển.

## Biên bản Excel

| Trang | Nội dung |
| --- | --- |
| Tổng hợp | Phiên bản, commit, ngày chạy, số ca đạt theo nhóm, kết quả chung, giới hạn, chỗ ký của người thực hiện và người xem xét |
| Ca thẩm định | Mỗi ca một dòng: nội dung, dữ liệu vào, căn cứ đáp án, kết luận |
| Chi tiết phép kiểm | Từng phép so sánh: đáp án, kết quả của app, Đạt/Không đạt |
| Dữ liệu vào | Mọi điểm QC đã nhập: lần chạy, ngày, mức, Mean/SD đích, giá trị, Z thiết kế — đủ để nhập tay lại vào app nếu muốn kiểm trên giao diện |

## Phạm vi

| Nhóm | Số ca | Kiểm |
| --- | --- | --- |
| Luật Westgard | 31 | 13 luật (1-2s, 1-3s, 2-2s, R4s, 3-1s, 4-1s, 6x, 8x, 9x, 10x, 12x, 7T, 2of3-2s), ca nổ và ca sát ranh giới không nổ; trong mức và liên mức (2–3 mức); hành động riêng của xét nghiệm (nâng, hạ, tắt luật); loại cả lần chạy; đổi Mean/SD giữa chuỗi |
| Z-score, Mean, SD, CV | 5 | Z từng điểm; Mean/SD/CV quan sát (SD mẫu n − 1); điểm và lần chạy bị loại không vào thống kê; nhãn "tạm thời"; CV ở Tổng quan |
| Six Sigma | 12 | Sigma, DPMO, Bias âm, Bias nhiều vòng EQA (RMS), thiếu Bias; bảng Westgard Sigma Rules 2 và 3 mức, ranh giới 3σ và 6σ; QGI; một ca trọn đường từ 30 điểm IQC tới gợi ý thiết kế QC |
| CUSUM | 5 | C+ và C− từng lần chạy, tín hiệu ±h, k/h theo cấu hình, đặt lại sau khắc phục hiệu quả, CUSUM không tự loại điểm |

Mỗi ca là một xét nghiệm riêng. Dữ liệu đi qua **đúng các hàm mà giao diện
gọi** (tạo xét nghiệm, lô, Mean/SD, Panel, luật riêng, nhập điểm, NCE, kỳ
Sigma); kết quả đọc lại như trang Phân tích Westgard, Tổng quan và Six Sigma
hiển thị.

## Đáp án đến từ đâu

- Ca Westgard dựng sao cho đáp án hiển nhiên theo định nghĩa: giá trị nhập ghi
  dưới dạng Z-score (giá trị = Mean + Z × SD), ví dụ điểm ở +3,2SD phải ra
  1-3s. Mỗi ca ghi căn cứ (định nghĩa của Westgard, hoặc quyết định nghiệp vụ
  đã chốt trong `docs/WESTGARD-REVIEW-*.md`, `docs/SIGMA-REVIEW-*.md`).
- Đáp án số (Mean, SD, CV, Sigma, DPMO, RMS, QGI, CUSUM) ghi tường minh trong
  `app/validation/cases.mjs` và được tính lại bằng bộ tính tham chiếu viết
  riêng từ định nghĩa (`app/validation/reference.mjs`), không dùng mã của app.
  DPMO tham chiếu tính Φ bằng tích phân số, khác cách app dùng.

Đã thử cố ý làm hỏng app ở 5 chỗ (ngưỡng 1-3s, SD chia n, bỏ trị tuyệt đối
Bias, CUSUM bỏ k, không loại cả lần chạy); lần nào bộ ca cũng báo không đạt.

## Giới hạn

- Kiểm phần **tính toán và kết luận**, không kiểm giao diện, in ấn, xuất tệp,
  LIS, LAN hay sao lưu.
- Dữ liệu là ca dựng sẵn, không phải dữ liệu thật của phòng xét nghiệm. Nên
  bổ sung đối chiếu song song với cách đang làm (Excel, phần mềm cũ) trong một
  thời gian trước khi dùng thật.
- Gợi ý thiết kế QC của các ca Sigma nhập CV tay được kiểm bằng chính hàm
  main dùng, vì trang Six Sigma chỉ hiện gợi ý khi CV lấy từ nhóm IQC đủ điều
  kiện và đã rà soát; ca SG-10 đi trọn đường đó.
- Một số đáp án là **quyết định nghiệp vụ của app** chứ không phải định nghĩa
  chuẩn duy nhất (vd WG-19 không nối chuỗi qua lần đổi Mean/SD, bias EQA lấy
  RMS). Phòng xét nghiệm cần xem cột "Căn cứ đáp án" và xác nhận các quyết định
  đó phù hợp SOP.

## Việc của phòng xét nghiệm

1. Chạy `npm run validate` trên đúng phiên bản sẽ cài.
2. Người phụ trách chất lượng đọc trang "Ca thẩm định", đặc biệt cột căn cứ.
3. Ký trang "Tổng hợp", lưu biên bản cùng hồ sơ phiên bản phần mềm.
4. Lặp lại mỗi lần nâng phiên bản.

## Thêm ca

Thêm một phần tử vào mảng tương ứng trong `app/validation/cases.mjs`. Ca
Westgard chỉ cần liệt kê điểm có luật (`points['lần chạy/mức']`); điểm không
liệt kê phải là "Đạt". Đáp án số mới nên được kiểm lại bằng `reference.mjs` —
`validation-suite.test.mjs` làm việc đó cho các nhóm đã có.
