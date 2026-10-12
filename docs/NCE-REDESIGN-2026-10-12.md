# Kế hoạch làm lại hồ sơ sự không phù hợp (NCE)

Lập ngày 2026-10-12, sau đợt rà soát nghiệp vụ và mã nguồn khu vực **Khắc
phục sự cố**. Tài liệu này thay phần mô hình dữ liệu, trạng thái và lộ trình
(mục 8, 9, 12, 13) của `docs/NCE-PLAN-2026-09-27.md`. Phần căn cứ pháp lý,
tiêu chuẩn, thuật ngữ và nguyên tắc (mục 2–7, 10, 11 của tài liệu đó) vẫn là
căn cứ của kế hoạch này.

App chưa vận hành chính thức; dữ liệu NCE hiện có là dữ liệu thử. Vì vậy được
phép đổi mô hình dứt khoát, chỉ cần đọc lại được hồ sơ cũ, không cần giữ hai
luồng song song.

## 1. Vì sao làm lại thay vì sửa tiếp

Rà soát ngày 2026-10-12 xác nhận các lỗi sau trong mã hiện tại. Phần lớn là lỗi
mô hình, không vá được bằng cách thêm trường vào form.

| Mã | Lỗi | Vị trí |
| --- | --- | --- |
| R-01 | Cổng duyệt bắt ngày cho chạy lại ≥ ngày hoàn thành CAPA, ngược thực tế (QC đạt thì chạy lại ngay; CAPA xong sau nhiều tuần) | `domain/nce-validation.ts:113` |
| R-02 | Westgard/CUSUM cắt chuỗi theo `action_completed_date` của NCE "duyệt + hiệu quả"; duyệt muộn làm verdict quá khứ đổi hồi tố (điểm từng bị loại thành đạt) | `db/westgard-evaluation.ts:8`, `domain/westgard-engine.ts:293`, `ipc/westgard-handlers.ts:192` |
| R-03 | Bằng chứng rerun chỉ kiểm tồn tại, cùng xét nghiệm, ngày không trước sự cố: chấp nhận chính điểm lỗi, khác mức, khác lô, điểm bị loại; cổng duyệt chỉ kiểm có `rerunPointId` | `ipc/nce-handlers.ts:113, 223–226` |
| R-04 | Mọi tài khoản có quyền ghi đều duyệt được; chỉ chặn người lập | `ipc/nce-handlers.ts:123` |
| R-05 | Hai đường ghi quyết định cho chạy lại (form gõ tay `releaseBy`, modal lấy actor) dùng hai bộ trường khác nhau và ghi đè lẫn nhau | `ActionsPage.tsx:416`, `ipc/nce-handlers.ts:208` |
| R-06 | "Hôm nay" ở handler là ngày UTC; 0–7 giờ sáng giờ Việt Nam bị báo "ngày ở tương lai", mã NCE mang ngày hôm trước | `ipc/nce-handlers.ts:17` |
| R-07 | Một điểm một hồ sơ: một lần chạy hỏng hai mức đòi hai NCE; hồ sơ không gắn điểm không gỡ được hàng chờ | `view-models/nce-issues-view-model.ts:119` |
| R-08 | Main tin xét nghiệm/mức/lô/luật do renderer gửi khi tạo; không chụp verdict; không chặn trùng hồ sơ cho một điểm | `ipc/nce-handlers.ts:78` |
| R-09 | `saveProtocol` ghi đè cả gói, không khóa lạc quan: mất kết luận hiệu lực khi hai nơi cùng sửa | `ipc/nce-handlers.ts:30–43, 88–109` |
| R-10 | Nguy cơ còn lại có hai mô hình (văn bản ở modal, S/O/D ở form); cổng chỉ nhận một | `ipc/nce-handlers.ts:193`, `domain/nce-validation.ts:123` |
| R-11 | NCE tự mở khi hủy điểm không có người phụ trách nên không bao giờ quá hạn | `domain/nce-overdue.ts:22`, `ipc/entry-handlers.ts:486` |
| R-12 | Hồ sơ đổi dải QC ghi vào bảng NCE, kẹt "Chờ duyệt" mãi; cổng an toàn đổi dải bật vĩnh viễn khi từng có NCE sai số hệ thống | `ipc/entry-handlers.ts:271, 285` |
| R-13 | Hủy từ bảng nhật ký dùng lý do soạn sẵn | `ActionsPage.tsx:63` |
| R-14 | Người duyệt không thấy FMEA, ảnh hưởng bệnh nhân, hành động khắc phục; mục "Khắc phục" hiển thị xử lý tức thời | `ActionsPage.tsx:436–570` |
| R-15 | Không có lịch sử nội dung: audit chỉ ghi "Cập nhật hồ sơ", `detail_json` bị ghi đè | `ipc/nce-handlers.ts:104` |
| R-16 | Mở vòng tiếp theo kế thừa trạng thái cho chạy lại và ảnh hưởng bệnh nhân của vòng cũ | `ipc/nce-handlers.ts:245` |
| R-17 | Hàng chờ sự cố tính ở renderer bằng cách nạp mọi điểm của mọi xét nghiệm × mức | `ActionsPage.tsx:75–82` |

