# Lộ trình đưa React vào QC Lab

> Tài liệu này ghi quyết định và trạng thái của việc đưa React vào ứng dụng —
> một sáng kiến **mới, tách biệt** với migration TypeScript đã đóng 2026-08-20
> (xem `docs/TYPESCRIPT-MIGRATION-PLAN.md`, mục 2 điều 5). Cập nhật tại đây khi
> chuyển thêm trang, đừng tạo file `NEXT`/`TODO` riêng.

## Vì sao có tài liệu này

Migration TypeScript trước đó (`docs/TYPESCRIPT-MIGRATION-PLAN.md`) từng ghi rõ
quyết định không đưa framework vào — đúng cho phạm vi lúc đó (đổi source từ JS
sang TS, giữ nguyên runtime một global scope). Quyết định 2026-08-29: bắt đầu
đưa **React** vào, phục vụ kế hoạch mở rộng ứng dụng sau này, với lý do kỹ thuật
thuận lợi: tầng `src/domain/**` và `src/application/**` (đã hoàn thành ở
migration trước) xác nhận **hoàn toàn không đụng `window`/`document`/
`localStorage`** — mọi side-effect nhận qua `deps` — nên tái dùng được thẳng cho
React, không cần viết lại.

## Chiến lược: "đảo" (strangler-fig), từng trang một

**Không** viết lại toàn bộ 11 trang cùng lúc. React chạy xen kẽ với bundle cổ
điển (`assets/generated/modular-pilot.js`) trong CÙNG một ứng dụng: trang nào đã
chuyển thì React đảm nhiệm, trang chưa chuyển vẫn dùng code cũ nguyên vẹn. Mỗi
bước phải để lại một bản chạy được — không có big-bang.

## Kiến trúc

- **Build riêng, không đụng build cũ**: `vite.react.config.mjs` biên dịch
  `src/react/react-pilot.entry.tsx` thành `assets/generated/react-pilot.js`
  (IIFE, `minify:true` — khác `modular-pilot.js`/`core.js` vốn `minify:false`
  để giữ code tự viết đọc được; React là thư viện ngoài nên minify để giảm
  dung lượng VÀ tránh false-positive ở `tests/global-name-uniqueness.test.js`,
  vốn quét theo dòng/cột chứ không parse JS thật). `tsconfig.react.json` tách
  biệt khỏi `tsconfig.modules.json` (include riêng `src/react/**`).
- **`index.html`**: `react-pilot.js` load **trước** `core.js`/`modular-pilot.js`
  (thứ tự 3 script defer) — `window.QCLabReact` phải tồn tại trước khi bundle
  cổ điển chạy boot.
- **Cơ chế "đảo"** (`src/presentation/router/router-dispatch-controller.ts`):
  `render()` kiểm `isReactPage(id)` — đúng thì gọi `mountReactPage(id, #main)`
  (mount/unmount qua `ReactDOM.createRoot`, xem
  `src/react/bootstrap/react-page-registry.ts`), sai thì giữ nguyên nhánh
  `innerHTML` cũ. `rerender()` gọi thêm `notifyReactStore()` — một dòng duy
  nhất, mọi call site gọi `rerender()` sau `save()` tự động báo cho React.
- **Cầu nối state** (`src/react/state/renderBus.ts` +
  `src/react/state/useRenderVersion.ts`, bọc `useSyncExternalStore`): component
  React chỉ dùng hook này để biết "khi nào vẽ lại", rồi tự đọc lại dữ liệu qua
  cầu nối (`src/react/bridge/*.ts`, đọc `window.X` một cách LƯỜI — không được
  đọc ở top-level module vì `react-pilot.js` chạy trước `modular-pilot.js`).
  `state` toàn cục không cần trở nên immutable/reactive.
