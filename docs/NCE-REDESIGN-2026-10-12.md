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
| D-09 | Duyệt đóng hồ sơ cần capability `nce.approve` và người duyệt không phải người báo cáo, người phụ trách, người xác minh kỹ thuật, người đánh giá ảnh hưởng bệnh nhân, người cho chạy lại, người hoàn thành hành động hay người đánh giá hiệu lực | ISO 15189:2022 5.4 (trách nhiệm, thẩm quyền), 8.7; NCE-PLAN mục 10 |
| D-10 | Hồ sơ đã cho chạy lại không được hủy (hủy sẽ làm đổi mốc cắt Westgard); chỉ hủy được khi còn ở `open` | Toàn vẹn hồ sơ QC |
| D-11 | Sigma coi điểm bị loại "đã xử lý" khi hồ sơ chứa điểm đó ở trạng thái `closed` (thay cho "duyệt + hiệu quả"; hồ sơ tầng `capa` chỉ đóng được khi hiệu quả) | ISO/TS 20914 như đã chốt ở `SIGMA-REVIEW-2026-09-22-lan2.md` |
| D-12 | Đổi dải QC không phải NCE: thôi ghi vào bảng NCE (lịch sử đã có ở `test_levels.mean_sd_history_json` và audit). Cổng an toàn đổi dải chỉ bật khi có NCE sai số hệ thống **chưa đóng** hoặc gắn **lô đang dùng** của mức đó | Kiểm soát thay đổi khác với sự không phù hợp (ISO 15189:2022 8.5 so với 7.5) |
| D-13 | Mọi ngày "hôm nay" ở main lấy theo giờ địa phương của máy chính (`isoLocalDate()`); thời điểm lưu ISO đầy đủ | Thống nhất với quy tắc quá hạn hiện có |
| D-14 | Hàng chờ NCE chỉ gồm lần chạy bị **loại**; cảnh báo (1-2s và mọi luật đặt hành động "Cảnh báo") không vào hàng chờ, vẫn hiện ở Nhập QC và Tổng quan. Người dùng vẫn có thể tự mở NCE từ nguồn khác khi cần. Người dùng xác nhận ngày 2026-10-12 | Westgard: 1-2s là quy tắc cảnh báo, không loại lần chạy |
| D-15 | Hồ sơ không phải IQC có xét nghiệm được kèm một lần chạy QC xác minh khi cho chạy lại (từ ngày phát hiện, đủ mức đang vận hành, không bị loại trong giai đoạn mới) và lần chạy đó cũng là mốc cắt. Thêm ngày 2026-10-12 khi làm giai đoạn 2 | Westgard bài 18 như D-03; tín hiệu CUSUM không loại lần chạy nào nên cần đường này để bắt đầu lại chuỗi |
| D-16 | Ngày phát hiện thực tế khác ngày lập hồ sơ. Khi ghi sai, chỉ đính chính ở `open` với quyền `nce.release`, lý do có căn cứ và lịch sử trước–sau. Không đổi ngày QC, mã NCE, thời điểm lập/quyết định; không đính chính sau release | Người dùng yêu cầu ưu tiên xử lý hồi cứu ngày 15/10/2026; toàn vẹn hồ sơ, không tự lùi ngày để nhận bằng chứng cũ |
| D-17 | Tại thời điểm 15/10/2026 chỉ dùng checklist hiện hành, chưa thêm ngưỡng khi thiếu SOP. Phần “không thêm” được **D-18 thay thế** sau khi người dùng cung cấp hướng dẫn ngày 27/10/2026; nguyên tắc không đòi CAPA xong trước release vẫn giữ nguyên | Lịch sử quyết định trước khi có tài liệu nguồn; D-18 ghi phạm vi bổ sung |
| D-18 | IQC ngoài kiểm soát có bước xác minh kỹ thuật riêng, bổ sung môi trường, TEa/Bias/SD và nhánh xem xét Mean/SD; mọi phép tính chỉ là tín hiệu kỹ thuật, quyết định lâm sàng vẫn do người có thẩm quyền ghi riêng | Hướng dẫn người dùng cung cấp ngày 27/10/2026; chi tiết và công thức ở phụ lục D-18 phía dưới |
| D-19 | Quyết định ảnh hưởng bệnh nhân lưu **phạm vi đã rà soát** do main chụp (lần đạt cuối, lần đầu chuỗi vi phạm, lần chạy QC mới nhất lúc ghi). Cho chạy lại, nộp và duyệt bị chặn khi phạm vi đó không bao phủ khoảng nghi ngờ hiện tính: bắt đầu muộn hơn, hoặc chưa tới lần rerun. Quyết định cũ không có phạm vi phải ghi lại | ISO 15189:2022 7.3.7.2 (đánh giá kết quả bệnh nhân từ lần IQC thành công cuối), 7.5; sửa hạng mục "chưa ràng buộc phạm vi" ghi ở đợt 16/10 |
| D-20 | `SEobs = \|Bias sự cố − Bias ổn định\| / SD` — cùng mốc với ΔSEcrit. Bias sau khắc phục chỉ bắt buộc ở nhánh xây lại Mean/SD, không chặn cho chạy lại | Westgard, sai số hệ thống tới hạn: ΔSEcrit tính từ Bias nền nên dịch chuyển phải đo từ cùng mốc; D-02 (một lần rerun đạt là đủ để hoạt động trở lại). Rà soát 28/10/2026, thay công thức cũ của hướng dẫn 27/10 |
| D-21 | Ghi quyết định ảnh hưởng bệnh nhân cần capability `nce.release` (cùng thẩm quyền cho hoạt động trở lại); thẩm quyền theo mức độ vẫn chờ SOP | ISO 15189:2022 5.4, 7.5; nguyên tắc ở D-18 "quyết định lâm sàng do người có thẩm quyền ghi" |
| D-22 | Khoảng nghi ngờ bắt đầu sau lần đạt cuối **trước lần chạy đầu tiên của chuỗi vi phạm**. Luật loại bỏ đếm nhiều lần chạy (2-2s, 4-1s, 6x, 8x, 9x, 10x, 12x, 7T…) lần ngược theo điểm làm bằng chứng của engine; luật cảnh báo không kéo dài khoảng. Khoảng tính trên đúng lô của lần khởi đầu | Các lần chạy trong chuỗi từng được chấp nhận nhưng đã mang sai số; ISO 15189:2022 7.3.7.2 nêu mốc "lần IQC thành công cuối", nhìn lại sau khi luật nổ thì các lần đó không còn là lần thành công |

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
- Checklist theo nguồn đã đánh giá; mục bất thường/không áp dụng phải có
  bằng chứng/lý do. Mục này được đưa lên trước release theo D-17.
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