## 2. Phạm vi

**Làm trong đợt này**

- NCE phân tích: IQC (nguồn chính, gắn lần chạy), EQA không đạt, sự cố thiết
  bị, hóa chất/calibrator, hiệu chuẩn; thêm nguồn "khác" dạng nhẹ, không cần
  gắn xét nghiệm.
- Đánh giá ảnh hưởng kết quả bệnh nhân ở mức **quyết định có cấu trúc**: khoảng
  nghi ngờ do main tính, kết luận, người quyết định, tham chiếu phiếu sửa báo
  cáo/thông báo.
- Hành động khắc phục nhiều dòng, đánh giá hiệu lực, duyệt độc lập, lịch sử
  sửa đổi, quyền theo capability.

**Chưa làm (giữ chỗ trong mô hình, không làm giao diện)**

- Danh sách từng kết quả bệnh nhân, thu hồi và xác nhận thông báo theo từng
  người nhận: cần tích hợp LIS mới có dữ liệu thật.
- Danh mục NCE trước/sau xét nghiệm đầy đủ, tệp đính kèm, dashboard Pareto/xu
  hướng, xuất hồ sơ PDF đầy đủ (giai đoạn 5, tùy chọn).

## 3. Quyết định nghiệp vụ và căn cứ

Các quyết định dưới đây chọn theo chuẩn. Chỉ đổi khi SOP phòng xét nghiệm quy
định khác; khi đổi phải ghi lại vào mục này.

| # | Quyết định | Căn cứ |
| --- | --- | --- |
| D-01 | **Một hồ sơ cho một sự kiện**, không phải một điểm. Với IQC, sự kiện khởi đầu từ một lần chạy bị loại; các lần chạy bị loại tiếp theo của cùng xét nghiệm trước khi cho chạy lại được gắn vào cùng hồ sơ (đó là quá trình xử lý sự cố, không phải sự kiện mới) | ISO 15189:2022 7.5 (công việc không phù hợp), Westgard: lần chạy là đơn vị chấp nhận/loại |
| D-02 | **Tách ba mốc**: (1) cho chạy lại (release-to-service), (2) hoàn thành hành động khắc phục, (3) kết luận hiệu lực. Cho chạy lại không phụ thuộc CAPA đã xong | ISO 15189:2022 7.5 (thẩm quyền cho hoạt động trở lại) và 8.7 (hành động khắc phục, đánh giá hiệu lực) là hai yêu cầu khác nhau |
| D-03 | **Mốc cắt chuỗi Westgard và CUSUM = lần chạy rerun được chấp nhận khi cho chạy lại.** Lần chạy rerun là lần chạy đầu tiên của giai đoạn mới. Hiệu lực ngay khi cho chạy lại, không đợi duyệt, nên không có thay đổi hồi tố | Westgard, *Basic QC Practices* bài 18: sau khi loại và khắc phục, các luật nhiều lần chạy áp dụng lại từ quá trình đã sửa; WG-07 trong `WESTGARD-REVIEW-2026-09-22.md` |
| D-04 | Rerun hợp lệ do main kiểm: cùng xét nghiệm; sau mọi lần chạy bị loại đã gắn vào hồ sơ; đủ các mức có mặt trong lần chạy khởi đầu; không mức nào bị loại khi đánh giá **trong giai đoạn mới**; không chứa điểm đã hủy hay điểm gây sự cố; khác lô thì bắt buộc giải thích. Chụp snapshot toàn lần chạy | Westgard (chạy lại vật liệu kiểm tra sau khắc phục); NCE-PLAN 7.1 |
| D-05 | Cho chạy lại một sự cố IQC bắt buộc đã có quyết định ảnh hưởng bệnh nhân cho khoảng từ lần chạy đạt cuối cùng trước sự kiện đến lần rerun | ISO 15189:2022 7.5 b–d; NCE-PLAN 7.5 ("không dùng quy tắc QC chạy lại đạt thì kết quả cũ mặc nhiên hợp lệ") |
| D-06 | **Phân tầng**: `low` (xử lý nhanh, không bắt RCA/CAPA, phải ghi lý do) và `capa` (bắt buộc nguyên nhân, hành động, đánh giá hiệu lực). Main ép `capa` khi có một tiêu chí kích hoạt (mục 5.3) | ISO 15189:2022 8.7.1 (hành động tương xứng với ảnh hưởng); QĐ 2429 Chương X |
| D-07 | Nguy cơ dùng ma trận **mức độ nghiêm trọng × khả năng xảy ra** (1–5 × 1–5), cùng thang cho nguy cơ ban đầu và còn lại. Bỏ bắt buộc FMEA S×O×D | ISO 22367:2020 (quản lý rủi ro PXN y học: nguy cơ là kết hợp xác suất xảy ra tác hại và mức độ nghiêm trọng) |
| D-08 | Kết luận "không hiệu quả" thì bổ sung hành động và đánh giá lại **trong cùng hồ sơ**; không đóng hồ sơ khi lần đánh giá cuối không phải "hiệu quả". Tái diễn sau khi đã đóng mở hồ sơ mới có liên kết | ISO 15189:2022 8.7.1 e–f |
| D-09 | Duyệt đóng hồ sơ cần capability `nce.approve` và người duyệt không phải người báo cáo, người phụ trách, người cho chạy lại, người hoàn thành hành động hay người đánh giá hiệu lực | ISO 15189:2022 5.4 (trách nhiệm, thẩm quyền), 8.7; NCE-PLAN mục 10 |
| D-10 | Hồ sơ đã cho chạy lại không được hủy (hủy sẽ làm đổi mốc cắt Westgard); chỉ hủy được khi còn ở `open` | Toàn vẹn hồ sơ QC |
| D-11 | Sigma coi điểm bị loại "đã xử lý" khi hồ sơ chứa điểm đó ở trạng thái `closed` (thay cho "duyệt + hiệu quả"; hồ sơ tầng `capa` chỉ đóng được khi hiệu quả) | ISO/TS 20914 như đã chốt ở `SIGMA-REVIEW-2026-09-22-lan2.md` |
| D-12 | Đổi dải QC không phải NCE: thôi ghi vào bảng NCE (lịch sử đã có ở `test_levels.mean_sd_history_json` và audit). Cổng an toàn đổi dải chỉ bật khi có NCE sai số hệ thống **chưa đóng** hoặc gắn **lô đang dùng** của mức đó | Kiểm soát thay đổi khác với sự không phù hợp (ISO 15189:2022 8.5 so với 7.5) |
| D-13 | Mọi ngày "hôm nay" ở main lấy theo giờ địa phương của máy chính (`isoLocalDate()`); thời điểm lưu ISO đầy đủ | Thống nhất với quy tắc quá hạn hiện có |
| D-14 | Hàng chờ NCE chỉ gồm lần chạy bị **loại**; cảnh báo (1-2s và mọi luật đặt hành động "Cảnh báo") không vào hàng chờ, vẫn hiện ở Nhập QC và Tổng quan. Người dùng vẫn có thể tự mở NCE từ nguồn khác khi cần. Người dùng xác nhận ngày 2026-10-12 | Westgard: 1-2s là quy tắc cảnh báo, không loại lần chạy |
| D-15 | Hồ sơ không phải IQC có xét nghiệm được kèm một lần chạy QC xác minh khi cho chạy lại (từ ngày phát hiện, đủ mức đang vận hành, không bị loại trong giai đoạn mới) và lần chạy đó cũng là mốc cắt. Thêm ngày 2026-10-12 khi làm giai đoạn 2 | Westgard bài 18 như D-03; tín hiệu CUSUM không loại lần chạy nào nên cần đường này để bắt đầu lại chuỗi |

