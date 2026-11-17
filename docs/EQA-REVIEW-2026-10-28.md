# Rà soát nghiệp vụ Phân tích ngoại kiểm và nghiệp vụ chuẩn

Lập ngày 2026-10-28, theo yêu cầu rà soát, nghiên cứu và đưa ra nghiệp vụ
chuẩn cho phân hệ Ngoại kiểm. Phạm vi: phần đã làm (giai đoạn 1 và nhập báo
cáo PDF, `docs/EQA-PLAN-2026-10-28.md`), công cụ HTML cũ của khoa (thẻ điều
tra nguyên nhân, phiếu BMQL, theo dõi nhiều đợt) và các yêu cầu tiêu chuẩn.

Tài liệu này là căn cứ nghiệp vụ cho giai đoạn 2 trở đi. Quyết định ở mục 4
(mã **N-xx**) chỉ đổi khi SOP của khoa quy định khác; khi đổi phải ghi lại tại
đây. Đây không phải chứng nhận phù hợp ISO 15189: các giá trị chờ SOP ở mục 6
vẫn cần phòng xét nghiệm phê duyệt.

## 1. Căn cứ

| Nguồn | Nội dung dùng |
| --- | --- |
| ISO 15189:2022 mục 7.3.7.3 (theo bảng đánh giá SADCAS F134(e), 2024) | Thủ tục tham gia; chương trình phù hợp, mẫu giống mẫu bệnh nhân, nhà cung cấp theo ISO/IEC 17043; mẫu ngoại kiểm do người thường làm xét nghiệm thực hiện; xem xét định kỳ theo tiêu chí chấp nhận định sẵn, đủ sớm để phản ánh hiệu năng hiện tại; hành động khắc phục khi ngoài tiêu chí **kèm đánh giá ý nghĩa lâm sàng với mẫu bệnh nhân**; khi có ý nghĩa thì rà soát kết quả bệnh nhân và báo người sử dụng; phương pháp thay thế khi không có ngoại kiểm, có lý do và bằng chứng hiệu quả; kế hoạch hoạt động phủ mọi xét nghiệm |
| ISO 13528:2022 mục 9.4.2 (theo tờ hướng dẫn Eurachem "Understanding PT performance assessment", 2024) | \|z\| ≤ 2,0 chấp nhận; 2,0 < \|z\| < 3,0 cảnh báo; \|z\| ≥ 3,0 không chấp nhận. Khi u(x_pt) > 0,3·σ_pt dùng z′ = (x − x_pt) / √(σ_pt² + u²(x_pt)) |
| Eurachem "How to investigate poor performance in proficiency testing", ấn bản 2, 2022 | Mọi kết quả không đạt phải điều tra và ghi lại việc xem xét nguyên nhân, kể cả khi quyết định không hành động; PXN tự đặt tiêu chí điều tra cho kết quả cảnh báo và xu hướng; trước hết xem báo cáo có giải thích không; các bước: dữ liệu thô, nội kiểm, xu hướng các đợt trước, hiệu năng chung của các đơn vị trong đợt → kế hoạch khắc phục **và hệ quả với kết quả đã trả** → thực hiện, ghi lại → kiểm hiệu lực; ba nhóm nguyên nhân: lỗi hành chính, lỗi kỹ thuật, vấn đề của chương trình/mẫu ngoại kiểm; công cụ xương cá, 5 Whys |
| RSC Analytical Methods Committee, Technical Brief 16 | Biểu đồ z nhiều đợt và điểm J cộng dồn để theo dõi chuỗi; RSZ có thể che hai z lớn trái dấu triệt tiêu nhau, cần thận trọng với chỉ số tổng hợp |
| CLIA 42 CFR 493 (vd. 493.841(f), 493.837(f); theo các biên bản CMS-2567) | Không đạt cùng một xét nghiệm ở 2 đợt liên tiếp hoặc 2 trong 3 đợt liên tiếp là "không thành công"; một đợt đạt khi ≥ 80% mẫu đạt. Quy định Hoa Kỳ, dùng làm tham chiếu, không bắt buộc ở Việt Nam |
| Thông tư 01/2013/TT-BYT, sửa đổi bởi Thông tư 25/2026/TT-BYT (hiệu lực 15/8/2026) | Khoản 5 Điều 5 sau sửa đổi: **khuyến khích** tham gia chương trình ngoại kiểm theo chuyên ngành (theo phân công kiểm chuẩn của Bộ Y tế) và chương trình quốc tế được công nhận. Đọc từ bản PDF có chữ ký trên datafiles.chinhphu.vn (lớp chữ để trống số hiệu); đối chiếu bản Công báo khi trích dẫn chính thức |

