# Đánh giá tổng thể QC Lab — 09/11/2026

Phạm vi: toàn bộ `app/` ở nhánh `feat/nce-redesign` (HEAD `0990535` cộng 29 tệp
sửa và 1 tệp mới chưa commit: thanh kéo đổi độ rộng, ô chọn xét nghiệm có tìm
kiếm, bản in Westgard/Sigma có biểu đồ). Đây là đợt tiếp theo của
`docs/APP-REVIEW-2026-11-05.md`; bốn mảng — nghiệp vụ, hiệu năng, mã & bảo mật,
giao diện — được rà song song, vừa kiểm trạng thái mục cũ vừa tìm lỗi mới. Mã
mới tiếp nối số của đợt trước (N26…, P13…, A26…, U26…).

Ký hiệu cột "Kiểm": **✔** đã đọc lại mã trong đợt tổng hợp; **○** người rà mảng
xác nhận bằng đọc mã; **▶** đã chạy script thử trên `app-dist` (CSDL tạm) và thấy
đúng tình huống lỗi; **đo** = có số đo thật. **(D)** = nằm trong diff chưa commit.

Bối cảnh: app **chưa lên production**, dữ liệu là dữ liệu test.

Lệnh đã chạy: `npm test` **590/590 đạt** (36 s), `npm run typecheck` đạt,
`npm run lint` đạt (0 cảnh báo), `npm run build` đạt (cảnh báo chunk > 500 KB).
Script thử và bài đo nằm ngoài repo (thư mục nháp của phiên rà), không sửa tệp
nào trong `app/`.

| Bài đo (60 XN, `seedRealisticDataset`) | 2 năm (197k điểm) | 5 năm (493k điểm) |
|---|---|---|
| Tổng quan lần đầu · lần sau · sau đăng nhập | 1007 · 0 · 887 ms | 949 · 0 · 988 ms |
| Hàng chờ NCE (`nceQueueRows`) | 518 ms | 541 ms |
| Biên bản tháng: tháng hiện tại · tháng lô cũ lần đầu | 1378 · 6831 ms | 1485 · 14999 ms |
| Tìm chữ trong Nhật ký | 2867 ms | 4405 ms |
| Gói Firebase | **158 MB** | **313 MB** (> giới hạn 256 MB) |
| Heap sau khi duyệt lô cũ của 60 XN | +128 MB | +385 MB |

## 0. Bảng ưu tiên

| Ưu tiên | Mục | Mức | Một câu |
|---|---|---|---|
| Trước commit | A28 (D) | Cao | `ResizeHandle.tsx` chưa track nhưng đã được import → commit thiếu là vỡ build. |
| P0 | N26, N27, N28 | Cao | **Sửa dữ liệu đổi kết luận của lần chạy khác**: huỷ điểm "bằng chứng" xoá được việc loại bỏ của lần chạy sau mà không cần lý do; nhập lùi ngày đổi Đạt ↔ Loại bỏ; cả hai chạm được kỳ đã khoá. Trái D-03/GV2. **Đã sửa 09/11/2026** (xem cuối §3). |
| P0 | A26 | Cao | Phục hồi/kéo Firebase ở chế độ vận hành chỉ canh `qc_points` → xoá cứng hồ sơ NCE, khoá kỳ, biên bản tháng đã ký, lịch sử luật, EQA mới hơn bản sao lưu. **Đã sửa 09/11/2026** (xem cuối §5). |
| P0 | N19 (nâng mức) | Cao | Không có đường nào lưu đủ một đợt VEQAS nhiều mẫu: nhập mẫu thứ hai làm mất mẫu thứ nhất (và z = 3,2 biến khỏi "Cần chú ý"). |
| P0 | N29, N20 | TB | Khoá kỳ chấp nhận biên bản tháng đã cũ; ký và khoá được tháng chưa hết (cả tháng tương lai khi khoá). |
| P0 | P1, A4 | Cao | Gói Firebase đo được 313 MB ở 5 năm, vẫn đẩy `pass_hash` và `activity`. |
| P1 | A27 | TB | Phục hồi "rửa" chuỗi hash nhật ký: dòng bị sửa tay trở thành hợp lệ. **Đã sửa 09/11/2026.** |
| P1 | N15, N30, A14, A16 | TB | EQA: lịch ↔ báo cáo vẫn không khớp; cùng một báo cáo nhập được vào hai đợt → đếm trùng trong xu hướng. |
| P1 | P2, P3, P13 | TB | Hàng chờ NCE 0,5 s/lần không đệm; Nhật ký tự nạp lại sau mọi thao tác ghi và mỗi lần tìm chữ 3–4 s chặn main. |
| P1 | U26, U30 | TB | Cây Nhập QC không co khi cửa sổ hẹp lại (D); trang báo "chưa có dữ liệu" cả khi đang tải hay lỗi. |
| P2 | còn lại | TB/Thấp | Xem từng mảng. |

## 1. Kết luận chung

| Mảng | 05/11 | Nay | Một câu |
|---|---|---|---|
| Nghiệp vụ | Tốt | **Khá** | Engine Westgard, Sigma, cổng nhập đúng chuẩn. Nhưng "không hồi tố" (GV2) mới khoá được *đổi luật*; *đổi dữ liệu* (huỷ điểm, nhập lùi ngày) vẫn đổi kết luận lần chạy đã có, kể cả kỳ đã khoá. EQA còn N15/N19 chặn việc dùng thật. |
| Hiệu năng | Khá | **Khá** | Không mục P nào được sửa trong đợt này. P1 đo thực tế nặng hơn dự báo. Thêm: Nhật ký kích hoạt P3 sau mọi lần ghi, LAN không nén. |
| Mã & kiến trúc | Tốt | **Tốt** | 85 handler ghi đều qua `writeCommand`, quét AST không thấy SQL ghi ngoài `commit`. A12, A13, A21, A22 đã sửa. Còn tệp chưa track (A28) và vài kẽ nhỏ. |
| Bảo mật | Khá | **Khá** | Electron/LAN/băm mật khẩu ổn. Phục hồi mới chỉ bảo vệ điểm QC (A26) và rửa chuỗi hash (A27); A4, A6 vẫn mở. |
| Giao diện & UX | Khá | **Khá** | Token chặt, không còn `var(--x)` thiếu định nghĩa, không còn hex trong CSS trang. Còn U5/U19 màu Sigma trên màn hình, trạng thái tải/lỗi ở các trang danh mục, nhãn ô nhập, và hai lỗi trong diff thanh kéo. |

