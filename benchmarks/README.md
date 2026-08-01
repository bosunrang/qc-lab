# QC Lab performance benchmarks

## Startup pipeline

Run `node benchmarks/startup-pipeline.js` to profile startup with a representative
109,500-point state (about 15.6 MB of JSON).

The complete pipeline improved from about 3,519 ms to 679 ms on the development
machine: about 81% less time, or 5.2x faster. Representative post-change stages are:

- JSON parse: 88 ms
- Default sanitization with defensive clone: 436 ms
- Post-sanitize invariant validation: 82 ms
- Duplicate-run normalization: 83 ms
- Shape completion after sanitization: 100 ms

Safety boundaries remain explicit: the default sanitizer still returns a defensive
deep clone; the owned-object fast path is limited to freshly parsed storage/import
objects; normal `ensureShape()` callers still sanitize by default; strict date,
duplicate ID, reference, and finite-value checks remain enabled.

## Partitioned startup

Run `node benchmarks/partitioned-startup.js` to compare the small boot shell with
the full QC snapshot. At deployment scale, the initial payload falls from 15.58 MB
to 44.68 KB (99.72% smaller), and shell validation plus initialization takes about
4–5 ms. Full QC hydration continues in the background and must finish before login
can enter the application or Firebase synchronization can begin.

IndexedDB writes rotate between slots A and B. The active marker changes only after
all shell and per-test records have been written, so an interrupted save leaves the
previous slot recoverable. Legacy `qclab` snapshots remain readable and migrate on
the next successful save.

## Large chart rendering

Run `node benchmarks/render-pipeline.js`. Canvas display sampling scans the complete
series but draws at most roughly one marker per two horizontal pixels, preserving
the first/last point, bucket minima/maxima, and every explicitly protected Westgard
violation. Domain calculations and exports still use the complete series.

For 100,000 synthetic points, the display selector returns 639 indices in about
33 ms while retaining both injected spikes and the protected violation. Multi-level
run lookup changed from repeated `indexOf` calls to a `Map`; 10,000 lookups improved
from about 124 ms to 0.31 ms in the local benchmark. On a DPR-1 display, removing
forced 2x supersampling reduces a 1400 × 430 canvas backing store by 75%.

The automated Node canvas-contract test exercises a 20,000-point Levey-Jennings
chart and verifies that marker/tooltip allocation stays bounded.

## Release performance gate

Run the complete pre-release check with:

```powershell
node benchmarks/verify-release.js
```

This runs every `tests/*.test.js` file first, then `npm audit --audit-level=high`.
Only when both checks pass does it run `performance-regression.js`. A failed
functional test, high/critical dependency advisory, exceeded budget, lost display
signal, or non-zero child process exits with a non-zero status suitable for a CI job
or deployment script.

Budgets live in `performance-budget.json`. The gate uses a deterministic 50-test,
3-level, 730-day state (109,500 QC points) and checks:

- boot-shell size relative to the full snapshot;
- shell and full startup time;
- cold domain time plus warm-cache, unrelated-change, and one-test ratios;
- display sample size/time and preservation of endpoints, extrema, and violations;
- indexed run lookup time for multi-level charts.

Ratio/structural checks are the primary regression signals. Absolute millisecond
budgets are intentionally generous to tolerate ordinary differences between local
and CI machines. Tighten them only after collecting several runs on the actual
deployment/CI hardware; do not replace the budget with the fastest observed run.

### Ngày 2026-08-01: nâng kịch bản gate lên cỡ triển khai (`version: 2`)

Trước đó gate chặn ở 20 × 3 × 365 (21.900 điểm) trong khi hình dạng "triển khai
thật" đã được chính repo định nghĩa là 50 × 3 × 730 (109.500 điểm) và có sẵn
profile `deployment` trong `performance-baseline.js` — gate gác ở một phần năm cỡ
thật, nên hồi quy chỉ lộ ra ở cỡ lớn sẽ đi lọt. Đây cũng là cỡ duy nhất mà mốc
`WG_WORKER_POINT_THRESHOLD = 3000` bắt đầu có nghĩa, và là cỡ đáng canh sau khi
`derived()` đổi từ memo thuần sang so chữ ký (đường warm chính là thứ
`warmDomainMaxColdRatio` đo).

