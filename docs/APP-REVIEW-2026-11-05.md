# Đánh giá tổng thể QC Lab — 05/11/2026

Phạm vi: toàn bộ `app/` ở nhánh `feat/nce-redesign` (HEAD `a96b15e` cộng 58 tệp
sửa và 13 tệp mới chưa commit, chủ yếu EQA). Đây là đợt tiếp theo của
`docs/APP-REVIEW-2026-10-31.md`: bốn mảng — nghiệp vụ, hiệu năng, mã & bảo mật,
giao diện — được rà song song, vừa kiểm trạng thái các mục cũ vừa tìm lỗi mới.

Ký hiệu cột "Kiểm": **✔** đã đọc lại mã trong đợt tổng hợp; **○** người rà mảng
xác nhận bằng đọc mã/đo, chưa kiểm lần hai. **(D)** = nằm trong diff chưa commit.

Bối cảnh: app **chưa lên production**, dữ liệu là dữ liệu test.

Lệnh đã chạy: `npm run typecheck` đạt, `npm run lint` đạt (0 cảnh báo),
`npm test` **582/582 đạt** (35 s), `npm run test:performance` 2/2 đạt.

| Bài đo hiệu năng (60 XN × 5 năm ≈ 493k điểm) | Thời gian |
|---|---|
| Tổng quan/Westgard lần đầu · lần 2 · sau nhập 1 điểm | 963 ms · 0 ms · 22 ms |
| Westgard một mức · lô cũ | 37 ms · 310 ms |
| Nhập QC một mức · lô cũ | 1 ms · 8 ms |
| Sigma một tháng | 182 ms |

## 1. Kết luận chung

| Mảng | 31/10 | Nay | Một câu |
|---|---|---|---|
| Nghiệp vụ | Khá | **Tốt** | 12/14 mục cũ đã sửa (N1–N10, N12; N14 một phần). Lỗ mới tập trung ở **EQA mới viết** (lịch ↔ báo cáo không khớp nhau) và vài kẽ còn sót của "không hồi tố". |
| Hiệu năng | — | **Khá** | Truy vấn SQL có chỉ mục tốt, ba tầng bộ nhớ đệm hiệu quả. Nút cổ chai là **tính JS đồng bộ trên main** ở các đường chưa có đệm (hàng chờ NCE, biên bản tháng, tìm nhật ký) và **gói Firebase đẩy toàn bộ CSDL**. |
| Mã & kiến trúc | Tốt | **Tốt** | Q1, Q2 đã sửa; Q3–Q8 (lint, test kiểu script, trùng lặp, hàm phức tạp) vẫn mở. Diff chưa commit có 2 lỗi TB và **13 tệp mới chưa track** — commit thiếu sẽ vỡ build. |
| Bảo mật | Trung bình | **Khá** | A1, A2, A3, A5, A7, A10 đã sửa. Còn: Firebase vẫn đẩy `pass_hash`; **phục hồi bản cũ xoá cứng điểm QC và nhật ký mới hơn** kể cả ở chế độ vận hành. |
| Giao diện & UX | Trung bình | **Khá** | Modal/focus/Esc/thông báo/nhãn đã sửa gọn. Còn **U5 màu Sigma** chưa đụng tới, và một **hồi quy trong diff** ở bước ánh xạ nhập PDF EQA. |

Ba việc nên làm trước tiên:

1. **EQA lịch ↔ báo cáo** (N15, A13, A14): chương trình tạo từ lịch, `round_no`
   RIQAS sau migration 11 và năm theo Issue Date đều làm đợt trong lịch không bao
   giờ khớp báo cáo nhập vào → "Quá hạn"/"Máy thiếu báo cáo" sai.
2. **Phục hồi không được xoá dữ liệu mới hơn ở chế độ vận hành** (A19, A20):
   chặn hoặc chỉ cho phục hồi kiểu gộp; giữ `activity`.
3. **Hồi quy chưa commit** (U13, A12, A17) — sửa trước khi commit lô EQA hiện tại.

## 2. Trạng thái các mục của đợt 31/10

