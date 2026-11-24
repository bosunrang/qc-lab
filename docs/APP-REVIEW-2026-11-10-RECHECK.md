# Kiểm tra lại R01–R06 — 10/11/2026

> Đã triển khai khắc phục RC01–RC03 theo yêu cầu người dùng sau đợt kiểm tra
> lại. Chi tiết ở mục "Khắc phục sau kiểm tra lại"; phần phát hiện bên dưới
> giữ nguyên để truy lại tình huống trước sửa.

Phiên bản kiểm: `df85925422385946510044559d7e449066bf1750`, nhánh
`feat/nce-redesign`. Thư mục làm việc sạch khi bắt đầu. Phạm vi là các sửa
R01–R06 và các đường ghi liên quan; không phải một đợt chứng nhận toàn bộ app.
Không sửa mã sản phẩm hoặc CSDL người dùng.

## Kết luận kiểm tra trước khi sửa

**Chưa thể đóng toàn bộ R01–R06.** R02, R04 và R06 đã đạt các ca đã kiểm.
R01, R03 và R05 đã sửa một phần nhưng còn ba chỗ thiếu kiểm soát được tái hiện
trên handler thật của bản build mới.

| Mục cũ | Kết quả kiểm tra lại |
|---|---|
| R01 — kết luận kỳ khoá | Dừng toàn bộ nhóm sau khi lập NCE đã giữ nguyên số liệu; đổi lô chỉ một mức vẫn làm kết luận kỳ khoá đổi |
| R02 — nhiều mẫu ngoại kiểm | Đạt: mẫu 09-01 z=3,2 và 09-02 z=0,5 cùng máy cùng đợt đều còn; Cần chú ý vẫn có 1 dòng |
| R03 — giữ việc chưa lập NCE | Nhánh đơn máy và các cổng mới đã chặn; nhánh `instrumentIds` và tạo nhóm mới bằng lô đang dùng vẫn bỏ lọt |
| R04 — chữ ký cũ | Đạt: 2 điểm lúc ký, thêm thành 4 điểm thì nhận diện chữ ký cũ và chặn khoá thông thường; ký lại thì hết cờ cũ |
| R05 — huỷ R4s lô cũ | Ca đổi cả hai mức làm nhóm cũ dừng đã đạt; nhóm cũ còn vận hành thì vẫn huỷ được khi lý do rỗng |
| R06 — khoá kỳ tương lai | Đạt: khoá 2027-03 bị từ chối với `future-period` tại ngày kiểm 10/11/2026 |

R04 giữ chính sách hiện hành: quản trị vẫn có thể xác nhận `acknowledge=true`
để khoá khi còn việc tồn; danh sách việc tồn được ghi vào nhật ký. Đây không
phải cổng bắt buộc ký lại tuyệt đối. Không coi hành vi đã được thiết kế và
ghi rõ này là một lỗi mới trong đợt kiểm tra lại.

## Ba phát hiện còn mở

### RC01 — P1: Nhánh sửa xét nghiệm theo nhiều máy chưa giữ hàng chờ NCE

Vị trí: `app/main/ipc/config-catalog-handlers.ts:150`,
`app/main/ipc/config-catalog-handlers.ts:186`.

`saveTest()` chuyển ngay sang `saveTestAssignments()` khi dữ liệu có
`instrumentIds`. Nhánh này ghi `active` qua `w.commit()` nhưng không chụp và
kiểm lại lần chạy bị loại. Cổng mới chỉ được đặt ở nhánh nhận `instrumentId`.
Form danh mục trong `app/renderer/pages/manage/TestsTab.tsx` thực sự có đường
gửi `instrumentIds`; đây không chỉ là một cấu trúc IPC giả định.

Ca thật: xét nghiệm có 1 lần QC bị loại chưa lập hồ sơ, rồi gọi:

```javascript
config.saveTest({
  id: assay.id,
  data: {
    name: 'Glucose', instrumentIds: [instrument.id],
    assignmentIds: [assay.id], active: false,
  },
}, admin);
```

Kết quả: `ok=true`, xét nghiệm chuyển sang không hoạt động (`tests.active=0`),
hàng chờ `1 → 0`; 2 điểm QC vẫn còn, chưa bị huỷ.