## 2. Trạng thái các mục của đợt 05/11

| Trạng thái | Mục |
|---|---|
| **Đã sửa** | A12 (`settings-store.ts:89-93`) · A13 (`schema.ts:853-874` đổi cả `eqa_schedule.round_no`) · A21 (cờ + dữ liệu + nhật ký một giao dịch: `backup-handlers.ts:235-240`, `firebase-handlers.ts:226-235`) · A22 (`table-io.ts:179-191`) · U13, U15 (đã ghi 05/11) |
| **Một phần** | A19 (gộp nhật ký `table-io.ts:136-162`, nhưng xem A27) · A20 (chỉ chặn mất điểm QC `table-io.ts:89-104`, xem A26) · N14 · N25 (`pdf-report.ts:308` đã chọn nhóm theo mean; nhóm all/method vẫn bị loại, `level`/`assignedLevel` gán cứng `:317,405`) · P8 (main đã đệm; renderer vẫn tải lại 1,6–4,9 MB chuỗi lô cũ sau mỗi điểm) · A4 · A9 (cửa sổ in chưa tắt JS, chưa kiểm `senderFrame`, chưa fuses) · A11 · Q5 · Q6 · U5/U19 (bản in đã dùng chung `zone()`; màn hình còn bảng màu riêng, xem dưới) · U9 · U12 · U23 (nay lan sang 4 trang qua diff) |
| **Còn mở** | **N11** (`sigma-cohort.ts:138-139,53`) · **N13** (`reagent-stats.ts:145-146`, `biasTarget \|\| 6` nên nhập 0 cũng thành 6) · **N15** (`eqa-handlers.ts:61-66,590-592`) · **N16** (`westgard-evaluation.ts:25-31,40-42`) · **N17** — rộng hơn đã ghi: XN `active=0` và panel tắt cũng làm run bị loại biến mất (`nce-evaluation.ts:20-24,85-95`) · **N18** (`eqa-handlers.ts:209`) · **N19 — nâng lên Cao**, xem §3 · **N20** — ▶ ký tháng 11 rồi khoá luôn tháng 11 không cần xác nhận; khoá được cả 2027-03 (`monthly-review.ts:170`, `period-lock-validation.ts:20-25`) · N21–N24 · A14, A15, A16, A18, A23, A24, A25 · A6 · Q3, Q4, Q7, Q8 · kẽ hở lint ranh giới (`desktop-operations.ts:80,192` gọi thẳng `writeAudit`; `main/sync` không bị cấm import `../db`) · P1–P7, P9–P12 · U16, U17, U18, U20, U21, U22, U24, U25 · ISO 7.3.7.2 người thứ hai duyệt Mean/SD (`entry-handlers.ts:221-277`) và lô mới (`config-lot-handlers.ts:297,365-366`) · ISO 7.3.7.3 (chưa có quyết định "xem xét đợt" N-08; NCE nguồn `eqa` không gắn `eqa_results`; chưa có ca thẩm định z/chuỗi EQA trong `app/validation/`) |

## 3. Nghiệp vụ — phát hiện mới