| Trạng thái | Mục |
|---|---|
| **Đã sửa** | N1–N10, N12 · A1, A2, A3, A5, A7, A8\*, A10 · A11.3, Q1, Q2 · U1, U2, U3, U4, U6, U7, U8, U10\*, U11 |
| **Một phần** | N14 (UTC đã sửa; tiêu chí "1 mẫu không đạt = đợt không đạt" và CLIA Urea/pH chưa chốt) · ISO 7.3.7.2 xem xét định kỳ (đã có biên bản tháng có ký; còn N17, N20) · A4 (đã bỏ khoá máy và giữ tài khoản khi kéo về; **vẫn đẩy `users.pass_hash` và `activity`**) · A9 (đã bỏ `QCLAB_DEV_SERVER_URL`; còn cửa sổ in bật JS, chưa fuses, chưa kiểm `senderFrame`) · A11.2 (đẩy đã sang `utilityProcess`; kéo về vẫn trên main) · Q6 · U9 (EQA còn `StatCard` riêng) · U12 (EQA bị test chữ tiếng Việt bỏ qua, xem U18) |
| **Còn mở** | N11 (Sigma `unstable` sau khi chuyển dải NSX→PXN) · N13 (ngưỡng Bias lô hoá chất 6% cố định) · ISO 7.3.7.2 người thứ hai duyệt · ISO 7.3.7.3 (xem xét đợt N-08, EQA→NCE, ca thẩm định EQA) · A6 (chuỗi hash không khoá, dòng thiếu hash vẫn qua) · A11.1 (thao tác hiếm, chấp nhận được) · kẽ hở lint ranh giới · Q3 (Electron 43.2.0, Node `lts/*`, chưa ký số) · Q4 · Q5 · Q7 · Q8 · **U5** |

\* A8: "Xoá sạch" đã bị chặn ở chế độ vận hành, nhưng phục hồi thì chưa (A20).
U10: diff mới làm hở lại ở bảng TEa (U17).

## 3. Nghiệp vụ — phát hiện mới

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| N15 | **Cao** | ✔ | **Chương trình tạo từ Lịch không khớp báo cáo nhập vào.** Lịch tạo chương trình với `program_code=''`; `findProgram` chỉ khớp theo mã, hoặc theo **nguyên văn** tên + đơn vị tổ chức. Lập lịch trước rồi nhập PDF VEQAS (đơn vị tổ chức là cả dòng "TRUNG TÂM KIỂM CHUẨN…") → app tạo chương trình thứ hai; đợt trong lịch không bao giờ thành "Đã có báo cáo", danh sách máy khai trong lịch không dùng được. Không có chức năng gộp chương trình. | `ipc/eqa-handlers.ts:61-66,476`; `domain/eqa/schedule.ts:59` |
| N16 | TB | ○ | **Phạm vi luật mặc định tính theo số mức hiện tại**, không theo phiên bản cấu hình → thêm/bớt một mức làm 2of3-2s, 3-1s đổi kênh trong-mức ↔ liên-mức cho **toàn bộ lịch sử**, kể cả kỳ đã khoá. Kẽ sót của GV2. | `db/westgard-evaluation.ts:25-31`; `domain/westgard-rules.ts:76-80`; `ipc/active-evaluation.ts:60` |
| N17 | TB | ✔ | **Lần chạy bị loại ở lô không còn vận hành biến khỏi hàng chờ NCE và cổng khoá kỳ.** `nceRejectedPoints` chỉ xét lô đang vận hành. Bị loại ngày 28/10 ở lô L1, 01/11 chuyển L2, khoá kỳ 10 → không cảnh báo, trong khi biên bản tháng vẫn đếm run đó là bị loại. | `db/nce-evaluation.ts:20-24,85-95`; `ipc/report-handlers.ts:79` |
| N18 | TB | ○ | **Huỷ kỳ EQA chỉ cần quyền `write`.** Kỳ huỷ rời khỏi chuỗi z, "không thành công", "Cần chú ý" → KTV huỷ đợt \|z\| ≥ 3 là tín hiệu biến mất. Nên cần `qc.config`/admin hoặc gắn NCE. | `ipc/eqa-handlers.ts:209-229` |
| N19 | TB | ○ | **Nhập thêm mẫu cho máy đã có làm mất mẫu cũ khỏi phiên bản hiện hành** (giữ kết quả cũ chỉ cho máy không có trong lần nhập mới). Hai tệp VEQAS `_01-01_`, `_01-02_` cùng máy nhập riêng → mất mẫu 01-01. | `ipc/eqa-handlers.ts:181-189` |
| N20 | TB | ○ | **Ký biên bản tháng và khoá kỳ cho tháng chưa kết thúc.** Chỉ chặn tháng tương lai: ký tháng 11 ngày 05/11 thì cổng "chưa có biên bản" đã qua dù số liệu chụp chỉ 5 ngày; khoá tháng hiện tại chặn luôn nhập QC hôm nay. | `domain/monthly-review.ts`; `domain/period-lock-validation.ts:20-25` |
| N21 | TB | ○ | **Đợt quá hạn không nộp không tính là không đạt** — chú thích nói trung tâm coi trễ hạn là không đạt nhưng "không thành công" chỉ dựa trên kết quả. Cần chốt trong EQA-PLAN. | `domain/eqa/schedule.ts:4-6,88-92`; `series.ts:126` |
| N22 | Thấp | ○ | Sửa lịch EQA: audit chỉ ghi giá trị mới (lùi hạn xoá dấu "Quá hạn" không để vết); "đã nộp" lấy thời điểm bấm, không cho nhập ngày nộp thật. | `ipc/eqa-handlers.ts:612-650` |
| N23 | Thấp | ○ | Ngày nộp hiển thị theo UTC (`submitted_at.slice(0,10)`): bấm lúc 01:00 ngày 06/11 hiện "Nộp 05/11", trông như đúng hạn. | `pages/eqa/EqaSchedule.tsx:44`; `EqaSubmitModal.tsx:35` |
| N24 | Thấp | ○ | "Vượt TEa" EQA sai khi đơn vị báo cáo khác đơn vị xét nghiệm (mmol/L vs mg/dL) — lúc nhập không so `row.unit` với `tests.unit`. | `ipc/eqa-handlers.ts:288`; `domain/eqa/import.ts` |
| N25 | Thấp | ○ | σp RIQAS luôn lấy SD nhóm thiết bị, kể cả khi "Mean for Comparison" là nhóm phương pháp/tất cả; `assignedLevel` gán cứng. | `domain/eqa/pdf-report.ts:304-317,405` |