- **Sự kiện**: component React vẫn gắn `data-action`/`data-args` (không dùng
  `onClick=`/`onChange=` của React) cho các thao tác đã có sẵn ở bundle cổ
  điển — bộ lắng nghe `action-dispatcher.ts` không cần sửa gì, các kịch bản
  Playwright hiện có (`ui-workflow-check.js`, `nce-workflow-check.js`,
  `a11y-audit.js`) tiếp tục chạy được. Ngoại lệ: MỌI ô tìm kiếm dùng
  `value=`+`onChange` React thật (state cục bộ, `useEffect` đồng bộ ngược khi
  giá trị đổi từ bên ngoài — ví dụ bấm "Xóa bộ lọc") thay vì
  `data-action-on="input"` — đã kiểm chứng trực tiếp trong trình duyệt rằng
  `value=` + `data-action` (không có `onChange`) khiến React tự đặt lại input
  về rỗng ngay sau mỗi phím gõ. Với Dashboard, `onChange` còn tự lọc dữ liệu
  trong component (dữ liệu nhỏ, không cần gọi lại bundle cũ); với Audit,
  `onChange` gọi thẳng hàm cũ `auditSetQuery()` (giữ nguyên debounce +
  `scheduleSearchRender` đã có, chỉ đổi cơ chế kích hoạt).
- **Không refactor code cũ khi chưa cần**: khi một trang cần dữ liệu mà hàm
  dựng HTML cũ (`pageX()`) đã tính sẵn, thêm một hàm MỚI trả về dữ liệu thuần
  (ví dụ `dashboardModel()` trong `dashboard-page-controller.ts`) thay vì sửa
  hàm cũ trước — một số test khoá nguyên văn dòng cuối của hàm `pageX()`, sửa
  vào đó sớm là rủi ro không cần thiết trong lúc còn giữ song song hai bản. Sau
  khi qua bước kiểm chứng song song (`scripts/react-migration-parity-check.js`)
  thì xoá hẳn bản cũ, không giữ lại "phòng khi cần".

## Trạng thái