Số đo ở cỡ mới (Windows x64, Node v26.4.0, trung vị của 3 lần chạy):

| Phép đo | 21.900 điểm | 109.500 điểm | Ngân sách mới |
|---|---:|---:|---:|
| `bootShellRatio` | 0,00568 | 0,00280 | ≤ 0,006 |
| `shellInitMs` | 2,38 | 5,48 | ≤ 100 |
| `fullStartupMs` | 131,43 | 633,07 | ≤ 3500 |
| `coldDomainMs` | 760,52 | 3.726,86 | ≤ 12000 |
| `warmDomainColdRatio` | 0,00014 | 0,00010 | ≤ 0,02 |
| `oneTestColdRatio` | 0,04271 | 0,01815 | ≤ 0,2 |
| `saveIncrementalMs` | 0,47 | 1,02 | ≤ 500 |
| `saveIncrementalBytesRatio` | 0,05154 | 0,02118 | ≤ 0,05 |

Chỉ hai ngưỡng **thời gian** được nới (`fullStartupMs`, `coldDomainMs`), giữ đúng
khoảng dư ~3–5 lần so với số đo cục bộ như bản cũ — đừng siết chúng lại từ một lần
chạy nhanh trên máy cá nhân. Hai ngưỡng được **siết** (`bootShellRatio`,
`saveIncrementalBytesRatio`) là tỉ lệ **đếm byte thuần**, cho ra cùng một con số ở
mọi lần chạy và mọi máy, nên siết chúng không tạo ra hỏng ngẫu nhiên theo tốc độ
máy — chúng chỉ trượt khi hình dạng dữ liệu boot shell hoặc phân vùng ghi tăng dần
thật sự đổi, đúng thứ cần biết.

Chạy benchmark đầy đủ:

```powershell
node benchmarks/performance-baseline.js
```

Chạy nhanh để kiểm tra benchmark vẫn hoạt động:

```powershell
node benchmarks/performance-baseline.js --quick
```

Stress test dữ liệu 10 năm (50 xét nghiệm × 3 mức × 3.650 ngày = 547.500
điểm QC):

```powershell
npm run benchmark:10y
```

Đây là phép đo định hướng, không phải release gate: chạy trên máy tham chiếu
Windows x64/Node v26.4.0 ngày 2026-08-01 cho snapshot JSON gọn 78,18 MB. Sau
tối ưu tail z-score của accepted-points và gộp CUSUM/moving-average thành một
lượt quét, `cold_domain_all_tests` còn khoảng 11,5 giây,
`one_test_recompute` khoảng 0,19 giây và cache ấm dưới 1 ms; accepted-points
riêng giảm từ khoảng 10,2 giây xuống 2,7 giây trong lệnh benchmark đầy đủ.
Kịch bản giả định một điểm mỗi mức mỗi ngày; labo chạy hai lần/ngày sẽ đạt cùng
số điểm sau khoảng 5 năm.

Smoke-test Web Worker qua HTTP: mở `benchmarks/worker-smoke.html` từ cùng web server
với ứng dụng; trang phải hiển thị `pass`.

## Đường lưu tăng dần (incremental save)

Ghi tăng dần qua `LocalStore.writePartitioned(state, slot, {dirtyTestIds})` đã là
đường lưu mặc định: chỉ ghi lại shell + các phân vùng test thay đổi ngay trên slot
đang hoạt động; một lần ghi đầy đủ (xoay slot A/B) bị ép sau
`LS_FULL_ROTATE_MAX_INCREMENTALS` lần tăng dần liên tiếp hoặc
`LS_FULL_ROTATE_MAX_MS`, để giới hạn cửa sổ mất dữ liệu nếu app tắt giữa một lần
ghi tăng dần (manifest lệch `savedAt` → `readPartitionSlot()` bỏ cả slot, quay về
slot an toàn). Hành vi này được khóa bởi `tests/local-store.test.js` và
`tests/storage-pipeline.test.js`.

`performance-regression.js` đo lại đường lưu ở kịch bản gate (109.500 điểm) với
IndexedDB giả đếm byte qua `put()` (xấp xỉ chi phí structured-clone thật):