## 4. Hiệu năng

| # | Mức | Kiểm | Phát hiện và ảnh hưởng ở cỡ thực | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| P1 | **Cao** | ○ | **Firebase đẩy toàn bộ CSDL mỗi chu kỳ.** ~450 B/dòng → 2 năm (200–300k điểm + nhật ký) ≈ 180–270 MB: chạm giới hạn 256 MB sau ~1,5–2 năm và sao lưu đám mây ngừng hẳn; trước đó mỗi 15 phút tải lên 100–250 MB. | `sync/firebase-payload.ts:18-22`; `db/table-io.ts:16-22` | Đẩy tăng dần theo `seq`/tháng, hoặc tải tệp `.sqlite` nén lên Storage. |
| P2 | **Cao** | ✔ | **Hàng chờ NCE chạy lại Westgard mọi xét nghiệm, không đệm.** Trang Khắc phục sự cố nghe `qc_points` không lọc `testId` → mỗi điểm nhập ở bất kỳ máy nào tốn ~0,5 s chặn main cho mỗi máy đang mở trang. Biên bản tháng, khoá kỳ cũng gọi. | `db/nce-evaluation.ts:85-95`; `pages/ActionsPage.tsx:24` | Đệm theo xét nghiệm như `summary-cache`, bỏ đúng `testIds`. |
| P3 | TB | ✔ đo | **Tìm chữ trong Nhật ký không debounce, lọc JS toàn bảng**: 200k dòng ≈ 2,7 s/lần; gõ 7 ký tự xếp hàng ~19 s chặn main, LAN đứng theo. | `store/audit-store.ts:48`; `ipc/audit-handlers.ts:89-90` | Debounce 300 ms; cột `search_key` không dấu hoặc FTS5. |
| P4 | TB | ○ | Biên bản tháng của tháng thuộc lô cũ dựng lô cũ cho mọi xét nghiệm (~5–6 s ở 2 năm; chú thích trong mã ghi ~15 s ở 5 năm). | `ipc/report-handlers.ts:90-127` | Chỉ đánh giá chuỗi lô chứa điểm của tháng. |
| P5 | TB | ○ | `PreviousLotCache` không giới hạn số mục → vài chục tới >100 MB heap sau khi duyệt nhiều xét nghiệm. | `ipc/previous-lot-cache.ts:39,70` | LRU 8–12 xét nghiệm. |
| P6 | TB | ○ | Kéo Firebase/phục hồi: parse + stringify + SHA + chèn 500k dòng đồng bộ trên main (5–10 s), LAN đứng. Thao tác hiếm. | `ipc/firebase-handlers.ts:211-221` | Dùng khung worker sẵn có, ghi `.sqlite` tạm rồi ATTACH. |
| P7 | Thấp | ○ | Đăng nhập/đăng xuất/đăng nhập sai xoá trắng cả hai bộ đệm (vì `writeAudit` báo `activity`). | `ipc/shared.ts:163`; `ipc/summary-cache.ts:43` | Cờ "chỉ nhật ký" để bộ đệm bỏ qua. |
| P8 | Thấp | ○ | Sau mỗi điểm nhập, Nhập QC tải lại cả chuỗi lô cũ (1–4 MB JSON qua LAN). | `store/entry-store.ts:58` | Bỏ qua khi lời báo chỉ chạm lô vận hành. |
| P9 | Thấp | ✔ EXPLAIN | Không chạy `PRAGMA optimize`/`ANALYZE`, `cache_size` mặc định 2 MB; truy vấn biên bản tháng thành SCAN + temp B-tree. | `db/open-database.ts:21-25` | `PRAGMA optimize` khi mở/đóng. |
| P10 | Thấp | ○ | `VACUUM INTO`, kiểm chuỗi hash, xuất CSV đồng bộ; ghi `lastBackup*` vào `app_meta` làm mất bộ đệm Westgard. | `ipc/backup-handlers.ts:146-175` | Loại khoá `lastBackup*` khỏi tín hiệu xoá đệm. |
| P11 | Thấp | ○ | Bundle renderer một khối ~981 KB JS + 245 KB CSS (exceljs, pdfjs đã nạp lười). | `renderer/router.tsx:4-17` | `React.lazy` cho Sigma, EQA, Settings, Users, Audit. |
| P12 | Thấp | ○ | Biểu đồ canvas vẽ lại mỗi lần cha render do prop mảng/đối tượng mới (1–5 ms/lần). | `westgard/ArchivedGroupView.tsx:63`; `eqa/EqaSeriesChart.tsx:37`; `entry/EntryLjPanel.tsx:89` | `useMemo`. |