| # | Mức | Kiểm | Phát hiện | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| N26 | **Cao** | ✔ ▶ | **Huỷ điểm "bằng chứng" ở lần chạy trước xoá được việc loại bỏ của lần chạy sau, không cần lý do** — lách cổng N4. `runRejected` chỉ xét chính điểm và lần chạy của nó. Tình huống: M1 04/10 z=+2,5 (1-2s), M1 05/10 z=+2,5 → 05/10 bị loại 2-2s. Huỷ điểm 04/10 loại "Nhập sai dữ liệu", lý do rỗng → `ok`; 05/10 thành chấp nhận, hàng chờ NCE 1 → 0, biên bản tháng `rejected_runs` 1 → 0, không còn bằng chứng ngoài một dòng "Huỷ điểm QC". Chiều ngược lại: huỷ một điểm có thể nối thành chuỗi 4-1s/10x mới, biến lần chạy đã trả kết quả thành bị loại. Căn cứ: ISO 15189:2022 7.3.7.2, 8.4; D-03. | `ipc/entry-handlers.ts:415-421`; `domain/entry-validation.ts:99-103,112-114` | Trong `voidPoint` đánh giá lại chuỗi khi bỏ điểm; lần chạy nào đổi trạng thái loại/không loại thì coi như `runRejected` (đòi lý do ≥ 10 ký tự), ghi danh sách lần chạy bị ảnh hưởng vào `void_rejection_json` và nhật ký, chặn nếu lần chạy đó thuộc kỳ đã khoá. |
| N27 | **Cao** | ○ ▶ | **Nhập lùi ngày đổi kết luận của lần chạy đã có, theo cả hai chiều, không cảnh báo.** 06/10 đang "Cảnh báo 1-2s"; nhập lùi 05/10 z=+2,5 → 06/10 thành Loại bỏ 2-2s, phản hồi chỉ báo "warn" cho điểm mới. Ngược lại: 07/10 đang bị loại 2-2s, nhập lùi 06/10 z=0 → 07/10 thành Đạt, hàng chờ NCE 1 → 0. GV2 ghi "không lần chạy đã có nào đổi kết luận, nên kỳ đã khoá không bị chạm" — chỉ đúng với đổi luật. | `ipc/entry-handlers.ts:303-381`; `docs/APP-REMEDIATION-PLAN-2026-10-31.md:104-105` | So kết luận trước/sau như N26; lần chạy đã có bị đổi kết luận → đòi lý do, ghi nhật ký, báo trên giao diện; chặn nếu thuộc kỳ đã khoá. |
| N28 | **Cao** | ○ ▶ | **Kỳ đã khoá không đóng băng kết luận.** Khoá 09 và 10, mở khoá 09, huỷ điểm 30/09 → số liệu tháng 10 (vẫn khoá) đổi `rejected_runs` 1 → 0. Hệ quả chung của N26/N27 qua ranh giới tháng. | `ipc/entry-handlers.ts`; `domain/period-lock-validation.ts` | Khi ghi ở kỳ mở, kiểm các lần chạy đổi kết luận ở kỳ đã khoá kế tiếp (chuỗi Westgard chạy qua ranh giới tháng) và chặn. |
| N29 | TB | ○ ▶ | **Cổng khoá kỳ chấp nhận biên bản tháng đã cũ.** Ký tháng 10 lúc n=6; huỷ 1 điểm, thêm 4 điểm (n=9); khoá tháng 10 thành công không cần xác nhận. `hasReview` chỉ kiểm có dòng chữ ký. | `ipc/report-handlers.ts:70,79,206` | Lưu dấu vân tay số liệu lúc ký; số liệu đổi → "biên bản cần ký lại". Gộp với N20: chỉ cho ký/khoá tháng đã kết thúc. |
| N30 | TB | ○ ▶ | **Cùng một báo cáo EQA nhập được vào đợt khác → đếm trùng trong chuỗi xu hướng.** Đợt nhận diện theo (chương trình, năm, tên đợt) và năm sửa được. Nhập lại "ĐỢT 09" với năm 2027 → 2 đợt, mẫu z = 3,2 tính hai lần. Với VEQAS, năm lấy theo ngày tạo PDF: ĐỢT 12/2026 tạo tháng 1/2027 gán năm 2027; khi ĐỢT 12/2027 thật được nhập thì bị coi là "nhập lại" và thay kết quả của đợt khác. `report_code` có lưu nhưng không dùng và bị tệp sau ghi đè. | `ipc/eqa-handlers.ts:75-79,169-175`; `EqaImportModal.tsx:151` | Lưu `report_code`/mã băm tệp theo (đợt, máy), chặn nếu đã có ở đợt khác; cảnh báo khi đợt số lớn mà PDF tạo đầu năm. |
| N31 | TB | ○ ▶ | **Huỷ điểm lô cũ thuộc lần chạy bị loại theo luật liên mức không cần lý do, không lưu bằng chứng.** Nhánh dự phòng chỉ chạy `rules.within`. R4s (M1 +2,5 / M2 −2,5), đổi lô vận hành, huỷ điểm M2 lý do rỗng → `ok`, `void_rejection_json=''`. (Script mô phỏng đổi lô bằng sửa `qc_lot_id`; cùng nhánh mã.) | `ipc/entry-handlers.ts:401-409,413-414` | Dùng `previousLotsOf(db, testId).blocks[].analysis.points` (đã có `runRejectedBy`). |
| N32 | Thấp | ○ | u(x_pt) RIQAS tính 1,25·SDPA/√N thay vì cột U_m in trên báo cáo (fixture Chloride: 0,45 vs 0,52). Nhóm N nhỏ thì cờ "giá trị ấn định kém chắc chắn" và z′ lệch. | `domain/eqa/pdf-report.ts:301`; `series.ts:163-166` | Lưu `peer.u` từ U_m và ưu tiên dùng. |
| N33 | Thấp | ○ | Sửa năm/đợt/chương trình của dòng lịch đã nộp → dấu "đã nộp" đi theo sang đợt khác, audit chỉ ghi giá trị mới (cùng gốc N22). | `ipc/eqa-handlers.ts:577-598` | Khoá các khoá nối khi đã có máy nộp, hoặc đòi lý do và ghi cũ → mới. |
| N34 | Thấp | ✔ | PDF Westgard in câu "Kết luận được đánh giá theo cấu hình luật hiện tại" — sai từ GV2 (theo phiên bản lúc nhập lần chạy). Hồ sơ nói sai căn cứ. | `pages/WestgardPage.tsx:181` | Sửa câu: "theo cấu hình luật hiệu lực lúc nhập từng lần chạy". (Đổi chữ trên bản in — hỏi người dùng.) |
| N35 | Thấp | ○ nghi vấn | Đổi số lô ghi đè `qc_points.lot` cả trong kỳ đã khoá (xem trước chỉ đếm `lockedCount`). Snapshot NCE lưu tên lô cũ → `referenceSets` truy theo tên cũ có thể ra rỗng. | `ipc/config-lot-handlers.ts:139-141,180-183`; `db/nce-evaluation.ts:39` | Chặn ở kỳ khoá hoặc truy theo `qc_lot_id`. |

**N19 (nâng Cao, ▶):** nhập mẫu 09-01 (z = 3,2) rồi 09-02 cùng máy → 09-01 biến
khỏi phiên bản hiện hành, chuỗi z và "Cần chú ý". Renderer lại chặn hai tệp cùng
máy trong một đợt (`EqaImportModal.tsx:91,166`) trong khi VEQAS phát hành mỗi mẫu
một tệp → không có đường nào lưu đủ một đợt nhiều mẫu. Sửa: thay theo khoá (máy,
mẫu) thay vì theo máy (`eqa-handlers.ts:181-189`); cho nhiều tệp cùng máy khác mẫu.

**N26–N28 đã sửa 09/11/2026.** `addPoint` và `voidPoint` dựng kết luận theo lần
chạy của tập đang vận hành trước khi ghi, rồi dựng lại trong cùng giao dịch sau
khi ghi (`domain/run-conclusion-change.ts`). Lần chạy của chính điểm được bỏ qua,
vì nhập dần từng mức là bình thường. Với các lần chạy khác đổi kết luận:
- Lần chạy thuộc kỳ đã khoá: chặn hẳn (`retro-locked`), kể cả khi chỉ đổi luật.
  Kỳ đã khoá giờ bất biến với cả thay đổi dữ liệu, không chỉ thay đổi luật như câu
  "Không chặn theo kỳ đã khoá" của GV2.
- Lần chạy ở kỳ đang mở mà đổi trạng thái loại bỏ: cần lý do ≥ 10 ký tự.
  - Huỷ điểm trả `reason-required-retro`; hộp thoại huỷ báo lỗi ngay trong ô lý do.
  - Nhập điểm trả `retro-reason-required`; trang Nhập QC mở hộp thoại hỏi lý do
    rồi gửi lại. LIS không có ô lý do nên nhận lỗi, người dùng nhập tay.