| Phép đo | Ngân sách | Ý nghĩa |
|---|---:|---|
| `saveIncrementalPartitions` | ≤ 1 | Tín hiệu cấu trúc: chỉ phân vùng test bẩn được ghi lại |
| `saveIncrementalBytesRatio` | ≤ 0,05 | Byte ghi tăng dần / byte ghi đầy đủ |
| `saveIncrementalMs` | ≤ 500 | Ngân sách tuyệt đối cố ý rộng, không phải tín hiệu chính |

Kết quả tham khảo (2026-07-24, kịch bản gate cũ 21.900 điểm, Windows x64, Node
v24): tỉ lệ byte ~0,05 (ghi tăng dần một test chỉ tốn khoảng 5% byte của ghi đầy
đủ), thời gian 0,56 ms so với 10,49 ms của ghi đầy đủ. Sau khi nâng gate lên
109.500 điểm (2026-08-01, Node v26.4.0): tỉ lệ byte 0,02118 — càng nhiều xét
nghiệm thì một phân vùng bẩn càng chiếm phần nhỏ hơn của snapshot đầy đủ — thời
gian 1,02 ms so với 50,62 ms của ghi đầy đủ (đều là trung vị của 3 lần chạy).

## Baseline ngày 2026-07-14

Môi trường: Windows x64, Node v26.4.0.

| Kịch bản | Điểm QC | JSON | Cold domain | Warm domain | Tính lại 1 test | Westgard toàn bộ | Stringify |
|---|---:|---:|---:|---:|---:|---:|---:|
| Small | 7.300 | 1,03 MB | 626,83 ms | 0,06 ms | 60,87 ms | 138,76 ms | 1,93 ms |
| Deployment | 109.500 | 15,58 MB | 8.412,10 ms | 0,14 ms | 161,21 ms | 1.688,53 ms | 49,12 ms |

`Cold domain` chạy operational index, Westgard, accepted-points và CUSUM cho
toàn bộ xét nghiệm sau khi xóa cache. `Westgard toàn bộ` xóa cache rồi tính lại
Westgard cho toàn bộ xét nghiệm. Mỗi phép đo lặp lại có mảng `samplesMs` trong
JSON in ra stdout để nhận biết độ nhiễu.

## Kết luận baseline

1. Cache ấm hoạt động tốt; đọc lại toàn bộ kết quả gần như tức thời.
2. Xóa toàn bộ cache là bottleneck lớn nhất ở quy mô triển khai.
3. Chỉ tính lại một xét nghiệm rẻ hơn khoảng 10 lần so với tính Westgard cho
   toàn bộ 50 xét nghiệm.
4. Serialize snapshot 15,58 MB đã vượt ngưỡng long-task 50 ms ở một số mẫu,
   nhưng vẫn thấp hơn đáng kể so với chi phí tính lại domain.

Sau tối ưu scoped invalidation, benchmark còn in thêm
`unrelated_change_then_domain_all_tests`. Giá trị này phải xấp xỉ warm cache;
`one_test_recompute` phải chỉ chịu chi phí của xét nghiệm vừa thay đổi dù sau đó
toàn bộ danh sách xét nghiệm được truy cập lại.

Kết quả xác minh scoped invalidation trên kịch bản 109.500 điểm:

| Thao tác sau thay đổi | Trung vị |
|---|---:|
| Thay đổi không liên quan QC rồi đọc toàn bộ domain | 0,15 ms |
| Thay đổi một xét nghiệm rồi đọc toàn bộ domain | 181,34 ms |
| Xóa cache và tính lại Westgard toàn bộ | 1.789,37 ms |

Như vậy thay đổi metadata không còn trả chi phí tính lại domain; thay đổi cục bộ
một xét nghiệm giữ được phần lớn cache của 49 xét nghiệm còn lại.

Thứ tự tối ưu dựa trên số liệu:

1. Tránh `clearDerived()` toàn cục cho thay đổi chỉ ảnh hưởng một xét nghiệm
   hoặc không ảnh hưởng dữ liệu QC.
2. Tránh dựng lại toàn bộ `#main` cho tìm kiếm/thay đổi cục bộ.
3. Chuyển lưu trữ sang ghi tăng dần khi snapshot bắt đầu gây giật giao diện.