**Cấu hình có giá trị mặc định tạm, chờ SOP** (lưu `app_meta`, sửa ở Cài đặt):

- hạn mặc định: `low` 7 ngày, `capa` 30 ngày;
- cửa sổ phát hiện tái diễn: 90 ngày, cùng xét nghiệm và cùng loại sai số;
- ngoại lệ phân tách nhiệm vụ cho đơn vị ít người: **tắt**; bật phải ghi mã
  SOP, mỗi lần dùng ngoại lệ được ghi vào quyết định duyệt.

## 4. Mô hình trạng thái

```text
open ──release──▶ released ──submit──▶ pending_approval ──approve──▶ closed
  │                  ▲                        │
  │                  └────────return──────────┘
  └──cancel──▶ cancelled
```

- `open`: đã ghi nhận và có xử lý tức thời. Được sửa mô tả, phân tầng, nguy
  cơ, điều tra, hành động; được gắn thêm lần chạy bị loại; được hủy.
- `released`: đã cho chạy lại. Với NCE không có xét nghiệm hoặc không dừng
  dịch vụ, bước này ghi "không áp dụng" kèm lý do nhưng vẫn là một quyết định
  có actor. Tiếp tục điều tra, hành động, đánh giá hiệu lực.
- `pending_approval`: khóa sửa; chỉ duyệt hoặc trả lại.
- `closed`: bất biến. Sửa sai hành chính dùng phụ lục (giai đoạn 5).
- `cancelled`: chỉ từ `open`, lý do người dùng nhập ≥ 10 ký tự.
- Trả lại đưa về `released` kèm lý do; người lập sửa rồi nộp lại.

Trạng thái chỉ đổi qua handler chuyển trạng thái ở main. Renderer không suy
trạng thái từ dữ liệu đã nhập. Mỗi lượt đọc hồ sơ trả kèm `next_step` và
`missing[]` do main tính để giao diện hiển thị "còn thiếu gì".