Test hiệu năng hiện chỉ đo Tổng quan, Westgard, Nhập QC, Sigma; ngưỡng 30–60 s
và không chạy trong `npm test`. Chưa đo hàng chờ NCE, biên bản tháng, tìm nhật
ký, cỡ gói Firebase.

## 5. Mã, kiến trúc và bảo mật — phát hiện mới

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| A12 (D) | TB | ○ | "Thay cả tài khoản" khi phục hồi mà tài khoản đang dùng không có trong bản sao lưu: store gọi `loadAll()` trước khi trả kết quả → `getLabProfile` ném "Chưa đăng nhập." → người dùng thấy thông báo chung, **mất đường dẫn bản an toàn**. E2E đã chuyển sang nhánh "Giữ tài khoản" nên nhánh này không còn ai chạy. | `store/settings-store.ts:89-92`; `pages/SettingsPage.tsx:236-240` |
| A13 (D) | TB | ✔ | **Migration 11 đổi `eqa_rounds.round_no` RIQAS (23 → 2307) nhưng không đổi `eqa_schedule.round_no`**; lịch nối đợt theo `(program_id, year, round_no)` → đợt đã lên lịch mất liên kết, hiện "Quá hạn" dù đã có báo cáo. | `db/schema.ts:838-852`; `ipc/eqa-handlers.ts:400-408,476` |
| A14 (D) | Thấp–TB | ○ | Năm đợt RIQAS lấy theo Issue Date, năm lịch do người nhập; sample cuối cycle phát hành sang năm sau không bao giờ khớp. | `domain/eqa/pdf-report.ts` (`parseRiqasReport`); `eqa-handlers.ts:476` |
| A15 (D) | Thấp | ○ | `keepAccounts` bỏ hẳn bảng `users` của bản sao lưu (Firebase thì gộp, thêm tài khoản khoá) → `owner_user_id` NCE trỏ id không tồn tại. Nên dùng chung `mergeUsersForPull`. | `ipc/backup-handlers.ts:207-209`; `domain/cloud-backup.ts:29-38` |
| A16 (D) | Thấp | ○ | Kỳ RIQAS cũ lẫn nhiều sample giữ tên "CYCLE 22"; nhập lại PDF "CYCLE 22 SAMPLE n" tạo đợt song song, mẫu đếm hai lần trong chuỗi xu hướng, không cảnh báo. | `db/schema.ts:845-846` |
| A17 (D) | Thấp | ✔ | **13 tệp chưa track** (`SearchSelect.tsx`, `search-options.ts`, `EqaTestDetail.tsx`, `EqaSeriesChart.tsx`, `EqaZMap.tsx`, `EqaTimeline.tsx`, `EqaResultInspector.tsx`, `useEqaRead.ts`, `useEqaScope.tsx`, 2 test, 1 fixture, 1 e2e) đang được import — commit thiếu là vỡ build. | `git status` |
| A18 (D) | Thấp | ○ | Nhận biết mất phiên bằng regex chữ `/Chưa đăng nhập\./` thay vì `code`. | `lib/unhandled-errors.ts:13` |
| A19 | TB | ○ | **Phục hồi backup và kéo Firebase thay toàn bộ bảng `activity`** → nhật ký sinh sau thời điểm sao lưu biến khỏi nhật ký sống (chỉ còn trong snapshot). Trái tinh thần A2/GV3. | `db/table-io.ts:47-49,90-91`; `ipc/backup-handlers.ts:220-222` |
| A20 | TB | ○ | **Chế độ vận hành chỉ chặn "Xoá sạch"; phục hồi bản cũ vẫn thay `qc_points`** = xoá cứng điểm QC nhập sau bản sao lưu. | `ipc/backup-handlers.ts:205-235`; `db/operation-mode.ts:29-33` |
| A21 | Thấp | ○ | Cờ chế độ vận hành ghi lại sau khi transaction phục hồi đã commit; dòng audit "Phục hồi" ở transaction riêng → sập giữa chừng mất cờ hoặc mất nhật ký. | `db/operation-mode.ts:29-33`; `backup-handlers.ts:232` |
| A22 | Thấp | ○ | Phục hồi từ tệp ghi đè khoá riêng của máy (`firebaseConfig`, `lisGatewaySettings`) — Firebase pull giữ `MACHINE_LOCAL_META_KEYS`, phục hồi tệp thì không. | `db/table-io.ts:41-49` |
| A23 | Thấp | ○ | SSE `/api/events` chỉ kiểm phiên lúc mở; phiên bị thu hồi vẫn nhận thông báo thay đổi. | `lan/http-server.ts:180-183` |
| A24 | Thấp | ○ | Xác thực lại mật khẩu trước phục hồi chỉ ở renderer; main không đòi bằng chứng. | `SettingsPage.tsx:236`; `desktop-operations.ts` |
| A25 | Thấp | ○ | `previewEqaImport` dùng cổng `nceReader` → vai trò chỉ-xem nhận thông báo lỗi nói về NCE. | `ipc/operations.ts:172-176,275` |