## Render cục bộ đã áp dụng

- Tìm kiếm trong Báo cáo chỉ cập nhật danh sách xét nghiệm và trạng thái các
  nút xuất báo cáo.
- Tìm kiếm Westgard chỉ cập nhật bộ chọn khi xét nghiệm hiện tại còn hợp lệ;
  biểu đồ và bảng Westgard không bị tạo lại.
- Tìm kiếm trong Cấu hình chung chỉ dựng lại `.config-shell-main`, giữ nguyên
  header, thanh điều hướng ứng dụng và thanh điều hướng cấu hình.
- Dashboard đã dùng `liveRowFilter`, còn các modal Sigma/Hóa chất đã có renderer
  cục bộ nên không chuyển ngược về full-page render.

## Nguyên tắc so sánh

- Chạy trên cùng máy và cùng phiên bản Node.
- Chạy ít nhất hai lần; bỏ lần đầu nếu máy đang bận hoặc antivirus vừa quét.
- Không đặt ngưỡng pass/fail tuyệt đối từ thời gian máy cá nhân vào test thường.
- Chỉ chấp nhận tối ưu domain nếu toàn bộ test nghiệp vụ vẫn pass.

## Fast path Westgard cho accepted-points

Sau khi profile riêng từng nhánh, `acceptedLotPoints()` được xác định là điểm nóng vì
mỗi ứng viên lại chạy toàn bộ Westgard trên cửa sổ lịch sử. Engine hiện có
`westgardLatestRules()` để chỉ đánh giá điểm cuối với lookback tối đa 12 điểm, đúng bằng
cửa sổ rộng nhất của bộ luật. Quét chuỗi Nx cũng không còn đánh dấu lại toàn bộ cửa sổ
khi một chuỗi dài tiếp tục tăng.

Kết quả xác minh trên kịch bản deployment 109.500 điểm:

| Phép đo | Baseline | Sau tối ưu |
|---|---:|---:|
| Cold domain toàn bộ | 8.412,10 ms | 3.659,47 ms |
| Tính lại một xét nghiệm | 161,21 ms | 70,22 ms |
| Westgard toàn bộ | 1.688,53 ms | 1.503,35 ms |
| Warm domain | 0,14 ms | 0,13 ms |

Fast path được so sánh với engine đầy đủ trên 300 chuỗi giả lập có cấu hình luật và
Mean/SD snapshot thay đổi; tập luật của điểm cuối phải tương đương tuyệt đối.

## Westgard chạy nền

Với dữ liệu từ 3.000 điểm trở lên, dashboard không còn gọi đồng bộ Westgard cho toàn
bộ xét nghiệm trong lượt render đầu. Main thread tạo payload tối giản theo từng xét
nghiệm, worker tự lọc/sắp xếp và trả verdict theo `pointId`; kết quả chỉ được hydrate
khi generation vẫn khớp state hiện tại. Nếu Worker không khả dụng hoặc lỗi, ứng dụng
tự quay về engine đồng bộ.

Ở kịch bản 109.500 điểm, thời gian tạo toàn bộ payload trên main thread là 6,36 ms,
so với khoảng 1.551–1.789 ms cho phép tính Westgard đồng bộ. Smoke-test HTTP tại
`worker-smoke.html` xác nhận worker thực tải và xử lý luật liên mức R4s thành công.

## Progressive rows cho bảng Westgard

Bảng lô hiện hành, lô đã chuyển tiếp và nhóm lô lưu trữ mặc định chỉ tạo DOM cho 120
điểm mới nhất mỗi mức. Người dùng có thể chọn “Xem toàn bộ” và thu gọn lại. Giới hạn
này chỉ áp dụng cho bảng HTML; engine Westgard, biểu đồ, thống kê và file xuất vẫn dùng
toàn bộ dữ liệu.

Với kịch bản 3 mức × 730 điểm, số dòng DOM ban đầu giảm từ 2.190 xuống 360 (khoảng
84%). UI state và cửa sổ dòng được kiểm thử cho bảng ngắn, bảng giới hạn và trạng thái
mở rộng.