## 5. Cổng của từng bước

### 5.1. Tạo hồ sơ (`open`)

- Bắt buộc: nguồn, mô tả sự kiện, xử lý tức thời (≥ 5 ký tự), có giữ kết quả
  hay không, thời điểm phát hiện, người phụ trách (tài khoản đang hoạt động),
  hạn (mặc định theo cấu hình).
- Nguồn `iqc`: chỉ nhận **khóa lần chạy** (`test_id`, `date`, `run_id`). Main tự
  lấy các điểm, mức, lô, luật vi phạm, loại sai số và chụp snapshot. Từ chối nếu
  lần chạy không bị loại, hoặc đã có hồ sơ chưa đóng chứa lần chạy đó (trả về
  mã hồ sơ để giao diện mở tiếp).
- Có hồ sơ `open` của cùng xét nghiệm: giao diện đề nghị gắn vào hồ sơ đó (D-01)
  thay vì tạo mới.
- Người báo cáo lấy từ phiên đăng nhập.

### 5.2. Cho chạy lại (`open → released`)

- Capability `nce.release`.
- IQC: rerun đạt D-04; quyết định ảnh hưởng bệnh nhân đạt D-05; nếu kết luận là
  "đã trả kết quả và phải sửa/thông báo" thì bắt buộc mô tả và mã tham chiếu.
- Có đọc thử `previewNceRelease` trả kết quả đánh giá từng mức của lần chạy
  ứng viên theo giai đoạn mới, để người dùng thấy lý do bị từ chối trước khi bấm.
- Lưu mốc cắt (D-03) cùng transaction với quyết định.

### 5.3. Phân tầng

Main ép tầng `capa` khi có ít nhất một điều kiện:

- mức nguy cơ ban đầu từ "trung bình" trở lên;
- kết quả bệnh nhân đã trả bị ảnh hưởng;
- có lần chạy bị loại gắn thêm sau lần khởi đầu (xử lý tức thời lần đầu không
  hiệu quả);
- nguyên nhân "chưa xác định" lúc nộp duyệt;
- nguồn EQA;
- tái diễn trong cửa sổ cấu hình (main tự phát hiện).

Tầng `low` yêu cầu lý do không làm RCA/CAPA.

### 5.4. Nộp duyệt (`released → pending_approval`)

- Người phụ trách hoặc người lập.
- Chung: phân tầng, nguy cơ ban đầu có căn cứ, checklist theo nguồn đã đánh
  giá (mục bất thường hoặc không áp dụng phải có ghi chú).
- Tầng `capa`: nguyên nhân (đã xác định / nghi ngờ / chưa xác định kèm kế hoạch
  kiểm tra); ít nhất một hành động khắc phục; mọi hành động ở trạng thái hoàn
  thành hoặc hủy có lý do; tiêu chí đánh giá hiệu lực đặt trước; lần đánh giá
  hiệu lực cuối là "hiệu quả", ngày đánh giá sau ngày hoàn thành hành động cuối
  cùng; nguy cơ còn lại không cao hơn ban đầu.

### 5.5. Duyệt (`pending_approval → closed`)

- Capability `nce.approve`, phân tách nhiệm vụ D-09.
- Kiểm lại toàn bộ cổng 5.2 và 5.4 trên dữ liệu hiện tại (ví dụ điểm rerun bị
  hủy sau đó thì chặn).

## 6. Mô hình dữ liệu

Bảng mới, cột `snake_case`. Bảng `actions` cũ giữ nguyên làm nguồn cho
migration và để phục hồi được backup cũ; không đọc/ghi từ mã nghiệp vụ nữa.

| Bảng | Nội dung chính |
| --- | --- |
| `nce_records` | `id`, `nce_id` (duy nhất), `source`, `phase`, `test_id` (có thể NULL), `detected_at`, `occurred_note`, `description`, `hold_results`, `containment_note`, `correction`, `status`, `tier`, `tier_reason`, `risk_severity`, `risk_probability`, `risk_level`, `risk_basis`, `checklist_json`, `cause_status`, `cause_category`, `cause_text`, `cause_check_plan`, `effectiveness_criteria`, `effectiveness_review_due`, `owner_user_id`, `due_date`, `reported_by_user_id`, `created_at`, `updated_at`, `row_version`, `legacy_action_id`, `protocol_version` (= 4) |
| `nce_runs` | `nce_record_id`, `test_id`, `date`, `run_id`, `role` (`trigger` / `repeat_reject` / `rerun`), `snapshot_json` (điểm, giá trị, Mean/SD, z, luật, verdict, lô của mọi mức) |
| `nce_actions` | `id`, `nce_record_id`, `kind` (`corrective` / `preventive` / `system_change`), `description`, `owner_user_id`, `due_date`, `status` (`open` / `done` / `cancelled`), `done_at`, `done_by_user_id`, `evidence`, `cancel_reason` |
| `nce_decisions` | append-only: `id`, `nce_record_id`, `type` (`release`, `patient_impact`, `effectiveness`, `submit`, `approve`, `return`, `cancel`), `payload_json`, `actor_user_id`, `actor_name`, `decided_at` |
| `nce_revisions` | append-only: `id`, `nce_record_id`, `actor_user_id`, `at`, `changes_json` (`{trường: [trước, sau]}`) |
| `nce_cuts` | mốc cắt Westgard/CUSUM: `test_id`, `date`, `run_id` (NULL = sau toàn bộ ngày đó, chỉ dùng cho hồ sơ cũ), `nce_record_id` |

