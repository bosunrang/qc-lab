# Registry nguồn TEa

Registry schema: `v1`  
Ngày rà soát: `2026-07-16`

## Nguyên tắc

- CLIA trong ứng dụng là tiêu chí chấp nhận proficiency testing được dùng làm mục tiêu TEa tham khảo; không phải tuyên bố đơn vị tuân thủ CLIA.
- Ricos/Westgard là bộ desirable biological-variation specifications legacy, cập nhật lần cuối năm 2014.
- EFLM là database sống. Mỗi giá trị nhập từ EFLM phải lưu analyte, mức APS, ngày tra cứu và link/tài liệu tại thời điểm áp dụng.
- Mỗi kỳ Sigma lưu snapshot ID nguồn, phiên bản, URL, ngày hiệu lực và thông tin rà soát. Thay registry sau này không được làm đổi truy xuất của kỳ cũ.
- Chỉ quản trị viên được sửa giá trị hoặc metadata nguồn. Mọi thay đổi phải ghi audit.

## Nguồn đăng ký

### CLIA PT

- Registry ID: `clia-cms-3355-f-2024`
- Version: `CMS-3355-F / 42 CFR §§493.931, 493.941`
- Hiệu lực dùng trong ứng dụng: `2024-07-11`
- eCFR: https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-493/subpart-I
- CMS memo: https://www.cms.gov/medicare/health-safety-standards/quality-safety-oversight-general-information/policy-memos/policy-memos-states-cms-locations/revised-final-rule-clinical-laboratory-improvement-amendments-1988-clia-proficiency-testing-analytes

### Ricos / Westgard biological variation

- Registry ID: `ricos-bv-2014`
- Version: `2014`
- Trạng thái: `legacy/retired`
- Nguồn: https://westgard.com/clia-and-quality-regulation-requirements/quality-requirements/biodatabase1.html

### EFLM Biological Variation Database

- Registry ID: `eflm-bv-live`
- Version: `Live database`
- Trạng thái: `dynamic`
- Nguồn: https://biologicalvariation.eu/
- Trích dẫn database theo hướng dẫn EFLM và ghi ngày truy cập cho từng lần áp dụng.

## Quy trình cập nhật

1. Kiểm tra nguồn chính thức và ngày hiệu lực.
2. Đối chiếu tên measurand, matrix, đơn vị và dạng giới hạn phần trăm/tuyệt đối.
3. Không quy đổi giới hạn tuyệt đối khi chưa xác nhận tính tương thích đơn vị.
4. Cập nhật version registry và metadata nguồn.
5. Bổ sung case kiểm thử cho mọi giá trị hoặc quy tắc thay đổi.
6. Người có thẩm quyền của đơn vị rà soát, ghi ngày và phê duyệt theo SOP trước khi áp dụng.

## Phạm vi thay đổi v1

Registry v1 bổ sung quản trị nguồn và snapshot lịch sử. Các giá trị số TEa mặc định trước đó được giữ nguyên để tránh thay đổi kết quả Sigma khi chưa hoàn tất đối chiếu từng analyte với nguồn và đơn vị tương ứng.

## Phạm vi thay đổi v2

Registry v2 bổ sung `analyteId` ổn định cho từng measurand và tách định danh khỏi tên hiển thị. Bảng TEa, Sigma và cấu hình xét nghiệm ưu tiên liên kết bằng `analyteId`; giao diện chỉ dùng một tên quốc tế và một viết tắt thống nhất. Dữ liệu v1 được tự động chuẩn hóa khi nạp, không thay đổi các giá trị TEa hoặc kết quả Sigma đã lưu.

Registry v2 đồng thời mở rộng danh mục cơ bản cho huyết học và đông máu. Tiêu chí CLIA tại 42 CFR §493.941 được nhập cho erythrocyte count, hematocrit, hemoglobin, leukocyte count, platelet count, fibrinogen, partial thromboplastin time và prothrombin time/INR. MCV, MCH, MCHC, RDW và D-dimer được giữ `null` ở nguồn CLIA vì bảng tiêu chí này không quy định giới hạn phần trăm tương ứng; không tự suy diễn TEa.