| Trang | Trạng thái |
| --- | --- |
| Tổng quan (dash) | **Hoàn tất** (2026-08-29) — chạy bằng React (`src/react/pages/DashboardPage.tsx`), đã qua kiểm chứng song song và **xoá sạch code HTML cổ điển** (`pageDash`/`pageDashLoading`, 25 file `dashboard-*-html.ts`/`dashboard-kpi-items.ts`/`dashboard-test-rank.ts`/`dashboard-test-action.ts`/`dashboard-test-status-tags.ts`/`dashboard-level-pill(s)-html.ts`/`dashboard-latest-point-text.ts`, cùng ~27 test file tương ứng). `dashboard-page-controller.ts` giờ chỉ còn `dashboardModel()`/`dashTestSetStatus`. |
| Nhật ký hoạt động (audit) | **Hoàn tất** (2026-08-29) — chạy bằng React (`src/react/pages/AuditPage.tsx`), đã qua kiểm chứng song song và **xoá sạch code HTML cổ điển** (`pageAudit()` cùng 2 file `activity-audit-page-html.ts`/`activity-audit-row-html.ts` và 2 test file tương ứng). Chỉ còn `root.auditModel()` (dữ liệu thuần) trong `modular-pilot.global.ts`; `tests/audit-filter.test.js` kiểm phân trang qua `auditModel()` thay vì quét HTML của `pageAudit()`. |
| Người dùng (users) | **Hoàn tất** (2026-08-29) — chạy bằng React (`src/react/pages/UsersPage.tsx`), đã qua kiểm chứng song song và **xoá sạch code HTML cổ điển** (`pageUsers()` cùng 2 file `user-row-html.ts`/`users-page-html.ts` và 2 test file tương ứng). Chỉ còn `root.usersModel()` (dữ liệu thuần, gọi lại `userListModel()` như cũ) trong `modular-pilot.global.ts`. Các hàm điều khiển modal/action (`addUser`, `openUserPerms`, `applyUserPerms`, `resetPass`, `applyResetPass`, `toggleUser`, `delUser`) không cần sửa gì — chúng thao tác trên `#modalRoot` (ngoài tầm React) hoặc đọc `document.getElementById(...).value` lúc submit (form không điều khiển). Form "Thêm người dùng" và select vai trò dùng input/`<select>` không điều khiển (`defaultValue`) vì chỉ đọc một lần lúc submit, không có nhu cầu đặt lại giá trị từ bên ngoài. |
| Cài đặt (settings) | **Hoàn tất** (2026-08-29) — chạy bằng React (`src/react/pages/SettingsPage.tsx`), đã qua kiểm chứng song song (khớp tuyệt đối, 164 phần tử, 0 lệch) và **xoá sạch code HTML cổ điển** (`pageSettings()` cùng 8 file `admin-tools-html.ts`/`brand-panel-html.ts`/`brand-preview-html.ts`/`firebase-connection-panel-html.ts`/`firebase-rules-panel-html.ts`/`lis-gateway-panel-html.ts`/`settings-page-layout-html.ts`/`unit-profile-html.ts` và 8 test file tương ứng). Chỉ còn `root.settingsModel()` (dữ liệu thuần) trong `settings-page-controller.ts`. Mọi field (tên đơn vị, logo, Firebase config, LIS Gateway...) là input/textarea/select không điều khiển (`defaultValue`/`defaultChecked`) vì chỉ đọc lúc bấm nút lưu — không trang nào cần đặt lại giá trị từ bên ngoài. `firebaseGuideHtml()` (nội dung `<details>` tĩnh) và `headOnly()` vẫn tái dùng qua `dangerouslySetInnerHTML`; các hàm điều khiển (`saveLab`, `saveBrand`, `pickLogo`, `saveFb`, `checkStorageUsage`,...) trong `settings-page-controller.ts` không cần sửa. |
| Cấu hình chung (manage) | **Hoàn tất** (2026-08-29) — chạy bằng React (`src/react/pages/ManagePage.tsx`), trang lớn nhất tới nay: 8 tab (máy, xét nghiệm, panel, lô/nhóm lô, Mean/SD, chuyển tiếp lô, lịch sử, TEa tham chiếu). Đã qua kiểm chứng song song từng tab (script tự đổi `ManageUIState.manageTab` trước khi so — xem `SUB_TABS` trong script) và **xoá sạch 37 file HTML cổ điển** (`manage-shell-html.ts`, `manage-toolbar-html.ts`, mọi `*-row-html.ts`/`*-table-html.ts` theo tab, cả cụm `target-*-html.ts` của tab Mean/SD) cùng 37 test file tương ứng, cộng các hàm `manageShell`/`manageToolbar`/`manageLots`/`manageInstruments`/`managePanels`/`manageTransitionsV2`/`manageTargets`/`manageAssays`/`manageHistory`/`manageTeaRefs`/`manageView`/`renderManageBody`/`pageManage` trong `manage-page-controller.ts`. Chỉ còn `root.manageModel()` (dữ liệu thuần cho cả 8 tab) cùng các hàm mở modal (`teaRefOpenAdd`, `teaLabProfileOpen`, ...) — modal thêm/sửa máy/lô/panel/xét nghiệm và hồ sơ TEa chuẩn hóa không cần sửa gì vì render vào `#modalRoot`. Bảng Mean/SD (tab phức tạp/rủi ro nhất) giữ nguyên input/checkbox KHÔNG điều khiển (`defaultValue`/`defaultChecked`) — `syncTargetRange()`/`toggleTargetRow()`/`targetCheckAll()` chỉ đọc/ghi DOM trực tiếp của dòng đó, không gọi `rerender()`, nên React không bao giờ vẽ lại các ô này giữa lúc gõ. Panel/Nhóm lô QC (tab Mean/SD) và Xét nghiệm (tab Lịch sử) là 3 `<select>` cần đặt lại giá trị từ bên ngoài (đổi panel/nhóm lô tự sửa lựa chọn không hợp lệ) nên dùng `value=`+`onChange` React thật gọi thẳng `setTargetPanel`/`setTargetGroup`/`setHistoryTest`, giống ô tìm kiếm chung của cả trang (`manageSearchSet`, đổi từ hàm vẽ lại cục bộ `renderManageBody()` sang gọi thẳng `deps.rerender()` — an toàn vì trang giờ do React sở hữu toàn bộ `#main`). |
| So sánh hóa chất (reagent) | **Hoàn tất** (2026-08-29) — chạy bằng React (`src/react/pages/ReagentPage.tsx`). Đã qua kiểm chứng song song (khớp tuyệt đối sau khi sửa script — xem `POST_RENDER` bên dưới) và **xoá sạch code HTML cổ điển** (`pageReagent()` cùng 8 file `reagent-toolbar-html.ts`/`reagent-info-panel-html.ts`/`reagent-pair-panel-html.ts`/`reagent-pair-row-html.ts`/`reagent-results-panels-html.ts`/`reagent-charts-panel-html.ts`/`reagent-select-options-html.ts`/`reagent-empty-page-html.ts` và 8 test file tương ứng). Chỉ còn `root.reagentModel()` (dữ liệu thuần) trong `reagent-page-controller.ts`; `rcCompute()` (tự vá trực tiếp `#rcStats`/`#rcCrit`/`#rcVerdict`/`#rcScatter`/`#rcBland` bằng SVG/HTML string, không qua React) và mọi hàm mở modal (`openRcModal`, `openRcCreateModal`, `rcOpenQuick`, ...) không cần sửa gì. Trang này phát hiện một **lỗi thật** trong khuôn mẫu "input không điều khiển" đã dùng cho Users/Settings/Manage: `rcSel` (chọn phép so sánh) và mọi field trong info/pair panel dùng `defaultValue`/`defaultChecked` an toàn khi chỉ GÕ (vì `rcMeta`/`rcCell` không gọi `rerender()`), nhưng khi ĐỔI SANG một phép so sánh khác (`rcSwitch`/`rcCreateFrom`/`rcPick`/`rcDelete`, đều gọi `rerender()`) mà các phần tử vẫn giữ NGUYÊN vị trí/khoá (cùng `currentId` cũ) thì React tái dùng đúng DOM node cũ và KHÔNG áp lại `defaultValue` mới — hiện đúng dữ liệu của phép so sánh vừa rời đi, không phải phép so sánh vừa chọn (xác nhận trực tiếp trong trình duyệt). Sửa bằng cách bọc toàn bộ toolbar + info/pair panel trong một `<div key={model.currentId} style={{display:'contents'}}>` để ép remount mỗi khi đổi phép so sánh, và khoá mỗi dòng cặp số liệu bằng `${rows.length}-${row.index}` để tránh kẹt dữ liệu cũ khi xoá một dòng ở giữa (dòng sau bị dịch chỉ số nhưng khoá cũ trùng, nếu không thêm `rows.length` vào khoá). Script kiểm chứng song song cũng cần sửa: `rcCompute()` chạy SAU khi `#main` đã vẽ (qua `useEffect` ở bản React, nhưng không có gì gọi lại nó khi ép về bản cổ điển), nên thêm cơ chế `POST_RENDER` gọi `rcCompute()` cho CẢ HAI bản trước khi so, nếu không bản cổ điển bị so ở trạng thái "chưa tính" trong khi bản React đã tính xong. |
| Báo cáo (report) | **Hoàn tất** (2026-08-30) — chạy bằng React (`src/react/pages/ReportPage.tsx`). Đã qua kiểm chứng song song (khớp tuyệt đối, 91 phần tử, sau khi sửa lệch có chủ đích ở ô tìm kiếm) và **xoá sạch code HTML cổ điển** (`pageReportV2()`, `reportLockPanelHtml()`, `reportRangePicker()`, `reportApplySearch()`, cùng 4 file `report-page-html.ts`/`report-range-picker-html.ts`/`report-lock-panel-html.ts`/`report-lock-list-html.ts` và module thuần `report-search.ts` (chỉ còn dùng bởi `reportApplySearch()` nay đã xoá), cộng 5 test file tương ứng). Chỉ còn `reportModel()`/`reportLockPanelModel()` (dữ liệu thuần) trong `report-page-controller.ts`; các hàm khóa/mở khóa kỳ, in, xuất Excel/CSV không cần sửa gì vì đọc DOM trực tiếp lúc gọi hoặc render vào `#modalRoot`. Panel "Khóa kỳ báo cáo" áp dụng khuôn mẫu Reagent NGAY TỪ ĐẦU (không đợi phát hiện lỗi): `<select>` tháng/năm dùng `key={ym}` để ép remount mỗi khi `reportSetLockPart()` đổi kỳ đang chọn (nếu không sẽ dính đúng lỗi stale-`defaultValue` đã gặp ở Reagent). Trong lúc kiểm thử phát hiện một **lỗi thật, có từ trước** (không liên quan React): `exportReportCSV()` luôn crash vì bẫy khởi tạo sớm — `root.qcReportCsvRows` đọc `root.qcReportRowsService` ngay lúc khởi tạo bundle (trước khi biến đó được gán), giống các bẫy đã ghi trong "Module roles" của CLAUDE.md; đã sửa bằng closure đọc lại `root.X` mỗi lần gọi, xác nhận lỗi tồn tại ở CẢ bản React lẫn bản cổ điển trước khi sửa. |
| Six Sigma (sigma) | **Hoàn tất** (2026-08-30) — chạy bằng React (`src/react/pages/SigmaPage.tsx`), trang lớn nhất từ trước tới nay xét theo bề mặt phụ thuộc (~35 hàm/dịch vụ đã bridge). Đã qua kiểm chứng song song (khớp tuyệt đối, 201 phần tử, sau khi sửa lệch có chủ đích ở ô chọn xét nghiệm/tháng/năm) và **xoá sạch code HTML cổ điển** (`pageSigma()`, `sgTrackedOptions()`, cùng 7 file `sigma-analysis-setup-html.ts`/`sigma-no-levels-panel-html.ts`/`sigma-period-table-html.ts`/`sigma-period-table-head-html.ts`/`sigma-period-row-html.ts`/`sigma-charts-panel-html.ts`/`sigma-tracked-options-html.ts`, cộng 7 test file tương ứng). Chỉ còn `sigmaModel()` (dữ liệu thuần) trong `sigma-page-controller.ts`; các panel tính SAU khi vẽ (`#sgStatus`/`#sgTrend`/`#sgMDC`/`#sgFreq`/`#sgMUAction`/`#sgMU`, qua `sgRefresh()` — vốn đã là container rỗng trong HTML cổ điển, không phải thứ mới) và mọi modal (Bias/MU/thêm xét nghiệm/cohort) không cần sửa gì, `sgRefresh()` được gọi lại qua `useEffect` không phụ thuộc, giống hệt `rcCompute()` của trang Reagent. Trang này phát hiện một biến thể MỚI của lỗi stale-`defaultValue` đã gặp ở Reagent/Report: 2 `<select>` tháng/năm của mỗi kỳ (`sgPart()`) không gọi `rerender()` khi đổi THÀNH CÔNG (chỉ `sgRefreshSoon()`), nhưng CÓ gọi `rerender()` khi bị TỪ CHỐI (trùng kỳ) — lúc đó select vẫn phải hiện lại giá trị CŨ dù giá trị JS đó "không đổi" giữa hai lần render. Thử `value=` có điều khiển thật (không state cục bộ) đã **không** khôi phục được DOM — xác nhận trực tiếp trong trình duyệt: `notify()` chạy, model đúng, nhưng select vẫn hiện giá trị vừa bị từ chối, vì React so sánh prop mới với giá trị chính nó nhớ đã set lần trước (không đổi), không so với giá trị DOM thật sự đang hiển thị sau một thao tác native bên ngoài luồng React. Sửa bằng `key={renderVersion}` (đếm tăng mỗi lần `rerender()`, lấy từ `useRenderVersion()`) ép 2 select này remount lại với `defaultValue` mới ở MỌI lần rerender — đúng chi phí của bản cổ điển (dựng lại toàn bộ HTML mỗi lần rerender), chỉ áp riêng cho 2 phần tử nhỏ này chứ không phải cả bảng. Khối `<div key={model.testId}>` bọc toàn bộ phần còn lại của trang tiếp tục dùng đúng khuôn mẫu Reagent để tránh dữ liệu kẹt lại khi đổi xét nghiệm. |
| Phân tích Westgard (westgard) | **Hoàn tất** (2026-08-30) — chạy bằng React (`src/react/pages/WestgardPage.tsx`). Đã qua kiểm chứng song song (khớp tuyệt đối, 418 phần tử, sau khi sửa lệch có chủ đích ở ô tìm nhanh) và **xoá sạch code HTML cổ điển** (`pageWestgard()`, `pageWestgardArchived()`, `wgChartModeTabs()`, `wgViewModeTabs()`, `wgRowsControl()`, `wgLotBlock()`, `pageWestgardCusum()`, cùng 8 file `westgard-mode-tabs.ts`/`westgard-point-rows-html.ts`/`westgard-rows-control.ts`/`westgard-cusum-page-html.ts`/`westgard-lot-block-html.ts`/`westgard-rule-guide-html.ts`/`westgard-rule-toggles-html.ts`/`westgard-export-actions-html.ts` và 8 test file tương ứng, cộng hàm thuần `icoRefArrow()` không còn nơi gọi sau khi các file trên bị xoá). Chỉ còn `westgardModel()` (dữ liệu thuần, hợp nhất cả chế độ "đang vận hành" và "đã dừng/lưu trữ") trong `westgard-page-controller.ts`. Canvas Levey-Jennings tổng hợp (`wgLJMulti`/`wgLJMultiArchived`) và CUSUM (`cusumChart`) KHÔNG cần vẽ lại bằng React — chúng vẫn là thẻ `<canvas>` rỗng y hệt HTML cổ điển, và `afterRender()` (cơ chế `IntersectionObserver`+rAF có sẵn, quét theo class/dataset) tiếp tục vẽ trực tiếp vào đó; điểm khác duy nhất là gọi `afterRender('westgard')` qua `useEffect` không phụ thuộc ở `WestgardPage.tsx` thay vì để `rerender()` tự gọi — vì `rerender()` gọi `afterRender()` NGAY SAU `render()` trong cùng một lượt gọi hàm, còn `createRoot().render()` của React commit KHÔNG đồng bộ, nên `<canvas>` có thể chưa thực sự nằm trong DOM tại thời điểm đó (xác nhận qua khảo sát mã nguồn, không phải qua lỗi thực tế). Bảng điểm QC (dùng chung cho mức hiện hành, lô cũ đã chuyển tiếp, và lô trong nhóm đã lưu trữ) được hợp nhất qua một component `<LevelBlock>` duy nhất thay vì 3 hàm dựng HTML gần giống nhau trước đây. Áp dụng lại khuôn mẫu `key={renderVersion}` đã dùng ở Sigma cho hàng checkbox bật/tắt luật Westgard: `wgSet()`/`wgReset()` chỉ gọi `rerender()` (không có nhánh "từ chối" như Sigma, nhưng "Khôi phục mặc định" đổi NHIỀU checkbox cùng lúc mà không ai trong số đó tự đổi `checked` qua thao tác click — nếu không ép remount, các checkbox giữ nguyên trạng thái cũ sau khi bấm nút này); xác nhận trực tiếp trong trình duyệt bằng `wgReset()` rằng tất cả checkbox cập nhật đúng theo cấu hình mặc định. Phát hiện và xác nhận (không phải lỗi thật, chỉ là đặc điểm môi trường test): cả bản React lẫn bản cổ điển đều KHÔNG tự vẽ canvas trong trình duyệt headless của phiên làm việc này vì `IntersectionObserver` không kích hoạt — gọi thẳng `canvas._ljDraw()` xác nhận hàm vẽ và dữ liệu đều đúng ở cả hai bản, nên đây là giới hạn của môi trường kiểm thử, không phải hồi quy từ việc chuyển sang React. |
| 2 trang còn lại | Chưa chuyển, vẫn chạy code cổ điển như cũ. |