### Cập nhật giao diện 2026-10-14

- Tổng quan có bốn mục ưu tiên (QC chưa có hồ sơ, đang xử lý, chờ duyệt,
  quá hạn), thẻ từng sự cố, tìm hồ sơ không dấu và bảng hồ sơ năm cột.
- Tám phần của hồ sơ được gom vào bốn bước điều hướng: ghi nhận, cho hoạt
  động trở lại, điều tra/CAPA, phê duyệt/lịch sử. Mở bước theo `next_step`
  và `missing[]` của main; danh sách điều kiện còn thiếu được thu gọn và
  từng mục dẫn tới phần cần hoàn thiện. Hồ sơ chờ duyệt mở toàn bộ bằng chứng.
- Chuyển bước giữ bản nháp. Bản nháp nội dung và hành động giữ phiên bản lúc
  mở form; thông báo thay đổi không nâng phiên bản của bản nháp. Khi `stale`,
  tải dữ liệu mới cần xác nhận bỏ bản nháp. Hồi quy Electron ở
  `app/e2e/nce-workspace.e2e.mjs` kiểm tìm kiếm, chuyển bước và xung đột sửa.
- Đợt này thay giao diện và bảo vệ bản nháp; không đổi các cổng nghiệp vụ NCE.

## 10. Lộ trình

### Bổ sung 10/11/2026 — làm lại bước Phê duyệt & lịch sử

- Một panel chung, gồm trạng thái/thao tác quyết định và lịch sử bên dưới.
  Nút xem toàn bộ bằng chứng nằm trên header; bỏ lời nhắc đứng ngoài khung.
- Vùng trạng thái có viền trái xanh dương nhẹ, cỡ chữ theo hệ thống. Hiển
  thị đúng trạng thái chưa đủ điều kiện, sẵn sàng nộp, chờ duyệt, đã đóng
  hoặc đã huỷ; danh tính và thời điểm lấy từ quyết định đã lưu.
- Điều kiện thiếu do main trả về nằm ngay dưới vùng nộp duyệt, thu/mở được
  và từng điều kiện dẫn tới đúng bước cần bổ sung. Yêu cầu trả lại có người
  ghi, thời điểm và nội dung riêng; phần duyệt giữ ghi chú của từng vòng.
- Lịch sử trình bày theo trục dọc, giữ nguyên thứ tự và mốc từ main, mở được
  snapshot QC tại từng mốc. Nhật ký quyết định/chỉnh sửa chi tiết vẫn thu gọn.
- Huỷ hồ sơ lập nhầm thu gọn riêng, giữ quyền, lý do và xác nhận hiện hành.
  Tách giao diện bước cuối vào `DossierReview.tsx`, không đổi IPC hay cổng ghi.

### Rà soát 10/11/2026 — dọn mã và quy tắc giao diện NCE

- Gộp CSS điều hướng, bỏ selector từ bố cục cũ, khai báo lặp và các phần
  ghi đè không còn cần. Bảng giữ cấu trúc `table`, cuộn qua khung bao;
  giữ căn giữa bảng snapshot, cột ngắn và mật độ theo hệ thiết kế.
- Nút sửa/huỷ hành động dùng `RowActionButton`; huỷ vẫn cần lý do và giữ
  lịch sử. Tiêu đề khung/nhóm/nội dung con có cấp rõ ràng, giữ thang chữ
  16/14/13px và viền nhấn xanh dương hiện hành.
- Sửa đua phản hồi ở danh sách: chỉ lần tải mới nhất được cập nhật dữ liệu,
  trạng thái tải và lỗi. Lỗi/đọc cũ không ghi đè kết quả mới.
- Lập hồ sơ và gắn lần chạy dùng khoá thao tác chung, có hạn chờ và bắt lỗi.
  Phản hồi thiếu mã/phiên bản hoặc sai hồ sơ không được nhận là thành công;
  lệnh chưa rõ kết quả không tự gửi lại. Đọc để đối chiếu không gỡ hộp thoại
  lập hồ sơ đang mở khi danh sách rỗng, tránh mất bản nháp và khoá gửi lại.
- Tách trạng thái đang gửi lệnh khỏi trạng thái khoá ghi do chưa rõ kết quả:
  hộp thoại CAPA không đóng trong lúc lưu, nhưng thoát được sau lỗi kết nối
  để đối chiếu dữ liệu. Nội dung đang nhập được giữ tới khi chủ động bỏ.
- Khoá dòng bảng QC dùng `pointId`, tránh trùng khi có điểm đã huỷ và điểm
  nhập lại cùng mức/lô. Bỏ helper không có nơi dùng; tách hàm đọc quyết định
  và kiểm tra phản hồi dùng chung, không nhận JSON `null`/mảng/giá trị đơn
  như đối tượng quyết định.
- Không đổi CSDL, IPC hay các cổng nghiệp vụ. Ngoài NCE chỉ bỏ token class
  `eqa-inspector-empty` không có CSS và không có nơi tham chiếu để kiểm tra
  CSS toàn app không bị chặn bởi class thừa sẵn có.
- Kiểm chứng: 628 test tự động đạt; typecheck, lint, CSS parity và build
  đạt. 13 ca Electron liên quan NCE/nhập QC/modal đạt; sau chỉnh cấp tiêu
  đề, chạy lại 4 ca CAPA và dọn lỗi đều đạt. Kiểm tra bảng ở 1647/1000/600px
  không tràn khung; ảnh Electron dùng để rà lại bố cục và căn cột.

### Bổ sung 28/10/2026 — rà soát nghiệp vụ khoảng nghi ngờ và đánh giá kỹ thuật

