# Rà soát Six Sigma — Bias từ ngoại kiểm — 17/11/2026

Đợt rà soát chốt E-09 (`docs/EQA-PLAN-2026-10-28.md`) và N-15
(`docs/EQA-REVIEW-2026-10-28.md`): cách lấy Bias cho Sigma từ kết quả ngoại
kiểm đã nhập trong app. Người phụ trách quyết định đổi SG21 của đợt
`SIGMA-REVIEW-2026-09-22-lan2` (Sigma dùng Bias RMS) sang trung bình có dấu
theo nghiệp vụ chuẩn (yêu cầu ngày 17/11/2026).

## 1. Căn cứ

| Nguồn | Nội dung dùng |
| --- | --- |
| Westgard, Sigma metric | `Sigma = (TEa − \|Bias\|) / CV`: Bias là sai số **hệ thống**, CV là sai số ngẫu nhiên (độ chụm nội kiểm) |
| Nordtest TR 537 | Bias RMS = √(trung bình² + độ phân tán²) dùng cho **độ không đảm bảo đo**, vì ngân sách MU cần cả phần dao động của bias |
| ISO 13528 / EQA-REVIEW N-05 | Khi u(x_pt) > 0,3·σp, độ không đảm bảo của giá trị ấn định có ảnh hưởng đáng kể đến đánh giá ngoại kiểm; không suy thành yêu cầu tự loại mẫu khỏi Bias Sigma |
| EQA-REVIEW N-11, N-15 | Kết quả mà điều tra kết luận lỗi hành chính hoặc vấn đề chương trình/mẫu không phản ánh phương pháp |

## 2. Phát hiện

| Mã | Phát hiện |
| --- | --- |
| SB01 | Sigma dùng Bias RMS: RMS gộp độ phân tán giữa các vòng vào Bias, nên sai số ngẫu nhiên bị tính hai lần (đã có trong CV), Sigma bị hạ thấp. Ví dụ hai vòng +2 % và −2 %: RMS = 2 %, trung bình có dấu = 0 % |
| SB02 | Bias nhập tay từng vòng EQA, không lấy từ kết quả ngoại kiểm đã nhập và đã đánh giá trong app |
| SB03 | Không chọn mẫu theo nồng độ mức QC: một đợt có nhiều mẫu ở nồng độ khác nhau, gộp chung trộn bias hằng định với bias tỷ lệ |
| SB04 | Không loại kết quả đã xác định không phản ánh phương pháp (N-15) hoặc giá trị ấn định kém chắc chắn |

## 3. Quyết định

| # | Quyết định |
| --- | --- |
| SB-1 | **Sigma dùng Bias trung bình có dấu** của các vòng/mẫu; công thức lấy `\|Bias\|`. Bias RMS **chỉ** dùng cho ngân sách MU (Nordtest). Một vòng thì hai giá trị trùng nhau. Bias nhập tay một con số giữ nguyên |
| SB-2 | **Nguồn "Ngoại kiểm"**: lấy kết quả hiện hành (đợt đang dùng, phiên bản hiện hành) của đúng xét nghiệm (`test_id`) của kỳ Sigma. Mỗi mẫu là một giá trị Bias% = (KQ − giá trị ấn định) / \|giá trị ấn định\| × 100 |
| SB-3 | **Thời gian (cập nhật theo yêu cầu người dùng)**: mọi mẫu hợp lệ trong số tháng lịch được chọn, tối thiểu 1 tháng, mặc định 3, không áp trần 12 tháng. Tính tới hết tháng Sigma; ví dụ kỳ 11/2026 chọn 1 tháng lấy từ 01/11, chọn 3 tháng lấy từ 01/09, đều tới 30/11, không lấy báo cáo sau kỳ |
| SB-4 | **Bias chung (thay phương án lọc ±25%)**: lấy mọi nồng độ của cùng xét nghiệm–máy, tính trung bình có dấu các Bias% và áp dụng chung cho các mức QC. CV, TEa và Mean vẫn riêng từng mức. Mỗi mẫu chỉ được đếm một lần trong bộ mẫu chung |
| SB-5 | **Loại trừ (cập nhật 18/11/2026)**: kết quả thuộc hồ sơ NCE (chưa huỷ) có kết luận nguyên nhân lỗi hành chính hoặc chương trình/mẫu (N-15, SB-5b). Cờ u/σp ước tính > 0,3 (N-05) chỉ cảnh báo cần rà soát, không tự loại khỏi Bias Sigma. Mẫu bị loại vì căn cứ khác vẫn hiện kèm lý do |
| SB-6 | **Cỡ mẫu**: khuyến nghị ≥ 3 mẫu sau loại trừ; ít hơn thì cảnh báo "chưa đủ mẫu", vẫn cho người phụ trách quyết định áp dụng. Hiện sai số chuẩn SD/√n; các mẫu đổi dấu thì cảnh báo "Bias không ổn định" thay vì đổi sang RMS |
| SB-7 | **Truy vết**: mỗi vòng lấy từ ngoại kiểm lưu mã kết quả và nhãn đợt/mẫu; main đối chiếu lại KQ và giá trị ấn định với CSDL khi lưu, không tin số do giao diện gửi |
| SB-8 | Bias so với giá trị ấn định của nhóm đồng đẳng là độ lệch so với nhóm, không phải so với giá trị thật; nhãn hiển thị ghi rõ nguồn |