- Mọi lần chạy đổi kết luận (kể cả Đạt ↔ Cảnh báo) được ghi vào nhật ký, trả về
  trong `retroChanges` và hiện ở dòng thông báo dưới bảng nhập.
- Điểm huỷ làm đổi trạng thái loại bỏ của lần chạy khác giữ `affectedRuns` trong
  `void_rejection_json`, nên biên bản tháng vẫn đếm nó là "huỷ điểm thuộc lần chạy
  bị loại".

Phạm vi: chỉ tập đang vận hành. Lô song song được đánh giá riêng; N31 (lô cũ) vẫn
mở. Test: `app/tests/retro-run-conclusion.test.mjs`.

Ghi chú: nhập nhiều đợt mỗi đợt một giao dịch, cả lô không nguyên tử — chấp nhận
được vì đã theo dõi `done`/`failed` và khoá "Quay lại". RIQAS "mỗi sample một đợt"
không gây đếm trùng; đếm trùng chỉ qua A16 và N30.

## 4. Hiệu năng

Trạng thái P1–P12: xem §2 (chỉ P8 một phần, còn lại mở). Số đo mới: P1 158/313 MB;
P2 0,45–0,54 s/lần, lần hai không nhanh hơn; P3 2,9/4,4 s; P4 6,8/15,0 s lần đầu;
P5 +128/+385 MB; P7 và P10 làm lần đọc Tổng quan sau đó mất 0,9–1 s; P9 vẫn
`SCAN … + TEMP B-TREE`; P11 `index-*.js` 976 KB (276 KB gzip), CSS 245 KB.
Cách sửa P2 rẻ nhất: `nceRejectedPoints` dùng lại `activeEvaluationOf` và đệm
kết quả theo XN trong `TestSummaryCache`.

| # | Mức | Kiểm | Phát hiện | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| P13 | TB | ✔ | **Nhật ký tự nạp lại sau MỌI thao tác ghi** — nghe `activity`, mà mọi lần ghi ở mọi máy đều đổi bảng này. Khi ô tìm còn chữ, mỗi điểm QC nhập ở bất kỳ máy trạm nào làm main lọc lại 2,9–4,4 s; LAN đứng theo. Đây là cách P3 bị kích hoạt mà không cần gõ. | `pages/AuditPage.tsx:56` | Gộp lời báo ~2 s; chỉ nạp lại khi ở trang 1 và không lọc chữ (hoặc hiện "Có dòng mới — tải lại"). |
| P14 | TB | ○ đo cỡ | **Máy chủ LAN không nén**, RPC trả JSON thô: mỗi điểm nhập kéo ~5,8 MB (5 năm) về mỗi máy trạm đang mở XN đó. `/assets/*` đã có hash trong tên nhưng chỉ cache 1 giờ, không ETag. | `lan/http-server.ts:63-66,169` | gzip/br bất đồng bộ khi thân > 8 KB; `immutable, max-age=31536000` cho `/assets/*`. |
| P15 | TB | ○ đo cỡ | Nạp lại Nhập QC tốn ~12 IPC, mỗi mức gọi cả `queryPoints` (186 KB) lẫn `analyzeLevel` (119 KB) cho cùng tập điểm. | `store/entry-store.ts:52-58`; `pages/EntryPage.tsx:120-126` | Một endpoint `loadEntryTest`; bỏ chuỗi lô cũ khi lời báo không chạm lô cũ (gộp với P8). |
| P16 | TB | ○ đo | `EntrySheet` quét toàn bộ chuỗi lô cũ cho từng ngày × từng cột, mỗi lần nạp lại và đổi tháng: 5 ms (3,3k điểm) → 29 ms (9,9k điểm). | `pages/entry/EntrySheet.tsx:124,171-174` | `useMemo` một Map theo ngày cho `previousLotSeries`, `pointsByLevel`. |
| P17 | Thấp | ○ đo | `QcMultiChart` dựng lại toàn bộ trục X (Set + sort `Intl.Collator` + Map) mỗi `pointermove`, và lại lần nữa mỗi lần vẽ: 5,5 ms (3×730 điểm) → 30 ms (3×3650). | `components/QcChart.tsx:572-582,619` | `useMemo` trục ngày theo `series`, dùng chung cho vẽ và tooltip. |
| P18 (D) | Thấp | ○ | `ResizeHandle` gọi `setWidth` mỗi `pointermove`, không gom theo rAF, đọc `getBoundingClientRect` và `parentElement.clientWidth` → ép layout; ResizeObserver của mọi biểu đồ L-J (cũng nghe `window.resize`, vẽ hai lần) vẽ lại liên tục khi kéo. | `components/ResizeHandle.tsx:25`; `pages/entry/EntryTree.tsx:57-60`; `QcChart.tsx:196-198` | Gom theo rAF hoặc đặt CSS variable khi kéo, commit state ở `pointerup`. |
| P19 | Thấp | ○ đo | `nceLatestRun` lấy mọi lần chạy rồi sort JS: 47 ms/XN ở 5 năm, mỗi lần mở hồ sơ NCE. `runsByRecord` và vài chỗ EQA gom nhóm bằng `[...(get ?? []), x]` (O(n²)). | `db/nce-evaluation.ts:157-161,174`; `nce-handlers.ts:384`; `eqa-handlers.ts:380,392,404,487` | `ORDER BY date DESC, run_id DESC LIMIT n`; `push` vào mảng sẵn có. |
| P20 | Thấp | ○ đo | **Bản xem trước:** sau mỗi lần ghi (debounce 250 ms) `db.export()` toàn CSDL rồi ghi IndexedDB; `dbFileBytes` cũng `export()` chỉ để lấy cỡ. **Lệch hành vi:** sql.js đóng/mở lại kết nối khi `export()` nên `PRAGMA foreign_keys` về 0 — bản xem trước ngừng kiểm khoá ngoại sau lần ghi đầu (khoá ngoại chỉ bật một lần trong `applySchema`, `schema.ts:952`). | `browser-mock/sqlite-loader.ts:79-89`; `real-api.ts:58,61-68` | Bật lại `foreign_keys` sau mỗi `export()`; lấy cỡ bằng `page_count × page_size`. |
| P21 | Thấp | ○ EXPLAIN | `queryReport` dùng `idx_qc_points_test_run (test_id=?)` + TEMP B-TREE, quét mọi điểm của XN (~8k ở 5 năm). | `ipc/report-handlers.ts` | Chỉ mục `(test_id, date)` hoặc gộp với P9. |