- `users.capabilities_json` (mảng mã capability). Quản trị viên mặc nhiên có
  `nce.release` và `nce.approve`; KTV được cấp từng quyền ở trang Người dùng.
- Mọi lệnh sửa gửi `expectedVersion`; lệch `row_version` trả lỗi `stale`
  ("Hồ sơ vừa được người khác cập nhật, hãy tải lại").
- Sửa nội dung ghi một dòng `nce_revisions` với đúng các trường đổi; giữ nguyên
  đúng giá trị cũ thì `w.noChange()`.

### 6.1. Migration (schema version 3)

Theo khuôn `MIGRATIONS` ở `db/schema.ts`, chạy lại được, kể cả sau khi phục
hồi backup cũ (khóa chống trùng là `legacy_action_id`).

- Dòng `rangeWorkflow` → không chuyển; hiện ở lịch sử dải QC của Nhập QC.
- Dòng còn lại → `nce_records` với `protocol_version = 3`, `checklist_json` /
  mô tả lấy từ `detail_json`; giữ nguyên JSON gốc trong `nce_revisions` dòng
  đầu (`changes_json = {legacy: …}`).
- Trạng thái: hủy → `cancelled`; đã duyệt → `closed`; còn lại → `open`, gắn nhãn
  "hồ sơ phiên bản cũ" (không tự suy ra quyết định cho chạy lại).
- Hồ sơ cũ đã duyệt và hiệu quả có `action_completed_date` → một dòng
  `nce_cuts` với `run_id = NULL`, giữ đúng ngữ nghĩa cắt theo ngày hiện tại
  (CU-05 cũ vẫn tái hiện được cho dữ liệu cũ).
- `point_id` cũ → `nce_runs` (`role = trigger`) theo lần chạy của điểm đó nếu
  điểm còn tồn tại.

## 7. Thay đổi ở các khu vực khác

| Khu vực | Thay đổi |
| --- | --- |
| Westgard/CUSUM | `effectiveQcFixDates()` → `qcCuts(db, testId)` đọc `nce_cuts`; `combinedWestgardByPoint` và vòng CUSUM ở `westgard-handlers.ts:192` cắt theo khóa lần chạy (`compareQcRunKey`), lần chạy rerun thuộc giai đoạn mới |
| Sigma | `listCohorts` / `resolvedActionsDigest` đọc điểm thuộc hồ sơ `closed` (D-11) |
| Hủy điểm (Nhập QC) | loại `analytical`: gắn vào hồ sơ chưa đóng của lần chạy đó, không có thì tạo hồ sơ `open` với người phụ trách = người hủy, hạn theo cấu hình (sửa R-11) |
| Đổi dải QC | bỏ `createRangeAction`; cổng an toàn theo D-12 |
| Tổng quan | quá hạn đọc `overdue_days` của hồ sơ và của hành động |
| Báo cáo | phụ lục NCE đọc `listNce`, hiển thị theo trạng thái mới |
| Đồng bộ / cache | `firebase-handlers.ts:109` và `SUMMARY_PER_TEST_TABLES` đổi `actions` → các bảng `nce_*`; mọi `useStoreInvalidation([... 'actions' ...])` đổi theo |
| Người dùng | thêm ô cấp `nce.release`, `nce.approve` |
| Tài liệu rà soát | ghi phụ lục vào `WESTGARD-REVIEW` (D-03) và `SIGMA-REVIEW` (D-11) trước khi sửa mã tương ứng |

## 8. Hợp đồng IPC (thay toàn bộ 11 kênh `nce:*` cũ)

Khai trong `app/shared/qc-api.d.ts`; mọi lệnh ghi qua `writeCommand()`.

| Kênh | Loại | Ghi chú |
| --- | --- | --- |
| `listNceQueue` | đọc | lần chạy bị loại chưa thuộc hồ sơ đã đóng, tính ở main (sửa R-07, R-17) |
| `listNce` | đọc | dòng tóm tắt + `overdue_days`, `next_step` |
| `getNce` | đọc | toàn bộ hồ sơ: bản ghi, lần chạy, hành động, quyết định, lịch sử, `missing[]` |
| `previewNceRelease` | đọc | đánh giá thử lần chạy rerun ứng viên |
| `createNce`, `attachNceRun`, `updateNce` | ghi | `updateNce` chỉ nhận các trường được sửa ở trạng thái hiện tại |
| `addNceAction`, `updateNceAction`, `completeNceAction`, `cancelNceAction` | ghi | hoàn thành cần bằng chứng |
| `recordNcePatientImpact`, `releaseNce`, `reviewNceEffectiveness` | ghi | quyết định append-only |
| `submitNce`, `approveNce`, `returnNce`, `cancelNce` | ghi | chuyển trạng thái |