Rà soát đối chiếu ISO 15189:2022 và Westgard phát hiện bốn chỗ chưa chặt; đã
sửa theo D-19 đến D-22:

- Quyết định ảnh hưởng bệnh nhân không gắn với khoảng nghi ngờ: có thể ghi
  khi khoảng còn ngắn rồi cho chạy lại bằng lần rerun muộn hơn. Nay main chụp
  phạm vi khi ghi; xem trước rerun trả `impact_problems` và nút cho hoạt động
  trở lại bị khóa khi phạm vi không bao phủ (D-19).
- SEobs so với Bias sau khắc phục thay vì Bias ổn định, và việc bắt buộc Bias
  sau khắc phục chặn release của mọi sai số hệ thống (D-20).
- Ai có quyền ghi cũng ghi được quyết định ảnh hưởng bệnh nhân (D-21).
- Luật nhiều lần chạy làm khoảng nghi ngờ bắt đầu quá muộn: 10x nổ ở lần
  thứ 10 thì chỉ lần đó được rà soát (D-22). Khoảng tính trên lô của lần khởi
  đầu, nên đổi lô sau sự cố không làm mất lịch sử.

Hồi quy: `nce-domain-rerun` (chuỗi vi phạm, bao phủ phạm vi),
`nce-domain-technical` (SEobs), `nce-handlers` (thẩm quyền, phạm vi được
chụp), `nce-hardening` H11–H12 (rerun muộn hơn phạm vi, luật 6x trên SQLite).
Còn chờ PXN: một bộ TEa/Bias/SD cho cả hồ sơ dù nhiều mức, thông báo riêng
khi ΔSEcrit ≤ 0, EQA được chọn "không liên quan kết quả bệnh nhân", tín hiệu
vượt ngưỡng chưa là tiêu chí ép CAPA.

### Bổ sung 10/11/2026 — gom Điều tra & CAPA vào một khung

- Phần 6 nằm trong một khung Điều tra & CAPA. Các nhóm nối tiếp bằng đường
  chia nội bộ; bỏ nền header, đường bao và bóng riêng của từng thẻ con.
- Tiêu đề khung 16px, tên nhóm 14px, tóm tắt 13px. Giữ cách mở phần cần
  thao tác và thu gọn phần đã ghi, không thêm tầng điều hướng mới.
- Giữ chế độ xử lý nhanh/CAPA đầy đủ, bản nháp và toàn bộ điều kiện ghi.

### Bổ sung 10/11/2026 — hiển thị Điều tra & CAPA theo tầng xử lý

- Xử lý nhanh ưu tiên phân tầng, nguy cơ và lý do; điều tra/hành động bổ
  sung chỉ mở khi cần. Hành động đang mở vẫn được đưa ra để theo dõi; dữ
  liệu bổ sung cũ có thể mở lại, không bị xoá khi đổi tầng.
- CAPA đầy đủ dùng các nhóm thu/mở Nguyên nhân → Hành động → Hiệu lực.
  Sau khi ghi thành công, mở phần cần xử lý tiếp theo theo mục thiếu từ
  main; phần đã ghi có tóm tắt ngắn và mở lại được để sửa.
- Không ép thứ tự như một cổng ghi mới. Các nhóm vẫn nằm trong DOM, chuyển
  nhóm/bước giữ bản nháp; phần đang thao tác không tự thu gọn khi có cập
  nhật từ cửa sổ khác. Xem toàn bộ hồ sơ vẫn mở đầy đủ cho người rà soát.
- Giữ quyền, kiểm tra dữ liệu, phiên bản và mọi điều kiện nộp/duyệt hiện hành.

### Bổ sung 10/11/2026 — tinh gọn bước Điều tra & CAPA

- Phân tầng và nguy cơ tóm tắt trong một hàng ba mục, dùng viền xanh dương;
  căn cứ phân loại, lý do xử lý nhanh và nguyên nhân trình bày theo hàng
  nhãn–giá trị, bỏ các thẻ nhỏ có màu khác nhau.
- Các thang nguy cơ nhập theo ba cột trên desktop; ngày đánh giá có độ rộng
  gọn. Hành động có thống kê tiến độ, trạng thái trống dùng EmptyState chung;
  giữ đầy đủ thao tác thêm, sửa, hoàn thành và huỷ cùng bằng chứng/lý do.
- Kế hoạch hiệu lực trình bày theo hàng; ưu tiên kết quả đánh giá gần nhất,
  các lần trước thu gọn riêng. Hiển thị bằng chứng, nguy cơ còn lại và căn
  cứ đã lưu của từng lần, không suy lại theo nội dung hiện tại.
- Giữ thang chữ 16/14/13px, quyền, phiên bản bản nháp và mọi cổng nghiệp vụ.

### Bổ sung 10/11/2026 — thống nhất cỡ chữ trong hồ sơ

- Tiêu đề panel dùng 16px; tiêu đề nhóm và nội dung chính dùng 14px; nhãn,
  người ghi, thời điểm và chú thích dùng 13px theo token hiện hành.
- Kết luận trong các thẻ không phóng to bằng tiêu đề panel. Nhãn nhóm
  trong hồ sơ viết thường theo nội dung, không dùng chữ 11px in hoa; phân
  cấp bằng độ đậm và màu chữ. Bảng, badge, nút và ô nhập giữ kiểu dùng chung.
- Áp dụng cho bảy bước và dòng thời gian, không đổi bố cục hay nghiệp vụ.

### Bổ sung 10/11/2026 — chuyển dòng thời gian sang Phê duyệt & lịch sử

- Ghi nhận sự cố chỉ hiện ngày phát hiện, ngày lập và bằng chứng QC gây sự
  cố (lần khởi đầu, các lần bị loại thêm). Đính chính ngày vẫn thực hiện
  cạnh mốc phát hiện, giữ phiên bản, lý do và xác nhận hiện hành.
- Dòng thời gian tổng thể nằm trong Lịch sử hồ sơ ở bước Phê duyệt & lịch
  sử, gồm cả QC chạy lại và các quyết định/hành động về sau. Bảng snapshot
  vẫn mở được tại từng mốc; giữ các lần QC đã gắn chưa có mốc tương ứng.