### Thứ tự dự kiến cho các trang còn lại

1. Khắc phục sự cố (NCE) — có bộ Playwright riêng vì lỗi ở đây là lỗi trạng thái `rerender()`. **(tiếp theo)**
2. Nhập QC & Biểu đồ — phức tạp và dùng nhiều nhất, làm cuối cùng.

## Kiểm chứng đã chạy (đầy đủ, kể cả bước dọn dẹp) cho từng trang đã xong

Cả chín trang đều theo cùng một quy trình: `npm run build:pilot` (gồm
`build:react`) → `npm run typecheck` (3 lần gọi tsc) →
`node scripts/react-migration-parity-check.js` (so cấu trúc DOM React vs bản
cũ trước khi xoá — mỗi lần chỉ lệch đúng 1-3 điểm CÓ CHỦ ĐÍCH ở ô tìm kiếm/
select đã ghi lý do trong code, hoặc khớp tuyệt đối như trang Người dùng/Cài
đặt/So sánh hóa chất/Báo cáo) → kiểm tra thủ công qua trình duyệt thật (gõ tìm
kiếm, đổi ngày/số dòng mỗi trang, phân trang, mở modal liên quan, với trang
Manage còn thêm: gõ số vào bảng Mean/SD và xác nhận không bị reset giữa
chừng, bật/tắt checkbox hàng loạt, lưu Mean/SD qua bước xác thực lại mật
khẩu, sửa CLIA/Ricos ở bảng TEa; với trang Reagent còn thêm: đổi qua lại giữa
hai phép so sánh và xác nhận field/select hiện ĐÚNG dữ liệu của phép đang
chọn, xoá một dòng cặp số liệu ở giữa bảng và xác nhận các dòng sau không kẹt
dữ liệu cũ; với trang Báo cáo còn thêm: khóa rồi mở khóa một kỳ qua đủ bước
xác thực lại mật khẩu và xác nhận panel cập nhật đúng, gọi thử cả ba nút
in/Xuất Excel/Xuất CSV không lỗi; với trang Six Sigma còn thêm: nhập CV/Bias
và xác nhận Sigma tính đúng ở cả bảng lẫn panel Tình trạng/biểu đồ, đổi kỳ
sang một tháng đã tồn tại và xác nhận hộp thoại trùng kỳ xuất hiện rồi select
khôi phục đúng giá trị cũ sau khi đóng hộp thoại, đổi qua lại giữa hai xét
nghiệm và xác nhận CV/Bias không kẹt dữ liệu cũ, mở cả 4 modal (thêm xét
nghiệm/Bias/MU/cohort) không lỗi, gọi thử Xuất Excel theo kỳ/tổng hợp và In
PDF theo kỳ/tổng hợp không lỗi; với trang Phân tích Westgard còn thêm: nhập
điểm QC và xác nhận luật Westgard tính đúng (bằng chứng/loại sai số/kết luận),
bật/tắt một luật và bấm "Khôi phục mặc định" rồi xác nhận MỌI checkbox cập
nhật đúng, phân trang "Tải thêm"/"Thu gọn", chuyển đổi Levey-Jennings ↔ CUSUM,
chuyển sang chế độ "đã dừng/lưu trữ", gọi thử Xuất Excel/In PDF không lỗi) →
xoá code cũ → chạy lại `npm test` + `npm run a11y-audit` +
`npm run check-build-freshness` lần nữa. Tổng: `npm test` 507/507 (giảm dần
từ 613 ban đầu do xoá các test file của code cổ điển đã dọn qua từng trang),
`npm run a11y-audit` 0 vi phạm giữ nguyên baseline (bao gồm modal
`users:edit-permissions`/`settings:lis-queue`/7 modal của trang `manage`/2
modal của trang `reagent`/3 modal của trang `sigma`), `npm run
check-build-freshness` khớp cả 4 bundle.
