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
biến môi trường `GH_TOKEN` có quyền ghi nội dung vào repository đích. Không
ghi token vào repository.

Từ 1.1.0, bản cài yêu cầu mã kích hoạt offline theo máy trước khi đăng nhập
hoặc khởi tạo tài khoản admin. Bản EXE tự nhận diện và tải bản mới từ GitHub
trong nền, sau đó hỏi khởi động lại để cập nhật. Xem
[hướng dẫn cấp mã và phát hành](docs/SOFTWARE-LICENSE-AND-UPDATES.md).
Bản chạy từ mã nguồn không yêu cầu kích hoạt và không tự cập nhật.

Công cụ cấp key có giao diện riêng cho bên phát hành: `npm run license:gui`
để mở, `npm run license:dist` để tạo EXE portable trong `dist-issuer/`.
Người sử dụng EXE chỉ cần nhập mã máy, tên đơn vị rồi bấm tạo key.

Dữ liệu được lưu trong SQLite ở thư mục user-data của ứng dụng; sử dụng
chức năng Sao lưu & phục hồi trước khi can thiệp dữ liệu.

Tài liệu trạng thái nằm tại [`docs/APP-PLAN.md`](docs/APP-PLAN.md). Các đợt rà
soát nghiệp vụ Westgard và Six Sigma cùng quyết định đã chốt nằm ở
`docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md`.