Test hiệu năng vẫn chưa đo hàng chờ NCE, biên bản tháng, tìm nhật ký, cỡ gói
Firebase (đợt trước đã nêu).

## 5. Mã, kiến trúc và bảo mật — phát hiện mới

**Kiểm `writeCommand`:** 85 handler ghi trên 16 tệp `*-handlers.ts` đều đi qua
`writeCommand`/`writeCommandAsync`; quét AST không thấy INSERT/UPDATE/DELETE nằm
ngoài `w.commit()` (trực tiếp hoặc qua hàm phụ). Ngoại lệ: `bootstrapAdmin`,
`login` (có `eslint-disable` kèm lý do — chấp nhận); `logout`, `exportLogBundle`
ở `desktop-operations.ts:80,192` (tệp không mang hậu tố nên lint không bắt);
trạng thái Firebase `setStatus`/`setMeta` ghi `app_meta` ngoài commit và không báo
thay đổi (`firebase-handlers.ts:78-81,119,192,200,268-283`) — rủi ro thấp, trang
Cài đặt có thể hiện trạng thái cũ. Không có route `lan:true` nào ghi mà thiếu cổng.

| # | Mức | Kiểm | Phát hiện | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| A26 | **Cao** | ✔ ▶ | **Chế độ vận hành chỉ bảo vệ `qc_points`; phục hồi tệp hoặc kéo Firebase vẫn xoá cứng mọi hồ sơ mới hơn bản sao lưu.** ▶ sao lưu, nhập thêm một đợt EQA, bật chế độ vận hành, phục hồi → `ok:true`, `eqa_rounds` 3 → 2. Cùng cơ chế xoá `nce_records/runs/decisions/actions/cuts` (mất `nce_cuts` → chuỗi Westgard không cắt lại, kết luận sau rerun đổi hồi tố, kể cả kỳ khoá), `period_locks` (tháng đã khoá tự mở), `qc_month_reviews` (biên bản đã ký), `rule_config_history`, `tea_ref_versions`. | `db/table-io.ts:89-104,185`; `ipc/backup-handlers.ts:217-220`; `ipc/firebase-handlers.ts:219-222` | Mở rộng phép "dòng sẽ mất" sang mọi bảng hồ sơ/chỉ-ghi-thêm (theo `id` và `row_version`/`status`); hoặc ở chế độ vận hành chỉ cho phục hồi khi nguồn là tập bao trùm dữ liệu hiện có. |
| A27 | TB | ✔ ▶ | **Phục hồi "rửa" chuỗi hash nhật ký.** Dòng nhật ký cục bộ được nối thêm được tính lại `prev_hash`/`hash` mà không kiểm chuỗi trước; bản sao lưu cũng không được kiểm chuỗi khi `inspectBackupFile`. ▶ sửa tay `detail` dòng seq 4 → `verifyAuditChain` báo hỏng; phục hồi bất kỳ bản cũ → `ok:true`, dòng bị sửa vẫn còn. | `db/table-io.ts:140-160`; `ipc/backup-handlers.ts:66-108` | Chạy `verifyAuditChain` cho nhật ký cục bộ và nguồn trước khi gộp; hỏng thì chặn, hoặc giữ hash gốc và ghi dòng "nối lại chuỗi" nêu dòng hỏng. |
| A28 (D) | **Cao** | ✔ | **`components/ResizeHandle.tsx` chưa track nhưng đã được import** — lặp lại kiểu A17. | `pages/entry/EntryTree.tsx:5`; `pages/eqa/EqaTestDetail.tsx:7` | `git add` trong cùng commit; kiểm `git status` sạch rồi build. |
| A29 (D) | TB | ○ nghi vấn | **Bản in PDF có thể vượt giới hạn URL `data:` (~2 MB) của Chromium.** Diff nhúng PNG raster: L-J Westgard 3300×960, hai biểu đồ Sigma vẽ ×4 tới ~6400×1680; sau base64 + `encodeURIComponent`, bản Sigma nhiều kỳ/mức hoặc báo cáo 12 tháng có thể vượt → "print-failed". | `ipc/export-handlers.ts:32`; `components/QcChart.tsx` (`renderQcMultiChartPng`); `lib/sigma-print-report.ts` (`chartsSection`) | Ghi HTML ra tệp tạm rồi `loadFile`, xoá ở `finally`; thêm test đo `html.length` ca lớn. |
| A30 | TB | ✔ | **Firebase `connect` gán `config`/`session` vào bộ nhớ trước khi ghi.** `read`/`pullNow` hỏng → trả `connection-failed` nhưng phiên vẫn trong RAM, `sync` chạy được và hiện `connected:true` dù cấu hình chưa lưu. `commitConnection` xong mà `pushNow` ném → báo thất bại trong khi nhật ký đã ghi "Kết nối". | `ipc/firebase-handlers.ts:250-262` | Chỉ gán biến bộ nhớ sau commit; trạng thái riêng cho lỗi sau commit. |
| A31 | Thấp | ○ | Kênh `lis:*` mở qua LAN và chú thích nói KTV được nhận/bỏ kết quả LIS, nhưng cổng trang gắn với `settings` (`ADMIN_ONLY`) → KTV không bao giờ dùng được. `getLisSettings` qua LAN trả token LIS dạng rõ cho admin ở máy trạm. | `ipc/operations.ts:327-329`; `access-gate.ts:44`; `lis-handlers.ts:63-66` | Chốt ai được dùng LIS; không trả token qua LAN (chỉ trả "đã đặt"). |
| A32 | Thấp | ✔ | Số vòng PBKDF2 lấy từ chuỗi hash đã lưu, chỉ chặn `<= 0`: bản sao lưu chứa `pbkdf2$1e9$…` làm đăng nhập treo thread pool; `1` thì hash yếu. | `domain/password-hash.ts:29-30` | Chỉ chấp nhận khoảng 100k–5M. |
| A33 | Thấp | ✔ | Bản đóng gói vẫn nhận `QCLAB_USER_DATA_DIR`, `QCLAB_LAN_PORT` (chỉ để e2e). | `main/index.ts:41-42` | Chặn bằng `app.isPackaged` như đã làm với `QCLAB_DEV_SERVER_URL`. |
| A34 | Thấp | ○ nghi vấn | Kéo Firebase gộp tài khoản theo `username`: hai máy cùng "an" khác `id` → NCE từ đám mây trỏ `id` không tồn tại; `nceParticipantRoles` so theo `id` nên người báo cáo có thể được coi là "độc lập" khi duyệt chính hồ sơ của mình. | `domain/cloud-backup.ts:31-35` | Ánh xạ `id` đám mây → `id` cục bộ khi trùng `username`, hoặc chặn. |
| A35 (D) | Thấp | ○ | Thêm loại biểu mẫu `'eqa'` nhưng không nơi nào gọi `loadPrintIdentity('eqa')` → trang Báo cáo có dòng "Báo cáo ngoại kiểm" mà sửa không tác dụng. | `domain/report-template-validation.ts:8`; `shared/qc-api.d.ts:564` | Nối vào bản in EQA hoặc ẩn đến khi có. |
| A36 (D) | Thấp | ○ | `tests/sigma-print-report.test.mjs` dùng `module.registerHooks` và import thẳng `.ts` renderer → cần Node ≥ 22.18; CI `lts/*` không ghim (Q3). `TestPicker` `useMemo(…, [items])` tắt exhaustive-deps — đúng hôm nay vì `labelOf`/`keywordsOf` thuần. | `tests/sigma-print-report.test.mjs`; `components/TestPicker.tsx`; `.github/workflows/test.yml:18,38,52` | Ghim Node trong CI và `engines`. |
| A37 | Thấp | ○ | Mã chết/trùng: `restoreAllTablesFromFile` (`table-io.ts:216`), `ncePatientImpactLabel` (`nce/patient-impact.ts:139`), `isTerminalNceStatus` (`nce/state.ts:59`), `catalogTables` (`useCatalog.ts:33`) không ai dùng; ba hàm chuẩn hoá chữ tìm kiếm trùng nhau (`useTestSelection.ts:7`, `search-options.ts:11`, `tea-suggest.ts:16` — bản cuối không đổi `đ`→`d`); `todayIso` 4 bản (Q8). `Db.get/all` trả `any` → ~50 chỗ `as unknown as`; `lis-handlers.ts:28,41` dùng `any`. | như cột trái | Dọn khi chạm tới; gộp một `normalizeSearchText`. |