Đề xuất: áp dụng cùng cổng giữ lần chạy cho toàn bộ lần ghi nhiều cấu hình
máy, kiểm trong transaction và hoàn nguyên toàn bộ khi mất việc. Hồi quy cần
đi qua đúng cấu trúc form gửi, gồm cả nhiều xét nghiệm được cập nhật cùng lúc.

### RC02 — P1: Nguồn lịch sử bỏ sót lô cũ khi nhóm vẫn đang được sử dụng

Vị trí: `app/main/ipc/historical-evaluation.ts:37`,
`app/main/ipc/report-handlers.ts:102`,
`app/main/ipc/entry-handlers.ts:449`.

Nguồn mới chỉ xét nhóm `active=0` hoặc `status='stopped'` sau khi không tìm
được chuỗi chuyển tiếp. Nhưng một lô của xét nghiệm có thể đã cũ trong khi
nhóm chứa nó vẫn vận hành ở mức khác. Khi đó điểm cũ không được tìm thấy;
biên bản coi nó là chưa đánh giá, còn cổng huỷ quay về đánh giá riêng một mức.

Ca thật, dùng một nhóm mới hợp lệ có hai lô:

1. Nhập hai mức cùng lần chạy: z=+2,5 và z=-2,5, bị loại theo R4s.
2. Lập NCE hợp lệ, ký biên bản tháng 10 và khoá tháng với xác nhận việc tồn.
3. Chỉ đổi lô được gán cho mức 1 sang nhóm mới; mức 2 còn dùng nhóm cũ.
4. Đọc lại biên bản: `rejected_runs: 1 → 0`, `rejected: 2 → 0`,
   `accepted: 0 → 1`; mức 1 trở thành chưa đánh giá. Kỳ vẫn đang khoá.
5. Mở khoá bằng handler với lý do hợp lệ rồi huỷ điểm mức 1, loại
   `data-entry`, lý do rỗng: `ok=true`, `void_rejection_json=''`.

Đây là biến thể còn sót của cả R01 và R05. Đã lập NCE trước khi đổi lô, nên
không phải do bỏ qua điều kiện tiếp nhận sự cố mới thêm ở R03.

Đề xuất: giải kết luận theo toàn bộ ngữ cảnh lần chạy và lô lịch sử, không
phụ thuộc việc cả nhóm đã dừng hay chưa. Cần giữ kết luận theo lần chạy cho
cả mức cũ lẫn mức còn gán hiện hành; chỉ mở rộng truy vấn nhóm mà vẫn ưu tiên
kết luận từ tập hiện hành bị thiếu mức có thể chưa giải quyết hết sai lệch.
Thêm ca đổi một mức trong kỳ đã khoá và ca huỷ điểm R4s ở nhóm vẫn vận hành.

### RC03 — P1: Tạo nhóm mới có thể chuyển lô đang dùng mà không qua cổng R03

Vị trí: `app/main/ipc/config-lot-handlers.ts:280`.

`saveLotGroup()` chỉ gọi `commitKeepingRejectedRuns()` khi có `id`; nhánh tạo
mới gọi `w.commit()` trực tiếp vì giả định nhóm mới chưa vận hành. Tuy vậy,
`validLotIds` có thể chứa lô đang thuộc nhóm vận hành khác, và phần ghi chuyển
`qc_lots.group_id` của lô đó sang nhóm mới.

Ca thật: có 1 lần chạy bị loại chưa lập hồ sơ; tạo thêm một lô dự phòng, rồi
tạo nhóm mới `status='planned'` gồm lô mức 1 đang dùng và lô dự phòng đó.
Lưu thành công, nhóm mới trả `inUse=true`, hàng chờ `1 → 0`, cả 2 điểm QC
vẫn còn và chưa bị huỷ.

Đề xuất: xét ảnh hưởng của các lô được chuyển trước khi quyết định cần cổng
giữ hàng chờ, không dựa riêng vào thao tác tạo hay sửa nhóm. Khi từ chối phải
hoàn nguyên cả nhóm mới lẫn liên kết của các lô cũ.

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| Typecheck, lint | Đạt |
| `npm test` | 649/649 đạt, gồm 9 ca trong `review-2026-11-10.test.mjs` |
| CSS parity | Đạt |
| Build | Đạt; còn cảnh báo chunk lớn hơn 500 kB |
| Electron trong `npm run verify-release` | 35/35 đạt; toàn lệnh thoát 0 |
| Thẩm định số học | 54/54 ca, 804 phép kiểm đạt |