Không đọc được nguyên văn ISO 15189, ISO 13528 và CLSI QMS24 (tài liệu có bản
quyền); các điểm trên lấy qua tài liệu đánh giá và tờ hướng dẫn công khai nêu
ở cột "Nguồn".

## 2. Kết luận rà soát

**Khung chung đúng hướng.** Lấy số liệu thẳng từ báo cáo nhà cung cấp, xếp
loại theo ISO 13528, đánh giá chính thức theo z của nhà cung cấp, đối chiếu z
tính lại, ánh xạ vào danh mục xét nghiệm, lưu phiên bản và lịch sử đều phù
hợp. Công cụ HTML cũ có trình tự điều tra đúng (lỗi hành chính trước, xương
cá, 5 Whys, trạng thái từng nguyên nhân).

**Thiếu so với yêu cầu** (app hiện tại = A, công cụ HTML = H):

| Mã | Phát hiện | A | H |
| --- | --- | --- | --- |
| R-01 | Chưa có bước **xem xét đợt** có người có thẩm quyền, thời hạn, kết luận và truyền đạt cho nhân viên (ISO 15189 7.3.7.3) | Thiếu | Phiếu BMQL ghi tay, không xác thực người ký |
| R-02 | Kết quả không chấp nhận **chưa dẫn tới điều tra và đánh giá ảnh hưởng bệnh nhân** có cấu trúc | Thiếu | Ô ghi chữ trong phiếu sự cố |
| R-03 | Hành động khắc phục không theo dõi hoàn thành, hiệu lực, duyệt độc lập | Thiếu liên kết NCE | Chỉ "Số CAR" |
| R-04 | Không kiểm **độ không đảm bảo của giá trị ấn định**: nhóm so sánh nhỏ làm z kém tin cậy (u(x_pt) > 0,3·σ_pt) | Thiếu | Chỉ cảnh báo "N nhóm nhỏ" theo ngưỡng tự đặt |
| R-05 | **"PT score" = % kết quả chấp nhận của cả đợt** không phải chỉ số chuẩn; ngưỡng 70% không có căn cứ. Chuẩn đánh giá theo từng xét nghiệm qua các đợt (không thành công liên tiếp) | Đang dùng | Đang dùng |
| R-06 | Theo dõi xu hướng: H dùng 6 quy tắc + J + RSZ + SSZ cho ~90 chuỗi nên báo động giả nhiều; RSZ có thể che z trái dấu; một \|z\| ≥ 3 bị gán "ngẫu nhiên"; quy tắc 5 không dùng | Thiếu | Có nhưng chưa chặt |
| R-07 | Điều tra H **chấm điểm 0–3** với ngưỡng tự đặt như kết luận; suy "nội kiểm chưa đủ nhạy" khi nội kiểm đạt; thiếu nhóm nguyên nhân từ chương trình/mẫu và kết luận "không xác định được nguyên nhân" | — | Có |
| R-08 | Chưa xét **hiệu năng chung của các đơn vị trong đợt** (N, %CV, số KQ loại của nhóm) — Eurachem nêu là bước 1 của điều tra; báo cáo PDF đã có số liệu này | Lưu nhưng chưa dùng | Không |
| R-09 | Chưa có **bao phủ ngoại kiểm**: xét nghiệm đang hoạt động nào không có ngoại kiểm và phương pháp thay thế | Thiếu | Thiếu |
| R-10 | Chưa lưu dấu vết **file báo cáo gốc** (tên, mã băm) để truy xuất | Thiếu | — |
| R-11 | Bias cho Six Sigma dùng RMS các vòng nhập tay (E-09 chưa chốt) | Chưa nối | — |

## 3. Quy trình nghiệp vụ chuẩn

```text
Nhận báo cáo PDF ─▶ Nhập & kiểm (N-01..N-03) ─▶ Đánh giá từng kết quả (N-04, N-05)
     │                                                   │
     ▼                                                   ▼
Xem xét đợt (N-08) ◀── Theo dõi xu hướng theo xét nghiệm (N-06, N-07)
     │
     ├─ đạt, không tín hiệu ─▶ ký xem xét, truyền đạt ─▶ đóng đợt
     └─ có kết quả/tín hiệu cần điều tra (N-09)
             ▼
        Hồ sơ NCE nguồn ngoại kiểm: điều tra (N-10, N-11) ─▶ phân loại nguyên nhân
             ─▶ ảnh hưởng kết quả bệnh nhân (N-12) ─▶ hành động khắc phục
             ─▶ hiệu lực ở đợt sau + nội kiểm (N-13) ─▶ duyệt độc lập
```