- Chi tiết quyết định và các lần chỉnh sửa giữ trong mục thu gọn riêng
  cùng thẻ lịch sử. Bằng chứng QC xác minh vẫn nằm cạnh quyết định cho
  hoạt động trở lại. Chỉ đổi vị trí trình bày, không đổi dữ liệu hay cổng.

### Bổ sung 10/11/2026 — tinh gọn bước Cho phép hoạt động trở lại

- Chọn QC, xem đánh giá và ghi căn cứ theo một cột. Bỏ các số bước phụ và
  khung lồng nhau; khi chưa chọn QC không dựng khung kết quả trống.
- Giữ lời nhắc ngắn về QC xác minh và phạm vi quyết định trong một khung
  viền xanh dương; trạng thái Đạt/Chưa đạt vẫn thể hiện ở nhãn kết quả.
- Bảng đánh giá từng mức và các lý do chặn nằm ngay dưới lần QC được chọn;
  căn cứ, điều kiện còn thiếu và nút xác nhận ở cuối. Giữ dữ liệu nháp khi
  chuyển bước. Quyết định đã ghi dùng cùng kiểu viền xanh dương với các
  thẻ thông tin trong hồ sơ, kèm snapshot QC và mốc bắt đầu lại chuỗi.
- Chỉ đổi trình bày; giữ nguồn preview từ main, danh sách QC đã lọc, quyền,
  điều kiện chặn, xác nhận trước khi ghi, phiên bản và audit hiện hành.

### Bổ sung 10/11/2026 — tinh gọn bước Ảnh hưởng bệnh nhân

- Phạm vi cần rà soát nằm trên cùng, các mốc bắt đầu/kết thúc và số lần QC
  trình bày trong một hàng; ngày và mã lần chạy tách dòng để dễ đọc. Giữ
  khoảng nghi ngờ do main tính và lưu ý về luật nhiều lần chạy/QC rerun.
- Quyết định nằm dưới phạm vi. Ưu tiên kết luận gần nhất, người ghi, thời
  điểm, số kết quả và phạm vi đã chụp; lịch sử cũ thu/mở riêng, không thay
  phạm vi lịch sử bằng khoảng nghi ngờ hiện tại.
- Biểu mẫu gọn, có lỗi ngay tại ô nhập và giữ bản nháp khi chuyển bước.
  Không đổi quyền quyết định, số liệu, cổng dữ liệu hoặc audit.

### Bổ sung 10/11/2026 — tinh gọn bước Xác minh kỹ thuật

- Bỏ khung hướng dẫn lớn và viền trang trí. Khi chưa đánh giá, chỉ hiện lời
  nhắc ngắn và nút Ghi đánh giá ở giữa khung; bỏ cột ngữ cảnh bên phải theo
  yêu cầu người dùng. Dữ liệu QC điền sẵn vẫn giữ trong biểu mẫu đánh giá.
- Biểu mẫu chia ba nhóm: bản chất sai số và bằng chứng, đánh giá định lượng,
  kết luận kỹ thuật. Nguồn số liệu điền sẵn thu/mở được; giữ nguyên mọi giá
  trị, điều kiện ghi và cách main tính snapshot.
- Kết quả đã ghi ưu tiên kết luận, người ghi và thời điểm. Phương pháp và
  bằng chứng trình bày theo hàng; số liệu, công thức và căn cứ định lượng
  mở xem khi cần. Khi ghi đánh giá mới, tập trung vào bản nháp, không lặp
  toàn bộ kết quả cũ phía trên. Chuyển bước vẫn giữ bản nháp và phiên bản.
- Lỗi nhập liệu khi ghi đánh giá kỹ thuật được gắn ngay dưới ô liên quan,
  đánh dấu ô và cuộn tới vị trí sửa; không lặp ở đầu hồ sơ. Ánh xạ từ mã lỗi
  main trả về, không sao chép điều kiện nghiệp vụ vào renderer. Lỗi chưa rõ
  kết quả, xung đột phiên bản và lỗi không gắn được ô vẫn giữ ở mức hồ sơ.

### Bổ sung 10/11/2026 — bố cục Hồ sơ liền mạch

- Theo phương án người dùng chọn, phần Ghi nhận trình bày mô tả và người báo
  cáo ở đầu; giai đoạn, người phụ trách và hạn trên một hàng thông tin gọn.
  Xử lý tức thời, kiểm soát kết quả, phạm vi/thông báo và diễn biến bổ sung
  được đọc theo hàng nhãn–giá trị, thay hai thẻ có chiều cao bằng nhau.
- Dùng nền trắng, chữ và đường chia trung tính. Đầu sự cố được nhấn bằng nền
  xám nhạt và một vạch teal mảnh, trạng thái kiểm soát ở bên phải; thông tin
  phụ trách/hạn được tách nhóm. Nội dung phạm vi còn thiếu giữ lời nhắc từ
  `missing[]` của main, không tự suy điều kiện nghiệp vụ. Nút Bổ sung chỉ
  hiện khi được sửa, mở bản nháp và đưa con trỏ thẳng tới ô phạm vi; vẫn cần
  bấm Lưu theo luồng hiện có.
- Dòng thời gian và bằng chứng QC mặc định thu gọn; mở ra vẫn xem được các
  mốc, bảng điểm và thao tác đính chính có căn cứ. Thu gọn không huỷ bản nháp.
- Chỉ đổi cách trình bày; giữ trường dữ liệu, quyền, cổng, lịch sử và quy
  trình lưu/đính chính hiện có.

### Bổ sung 22/10/2026 — tinh gọn phần ghi nhận sự cố

- Chế độ xem của “Ghi nhận và xử lý tức thời” ưu tiên hai thẻ Sự cố / Xử lý
  tức thời; phạm vi và diễn biến là thông tin phụ, bốn trạng thái vận hành
  được gom thành một hàng ngắn để quét nhanh.
- Mốc phát hiện/lập hồ sơ được trình bày thành khối gọn, chỉ hiện cảnh báo hồi
  cứu khi người dùng thực sự mở chức năng đính chính. Bằng chứng lần chạy QC
  mặc định thu gọn, phần tóm tắt vẫn cho biết số mức đạt và bị loại.