**A26, A27 đã sửa 09/11/2026.**
- **A26:** `recordsLostByRestore()` (`db/table-io.ts`) thay cho phép kiểm chỉ có
  điểm QC. Ở chế độ vận hành, phục hồi tệp và kéo Firebase bị chặn nếu nguồn
  thiếu dòng (theo `id`) của điểm QC hoặc của các bảng hồ sơ: `nce_records`,
  `nce_runs`, `nce_actions`, `nce_decisions`, `nce_revisions`, `nce_cuts`,
  `actions`, `period_locks`, `qc_month_reviews`, `rule_config_history`,
  `tea_ref_versions`, `eqa_rounds`, `eqa_results`, `eqa_decisions`.
  - `nce_records` và `eqa_rounds` còn bị chặn khi `row_version` của nguồn cũ hơn,
    ví dụ hồ sơ đã đóng ở đây mà bản sao lưu còn mở.
  - Câu từ chối liệt kê từng loại hồ sơ sẽ mất.
  - Chưa canh: bảng danh mục/cấu hình và dấu "đã nộp" theo máy
    (`eqa_schedule_instruments`, khoá ghép).
- **A27:** trước khi gộp, kiểm chuỗi hash nhật ký của máy. Từ dòng hỏng đầu tiên
  trở đi, các dòng nối thêm giữ nguyên `prev_hash`/`hash` gốc, không tính lại,
  nên kiểm tra chuỗi sau phục hồi vẫn chỉ đúng dòng bị sửa.
  - Nhật ký của nguồn vẫn chép nguyên văn.
  - Nếu một trong hai chuỗi hỏng, dòng "Phục hồi…"/"Tải dữ liệu từ Firebase" ghi
    "CẢNH BÁO" kèm số dòng.
  - Phục hồi không bị chặn, để vẫn cứu được máy có nhật ký đã bị sửa.
- **Test:** 3 ca mới trong `app/tests/audit-integrity.test.mjs`.

Độ phủ test: 144 tệp test + 2 perf + 22 e2e. Phục hồi ở chế độ vận hành và giữ
`MACHINE_LOCAL_META_KEYS` nay đã có test (`audit-integrity.test.mjs:93-249`), nhưng
chỉ cho `qc_points`. Còn thiếu: N26/N27 (huỷ hoặc nhập lùi đổi kết luận lần chạy
khác), phục hồi xoá NCE/khoá kỳ (A26), chuỗi hash sau phục hồi (A27), cỡ bản in
(A29), Firebase `connect` hỏng giữa chừng, SSE sau thu hồi phiên, ca thẩm định EQA;
phần mới trong diff (`ResizeHandle`, `renderQcMultiChartPng`, `SearchSelect` ở
Sigma/Lịch sử) chủ yếu được kiểm bằng regex trên mã nguồn; chưa có test React
tương tác.

## 6. Giao diện và UX — phát hiện mới

Đã kiểm, không có lỗi: không có `var(--x)` nào thiếu định nghĩa; CSS trang không
còn hex/rgb; `outline:none` duy nhất (`app.css:476`) có vòng focus thay thế;
không có `catch` rỗng nuốt lỗi IPC; sidebar tự thu gọn ≤ 1050px.