Logic thuần (máy trạng thái, cổng, phân tầng, rerun, khoảng nghi ngờ, phân tách
nhiệm vụ) nằm ở `app/main/domain/nce/` để test trực tiếp, không cần SQLite.

## 9. Giao diện

- **Hàng chờ**: mỗi dòng là một lần chạy bị loại (các mức hỏng trong cùng một
  dòng). Nút "Lập hồ sơ" hoặc "Gắn vào NCE-…".
- **Danh sách hồ sơ**: lọc theo trạng thái, quá hạn, "của tôi", "chờ tôi duyệt".
- **Trang hồ sơ** (route riêng): các thẻ theo bước, mỗi thẻ hiển thị nội dung đã
  có ở dạng đọc và chỉ mở form của bước hiện tại. Thanh "Bước tiếp theo / còn
  thiếu" đọc `missing[]` từ main. Nút chỉ hiện khi người dùng có capability.
- Người duyệt thấy toàn bộ hồ sơ ở dạng đọc, lịch sử sửa đổi và các quyết định,
  rồi mới duyệt hoặc trả lại (sửa R-14).
- Không còn ô gõ tên người cho phép, người duyệt; danh tính lấy từ phiên.
- Thuật ngữ đúng mục 3 NCE-PLAN: "xử lý tức thời" ≠ "hành động khắc phục".

## 10. Lộ trình

Giai đoạn 2 và 3 đổi hợp đồng IPC, nên làm trên cùng một nhánh và hợp nhất một
lần (không thêm lớp tương thích tạm, theo quy ước APP-PLAN mục 7). Không vá mã
NCE cũ trong lúc làm.

### Giai đoạn 0 — Chốt và chuẩn bị (xong 2026-10-12)

- Chốt hàng chờ chỉ gồm lần chạy bị loại (D-14).
- Phụ lục D-03 ở `WESTGARD-REVIEW-2026-09-22.md` (thay phần WG-07) và D-11 ở
  `SIGMA-REVIEW-2026-09-22-lan2.md`.
- Commit các thay đổi đang dở trên nhánh `chore/ui-audit` (hàng chờ NCE giữ
  điểm bị loại tới khi có hồ sơ được duyệt; sửa mất số Mean/SD ở chuyển tiếp
  lô). Phần NCE trong đó sẽ bị thay ở giai đoạn 3.
- Con trỏ trong `APP-PLAN.md` trỏ tới tài liệu này.

### Giai đoạn 1 — Domain thuần (xong 2026-10-12, nhánh `feat/nce-redesign`)

Các tệp trong `app/main/domain/nce/`, chưa được handler nào gọi:

| Tệp | Nội dung |
| --- | --- |
| `types.ts` | hằng số trạng thái, nguồn, tầng, kết luận…; kiểu `NceDossier`, snapshot lần chạy |
| `state.ts` | chuyển trạng thái hợp lệ; thao tác sửa được phép theo trạng thái |
| `permissions.ts` | capability, ai được nộp/hủy/trả lại, phân tách nhiệm vụ khi duyệt, ngoại lệ SOP |
| `gates.ts` | cổng 5.1 tạo, 5.2 cho chạy lại, 5.4 nộp duyệt, 5.5 duyệt; bước tiếp theo |
| `rerun.ts` | kiểm lần rerun (D-04) và lần chạy khởi đầu (D-14) |
| `patient-impact.ts` | khoảng nghi ngờ, kiểm quyết định ảnh hưởng bệnh nhân (D-05) |
| `tier.ts` | điểm nguy cơ, tiêu chí ép CAPA, loại sai số, phát hiện tái diễn |
| `actions.ts` | kiểm hành động, hoàn thành, hủy; đánh giá hiệu lực |
| `checklist.ts` | checklist theo nguồn |
| `queue.ts` | hàng chờ theo lần chạy, gợi ý gắn vào hồ sơ đang mở |
| `overdue.ts`, `config.ts`, `format.ts` | quá hạn, cấu hình mặc định, tiện ích ngày/lần chạy |

Test: `nce-domain-state`, `nce-domain-rerun`, `nce-domain-gates`,
`nce-domain-queue` (50 ca, dữ liệu mẫu ở `tests/helpers/nce-fixture.mjs`).

Ca nghiệm thu đã có test thuần: 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15 (phần
kiểm ngày), 16 (phần quá hạn), 20. Các ca còn lại cần CSDL, engine Westgard
hoặc giao diện nên làm ở giai đoạn 2–3: 6, 7 (mốc cắt trong engine), 13
(khóa lạc quan), 14 (lịch sử sửa), 17 (đổi dải), 18 (migration), 19 (Sigma).