- Bỏ khối “Hướng dẫn kết hợp 6 bước” khỏi đầu hồ sơ để tránh lặp lại thanh
  quy trình và làm loãng thông tin vận hành; các cổng nghiệp vụ vẫn giữ nguyên.
- Kiểm tra nhanh đổi từ bảng ba cột sang lưới thẻ hai cột. Mỗi thẻ ưu tiên
  tên và trạng thái; bằng chứng chỉ chiếm chỗ khi có nội dung hoặc đang sửa,
  giúp sáu mục ngắn hơn mà vẫn giữ đầy đủ nhãn và trường nghiệp vụ.
- Các bảng snapshot QC căn giữa cả tiêu đề và nội dung sáu cột để giá trị,
  kết luận và luật thẳng hàng; không tác động các bảng dữ liệu NCE khác.
- Nút mở bằng chứng QC dùng chevron SVG trong khung bo tròn ở mép phải, thay
  tam giác mặc định của trình duyệt và xoay theo trạng thái mở/đóng.
- Không đổi trường dữ liệu, quyền, cổng nghiệp vụ hoặc chế độ sửa; toàn bộ
  bằng chứng chi tiết vẫn mở xem được bằng bàn phím và chuột.
- Kiểm chứng: 410/410 test, typecheck, lint, CSS parity, build và E2E NCE
  đạt; checklist được đo ở năm độ rộng trong cả chế độ xem/sửa, ảnh Electron
  xác nhận bố cục gọn và nội dung dài không tràn.

### Bổ sung 21/10/2026 — màu viền các ô tổng quan

- Bốn ô QC cần lập hồ sơ / Đang xử lý / Chờ duyệt / Quá hạn lần lượt dùng
  vạch viền trái 3px xanh dương, cam, teal, đỏ qua token `info-accent`,
  `warning-accent`, `success-accent`, `danger-accent`. Theo đính chính của
  người dùng, chỉ cạnh trái có màu; ba cạnh còn lại giữ viền trung tính 1px,
  kể cả khi rê chuột.
- Chỉ đổi cách trình bày; giữ số liệu, cảnh báo và thao tác lọc/điều hướng.
  Hồi quy Electron kiểm đủ bốn cạnh ở trạng thái thường và hover.
- Kiểm chứng: 410/410 test, typecheck, lint, CSS parity, build và E2E chọn
  lọc đạt; đã xem ảnh bốn ô và kiểm dev 5174 trả HTTP 200.

### Bổ sung 21/10/2026 — căn cột danh sách hồ sơ

- Căn giữa tiêu đề và nội dung các cột Phụ trách, Tiến độ, Hạn hoàn thành,
  Thao tác; cột Hồ sơ / sự kiện giữ căn trái. Chỉ áp dụng bảng danh sách NCE,
  không đổi bảng hành động, checklist hoặc lịch sử chi tiết trong hồ sơ.
- Bỏ dòng đếm "N hồ sơ trong mục đang chọn" dưới bộ lọc vì số lượng đã hiển
  thị ngay trên từng nút lọc; giữ nguyên số liệu, tìm kiếm và trạng thái rỗng.
- Hồi quy ở 1366/1647px kiểm cả kiểu căn ô và vị trí giữa của nhãn trạng thái,
  nút mở hồ sơ. Không thay đổi dữ liệu, quyền hoặc nghiệp vụ.
- Kiểm chứng: 410/410 test, typecheck, lint, CSS parity và build đạt; E2E
  chọn lọc có ca đo căn cột đạt. Đã xem ảnh bảng và kiểm dev 5174 trả HTTP 200.

### Bổ sung 16/10/2026 — trình bày bảng Kiểm tra nhanh

- Bỏ tình trạng bảng co cụm bên trái: đặt bảng ba cột thật trong khung cuộn
  riêng, phủ đủ chiều ngang. Tên mục, mô tả phụ, kết quả và bằng chứng có
  phân cấp rõ; giữ nguyên nhãn nghiệp vụ và tên truy cập cho ô nhập.
- Bổ sung tiến độ **số mục đã đánh giá**, không đồng nghĩa đủ điều kiện
  release: bất thường/không áp dụng thiếu lý do vẫn bị cổng hiện hành chặn.
  Trạng thái có nhãn chữ, không chỉ phân biệt bằng màu.
- Bằng chứng nhập nhiều dòng, xuống dòng cả chuỗi tham chiếu dài. Hướng dẫn
  chi tiết thu trong mục có thể mở bằng bàn phím; cảnh báo không chỉ chạy lặp
  QC tới khi đạt vẫn luôn hiển thị. Không đổi danh mục hoặc tiêu chí kiểm tra.
- Hồi quy hình học bảng ở 1647/1366/1265/1110/1000px, chế độ xem/sửa, lưu/mở lại ghi
  chú dài và lý do bắt buộc ở `app/e2e/nce-workspace.e2e.mjs`. Chỉ dùng
  dữ liệu/profile tạm, không chỉnh hồ sơ thực tế của người dùng.

Kiểm chứng giao diện: 410/410 test đạt; typecheck, lint, build, CSS parity và
kiểm tra khoảng trắng đạt. Sáu ca E2E liên quan NCE đều đạt, gồm ca bố cục
và nhập bằng chứng mới. Đã xem ảnh chế độ đọc/sửa, xác nhận bảng phủ khung
và không cắt trạng thái khi hẹp. Đây là kiểm thử chọn lọc, không phải chạy
lại toàn bộ E2E của app; lỗi `reload-count` ghi nhận bên dưới không bị sửa.

### Bổ sung 16/10/2026 — gia cố phiên làm việc và phục hồi lỗi NCE

Phạm vi đợt này là ba rủi ro kỹ thuật vừa rà soát: phiên bản của xác nhận
hoàn thành/hủy hành động, lỗi đọc/ghi qua IPC/LAN và phản hồi đọc cũ làm lùi
dữ liệu đang xem. Không đổi schema, hợp đồng IPC, quyền hay cổng nghiệp vụ.