Độ phủ test còn thiếu: nhánh `signedOut` khi phục hồi; lịch ↔ đợt RIQAS sau
migration 11; phục hồi ở chế độ vận hành (giữ `activity`/`qc_points`); phục hồi
tệp giữ `MACHINE_LOCAL_META_KEYS`; chưa có test render React.

## 6. Giao diện và UX — phát hiện mới

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| U13 (D) | **Cao** | ✔ | **Hồi quy bước ánh xạ nhập PDF EQA**: effect xem trước nay gọi `setPreview(null)` (HEAD không có). Mỗi lần chọn một xét nghiệm, cả bảng ánh xạ thành "Đang kiểm tra dữ liệu…", ô vừa chọn bị gỡ khỏi DOM → mất focus và vị trí cuộn; ánh xạ N cặp phải dò lại N lần. Sửa: bỏ `setPreview(null)`, giữ bản cũ khi `loading`. | `pages/eqa/EqaImportModal.tsx:205` |
| U14 (D) | TB | ✔ | Diff **xoá lời nhắc "không hồi tố"** (`NOT_RETROACTIVE_NOTE`) ở panel luật Westgard chung — đi ngược quyết định GV2 (`APP-REMEDIATION-PLAN:111-112`). | `pages/WestgardPage.tsx` |
| U15 (D) | TB | ○ | Nhập hàng loạt: đã ghi một phần, bấm "Quay lại chọn máy" rồi kiểm tra lại → các đợt vừa ghi hiện "Cần xem trước" và đòi lý do nhập lại → dễ nhập trùng phiên bản. Khoá nút quay lại sau lần ghi đầu. | `EqaImportModal.tsx:107,353,430` |
| U16 (D) | TB | ○ | Bước chọn tệp: nút "Xem trước" bị khoá không nói lý do; ô năm/máy sai không có `aria-invalid`; lỗi chặn "hai file cùng máy" hiện màu vàng `warn` (trái U8). | `EqaImportModal.tsx:92,113,151-166` |
| U17 (D) | TB | ○ | Bảng TEa tham chiếu thêm cột "Hồ sơ", `min-width` 920 → 1080px → cuộn ngang ở 1280–1366, cột Trạng thái và nút Xoá khuất (lặp lại U10). | `styles/pages/manage.css:402-411` |
| U18 | TB | ○ | **Thuật ngữ EQA lẫn "kỳ/đợt/vòng"**: panel "Kỳ báo cáo" nhưng cột "Chương trình / đợt", nút "Huỷ kỳ" nhưng nhật ký "Huỷ đợt"; Sigma gọi "vòng EQA"; sót "app", "File/Đọc file". `vietnamese-text.test.mjs` **cố ý bỏ qua `pages/eqa`** nên không bắt được. | `EqaOverview.tsx:126-129`; `EqaRoundDetail.tsx:19,108,122`; `tests/vietnamese-text.test.mjs:15` |
| U19 | TB | ✔ | **U5 còn nguyên**: 4 bảng màu Sigma tự dựng; `#dd8b1f` ngoài token; chữ trắng trên `#dd8b1f` 2,70:1; bậc "Tốt" `#3f9a55` chữ trắng 3,52:1 (trượt AA cho chữ nhỏ). `--amber-500` cũng chỉ 4,06:1 — dùng `--warning-text` hoặc chữ tối trên nền amber. Gộp vào một `sigma-zone.ts`. | `pages/sigma/shared.ts:84-89`; `lib/sigma-print-report.ts:45-51`; `components/SigmaCharts.tsx:8-9`; `lib/sigma-summary-export.ts:48-49` |
| U20 (D) | Thấp | ○ | Mở kỳ từ chuỗi/ô kết quả: dòng được tô nhưng không cuộn tới (`data-eqa-result` không ai đọc). | `EqaRoundDetail.tsx:63,190` |
| U21 (D) | Thấp | ○ | "Ghi nhận nộp" và "Đã nộp" cùng một thao tác; nút "Đã nộp" trùng chữ với tag trạng thái; nút vẫn hiện khi đã `submitted`. | `EqaSchedule.tsx:185,197,258` |
| U22 | Thấp | ○ | Lịch tháng EQA: `role="grid"` thiếu `role="row"`, không có phím mũi tên (Tab qua 42 ô), chấm trạng thái chỉ phân biệt bằng màu, cắt ở 3 chấm không có "+N". | `EqaSchedule.tsx:161-170` |
| U23 (D) | Thấp | ○ | `SearchSelect` dùng chung nhưng câu rỗng cứng "Không tìm thấy xét nghiệm phù hợp", không bỏ chọn được. | `components/SearchSelect.tsx:97` |
| U24 | Thấp | ○ | Bẫy focus chỉ chặn đầu/cuối: phần tử đang focus bị gỡ khỏi DOM (như U13) → focus về `body`, Tab thoát ra sau modal. | `components/useFocusTrap.ts:56-64` |
| U25 (D) | Thấp | ○ | Nút "Huỷ" ở modal lịch và modal nộp không khoá khi đang lưu. | `EqaScheduleModal.tsx:74`; `EqaSubmitModal.tsx:26` |