Hai điểm handler giai đoạn 2 phải làm đúng vì hàm thuần không tự kiểm được:
verdict của lần rerun truyền vào `checkNceRerun()` phải được đánh giá trong
giai đoạn mới (coi lần rerun là mốc cắt); "hôm nay" truyền vào mọi cổng là
`isoLocalDate()`.

### Giai đoạn 2 — Schema, handler, tích hợp (xong 2026-10-12)

Đã làm:

- Schema 3 (`db/schema.ts`): bảng `nce_records`, `nce_runs`, `nce_actions`,
  `nce_decisions`, `nce_revisions`, `nce_cuts`; cột `users.capabilities_json`;
  migration chuyển hồ sơ cũ (`domain/nce/legacy.ts`), chạy lại được, chạy cả
  sau khi phục hồi backup cũ.
- Đọc/ghi ở `db/nce-repository.ts`; snapshot và hàng chờ ở
  `db/nce-evaluation.ts`; handler viết lại ở `ipc/nce-handlers.ts` (21 thao
  tác, mục 8) và `setUserNceCapabilities` ở `ipc/auth-handlers.ts`.
- Westgard và CUSUM cắt theo `nce_cuts` (`domain/qc-cuts.ts`); Sigma đọc điểm
  đã xử lý từ hồ sơ đã đóng; hủy điểm loại phân tích gắn/tạo hồ sơ theo lần
  chạy; đổi dải QC thôi tạo hồ sơ NCE và cổng an toàn theo D-12; đồng bộ
  Firebase, bộ nhớ đệm tóm tắt và các chỗ nghe thay đổi đổi sang bảng mới.
- Renderer chỉ đổi đủ để chạy: store NCE, Tổng quan, phụ lục Báo cáo, và một
  trang Khắc phục sự cố **tạm, chỉ đọc** (hàng chờ, danh sách, chi tiết).
- Bỏ `nce-validation.ts`, `nce-overdue.ts`, `nce-bias-suggestion.ts`,
  `nce-issues-view-model.ts` cùng test của chúng.
- Test: `nce-handlers.test.mjs` (viết lại), `nce-migration.test.mjs`, helper
  `tests/helpers/nce-flow.mjs`; cập nhật 20 tệp test và e2e bám mô hình cũ.
  Ca nghiệm thu 6, 7, 13, 14, 16, 17, 18, 19 đã có test; cùng các ca của
  giai đoạn 1 là đủ 20 ca. Riêng ca 15 mới kiểm ở mức hàm (tham số "hôm nay")
  và mã hồ sơ theo ngày địa phương lúc chạy test; chưa giả lập đồng hồ ở
  khung 0–7 giờ sáng.

Bổ sung so với kế hoạch ban đầu:

- **D-15.** Hồ sơ không phải IQC nhưng có xét nghiệm (hiệu chuẩn, thiết bị,
  hóa chất, tín hiệu CUSUM…) được kèm một lần chạy QC xác minh khi cho chạy
  lại; lần chạy đó phải từ ngày phát hiện trở đi, đủ mọi mức đang vận hành,
  không mức nào bị loại khi đánh giá trong giai đoạn mới, và cũng ghi mốc cắt.
  Lý do: tín hiệu CUSUM không loại lần chạy nào nên không có lần chạy khởi
  đầu để lập hồ sơ IQC, nhưng sau khắc phục vẫn phải bắt đầu lại chuỗi.
- `hold_results` có thể là "chưa xác định" (hồ sơ tự mở khi hủy điểm); phải
  ghi trước khi cho chạy lại.

Còn lại cho giai đoạn 3: dọn CSS `pages/actions.css` của trang cũ (phần lớn
selector không còn dùng), giao diện cấp quyền NCE ở trang Người dùng, cấu hình
NCE ở Cài đặt. E2E `reload-count` hỏng từ trước giai đoạn 2 (đã kiểm trên
commit `9017e96`), không thuộc phạm vi này.

### Giai đoạn 3 — Giao diện (xong 2026-10-12)

- Trang Khắc phục sự cố viết lại (`renderer/pages/ActionsPage.tsx` và thư mục
  `renderer/pages/actions/`): tổng quan gồm hàng chờ theo lần chạy (lập hồ sơ
  ngay trên dòng, hoặc gắn vào hồ sơ đang mở) và danh sách hồ sơ có thẻ lọc
  (đang xử lý, của tôi, chờ duyệt, quá hạn, đã đóng); `#/actions?id=…` mở một
  hồ sơ với thanh bước, danh sách "còn thiếu" do main tính, tám phần theo quy
  trình, dữ liệu phiên bản cũ (nếu có) và lịch sử.
- Cho phép hoạt động trở lại có bước đánh giá thử lần rerun trong giai đoạn mới
  trước khi ghi; xác nhận nói rõ mốc bắt đầu lại chuỗi Westgard/CUSUM.