Các hồi quy mới hiện chỉ thử R03 bằng nhánh đơn máy và thử R05 sau khi đổi
cả hai mức, khiến nhóm cũ dừng hoàn toàn. Vì vậy việc chúng đạt không bác bỏ
các biến thể ở trên. Không chạy lại hai bài hiệu năng trong đợt này.

Ca bổ sung được lưu trong
`docs/app-review-recheck-probes-2026-11-10.cjs`:

```powershell
npm run build
node docs/app-review-recheck-probes-2026-11-10.cjs
```

Script chỉ dùng SQLite trong bộ nhớ; in 5 dòng bằng chứng, gồm một ca đối
chứng dừng toàn bộ nhóm đã được sửa đúng. Script quan sát không có nghĩa
`ok=true` là hành vi mong muốn. Script của đợt trước có thể dừng giữa chừng
vì những thao tác nay được chặn đúng; không dùng mã thoát của nó để kết luận
hồi quy chính thức thất bại.

## Khắc phục sau kiểm tra lại

- **RC01:** nhánh `saveTestAssignments()` cũng kiểm việc ngừng dùng các cấu
  hình xét nghiệm. Nếu mất lần chạy chưa lập hồ sơ, hoàn nguyên toàn bộ cập
  nhật nhiều máy cùng nhật ký; gán thêm máy mà giữ nguyên cấu hình cũ không
  bị chặn ngoài ý muốn.
- **RC03:** tạo nhóm bằng lô thuộc nhóm khác đi qua cổng giữ hàng chờ, cùng
  chính sách với sửa nhóm. Cổng tương tự bảo vệ việc đổi `groupId` trực tiếp
  qua `saveLot()`, tránh chuyển cùng một lô bằng một đường ghi khác. Cổng
  chung chỉ ghi nhật ký sau khi đã chấp nhận thay đổi, nên thao tác bị huỷ
  không phát lời báo dữ liệu đổi hay hẹn đẩy đám mây.
- **RC02 / R01 / R05:** nguồn lịch sử đọc cả nhóm còn vận hành khi có lô đã
  thay và còn dữ liệu. Báo cáo và biên bản giữ kết luận của toàn bộ lần chạy
  cũ; cổng huỷ áp dụng cho cả mức đã thay và mức còn dùng. Không trộn các
  điểm của lô cũ vào một lần chạy mới không có lô đó.

Đã thêm **8 ca hồi quy**, nâng nhóm kiểm `review-2026-11-10.test.mjs` từ 9
lên 17 ca: gồm hoàn nguyên dữ liệu/nhật ký, cổng sửa lô trực tiếp, giữ chữ ký
và số liệu kỳ khoá, lần chạy mới, cùng huỷ từng mức của R4s và 1-3s. Script
quan sát kiểm tra lại nay trả đúng: hàng chờ giữ 1 dòng khi thao tác bị chặn,
số lần chạy bị loại của kỳ khoá giữ nguyên 1 và huỷ không lý do bị từ chối.

Trong lượt Electron đầy đủ, ca Ngoại kiểm phát hiện bài kiểm thử đo canvas
khi bố cục vẫn đang chuyển động ở cửa sổ 1366 px. Đo từng khung hình xác nhận
chiều rộng còn đổi từ 594 tới 600 px trước khi đứng yên. Đã sửa đồng bộ trong
`app/e2e/eqa-analysis.e2e.mjs`: đợi kích thước và bitmap khớp trong ba khung
hình liên tiếp, giữ nguyên các điều kiện kiểm độ phân giải và tràn ngang.
Ca riêng đã chạy lại đạt; không đổi mã giao diện Ngoại kiểm.

Kết quả cuối sau khắc phục:

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | 657/657 đạt |
| Typecheck, lint, CSS parity | Đạt |
| `npm run build` | Đạt; còn cảnh báo chunk lớn đã có từ trước |
| Bộ Electron đầy đủ chạy lại trên bản cuối | 35/35 đạt, không bỏ qua ca nào |
| Thẩm định Westgard/Sigma | 54/54 ca, 804 phép kiểm đạt |
| Script tái hiện RC01–RC03 | Giữ hàng chờ, giữ kết luận kỳ khoá, chặn huỷ thiếu lý do |

Đóng RC01–RC03 theo các ca đã kiểm. Chưa chạy lại bài đo hiệu năng hoặc bản
cài `dist`; kết luận này áp dụng cho phạm vi sửa và kiểm thử nêu trên.