## 7. Điểm mạnh

- **Không hồi tố luật (GV2)**: kết luận gắn thứ tự nhập qua `rule_config_history`
  + `entry_seq`; mọi mức của một lần chạy cùng một phiên bản cấu hình.
- **Cổng nhập điểm chặt**: Mean/SD theo ngày chạy, chặn lô hết hạn đúng ranh
  giới, ngày tương lai theo giờ địa phương, chặn trùng lần chạy.
- **EQA đúng chuẩn**: z, z′, u(x_pt) ≤ 0,3σp (ISO 13528), điểm J, xu hướng đếm
  theo đợt và tách chương trình; z ngược dấu nhà cung cấp là lỗi chặn; RIQAS đối
  chiếu trang chi tiết với trang tổng hợp.
- **Cổng quyền mọi lời gọi** đọc lại tài khoản; phiên LAN thu hồi được; LAN HTTPS
  có CA giới hạn dải IP, cookie chặt, body 1 MB, chống path traversal.
- **`writeCommand`** ép quyền → kiểm → giao dịch → audit → báo thay đổi; có lint canh.
- **Hiệu năng SQL**: chỉ mục partial/covering đúng chỗ, có test giữ kế hoạch truy
  vấn; ba tầng đệm (Tổng quan sau nhập một điểm 534 → 29 ms); đẩy Firebase chạy
  trong `utilityProcess`; LAN dùng một `EventSource`.