- Lỗi `stale` hiện kèm nút tải lại hồ sơ, không ghi đè.
- Trang Người dùng cấp quyền `nce.release` / `nce.approve` cho KTV; trang Cài
  đặt có khối cấu hình NCE (hạn theo tầng, cửa sổ tái diễn, ngoại lệ phân tách).
- Hàm hiển thị thuần ở `main/domain/nce/presentation.ts` (test
  `nce-presentation.test.mjs`); CSS cũ của trang được thay toàn bộ bằng
  `pages/actions.css` mới, tiền tố `nce-`.
- E2E: `nce-flow.e2e.mjs` chạy trọn vòng đời trên Electron (lập từ hàng chờ →
  ảnh hưởng bệnh nhân → cho chạy lại bằng rerun → phân tầng, checklist → nộp
  duyệt → người báo cáo bị chặn → KTV có quyền duyệt đóng); `entry-nce` lập hồ
  sơ bằng nút trên hàng chờ.

Chưa có e2e riêng cho máy trạm LAN thiếu quyền và hai máy cùng sửa một hồ sơ;
hai ca này đã có test handler (`nce-handlers.test.mjs`, `ipc-operations`).
E2E `reload-count` vẫn hỏng từ trước giai đoạn 2, không thuộc phạm vi này.

### Giai đoạn 4 — Thẩm định nghiệp vụ

- Chạy thử cùng người phụ trách chất lượng trên dữ liệu giả lập: một sự cố tầng
  `low`, một sự cố `capa` sai số hệ thống có kết quả đã trả, một sự cố không
  hiệu quả phải bổ sung hành động.
- Điều chỉnh cấu hình mặc định theo SOP.

### Giai đoạn 5 — Mở rộng (tùy chọn)

- Xuất hồ sơ PDF/Excel đầy đủ; phụ lục sau đóng; tệp đính kèm có checksum và
  nằm trong backup; dashboard NCE (theo nguồn, nguyên nhân, thời gian đóng, tái
  diễn); danh sách kết quả bệnh nhân khi có LIS.

## 11. Ca nghiệm thu

1. Lần chạy hỏng mức 1 và mức 2 cùng lúc → hàng chờ có một dòng, tạo một hồ sơ.
2. Lần chạy hỏng tiếp theo của cùng xét nghiệm trước khi cho chạy lại → gắn vào
   hồ sơ đang mở, hồ sơ bị ép tầng `capa`.
3. Rerun là chính lần chạy khởi đầu, trước lần chạy hỏng cuối, thiếu mức, có
   mức bị loại, có điểm đã hủy → bị từ chối, thông báo đúng lý do.
4. Rerun khác lô không giải thích → bị từ chối; có giải thích → được nhận.
5. Cho chạy lại khi chưa có quyết định ảnh hưởng bệnh nhân → bị chặn.
6. 4-1s: ba ngày z = +1,5, ngày 4 bị loại, cho chạy lại bằng rerun z = +1,1 →
   rerun đạt và các lần chạy sau không nối chuỗi cũ; các verdict trước mốc cắt
   không đổi.
7. CUSUM bắt đầu lại từ lần chạy rerun.
8. Cho chạy lại được trước khi hành động khắc phục hoàn thành (R-01).
9. KTV không có `nce.release` / `nce.approve` bị chặn ở main, kể cả qua LAN.
10. Người báo cáo, người phụ trách, người cho chạy lại, người hoàn thành hành
    động, người đánh giá hiệu lực cố duyệt → bị chặn.
11. Tầng `capa` có lần đánh giá cuối "không hiệu quả" → không nộp duyệt được;
    thêm hành động và đánh giá lại "hiệu quả" → nộp được.
12. Hồ sơ `released` không hủy được; hồ sơ `open` hủy phải có lý do ≥ 10 ký tự.
13. Hai phiên sửa cùng hồ sơ → phiên sau nhận `stale`, không mất dữ liệu.
14. Mọi lần sửa nội dung có dòng lịch sử trước/sau đúng trường.
15. Tạo/hoàn thành hành động lúc 01:00 giờ Việt Nam với ngày hôm nay → được
    nhận; mã NCE mang ngày địa phương.
16. Hủy điểm loại `analytical` → hồ sơ có người phụ trách và hạn, quá hạn được
    tính.
17. Đổi dải QC không tạo hồ sơ NCE; cổng an toàn chỉ bật theo D-12.
18. Migration chạy hai lần không tạo trùng; hồ sơ cũ đọc được và có nhãn phiên
    bản cũ; ca CU-05 với dữ liệu cũ cho cùng kết quả như trước.
19. Sigma: điểm bị loại thuộc hồ sơ `closed` không còn chặn nhóm; hồ sơ chưa
    đóng vẫn chặn.
20. Lần chạy chỉ có cảnh báo 1-2s không vào hàng chờ NCE (D-14).