- Tách bộ điều phối một hồ sơ vào `renderer/pages/actions/dossier-session.ts`.
  Mỗi yêu cầu đọc có thế hệ; bắt đầu ghi hoặc rời trang vô hiệu hóa các phản
  hồi cũ. Khóa ghi đồng bộ, gom thông báo trong lúc ghi thành một lần đọc mới.
- Modal hoàn thành/hủy giữ `row_version` và mô tả hành động tại lúc mở, gửi
  đúng phiên bản đó; cập nhật nền không nâng phiên bản của bản nháp. Lỗi được
  hiển thị cả trong modal, không nằm khuất sau hộp thoại khóa tiêu điểm.
- Lỗi đọc có thông báo và nút thử lại; đọc nền lỗi không xóa dữ liệu đã xem.
  Mỗi yêu cầu có giới hạn chờ giao diện 30 giây, không phải thời hạn nghiệp vụ.
- Lỗi transport, phản hồi hỏng, `internal-error` hoặc hết thời gian khi ghi
  được coi là **chưa rõ kết quả**, không khẳng định máy chính đã hoàn nguyên.
  Giữ bản nháp, khóa gửi lại và không tự lặp lệnh. Người dùng cần chủ động tải
  mới để đối chiếu; chỉ bỏ bản nháp/gỡ cảnh báo sau khi đọc thành công.
- Giới hạn chờ không hủy giao dịch phía máy chính; lệnh đến muộn vẫn chịu
  `expectedVersion` ở backend. Phản hồi cũ không được cập nhật lại giao diện.
- Ghi chú duyệt/hủy và xác nhận hủy hồ sơ giữ phiên bản đang rà soát. Chỉ sau
  quyết định thành công mới xóa ghi chú/phiên bản nháp để vòng duyệt kế tiếp
  bắt đầu sạch; lỗi/xung đột vẫn giữ nội dung. Không reset theo cập nhật nền.
- Hồi quy bộ điều phối ở `app/tests/nce-dossier-session.test.mjs`; Electron
  kiểm modal cạnh tranh và vòng trả lại/nộp lại/duyệt. E2E máy trạm HTTPS làm
  mất phản hồi **sau khi main đã commit**, kiểm không tự ghi lặp, không mất
  nháp khi đối chiếu lỗi và không nhận phản hồi đọc cũ sau lần ghi thành công.
  Tất cả dùng SQLite bộ nhớ hoặc profile tạm, không sửa dữ liệu vận hành.

Kiểm chứng cuối đợt 16/10: 410/410 test đạt (19 ca mới cho bộ điều phối);
typecheck, lint, CSS parity, build và `git diff --check` đạt. E2E toàn app
22/23 đạt; toàn bộ ca NCE đạt, gồm vòng trả lại/nộp lại/duyệt không rời trang.
Ca duy nhất còn lỗi là `reload-count.e2e.mjs:32` của Nhập QC: 4 lần
`entry:queryPoints` thay vì 2, `westgard:listTestSummaries` vẫn đúng 1;
đây là lỗi đã ghi nhận từ trước, không sửa hoặc nới assertion trong đợt này.
Ca hai vòng duyệt đã thất bại đúng ở ghi chú/phiên bản cũ trên build trước khi
sửa, rồi đạt trên build mới. Đã xem ảnh phục hồi LAN khi đọc đối chiếu lỗi;
dev `http://localhost:5174/` trả HTTP 200 lúc kiểm tra.

Phân biệt với thẩm định nghiệp vụ: đợt này chưa giải quyết việc chụp/ràng
buộc phạm vi quyết định ảnh hưởng bệnh nhân theo lần rerun đã chọn. Hạng mục
đó cần một đợt sửa domain/handler và kiểm thử riêng, không được coi là đã
hoàn thành nhờ các test phục hồi giao diện. (Đã làm ngày 28/10/2026, D-19.) Các quyết định phụ thuộc SOP ở
bên dưới vẫn chờ PXN phê duyệt; chưa thể xác nhận toàn bộ quy trình đạt chuẩn.

### Bổ sung 15/10/2026 — ưu tiên hồ sơ hồi cứu và cổng xác minh

Người dùng yêu cầu thực hiện theo thứ tự sau (đã triển khai kỹ thuật):

1. Phân biệt ngày lập hồ sơ với ngày phát hiện thực tế. Không tự lấy ngày
   QC cũ làm ngày phát hiện và không đổi ngày điểm QC. Thêm đính chính ngày
   phát hiện khi còn `open`, cần quyền `nce.release`, lý do và lịch sử
   trước–sau; khóa sau release, không ghi lùi thời điểm lập/quyết định.
2. Giữ chặn rerun trước ngày phát hiện, nhưng hiển thị các lần bị loại khỏi
   lựa chọn cùng lý do. Danh sách tự cập nhật khi QC/cấu hình thay đổi.
3. Checklist theo nguồn hiện có phải đủ ngay trước release, vẫn kiểm lại khi
   nộp/duyệt. Không thêm mục hay ngưỡng lâm sàng mới, không bắt CAPA xong
   trước release. Hồ sơ đã release không bị tự đổi trạng thái.
4. Hồi quy ngày không hợp lệ, quyền, trạng thái, xung đột, nguyên tử, lịch sử,
   dữ liệu hồi cứu, giải thích lựa chọn và cập nhật QC ngay khi hồ sơ đang mở.

Đính chính chỉ dành cho dữ liệu ghi sai có căn cứ; nếu thực sự phát hiện sự
cố tháng 10 thì QC tháng 9 không tự trở thành bằng chứng sau phát hiện.
Chưa có SOP được cung cấp; thay đổi này không thay cho thẩm định của PXN.

Chi tiết hiện thực:

- Tạo hồ sơ có lựa chọn nhập hồi cứu; khi bật phải tự chọn ngày thực tế,
  không tự gán ngày QC. Hiện cảnh báo khi QC trước ngày phát hiện đang chọn.
- Bước Ghi nhận có đính chính riêng qua `updateNce` với
  `detectedAtCorrection`, không cho gửi ngày qua patch nội dung. Kiểm ngày có
  thật, không ở tương lai/sau ngày lập/trước trigger/sau hạn hoặc hoàn thành
  liên quan; giữ `expectedVersion`, transaction, revision, audit và notify.
