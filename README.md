# QC Lab

QC Lab là ứng dụng desktop quản lý nội kiểm chất lượng xét nghiệm (IQC) bằng
tiếng Việt: Westgard, Six Sigma, Levey–Jennings, CUSUM, so sánh lô thuốc thử,
hồ sơ khắc phục và audit trail.

Mã nguồn hiện hành là **app**: Electron hai tiến trình, React và SQLite.
Mã nguồn sản phẩm nằm trong thư mục `app/`.

## Phát triển

```powershell
npm install
npm run dev       # bản xem trước tại http://localhost:5174
npm start         # Electron thật, dùng SQLite trên đĩa
```

## Kiểm tra và đóng gói

```powershell
npm test
npm run typecheck
npm run build
npm run verify-release
npm run dist
```

`npm run dist:publish` phát hành installer Windows lên GitHub Releases và cần
biến môi trường `GH_TOKEN` có quyền `repo`. Không ghi token vào repository.

Lần chạy Electron đầu tiên tạo cơ sở dữ liệu trống và yêu cầu khởi tạo tài
khoản admin. Dữ liệu được lưu trong SQLite ở thư mục user-data của ứng dụng;
sử dụng chức năng Sao lưu & phục hồi trước khi can thiệp dữ liệu.

Tài liệu trạng thái nằm tại [`docs/APP-PLAN.md`](docs/APP-PLAN.md). Các đợt rà
soát nghiệp vụ Westgard và Six Sigma cùng quyết định đã chốt nằm ở
`docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md`.
