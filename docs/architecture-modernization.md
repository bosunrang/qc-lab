# Lộ trình hoàn thiện kiến trúc QC Lab

Tài liệu này ghi lại đường cơ sở và thứ tự cải tiến kiến trúc. Mục tiêu là giảm
phụ thuộc ngầm trong global scope mà không viết lại ứng dụng, không thay đổi
nghiệp vụ QC, mô hình offline-first, Firebase hay Electron.

## Đường cơ sở 2026-08-01

- `npm test`: 62/62 file kiểm thử đạt.
- `npm run typecheck`: đạt.
- `npm run verify-release`: đạt cả functional test, dependency gate và
  performance gate.
- Coverage động: 40,5% trên 45 file JavaScript trong `assets`; 9 file chưa được
  test nào nạp tới. Phần thiếu chủ yếu là route/render bị giới hạn bởi sandbox,
  không phải lõi tính toán.
- Source scanner ghi nhận 1.087 tên global trong 44 file cùng chia sẻ một global
  scope, không có tên trùng.
- Worktree sạch trước khi bắt đầu đợt rà soát.

Số liệu benchmark tham chiếu cho bộ dữ liệu 50 xét nghiệm × 3 mức × 730 ngày:

| Chỉ số | Baseline | Ngân sách |
|---|---:|---:|
| Full startup | 571,09 ms | 3.500 ms |
| Cold domain | 3.737,19 ms | 12.000 ms |
| Warm/cold domain | 0,00010 | 0,02000 |
| Display sampling | 31,53 ms | 200 ms |
| Incremental save | 1,05 ms | 500 ms |

Hiệu năng hiện không phải lý do để thay kiến trúc. Lý do chính là kiểm soát
dependency, mutation state và khả năng test độc lập.

## Ranh giới cần giữ

1. `core.js` tiếp tục là lõi domain thuần, dùng chung cho browser, Node và
   Westgard worker.
2. Mọi thay đổi điểm QC phải đi qua service và giữ đúng period-lock, audit,
   cache invalidation cùng partitioned save.
3. Firebase, localStorage/IndexedDB và Electron tiếp tục là hạ tầng; không để
   chi tiết của chúng chảy vào domain.
4. Mọi đợt thay đổi phải giữ release gate xanh và có thể phát hành độc lập.
5. Không thêm framework UI, state library, microservice hoặc bundler chỉ để
   phục vụ việc đổi cấu trúc.

## Bản đồ rủi ro

| Khu vực | Hiện trạng | Rủi ro | Hướng xử lý |
|---|---|---|---|
| Global scope | 1.087 tên global | Phụ thuộc ngầm và collision | Không mở rộng API global tùy ý; gom API theo service |
| Script load order | Hơn 40 thẻ script theo thứ tự cố định | Reorder có thể hỏng runtime | Ghi rõ dependency; ESM chỉ làm sau pilot |
| Mutation state | Một số route/UI sửa `state` trực tiếp | Có thể bỏ sót audit/cache/save option | Gom dần vào command/service |
| Query/render | Một số trang vừa đọc, lọc, sửa state và render | Khó test, rerender có side effect | Tách query/view-model thuần |
| Storage/sync | `save(opts)` gánh nhiều hợp đồng | Caller phải nhớ đúng option | Application command quyết định save policy |
| UI coverage | Route/render có coverage thấp | Hồi quy chỉ xuất hiện trong browser | Giữ visual/a11y/NCE/print check; thêm pure helper test |

## Thứ tự triển khai

### Đợt 1 — Baseline và lựa chọn lát dọc

Đã hoàn thành đường cơ sở ở trên. Lát dọc đầu tiên được chọn là **So sánh hóa
chất** vì:

- dữ liệu nằm trong ba nhánh riêng `reagentTests`, `reagentOperators` và
  `reagentSampleTypes`;
- không tham gia phép tính Westgard hoặc cache điểm QC;
- đã có test cho thống kê so sánh lô;
- file hiện trộn tính toán, mutation, DOM, modal, SVG và báo cáo nên việc tách
  service tạo ra lợi ích có thể đo được;
- rủi ro thấp hơn Entry/NCE nhưng vẫn đủ đại diện để kiểm chứng mô hình
  command/query.

### Đợt 2 — Reagent application service (hoàn thành 2026-08-01)

Tách các thao tác tạo, cập nhật metadata, sửa dòng, thêm/xóa dòng, xóa phép so
sánh và quản lý danh mục nhanh vào một service không truy cập DOM. Service trả
về kết quả có cấu trúc; UI tiếp tục chịu trách nhiệm hỏi xác nhận, thông báo,
rerender và lên lịch save.

Tiêu chí hoàn thành:

- mutation `reagentTests` không còn nằm rải trong các event handler chính;
- service có behavior test cho success, validation và boundary cuối cùng;
- trang không tự thêm bản ghi mặc định trong hàm render;
- toàn bộ baseline tiếp tục xanh;
- không đổi schema backup và Firebase.

Kết quả thực hiện:

- thêm `ReagentComparisonService`, là service thuần không truy cập DOM và không
  tự gọi persistence;
- UI Reagent không còn trực tiếp mutation ba nhánh dữ liệu hóa chất;
- khởi tạo phép so sánh mặc định chuyển từ `pageReagent()` sang `ensureShape()`,
  nên render không còn tạo dữ liệu;
- behavior test chốt create/update/delete, boundary phép so sánh cuối cùng,
  dòng dữ liệu, danh mục nhanh, tích hợp `ensureShape()` và ranh giới source;