- Bước release giải thích các lần bị lọc (ngày, thứ tự, toàn điểm đã hủy),
  hiển thị 20 lần bị lọc gần nhất khi danh sách dài; ứng viên còn lại vẫn phải
  qua preview và cổng main, không tự được coi là QC đạt. Có trạng thái tải,
  lỗi, nút cập nhật và tự tải lại khi dữ liệu QC/cấu hình thay đổi.
- Preview loại phản hồi cũ, tính lại khi QC đổi; nút release khóa khi preview
  chưa đạt, còn thiếu checklist/quyết định ảnh hưởng hoặc thiếu căn cứ.
- Câu "chưa chọn rerun" ở banner được đổi thành "chưa chốt bằng chứng bằng
  quyết định" vì main không coi lựa chọn nháp trên giao diện là quyết định.
- Kiểm thử trên SQLite bộ nhớ/profile Electron tạm, không sửa dữ liệu vận
  hành của người dùng. Có ca đính chính thành công, sai quyền/ngày/trạng thái,
  xung đột phiên bản, lỗi ghi lịch sử hoàn nguyên, checklist chặn tại main,
  QC mới xuất hiện khi hồ sơ đang mở và điểm bị hủy làm preview đánh giá lại.

E2E toàn app: 20/21 đạt; toàn bộ ca NCE đạt. Ca duy nhất còn lỗi là
`reload-count` của Nhập QC (4 query thay vì 2), đã xác nhận có từ mã gốc ở
đợt trước. Ảnh đã kiểm: danh sách QC bị lọc, form đính chính ngày và preview
sau hủy điểm, ở profile tạm `qclab-e2e-iurmjR`.
Kiểm chứng cuối đợt: 391/391 test đạt; typecheck, lint, CSS parity và build
đạt. Không sửa ngày/hồ sơ thực tế của người dùng thay cho việc xác nhận căn cứ.

### Bổ sung 15/10/2026 — kết hợp hướng dẫn IQC sáu bước

Người dùng yêu cầu đối chiếu và kết hợp `IQC-Dashboard(4).html` với app, sau
đó xác nhận **không có** hai SOP `BMSH-QLCL-IQC-02` và `BMSH-QLCL-TEa-01`
mà biểu mẫu viện dẫn. Vì vậy bản này là phần mềm/hướng dẫn **chờ thẩm định**,
không phải SOP đã phê duyệt hay chứng nhận ISO.

**Phạm vi đã triển khai, không áp chính sách lâm sàng mới:**

- Sáu bước giao diện: ghi nhận/kiểm soát → kiểm tra nhanh → ảnh hưởng bệnh
  nhân → xác minh/cho hoạt động trở lại → nguyên nhân/CAPA/hiệu lực → duyệt.
  Giữ các cổng của mô hình hiện hành; việc tách bước không tự tăng thẩm quyền.
- Checklist hiện hành chuyển sang kiểm tra nhanh. Hướng dẫn môi trường là
  nội dung tham khảo; chưa thêm mục bắt buộc khi chưa có SOP. Có trường phạm
  vi kiểm soát/thông báo và diễn biến/mốc thời gian, lưu lịch sử từng sửa đổi.
- Schema 4 thêm `containment_note`, `occurred_note`; không tự bịa thời gian
  hay thông báo của hồ sơ cũ. Backup cũ được migration khi phục hồi.
- Rerun không trước ngày phát hiện, kể cả khi đã sau trigger. Lần hỏng mới
  chưa gắn hồ sơ cũng chặn lựa chọn mốc khôi phục cũ; khi kiểm phải xét trong
  giai đoạn mới để không nhầm hậu quả chuỗi trước khắc phục là lỗi mới.
- Lần QC thiếu mức cấu hình/chưa đánh giá không được dùng làm mốc đạt cuối
  cùng để thu hẹp khoảng bệnh nhân nghi ngờ. Cổng rerun IQC vẫn giữ D-04
  (mức của trigger); nếu thiếu mức đang vận hành, xem trước và quyết định
  release lưu cảnh báo phải đối chiếu SOP. Chưa tự đặt số mức bắt buộc mới.
- Ghi mốc cắt bị chặn nếu mốc hoặc các điểm phía sau thuộc kỳ đã khóa.
  Không ghi dở quyết định/mốc/audit khi bị chặn.
- Khi duyệt lại, tính rerun trên đúng lô/Mean/SD của bằng chứng đã chốt và
  dữ liệu điểm hiện tại, không phụ thuộc lô hiện đang gán. Điểm hủy vẫn chặn;
  hồ sơ chưa đóng không biến mất khỏi hàng chờ chỉ vì đổi lô.
- Đánh giá hiệu lực lưu snapshot tiêu chí/nguy cơ/nguyên nhân/hành động do
  main dựng. Sửa căn cứ sau đó phải đánh giá lại; kiểm nguy cơ còn lại ở cổng
  nộp/duyệt. Không tự gắn snapshot hiện tại cho đánh giá cũ chưa có căn cứ.
- Đọc tóm tắt qua API cần đăng nhập. Chi tiết, hàng chờ, nhân sự và xem trước
  chỉ mở cho vai trò được dùng NCE; quyền tóm tắt ở Tổng quan/Báo cáo giữ nguyên.

**Không sao chép từ HTML:** phép so `|Bias|/CV` với cả ΔSEcrit và ΔREcrit,
tự kết luận nguy cơ lâm sàng, yêu cầu đo Bias giống nhau cho mọi sự cố, chữ
ký gõ tay thay xác thực, hoặc xóa vĩnh viễn hồ sơ. ΔREcrit là hệ số tăng
SD/CV; không phải độ lệch Bias chuẩn hóa. Nếu sau này xây công cụ hỗ trợ,
phải phân biệt Bias nền, dịch chuyển quan sát và độ phân tán, đồng nhất đơn
vị, lấy trị tuyệt đối Bias trong mô hình và thẩm định riêng.