- **Giao diện**: Modal tập trung Enter/Esc theo lớp/hỏi trước khi bỏ dữ liệu/khoá
  khi lưu; `useInvalidField` focus đúng ô sai; L-J không dùng màu làm tín hiệu
  duy nhất; biểu đồ EQA dùng được bằng bàn phím; token ba lớp có test canh.

## 8. Lộ trình đề xuất

**Trước khi commit lô EQA hiện tại** — U13, U14, U15, A12, A13 đã sửa 05/11/2026;
A17 còn chờ lúc commit.

1. U13 bỏ `setPreview(null)`; U14 trả lời nhắc "không hồi tố"; A12 sửa thứ tự
   `loadAll`/`signedOut`; A17 thêm 13 tệp mới vào commit.
2. A13 migration cập nhật cả `eqa_schedule.round_no`; U15 khoá "Quay lại" sau khi ghi.

**P0 — trước khi chạy thật**

3. N15, A14 — khớp lịch ↔ báo cáo: cho gắn chương trình khi nhập (chọn từ danh
   sách thay vì so nguyên văn), khớp năm theo cycle; thêm gộp chương trình.
4. A19, A20, A21 — phục hồi ở chế độ vận hành: chặn hoặc chỉ phục hồi kiểu gộp,
   luôn giữ `activity`, ghi cờ và audit trong cùng giao dịch.
5. N16, N17 — lưu phạm vi luật theo phiên bản cấu hình; hàng chờ NCE xét mọi lô
   có điểm trong kỳ.
6. N18, N20 — nâng quyền huỷ kỳ EQA; chặn ký/khoá tháng chưa kết thúc.
7. P1, A4 — Firebase đẩy tăng dần và bỏ `pass_hash`.

**P1 — ngay sau đó**

- P2, P3, P4, P5 — đệm hàng chờ NCE, debounce + `search_key` nhật ký, biên bản
  tháng chỉ dựng lô cần, LRU cho lô cũ; thêm bài đo cho các đường này.
- N19, N21 (chốt SOP), N22–N25; U16–U19 (U19 = U5 màu Sigma); A22–A25.
- Ca thẩm định EQA trong `app/validation/`; bỏ ngoại lệ `pages/eqa` khỏi test chữ.

**P2 — dần dần**

- N11, N13, A6, A9, Q3–Q8, P6–P12, U20–U25, người thứ hai duyệt Mean/SD và lô mới.
