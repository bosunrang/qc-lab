# Phát hành bản desktop lên GitHub Releases

Quy trình bắt buộc mỗi lần đưa một bản cài ra ngoài. Viết ra sau sự cố **v2.6.0**
(phát hành 2026-07-30): release đó chỉ được upload mỗi `QC-Lab-Setup-2.6.0.exe`,
thiếu `latest.yml`, nên `electron-updater` trên **mọi máy đã cài** trả 404 ở mỗi
lần khởi động và toàn bộ luồng tự cập nhật đứng im — lỗi không hiện gì cho người
dùng, chỉ thấy trong console.

> **Luật một dòng:** một release hợp lệ phải có **đủ ba** file. Thiếu `latest.yml`
> thì release đó không những vô dụng, mà còn *chặn* cập nhật của các bản cũ hơn,
> vì `electron-updater` luôn hỏi release **mới nhất** rồi mới đọc `latest.yml` ở đó.

| File | Vai trò | Thiếu thì sao |
|---|---|---|
| `QC-Lab-Setup-<ver>.exe` | Bản cài | Không tải được |
| `QC-Lab-Setup-<ver>.exe.blockmap` | Cập nhật vi sai | Vẫn cập nhật được nhưng tải lại toàn bộ ~96 MB |
| `latest.yml` | Manifest `electron-updater` đọc | **404 — toàn bộ auto-update chết** |

## 0. Điều kiện trước khi phát hành

- Cây làm việc sạch, đang ở đúng commit muốn phát hành.
- Phiên bản trùng khớp ở cả ba chỗ: `package.json`, `assets/modules/app-meta.js`
  (`version` + `releaseDate`), và tag `?v=` của `app-meta.js` trong `index.html`.
- Đã chạy và lưu stdout đủ bộ bằng chứng (xem `TRACEABILITY.md`):
  `npm test`, `npm run typecheck`, `npm run verify-release`, `npm run visual-check`,
  `npm run a11y-audit`, `npm run print-check`, `npm run nce-check`.
- Không có lỗi critical/high chưa xử lý.

```powershell
git status --short          # phải trống
node -e "console.log(require('./package.json').version)"
Select-String -Path assets\modules\app-meta.js -Pattern "version:|releaseDate:"
Select-String -Path index.html -Pattern "app-meta\.js\?v="
```

## 1. Cách A — để electron-builder tự upload (khuyến nghị)

Token là **personal access token có scope `repo`**. Đặt ở phạm vi phiên, tuyệt đối
không commit và không ghi vào file trong repo.

```powershell
$env:GH_TOKEN = '<personal-access-token-scope-repo>'
npm run dist:publish
```

`dist:publish` **build lại từ đầu** rồi upload đủ cả ba file — đây là lý do nên
dùng cách này: không có bước thủ công nào để quên `latest.yml`.

Lưu ý: vì nó build lại nên binary khác với bản `npm run dist` đã tạo trước đó
(timestamp khác → sha512 khác). Không sao — `latest.yml` nó upload là của chính
lần build đó nên vẫn nhất quán. Nếu hồ sơ đã ghi SHA-256 của một binary cụ thể thì
phải ghi lại theo binary vừa upload, hoặc dùng Cách B.

## 2. Cách B — upload đúng binary đã kiểm chứng

Dùng khi hồ sơ thẩm định đã chốt SHA-256 của bản trong `dist/` và không muốn build lại.

```powershell
# Đối chiếu latest.yml với chính installer trong dist/ trước khi upload
$exe   = "dist\QC-Lab-Setup-2.6.1.exe"
$bytes = [System.IO.File]::ReadAllBytes($exe)
$sha   = [Convert]::ToBase64String(([System.Security.Cryptography.SHA512]::Create()).ComputeHash($bytes))
$yml   = Get-Content dist\latest.yml -Raw
"sha512 khop? " + ($sha -eq ([regex]::Match($yml,'sha512:\s*(\S+)')).Groups[1].Value)
"size   khop? " + ($bytes.Length.ToString() -eq ([regex]::Match($yml,'size:\s*(\d+)')).Groups[1].Value)
```

Rồi tạo release kèm **cả ba** file:

```powershell
gh release create v2.6.1 `
  "dist\QC-Lab-Setup-2.6.1.exe" `
  "dist\QC-Lab-Setup-2.6.1.exe.blockmap" `
  "dist\latest.yml" `
  --repo bosunrang/qc-lab --title "QC Lab 2.6.1" --notes-file docs\release-notes-2.6.1.md
```

`gh` chưa được cài trên máy build hiện tại (`gh: command not found`) — cài từ
<https://cli.github.com/> rồi `gh auth login`, hoặc làm bằng giao diện web GitHub và
**kéo đủ ba file** vào phần Assets.

## 3. Kiểm tra sau khi phát hành (bắt buộc, đủ 4 mục)

```powershell
$repo = 'bosunrang/qc-lab'; $ver = '2.6.1'
$h = @{'User-Agent'='qclab-release-check'}

# (1) release mới nhất đúng là bản vừa phát hành
$latest = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $h
"latest = $($latest.tag_name)"

# (2) có đủ ba asset
$latest.assets | ForEach-Object { $_.name }

# (3) tải latest.yml đúng bằng đường electron-updater đi — phải 200, không 404
$url = "https://github.com/$repo/releases/download/$($latest.tag_name)/latest.yml"
$yml = (Invoke-WebRequest $url -Headers $h -UseBasicParsing).Content
$yml

# (4) version trong latest.yml khớp bản vừa phát hành
"version khop? " + ($yml -match "version:\s*$([regex]::Escape($ver))")
```

**(5)** Trên một máy đang chạy bản *cũ hơn*: mở app, chờ vài giây, xác nhận không
còn dòng `[auto-update] check failed ... 404` trong console và app báo có bản mới.
Đây là mục duy nhất chứng minh đường cập nhật thật sự thông; bốn mục trên chỉ chứng
minh artefact đã nằm đúng chỗ.

## 4. Dọn release hỏng

Một release thiếu `latest.yml` mà đang là *latest* sẽ chặn cập nhật của mọi máy.
Xử lý một trong hai cách:

- Bổ sung `latest.yml` (và `.blockmap`) đúng của bản đó vào release cũ, **hoặc**
- Xoá / đánh dấu pre-release cho nó, để `latest` rơi về một release đầy đủ.

Riêng **v2.6.0** đang ở tình trạng này tính đến 2026-07-31.

## 5. Ghi vào hồ sơ

- Tag, ngày phát hành, danh sách asset.
- SHA-256 của installer thật sự được upload.
- stdout của bộ bằng chứng ở mục 0.
- Kết quả 5 mục kiểm tra ở mục 3.