**Còn chờ quyết định của PXN:** ngưỡng Bias (TEa/4 hiện vẫn là chính sách
cũ ở đổi dải, đã thêm cảnh báo), mức QC bắt buộc, thời điểm xử lý có bằng
chứng máy, tiêu chí/cỡ mẫu hiệu lực, ma trận rủi ro, thẩm quyền theo mức độ
và thời hạn lưu hồ sơ. App không tự khóa máy/LIS hoặc phát hành kết quả.
Không được suy từ các test đạt rằng quy trình đã đủ điều kiện vận hành y tế.

Căn cứ đối chiếu:

- [VSQI — TCVN ISO 15189:2025 tương đương ISO 15189:2022](https://tieuchuan.vsqi.gov.vn/tieuchuan/view?sohieu=TCVN+ISO+15189%3A2025).
- [NATA — bảng đối chiếu ISO 15189:2022](https://nata.com.au/files/2023/06/15189-Assessment-Worksheet-2022.pdf), 7.3.7.2, 7.5 và 8.7.
- [Westgard — Critical-Error Graphs](https://www.westgard.com/lessons/quality-management/lesson5.html).

Hồi quy bổ sung: `nce-hardening.test.mjs`, `ipc-operations.test.mjs` và
`nce-workspace.e2e.mjs`. Chạy trên SQLite bộ nhớ hoặc profile Electron tạm.
Kiểm chứng 15/10: 383/383 test đạt; typecheck, lint, build và CSS parity đạt.
E2E toàn app đạt 19/20, mọi ca NCE đạt; ca còn lỗi là `reload-count` ở Nhập
QC (4 lần query thay vì 2), đã có từ mã gốc và không sửa trong phạm vi này.
Đã xem ảnh workspace sáu bước ở 1366×768 và kiểm căn hàng ở 1366/1647px,
menu mở/thu gọn, cùng bố cục xếp dọc ở 1000px.

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

#### D-18. Bổ sung SOP xử lý IQC ngoài kiểm soát (2026-10-27)

Áp dụng nội dung phù hợp từ tài liệu
`HƯỚNG DẪN HÀNH ĐỘNG KHẮC PHỤC KHI KẾT QUẢ NỘI KIỂM NẰM NGOÀI KIỂM SOÁT VÀ RÀ SOÁT KẾT QUẢ BỆNH NHÂN.docx`
vào protocol 4, nhưng giữ nguyên D-02: cho hoạt động trở lại không chờ hoàn tất
CAPA dài hạn và đánh giá hiệu lực.

- Hồ sơ IQC phải ghi rõ đã dừng/giữ kết quả liên quan, phạm vi kiểm soát,
  người được thông báo và diễn biến theo mốc thời gian trước khi cho hoạt động
  trở lại. Không chấp nhận lựa chọn “không giữ kết quả” cho IQC ngoài kiểm
  soát.
  - **Sửa đổi 10/11/2026 (người dùng đồng ý):** diễn biến theo mốc thời gian
    do app tự dựng từ dữ liệu đã lưu (`domain/nce/timeline.ts`: lần chạy bị
    loại, huỷ điểm, phát hiện, lập hồ sơ, chạy lại, các quyết định, hành động
    đã xong) và hiện ở bước Ghi nhận; ISO 15189 yêu cầu hồ sơ có mốc, không
    yêu cầu gõ lại mốc app đã ghi. Ô `occurred_note` thành “Ghi thêm về diễn
    biến (tuỳ chọn)” và bỏ khỏi cổng. Phạm vi kiểm soát/thông báo vẫn bắt
    buộc; nút “Điền sẵn từ dữ liệu” (`domain/nce/containment-draft.ts`) điền
    xét nghiệm, máy, lô, khoảng nghi ngờ và chừa `[cần ghi]` cho thời điểm giữ
    kết quả và người được báo — còn `[cần ghi]` thì cổng `containment-blank`
    chặn.
- Checklist IQC bổ sung điều kiện môi trường: nhiệt độ phòng, điện và nước cấp.
- Sau kiểm tra nhanh có quyết định append-only `technical_assessment`: bản chất
  sai số, phương pháp xác minh, xử lý và bằng chứng, kết luận kỹ thuật. Sai số
  hệ thống phải có đánh giá định lượng; loại khác được ghi không áp dụng kèm
  lý do.
- Khi đủ dữ liệu cùng đơn vị, app tính snapshot:
  `ΔSEcrit = (TEa − |Bias ổn định|) / SD − 1,65`,
  `ΔREcrit = (TEa − |Bias ổn định|) / (1,65 × SD)`,
  `SEobs = |Bias sự cố − Bias ổn định| / SD` (D-20, thay công thức cũ dùng
  Bias sau khắc phục),
  `REobs = độ phân tán quan sát / SD`. Kết quả chỉ là **tín hiệu kỹ thuật** để
  hỗ trợ người có thẩm quyền đánh giá ảnh hưởng bệnh nhân; không tự kết luận
  một kết quả bệnh nhân hợp lệ hay cần sửa.
- Luật dịch chuyển dài `8x`, `9x`, `10x`, `12x` bắt buộc quyết định riêng về
  Mean/SD. Chỉ ghi “đủ điều kiện xem xét Mean/SD mới” khi có thay đổi hợp lệ,
  dữ liệu độc lập, đã tính chỉ số và `|Bias sau khắc phục| ≤ TEa/4`.
- Quyết định ảnh hưởng bệnh nhân của hồ sơ IQC phải ghi số kết quả đã rà soát;
  nếu sửa báo cáo thì số bị ảnh hưởng phải lớn hơn 0, có mã tham chiếu và thông
  tin đã thông báo. Việc này vẫn tách khỏi quyết định kỹ thuật và quyết định
  cho hoạt động trở lại.

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
- Tinh gọn không gian làm việc hồ sơ (22/10/2026): bỏ banner "Việc cần làm
  tiếp" vốn lặp lại thanh sáu bước; mỗi thẻ bước hiển thị trực tiếp số điều
  kiện còn thiếu hoặc trạng thái sẵn sàng/chờ duyệt. Danh sách thông báo đầy
  đủ của main vẫn được giữ trong mục thu gọn ngay dưới thanh bước và mỗi mục
  tiếp tục dẫn tới đúng phần cần xử lý; giao diện không tự suy đoán bước hoàn
  tất từ thứ tự hiển thị.

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