## 4. Quyết định nghiệp vụ

| # | Quyết định | Căn cứ |
| --- | --- | --- |
| N-01 | **Nguồn và truy xuất.** Số liệu lấy nguyên từ báo cáo PDF của nhà cung cấp (E-11..E-14). Lưu tên file, mã báo cáo, ngày tạo file và **mã băm SHA-256** của file để chứng minh số liệu đến từ báo cáo nào; không lưu số đã sửa tay | ISO 15189 8.4 (kiểm soát hồ sơ); R-10 |
| N-02 | **Báo cáo đủ thông tin tối thiểu** mới được ghi: đơn vị, chương trình, đợt, thông số, kết quả, giá trị ấn định và cách lập (nhóm so sánh), σ_pt, đánh giá. Thiếu thì chặn hoặc ghi rõ phần thiếu | SADCAS TR 08 (nội dung tối thiểu của báo cáo ngoại kiểm) |
| N-03 | **Đối chiếu nội bộ báo cáo**: trang chi tiết khớp trang tổng hợp; z tính lại khớp z báo cáo (sai lệch ≤ 0,02); ngược dấu hoặc lệch là lỗi chặn/cảnh báo như hiện có | Đã làm (E-03, E-12, E-14) |
| N-04 | **Đánh giá chính thức từng kết quả theo điểm của nhà cung cấp**, ngưỡng ISO 13528 9.4.2: \|z\| ≤ 2,0 chấp nhận; 2,0 < \|z\| < 3,0 cảnh báo; \|z\| ≥ 3,0 không chấp nhận | ISO 13528:2022 9.4.2; ISO 15189 7.3.7.3 (tiêu chí chấp nhận định sẵn) |
| N-05 | **Độ tin cậy của giá trị ấn định.** Từ N và SD của nhóm làm giá trị ấn định, ước lượng u(x_pt) ≈ 1,25·SD/√N (trung bình bền vững). Nếu u(x_pt) > 0,3·σ_pt: gắn cờ "giá trị ấn định kém chắc chắn", hiện thêm z′ để tham khảo, **không đổi đánh giá chính thức**; cờ này là căn cứ khi điều tra (nhóm chương trình/mẫu). Ngoài ra hiện % lệch so với TEa của xét nghiệm trong danh mục làm thông tin nội bộ, không thay tiêu chí nhà cung cấp | ISO 13528 (z′), Eurachem 2024; R-04 |
| N-06 | **Đánh giá theo xét nghiệm qua các đợt** thay cho "PT score": một xét nghiệm "**không thành công**" khi không chấp nhận ở 2 đợt liên tiếp hoặc 2 trong 3 đợt gần nhất. % kết quả chấp nhận của đợt/máy chỉ là chỉ số tổng hợp, đổi tên "Tỷ lệ chấp nhận", bỏ ngưỡng 70% | CLIA 493 (tham chiếu); R-05 |
| N-07 | **Theo dõi xu hướng** theo từng xét nghiệm (cùng máy), chuỗi z theo năm–đợt–mẫu: (a) biểu đồ z với giới hạn ±2/±3; (b) tín hiệu: \|z\| ≥ 3; 2 trong 3 đợt liên tiếp \|z\| > 2 cùng dấu; 6 đợt liên tiếp cùng dấu (lệch hệ thống kéo dài); (c) điểm J cộng dồn theo đợt (0/2/4/8 theo \|z\| < 1/< 2/< 3/≥ 3 của mẫu lệch xa nhất trong đợt, đổi dấu thì đặt lại, báo khi \|J\| ≥ 8; chốt 17/11/2026 để nhiều mẫu lệch nhẹ trong một đợt không tự đạt ngưỡng). Cần ≥ 6 đợt mới kết luận về xu hướng. **Không dùng RSZ/SSZ làm tiêu chí**. Tín hiệu là "cần xem xét", không tự gán kiểu sai số; một \|z\| ≥ 3 đơn lẻ là "cần điều tra" | RSC AMC TB16; Eurachem 2022 (xu hướng); R-06 |
| N-08 | **Xem xét đợt** là quyết định append-only của người có thẩm quyền (lấy từ phiên): kết luận sơ khởi (theo báo cáo) và kết luận phân tích (sau xu hướng/điều tra), trong hạn N ngày từ ngày nhận báo cáo; ghi việc truyền đạt cho nhân viên. Đợt đã xem xét khoá sửa; nhập lại tạo phiên bản mới và mở lại xem xét. Phiếu BMQL 14-01-24 dựng từ dữ liệu này | ISO 15189 7.3.7.3; R-01; E-07, E-08 |
| N-09 | **Ngưỡng bắt buộc điều tra** (lập hồ sơ NCE nguồn ngoại kiểm): mọi kết quả không chấp nhận; xét nghiệm "không thành công" (N-06); tín hiệu xu hướng N-07(b)(c). **Cảnh báo đơn lẻ**: bắt buộc ghi nhận khi xem xét đợt (đã xem, lý do không điều tra), chưa bắt buộc hồ sơ | Eurachem 2022 (mọi kết quả không đạt phải điều tra; PXN tự đặt tiêu chí cho cảnh báo, xu hướng); R-02 |
| N-10 | **Các bước điều tra** trong hồ sơ NCE nguồn ngoại kiểm: (1) báo cáo có giải thích của nhà cung cấp không; (2) **lỗi hành chính**: kết quả gửi so với kết quả trên máy/LIS, đơn vị, dấu thập phân, nhầm mẫu/đợt, khai báo nhóm, hệ số pha loãng; (3) **dữ liệu và nội kiểm**: nội kiểm quanh ngày chạy mẫu (lấy từ dữ liệu QC của app), xu hướng N-07, hiệu năng chung của nhóm so sánh trong đợt (N, %CV, số KQ loại, cờ N-05); (4) **kỹ thuật**: 6 nhóm xương cá (con người, phương pháp, thiết bị, mẫu/vật liệu, môi trường, đo lường–nội kiểm), chạy lại mẫu lưu nếu còn ổn định; (5) **chương trình/mẫu ngoại kiểm**: nhóm so sánh không phù hợp, giá trị ấn định kém chắc chắn, mẫu không tương đương mẫu bệnh nhân, vận chuyển/bảo quản; trao đổi với nhà cung cấp. Mỗi nguyên nhân có trạng thái Chưa kiểm / Đã loại trừ / Nghi ngờ / Nguyên nhân gốc kèm bằng chứng; có 5 Whys. Danh mục trong app (chốt 17/11/2026) đi đúng thứ tự trên với 11 mục: báo cáo nhà cung cấp; lỗi hành chính; dữ liệu và nội kiểm; người thực hiện; phương pháp; máy phân tích; hoá chất và calibrator; xử lý mẫu ngoại kiểm (gồm chạy lại mẫu lưu); môi trường; chương trình/mẫu; 5 Whys | Eurachem 2022; CLSI QMS24 (nhóm nguyên nhân); R-07, R-08 |
| N-11 | **Kết luận phân loại nguyên nhân** (bắt buộc trước khi đóng): Lỗi hành chính / Lỗi kỹ thuật / Vấn đề chương trình–mẫu ngoại kiểm / **Không xác định được nguyên nhân** (kèm kế hoạch theo dõi). Gợi ý tự động chỉ là "căn cứ cần kiểm" kèm số liệu, **không chấm điểm, không xếp hạng** | Eurachem 2022 (3 nhóm); NCE D-06 (nguyên nhân chưa xác định ép CAPA); R-07 |
| N-12 | **Ảnh hưởng kết quả bệnh nhân**: bắt buộc quyết định có cấu trúc (dùng quyết định ảnh hưởng của NCE: phạm vi, số kết quả rà soát, kết luận, người có thẩm quyền nce.release). Lỗi kỹ thuật → phạm vi rà soát từ đợt ngoại kiểm đạt gần nhất và đối chiếu nội kiểm cùng giai đoạn; lỗi hành chính chỉ ở khâu ngoại kiểm hoặc vấn đề chương trình → được kết luận "không ảnh hưởng" kèm lý do. Có ý nghĩa lâm sàng thì rà soát kết quả và thông báo người sử dụng | ISO 15189 7.3.7.3 (theo SADCAS); Eurachem 2022 ví dụ 1; NCE D-19, D-21 |
| N-13 | **Hiệu lực**: tiêu chí đặt trước khi đánh giá; tối thiểu kết quả đạt ở đợt ngoại kiểm kế tiếp của xét nghiệm đó và không có tín hiệu nội kiểm tương ứng; duyệt độc lập theo NCE | Eurachem 2022 bước 4; ISO 15189 8.7 |
| N-14 | **Bao phủ ngoại kiểm**: báo cáo xét nghiệm đang hoạt động không có kết quả ngoại kiểm trong 12 tháng; với từng xét nghiệm đó ghi phương pháp thay thế (so sánh liên phòng, mẫu chia đôi, mẫu đã biết giá trị), lý do và kết quả | ISO 15189 7.3.7.3; SADCAS TR 08 (kế hoạch phủ mọi xét nghiệm); R-09 |
| N-15 | **Bias cho Six Sigma**: lấy từ kết quả ngoại kiểm cùng xét nghiệm trong kỳ Sigma, loại kết quả mà điều tra kết luận lỗi hành chính hoặc vấn đề chương trình. Cách gộp (trung bình có dấu cho Sigma; RMS chỉ cho ngân sách MU theo Nordtest) và chọn mẫu theo nồng độ phải chốt trong một đợt `SIGMA-REVIEW` trước khi làm | E-09; R-11 |
| N-16 | **Một đợt = một lần phân phối mẫu được chấm điểm riêng.** VEQAS: một đợt (ĐỢT nn) có thể gồm nhiều mẫu. RIQAS: mỗi SAMPLE của một CYCLE là một đợt ("CYCLE 23 SAMPLE 7", số thứ tự = cycle×100 + sample để sample cuối cycle vắt sang năm sau vẫn xếp trước cycle kế tiếp). Bản trước lấy CYCLE làm kỳ nên sample sau ghi đè sample trước của cùng máy và luật xu hướng N-07 đếm cả cycle là một đợt. Schema 11 đổi tên kỳ RIQAS cũ chỉ có một sample; kỳ đã lẫn nhiều sample giữ nguyên (2026-11-05) | ISO 13528 (mỗi vòng PT đánh giá riêng); RIQAS cấp báo cáo theo từng sample |

