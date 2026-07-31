# QC Lab

Ứng dụng quản lý **nội kiểm chất lượng (IQC)** cho phòng xét nghiệm lâm sàng:
quy tắc Westgard đa mức, chỉ số Six Sigma, biểu đồ Levey-Jennings, so sánh lô
thuốc thử, CUSUM và quy trình QC theo hướng ISO 15189. Toàn bộ giao diện bằng
tiếng Việt.

Phiên bản hiện tại: **2.6.1**

## Đặc điểm kỹ thuật

- **Không build step, không bundler, không runtime dependency** — app trình
  duyệt là file tĩnh thuần (`index.html` + `assets/`), dữ liệu lưu ở
  `localStorage`, mirror dự phòng qua IndexedDB, đồng bộ tuỳ chọn qua Firebase
  Realtime Database (theo từng khoa, `labCode`).
- **Bản desktop** đóng gói bằng Electron + electron-builder (NSIS), có kích
  hoạt license (1 máy = 1 license vĩnh viễn, dùng thử 30 ngày) và tự động cập
  nhật qua GitHub Releases.

## Chạy bản web (phát triển)

Cần bất kỳ static file server nào, ví dụ:

```
python -m http.server
```

rồi mở `http://localhost:8000/`. Không cần `npm install` cho cách chạy này.

## Chạy bản desktop (Electron)

```
npm install
npm start
```

## Test

```
npm test                    # toàn bộ test (chỉ dùng Node core, không cần npm install)
node tests/qccore.test.js   # chạy một file test
npm run typecheck           # TypeScript checkJs trên assets/**/*.js
```

Kiểm tra bằng trình duyệt thật (cần `npm install` + `npx playwright install chromium`):

```
npm run visual-check        # chụp màn in báo cáo (print media)
npm run a11y-audit          # axe-core trên mọi trang/modal, ratchet cứng
npm run print-check         # pipeline in PDF của bản desktop (Electron)
```

Trước khi phát hành:

```
node benchmarks/verify-release.js   # test + performance regression gate
```

Pre-commit hook (`.githooks/pre-commit`) tự chạy test và chặn commit khi fail.

## Đóng gói installer Windows

```
npm run dist            # build local, tạo dist/QC-Lab-Setup-<version>.exe
npm run dist:publish    # build + upload lên GitHub Releases (cần GH_TOKEN)
```

**Lưu ý:** `dist:publish` cần biến môi trường `GH_TOKEN` (GitHub personal
access token, scope `repo`). Tuyệt đối không commit token này.

Bản đã cài sẽ tự kiểm tra cập nhật từ GitHub Releases của repo
`bosunrang/qc-lab` mỗi lần mở app, tải ngầm và chỉ hỏi khi bản mới sẵn sàng.

## Firebase (đồng bộ đám mây, tuỳ chọn)

- Cấu hình nằm ở `assets/modules/app-meta.js` (`window.QCLAB_CLOUD`): `labCode`,
  cờ `anonymous`/`locked` và config Firebase project.
- Firebase Rules mẫu ở `firebase/database.rules.json` — giới hạn truy cập theo
  UID qua nhánh `qclab-acl`. Hướng dẫn cấp quyền chi tiết:
  `firebase/HUONG-DAN-FIREBASE-RULES.md`.
- Sau khi sửa rules, phải deploy lên Firebase Console thì mới có hiệu lực.

## License (bản desktop)

- Khoá RIÊNG ký license giữ bí mật tại máy phát hành (`tools/qclab-license-private-key.pem`,
  đã nằm trong `.gitignore` — không bao giờ commit).
- App xác minh bằng khoá công khai nhúng trong `electron/license.js`; license
  gắn với mã máy nên copy sang máy khác sẽ vô hiệu.
- Dùng thử 30 ngày không cần license, mốc thời gian lưu riêng ở
  `qclab-trial.dat` trong thư mục userData.

## Cấu trúc thư mục

```
index.html            # entry, nạp script theo thứ tự cố định (xem chú thích trong file)
assets/
  core.js             # toán miền thuần (Westgard, Sigma, CUSUM...) — UMD, dùng được cả Node
  modules/            # state, services, UI theo trang (global scope, không module)
  workers/            # Web Worker đánh giá Westgard khi dữ liệu lớn
electron/             # main process, preload, license, auto-update
tests/                # test Node thuần (vm sandbox) + baseline a11y ratchet
scripts/              # visual-check, a11y-audit, print-check, seed browser
benchmarks/           # benchmark + release gate + performance budget
firebase/             # database.rules.json + hướng dẫn cấp quyền
docs/                 # tea-sources (nguồn TEa) + validation (URS, IQ/OQ/PQ, UAT...)
```

## Quy ước cần nhớ khi sửa code

- **Cache-busting:** mọi `<script>`/`<link>` trong `index.html` có hậu tố
  `?v=<tag>-<date>-<n>` — sửa file nào thì bump version file đó.
- **Code style:** các file `assets/*.js` viết tay theo kiểu nén (nhiều lệnh/dòng)
  — match style hiện có, đừng reformat cả file.
- **Nút bấm:** luôn dùng builder `btn()` trong `router-render.js`, không tự viết
  `<button class="btn ...">` (test `button-conventions` chặn cứng).
- **`global.d.ts`:** thêm field mới vào `*-ui-state.js` hoặc export global mới
  thì cập nhật file này, nếu không `npm run typecheck` báo lỗi giả.
- **Dữ liệu TEa:** mọi thay đổi số liệu trong `analyte-catalog.js` phải ghi
  justification vào `docs/tea-sources.md` (test `tea-sources` kiểm tra).

Chi tiết kiến trúc đầy đủ xem `AGENTS.md`.