Quy tắc ứng dụng được người dùng chọn: cửa sổ tuỳ chọn từ 1 tháng lịch,
mặc định 3 tháng, không lọc theo
nồng độ, khuyến nghị tối thiểu 3 mẫu. Đây là lựa chọn cho SOP của đơn vị,
không phải khẳng định mọi tiêu chuẩn đều yêu cầu đúng 3 tháng.

Bias chung là ước lượng tổng hợp so với giá trị ấn định của các mẫu đã chọn.
Nếu dữ liệu tập trung ở một vùng nồng độ, kết quả không tự chứng minh hiệu
năng của cả dải đo; nếu Bias đổi dấu thì cảnh báo sự triệt tiêu khi lấy trung
bình. Áp dụng chung cần được người phụ trách chủ động quyết định.
Tham khảo: [ADLM — The Case for Six Sigma](https://myadlm.org/cln/articles/2020/april/the-case-for-six-sigma-in-lab-quality-management-systems),
[Westgard — QC Validator FAQ](https://www.westgard.com/questions/quest3.html).

## 4. Ảnh hưởng

- Kỳ Sigma đã lưu có ≥ 2 vòng EQA khác dấu hoặc khác độ lớn sẽ tính lại Sigma
  theo trung bình có dấu khi mở. App chưa vận hành chính thức nên không giữ
  công thức RMS cho kỳ cũ.
- MU không đổi (vẫn RMS). Nhãn "Bias RMS" trên màn Sigma và tệp xuất đổi thành
  "Bias"; bảng MU giữ "Bias RMS".
- Bộ ca thẩm định (`app/validation/`) cập nhật giá trị kỳ vọng tương ứng.

## 5. Khắc phục sau rà soát triển khai

- Khi lưu vòng mới lấy từ ngoại kiểm, main dùng lại bộ lọc thời gian, số
  liệu hợp lệ và kết luận NCE. Cờ độ không đảm bảo của giá trị ấn định chỉ
  dùng cảnh báo, không chặn lấy hoặc lưu mẫu. Căn cứ loại trừ thay đổi trong
  lúc mở hộp thoại phải lấy lại trước khi áp dụng.
- NCE khớp bằng `eqa_source_key` như tab Khắc phục: đổi số liệu không mang
  theo kết luận của báo cáo cũ; bổ sung máy hoặc đổi phiên bản mà giữ nguyên
  nội dung vẫn nhận đúng kết luận cũ.
- Một mã kết quả chỉ dùng một lần trong mỗi mức. Vòng trùng đã có ở kỳ cũ
  vẫn được đọc và giữ nguyên, nhưng không được nhân thêm bản sao. Một mẫu
  trong bộ chung được lưu làm căn cứ của mỗi mức, không nhân đôi cỡ mẫu.
- Cửa sổ đủ số tháng được chọn tính từ ngày đầu tháng, kể cả tháng nhuận.
  Main kiểm số tháng nguyên từ 1, từ chối số không hữu hạn hoặc vượt phạm
  vi biểu diễn của lịch; không tự đổi 0 thành 1 hoặc âm thầm dùng mặc định.
- Mỗi vòng đã chụp được giữ nguyên mã, nhãn và số liệu khi sửa CV/MU, kể cả
  sau khi thay báo cáo hoặc đổi NCE/Mean. Không lọc lại hay di trú ngầm các
  kỳ đã lưu. Miễn trừ lịch sử chỉ áp dụng đúng kỳ và mức đã có vòng đó.
  Payload giao diện giữ cả mã kết quả và nhãn khi sửa các trường khác.
- Thao tác áp dụng chung truyền một bộ mẫu lên main; main phân phối vào
  các mức trong một giao dịch, kiểm tra đủ mức đang có và đủ mọi mẫu hợp lệ
  khi lấy hoàn toàn từ ngoại kiểm. Mẫu thêm mới hoặc hết hợp lệ trong lúc
  mở hộp thoại phải lấy lại. Áp dụng lại chủ động kiểm cả căn cứ đã từng lưu;
  sửa CV/MU thông thường vẫn giữ nguyên ảnh chụp, không di trú kỳ cũ.
- Số tháng được truyền qua cùng IPC/LAN lúc lấy mẫu và áp dụng, lưu ở
  `eqaWindowMonths` trong căn cứ từng mức. Mở lại dùng đúng khoảng đã lưu;
  sửa CV/MU giữ nguyên, kỳ cũ thiếu trường này không tự bị ghi lại. Đổi ô
  số tháng yêu cầu lấy lại mẫu; phản hồi chậm của khoảng cũ không được ghi
  đè lựa chọn mới hoặc cho áp dụng nhầm.

Kiểm thử hồi quy: `app/tests/sigma-eqa-bias.test.mjs` và luồng Electron
`app/e2e/sigma-eqa-bias.e2e.mjs`, dùng CSDL tạm riêng.

## 6. Rà soát lại toàn bộ nghiệp vụ Sigma (17/11/2026)

Rà công thức Sigma, DPMO, bảng Westgard Sigma Rules 2/3 mức, QGI, mục tiêu
cải thiện, quy đổi CLIA, MU kiểu Nordtest và đáp án SG-01…SG-10: đúng chuẩn.
Sửa theo yêu cầu người dùng:

| # | Quyết định |
| --- | --- |
| SB-9 | **CV bỏ điểm của lần chạy bị loại đã đóng hồ sơ NCE** (nguyên nhân xác định, đã khắc phục), cùng quy tắc WG-16 của thống kê Westgard và CLSI C24 / ISO/TS 20914. Thay quyết định 22/09 ("không loại điểm mất kiểm soát khỏi CV"): điểm mất kiểm soát **chưa** xử lý vẫn nằm trong CV và vẫn chặn nhóm; không loại điểm theo giá trị. Hộp thoại chọn lô ghi số điểm đã bỏ |
| SB-5b | Loại mẫu theo NCE chỉ khi hồ sơ đã kết luận nguyên nhân **xác định hoặc nghi ngờ** thuộc nhóm hành chính hoặc chương trình/mẫu; "chưa xác định" không loại dù còn giữ nhóm cũ (N-11) |
| SB-4b | **Bias chung chỉ lấy từ ngoại kiểm** và dùng đủ mọi mẫu hợp lệ. Vòng nhập tay (EQC có target riêng từng mức) lưu riêng cho đúng mức đang mở. Một mức không trộn mẫu ngoại kiểm với vòng nhập tay; mẫu ngoại kiểm mới chỉ vào qua "Lấy từ ngoại kiểm". Dòng ngoại kiểm trong hộp thoại chỉ đọc, không xoá lẻ |
| SB-10 | Nhãn: ô Bias không còn ghi "RMS"; mục thiết kế QC gọi đúng là "Westgard Sigma Rules" (không phải OPSpecs); Excel ghi "DPMO (quy đổi, dịch 1,5σ)". Bỏ hàm xuất MU sang Excel không còn nơi gọi |

Còn chờ chuyên môn của khoa: MU có cộng u(cal) bên cạnh u(bias) (Nordtest
thuần chỉ dùng u(Rw) và u(bias)); u(Rw) đang lấy CV một lô QC (ISO/TS 20914
khuyến nghị độ chụm dài hạn ≥ 6 tháng); tiêu chí "U ≤ TEa" là lựa chọn của
PXN, không phải ngưỡng chuẩn.

## 7. Cảnh báo độ không đảm bảo giá trị ấn định (18/11/2026)

Theo yêu cầu người dùng, thay phần tự loại theo N-05 trong SB-5: mẫu có
u/σp ước tính > 0,3 vẫn tham gia trung bình Bias và được lưu khi người dùng
bấm áp dụng, nếu không có căn cứ loại trừ khác. Hộp thoại hiện số mẫu cần
rà soát và đánh dấu từng dòng; cảnh báo không đồng nghĩa giá trị ấn định sai
hoặc mẫu đã được phê duyệt chuyên môn. Không đổi kết quả ngoại kiểm chính
thức, công thức ước tính u, công thức Bias/Sigma hay dữ liệu kỳ đã lưu.

Căn cứ: [Eurachem — Understanding PT performance assessment, 2024](https://eurachem.org/images/stories/leaflets/pt/pt_perf_assmnt/PT_Understand_Evaluation_V1_EN.pdf)
dùng ngưỡng 0,3 để xét ảnh hưởng độ không đảm bảo trong chấm điểm ngoại
kiểm (z′); không phải quy tắc loại mẫu Bias Sigma. Công thức ước tính u từ
SD/N cần phù hợp phương pháp lập giá trị ấn định; xem
[Eurachem 2021, phụ lục D](https://www.eurachem.org/images/stories/Guides/pdf/EPT_2021_P1_EN.pdf).
Kiểm thử hồi quy kiểm cả lấy mẫu, lưu chung nhiều mức, giữ nguyên cờ cảnh
báo và việc loại đúng theo thời gian, dữ liệu không hợp lệ hoặc NCE.