- global surface giảm từ 1.087 xuống 1.085 tên dù có thêm service;
- `npm test` đạt 63/63, typecheck, a11y ratchet và release gate đều đạt.

### Đợt 3 — Chuẩn hóa command/query (hoàn thành 2026-08-01)

Dựa trên kết quả pilot Reagent, áp dụng cùng mẫu cho một luồng Entry có phạm vi
nhỏ, ưu tiên ghi chú ngày hoặc metadata trước khi đụng đến record/void QC. Mọi
command phải làm rõ mutation, audit, cache policy và save policy.

Kết quả thực hiện:

- thêm `EntryService.updateDateNoteCommand()` cho luồng ghi chú QC theo ngày;
- command kiểm tra test/ngày, kiểm tra lại period-lock tại thời điểm mutation,
  chỉ sửa các điểm chưa hủy và trả về audit event cùng save policy;
- route không còn gọi mutation primitive `saveDateNote()` hoặc tự quyết định
  cache/persistence policy;
- source-boundary test chốt route phải dùng command và effect `save`;
- behavior test chốt lưu/xóa ghi chú, dữ liệu không tồn tại, input sai và kỳ
  khóa không được mutation;
- `npm test` đạt 63/63, typecheck và release/performance gate đều đạt.

### Đợt 4 — Pilot ES modules (đã thử nghiệm và hoàn tác 2026-08-01)

Pilot chuyển `ReagentComparisonService` sang native ES module để kiểm tra tác
động thực tế lên chuỗi khởi động, Electron, CSP, static HTTP và cách người dùng
mở trực tiếp `index.html`.

Kết quả:

- native ESM chạy được trên static HTTP và Electron `file://` sau khi xử lý thứ
  tự nạp cùng MIME cho `.mjs`;
- Chromium thông thường chặn `import()` khi người dùng mở trực tiếp
  `index.html` bằng `file://`, do giới hạn CORS của module;
- mở trực tiếp bằng double-click vẫn thuộc hợp đồng tương thích của QC Lab, nên
  không thể yêu cầu người dùng luôn khởi động một HTTP server;
- production đã trả `ReagentComparisonService` về classic script `.js`; ranh
  giới service và các behavior test của đợt trước vẫn được giữ nguyên;
- test cấu trúc chốt `app.js` không dùng dynamic `import()` và service classic
  phải được nạp trước `app.js`.

Quyết định sau pilot: chưa đưa native ESM vào bản phát hành nếu chưa có bundler
hoặc chưa chủ động bỏ hỗ trợ browser `file://`. Tiếp tục tách service theo kiến
trúc modular nhưng xuất thành classic script; chỉ xem xét lại ESM khi Vite/Rollup
có thể bundle thành tài nguyên tương thích, hoặc ứng dụng trở thành HTTP/Electron
only.

### Tiếp tục bằng artifact bundler tương thích (2026-08-09)

Điều kiện của quyết định trên đã được đáp ứng: nguồn TypeScript/ES Modules được
Vite bundle thành một IIFE classic tại `assets/generated/modular-pilot.js`.
`index.html` không dùng native `import()` nên vẫn hoạt động qua static HTTP,
Electron và `file://`. `ReagentComparisonService` hiện nằm trong
`src/application/reagent/`, nhận `cleanText`/`cleanId` qua dependency injection;
adapter compatibility là nơi duy nhất nối service với `QCCore` toàn cục.
`EntryService` cũng đã chuyển sang `src/application/entry/`; quy tắc khóa kỳ và
độ chính xác số được truyền vào factory qua adapter, thay vì service đọc
`PeriodService` hoặc `qcValueDecimals` từ shared global scope.
`ManageConfigService` đã chuyển sang `src/application/manage/`, giữ nghiệp vụ
máy/xét nghiệm độc lập với DOM, audit và persistence; `QCCore.cleanText` cùng
`QCCore.cleanId` chỉ được nối tại adapter compatibility.
`PeriodService` đã chuyển sang `src/application/period/` và được adapter khởi tạo
trước `EntryService`; các caller khóa/mở kỳ vẫn dùng API tương thích cũ trong lúc
nguồn đã có dependency và kiểu dữ liệu rõ ràng.
Phần cảnh báo trước khi lưu của `qc-rules.js` đã thành hàm thuần tại
`src/domain/qc/qc-point-warnings.ts`: danh sách điểm được truyền vào rõ ràng, còn
adapter mới đọc `state.data`. Registry và ngữ nghĩa Westgard vẫn chỉ ở `core.js`.
Sáu file `*-ui-state.js` đã được thay bằng `src/presentation/state/ui-state.ts`.
Một installer có kiểu dữ liệu duy trì cả namespace bag và global accessor cũ;
`localStorage` của khóa đăng nhập chỉ được đọc tại compatibility adapter.
`LISClientService` đã chuyển sang `src/application/lis/`: phần đồng bộ, timeout,
polling và nhập điểm không tự đọc DOM hay storage. Modal/cấu hình LIS được giữ ở
`assets/modules/lis-queue-ui.js` như một lớp presentation riêng.

## Điều không làm trong lộ trình này

- Không viết lại React/Vue/Svelte.
- Không thay Firebase hoặc schema dữ liệu nếu không có yêu cầu nghiệp vụ.
- Không chuyển hàng loạt sang TypeScript.
- Không đổi đồng thời UI, state, persistence và build system.
- Không dùng mốc thời gian đơn lẻ làm test hồi quy cache hoặc hiệu năng.