**U5/U19 còn lại trên màn hình:** thẻ `.sgbig` chữ trắng trên `#dd8b1f` (2,70:1)
và `#3f9a55` (3,52:1) (`pages/sigma/shared.ts:81-89`, `SigmaPanels.tsx:24`); số
Sigma tô `#dd8b1f` trên nền trắng (`SigmaPanels.tsx:56`); `SigmaCharts.tsx:8-9`,
`sigma-summary-export.ts:57-58` còn màu cứng → vẫn 3 bảng màu. Sửa cần đổi màu
trạng thái → **hỏi người dùng trước**.

| # | Mức | Kiểm | Phát hiện | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| U26 (D) | TB | ✔ | **Cây Nhập QC không co lại khi cửa sổ hẹp đi.** Kéo cây lên 480px ở màn 1920 rồi thu cửa sổ ~1100px → cây vẫn 480px vì `maxWidth:'none'` đè `max-width:min(440px,34vw)`, bảng nhập còn ~350px. EQA không bị vì dùng `clamp(…,42%)`. | `pages/entry/EntryTree.tsx:102,185-188`; `EqaTestDetail.tsx:147` | `width: clamp(280px, ${w}px, 42%)`; dồn giới hạn min/max vào `ResizeHandle`. |
| U27 (D) | TB | ✔ | **`ResizeHandle` chưa đủ cho bàn phím/trình đọc màn hình:** `aria-valuenow` trống tới lần kéo đầu (Nhập QC); `aria-valuemax=480` trong khi giới hạn thật là min(480, 42%) → ở ~1024px bấm → không tác dụng mà không rõ vì sao; chưa có Home/End; độ rộng không được lưu (ẩn/hiện cây thì có lưu). | `components/ResizeHandle.tsx:22-31`; `EntryPage.tsx:63,82` | `valuenow` từ độ rộng đo được, `valuemax` theo giới hạn hiệu lực, thêm Home/End, lưu `localStorage` như cờ ẩn cây. |
| U28 | TB | ○ | **Nút chuyển đoạn không báo mục đang chọn** cho trình đọc màn hình (chỉ lớp `.on`): Westgard vận hành/lưu trữ và L-J/CUSUM, khoảng 7–90 ngày, chọn mức Mean/SD. Chỗ khác dùng `role="tab"` mà không có `tabpanel` hay phím mũi tên. | `WestgardPage.tsx:214-216,271-274`; `entry/EntryLjPanel.tsx:49-51`; `manage/TargetsTab.tsx:186`; `EqaPage.tsx:57`; `EntryRangePanel.tsx:31`; `EqaTestDetail.tsx:179`; `EqaSchedule.tsx:209` | Thống nhất `aria-pressed` như `RangeWorkflowModal.tsx:94`. |
| U29 | TB | ○ | **Ô nhập không có nhãn gắn kèm:** tìm/lọc máy của cây (`EntryTree.tsx:109-110`); tháng/năm (`EntrySheet.tsx:98-99`); ma trận Mean/SD 4 ô số chỉ placeholder, không biết thuộc XN/mức nào (`TargetsTab.tsx:223-228`, `TransitionsTab.tsx:248-251`); cặp kết quả so sánh hoá chất (`ReagentPage.tsx:488-489`); ô tìm các tab Cấu hình (`InstrumentsTab:61`, `LotsTab:196`, `PanelsTab:84`, `TestsTab:285`, `TeaRefsTab:210`, `TransitionsTab:214`). | như cột trái | `aria-label` có ngữ cảnh, ví dụ "Mean mức 2 – Glucose". |
| U30 | TB | ○ | **Trang báo "chưa có dữ liệu" cả khi đang tải hoặc tải lỗi.** Store khởi tạo `[]`, không có cờ `loading`/`error` → mới mở trang hoặc IPC lỗi: Nhập QC hiện "Chưa có xét nghiệm" kèm nút "Thêm xét nghiệm"; Báo cáo "Chưa có xét nghiệm đang vận hành"; So sánh hoá chất "Chưa có phép so sánh nào". | `store/manage-store.ts:73,84`; `westgard-store.ts:32,40-44`; `reagent-store.ts:45-47`; `EntryPage.tsx:307-321`; `ReportPage.tsx:284`; `ReagentPage.tsx:332` | Cờ `loaded`/`error` trong `useCatalog`; "Đang tải…" và "Thử lại" như Dashboard/NCE/EQA. |
| U31 (D) | Thấp | ○ | `SearchSelect` tự mở danh sách mỗi khi nhận focus — nay ở 4 trang; Tab qua bộ lọc Báo cáo thì danh sách che nút Xuất. Chưa có Home/End; `aria-controls` trỏ phần tử chưa tồn tại khi đóng. | `components/SearchSelect.tsx:84` | Chỉ mở khi gõ, bấm chuột hoặc Alt+↓. |
| U32 (D) | Thấp | ○ | Lý do khoá ô "Nguồn TEa" nằm trong `<label>` nhưng `aria-label="Nguồn TEa"` đè mất → trình đọc màn hình không đọc lý do. | `pages/SigmaPage.tsx:362-363` | Bỏ `aria-label` hoặc dùng `aria-describedby`. |
| U33 (D) | Thấp | ○ | Chú thích cột biên bản tháng chỉ còn ở `title` — bàn phím/cảm ứng không xem được, không có dấu hiệu cột nào có chú thích. Không đề xuất đưa đoạn chú thích cũ trở lại. | `report/MonthlyReviewPanel.tsx:93` | Dấu ⓘ hoặc gạch chân chấm — **hỏi người dùng** (thay đổi hiển thị). |
| U34 | Thấp | ○ | Tương phản thấp trong biểu đồ: `#7b838e` trên trắng ~3,8:1 cho "Chưa có dữ liệu" 14px; `#70818d` ~4,0:1 cho nhãn trục 10,5px. | `QcChart.tsx:472,656,733,815`; `SigmaCharts.tsx:63,77,126-127` | SigmaCharts là SVG nên dùng thẳng `var(--text-…)`. |
| U35 | Thấp | ○ | Canvas L-J tổng hợp và CUSUM thiếu `role="img"`/`aria-label` (biểu đồ đơn đã có ở `:272`). Ma trận Sigma: hàng `role="row"` chứa `<span>` không có `columnheader`; ma trận Mean/SD và bảng cặp hoá chất là lưới `div` không vai trò bảng. | `QcChart.tsx:595,783`; `SigmaPage.tsx:432` | Bổ sung vai trò ARIA. |
| U36 | Thấp | ○ | Biểu tượng lịch là `<span onClick>` không dùng được bằng bàn phím (vẫn gõ ngày tay được). Lỗi Nhật ký hiện bằng `<p>` không `role="alert"` và cùng lúc hiện "Không có dữ liệu phù hợp". | `components/DateField.tsx:85`; `AuditPage.tsx:75,126` | `<button aria-label="Chọn ngày">`; ẩn câu rỗng khi có lỗi. |
| U37 | Thấp | ○ | Ngoài tầm test design system (chỉ quét CSS): `style={{ margin:'10px 12px 18px' }}` (`WestgardPage.tsx:254`); `<label>&nbsp;</label>` làm khoảng đệm (`:228`); palette hex riêng ở `ReagentChart.tsx:12-17`; 3 token không dùng `--gray-0`, `--icon-lg`, `--shadow-panel-hover` (`tokens.css:38,170,308`). | như cột trái | Mở rộng test quét `style={{…}}` trong `.tsx`. |