## 5. Ảnh hưởng tới kế hoạch EQA

Bổ sung 15/11/2026 theo yêu cầu vận hành của người dùng: cùng một chương
trình/đợt, máy sinh hóa và điện giải có thể có ngày chạy và hạn nộp khác nhau.
Lịch công việc vì vậy tách theo nhóm máy không giao nhau, có loại mẫu riêng
ở từng lịch (schema 14). Không thay định danh kỳ báo cáo theo N-16 hoặc cách
đánh giá kết quả. Trùng đúng máy của cùng chương trình–năm–số đợt phải sửa
lịch hiện có; đổi loại mẫu không tự tạo một công việc mới cho chính máy đó.
Dấu nộp và báo cáo hoàn thành theo đúng máy, không lan sang các lịch khác.

| Mục kế hoạch | Thay đổi theo tài liệu này |
| --- | --- |
| E-05 (chuỗi dài hạn) | Thay bằng N-07: bỏ RSZ/SSZ làm tiêu chí; bộ tín hiệu thu gọn |
| "PT score" ở giai đoạn 1 | Đổi tên "Tỷ lệ chấp nhận", bỏ ngưỡng 70% và tô đỏ theo ngưỡng (N-06) |
| Giai đoạn 2a | Thêm N-05 (u(x_pt), z′), N-06 (không thành công qua các đợt), N-07 |
| Giai đoạn 2b | Theo N-09..N-13; bổ sung bước "hiệu năng chung của nhóm trong đợt" và nhóm nguyên nhân chương trình/mẫu |
| Giai đoạn 2c | Theo N-08; thêm N-01 (mã băm file) vào bước nhập; N-14 (bao phủ) |
| Giai đoạn 3 | N-15, sau đợt `SIGMA-REVIEW` |

## 6. Chờ SOP của khoa

Các giá trị sau có mặc định tạm theo căn cứ ở mục 1, lưu ở cấu hình, sửa được
khi SOP chốt: thời hạn xem xét đợt (đề xuất 7 ngày làm việc từ ngày nhận báo
cáo); quy tắc "không thành công" (2 liên tiếp / 2 trong 3); ngưỡng J (8); số
đợt tối thiểu để kết luận xu hướng (6); cửa sổ bao phủ (12 tháng); người có
thẩm quyền xem xét đợt (đề xuất cùng quyền nce.approve); mã và phiên bản biểu
mẫu BMQL 14-01-24, 18-01-24.