## 7. Điểm mạnh

- **Engine Westgard đúng chuẩn:** R4s chỉ trong một lần chạy; 2-2s trong và giữa
  các lần chạy, chuỗi liên mức loại 2-2s; chuỗi đếm cắt tại mốc đổi Mean/SD và mốc
  NCE; 1-3s/1-2s dùng `>` khớp cổng cohort Sigma. Không hồi tố khi đổi luật (GV2)
  gắn theo `entry_seq`, mọi mức của một lần chạy cùng phiên bản.
- **Six Sigma đúng công thức:** σ = (TEa − |Bias|)/CV, trả null khi thiếu dữ liệu
  (không ngầm Bias = 0); bảng Westgard Sigma Rules 2/3 mức đúng; main tự dựng lại
  cohort; TEa chụp theo mức. Lập dải PXN đòi ≥ 20 điểm trên ≥ 20 ngày, bỏ lần chạy
  bị loại (CLSI C24).
- **EQA:** main tính lại từ dữ liệu thô; z ngược dấu và trang chi tiết lệch trang
  tổng hợp là lỗi chặn; ngưỡng |z| so trên z làm tròn như báo cáo; xu hướng tách
  chương trình, đếm theo đợt; kết quả có phiên bản, `eqa_decisions` chỉ ghi thêm.
- **Phục hồi** đã kiểm tệp lại ngay trước khi ghi, chụp bản an toàn, migration +
  kiểm khoá ngoại trong cùng giao dịch, giữ cờ vận hành, khoá riêng của máy và
  nhật ký mới hơn.
- **Kiến trúc ghi:** 85 handler qua `writeCommand`, test khoá danh sách cổng ghi và
  quy tắc LAN/admin. Electron `contextIsolation` + `sandbox`, CSP `default-src
  'self'`, `openExternal` chỉ `https:`, LAN cookie chặt + chặn dò mật khẩu, PBKDF2
  600k vòng + `timingSafeEqual`.
- **Giao diện:** token ba lớp có ~40 quy tắc test canh (tương phản AA, thang khoảng
  cách, z-index, focus ring); L-J phân biệt bằng hình điểm chứ không chỉ màu, đi
  qua điểm bằng phím mũi tên; `SearchSelect` đúng mẫu combobox; trạng thái lỗi có
  "Thử lại" ở Dashboard/NCE/Hồ sơ/EQA.

## 8. Lộ trình đề xuất

**Trước khi commit lô hiện tại**

1. A28 `git add app/renderer/components/ResizeHandle.tsx`.
2. U26, U27 sửa thanh kéo (clamp theo cửa sổ, ARIA đúng giới hạn, lưu độ rộng);
   P18 gom theo rAF.
3. A29 chuyển in PDF sang tệp tạm (hoặc ít nhất đo `html.length` ca lớn).

**P0 — trước khi chạy thật**

4. N26, N27, N28, N31 — "không hồi tố" cho thay đổi dữ liệu: khi huỷ/nhập lùi,
   so kết luận các lần chạy khác trước/sau; đổi thì đòi lý do, lưu bằng chứng, chặn
   nếu chạm kỳ đã khoá. **N26–N28 đã sửa 09/11/2026**; còn N31 (lô cũ) và ca
   thẩm định trong `app/validation/`.
5. A26, A27 — phục hồi ở chế độ vận hành bảo vệ mọi bảng hồ sơ; kiểm chuỗi hash
   trước khi gộp nhật ký. **Đã sửa 09/11/2026.**
6. N19, N30, N15, A14, A16 — EQA: thay kết quả theo (máy, mẫu); chống nhập trùng
   theo `report_code`/mã băm; gắn chương trình khi nhập, khớp năm theo cycle.
7. N20, N29 — chỉ ký/khoá tháng đã kết thúc; biên bản có dấu vân tay số liệu.
8. P1, A4 — Firebase đẩy tăng dần, bỏ `pass_hash`.

**P1 — ngay sau đó**

- P2, P3, P13, P4, P5 — đệm hàng chờ NCE (dùng lại `activeEvaluationOf`), debounce
  + `search_key` nhật ký và gộp lời báo `activity`, biên bản tháng chỉ dựng lô cần,
  LRU lô cũ; thêm bài đo cho các đường này.
- N16, N17 (gồm XN tắt/panel tắt), N18; N32–N35; A30–A34.
- U30 trạng thái tải/lỗi; U28, U29 ARIA; U5/U19 màu Sigma (hỏi người dùng).
- ISO 7.3.7.3: quyết định "xem xét đợt", gắn NCE với `eqa_results`, ca thẩm định EQA.

**P2 — dần dần**

- P14–P17, P19–P21 (P20 bật lại `foreign_keys` sau `export()` nên làm sớm vì rẻ),
  P6–P12; N11, N13, N21–N25; A6, A9, A15, A18, A23–A25, A35–A37; Q3–Q8;
  U16–U18, U20–U25, U31–U37; người thứ hai duyệt Mean/SD và lô mới.
