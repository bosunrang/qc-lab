# Phát hành bản desktop lên GitHub Releases

Quy trình bắt buộc mỗi lần đưa một bản cài ra ngoài. Viết ra sau sự cố **v2.6.0**
(phát hành 2026-07-30): release đó chỉ được upload mỗi `QC-Lab-Setup-2.6.0.exe`,
thiếu `latest.yml`, nên `electron-updater` trên **mọi máy đã cài** trả 404 ở mỗi
lần khởi động và toàn bộ luồng tự cập nhật đứng im — lỗi không hiện gì cho người
dùng, chỉ thấy trong console.

> **Luật một dòng:** một release hợp lệ phải có **đủ ba** file. Thiếu `latest.yml`
> thì release đó không những vô dụng, mà còn *chặn* cập nhật của các bản cũ hơn,
> vì `electron-updater` luôn hỏi release **mới nhất** rồi mới đọc `latest.yml` ở đó.

> **Từ sau v2.7.2 (lỗi lặp lại y hệt v2.6.0 — chỉ upload tay `.exe`, thiếu
> `latest.yml`/`.blockmap`): dùng `.github/workflows/release.yml`.** Push tag
> `v<version>` khớp `package.json` lên GitHub, CI tự chạy `npm run dist:publish`
> trên Windows runner và upload đủ cả ba file trong một lần — không còn bước tay
> nào để quên. Mục 1/2 dưới đây (chạy `dist:publish`/`gh release create` tại máy)
> chỉ còn là phương án dự phòng khi CI không chạy được; **không tự tạo release
> qua giao diện web và kéo thả riêng file `.exe`** — đó chính là cách hai lần lỗi
> này xảy ra.

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

### 1b. Khi `dist:publish` lỗi giữa chừng

Đã xảy ra thật khi phát hành 2.6.1 (2026-07-31): lệnh build lại xong, upload `.exe`
thành công, rồi ném lỗi HTTP (`builder-util-runtime/httpExecutor`) và dừng — release
chỉ có đúng một asset, thiếu cả `latest.yml` lẫn `.blockmap`.

**Cứ chạy lại `npm run dist:publish`.** electron-builder **ghi đè** asset trùng tên
chứ không trả 422 như thường bị suy đoán; lần chạy thứ hai đã upload trọn cả ba file
và chuỗi checksum khớp. Đừng vá bằng tay khi chưa thử chạy lại.

Hai điều phải nhớ khi chạy lại:

- Mỗi lần chạy là **build lại**, sinh binary mới với sha khác. SHA-256 đã ghi vào hồ
  sơ phải cập nhật theo binary **cuối cùng thực sự nằm trên release**, không phải theo
  bản build đầu tiên.
- **Cái bẫy:** khi lỗi xảy ra *sau* bước build, `dist/*.exe` đã bị ghi đè nhưng
  `dist/latest.yml` có thể vẫn là bản của lần build **trước**. Upload tay đúng file
  `latest.yml` đó lên sẽ khiến updater tải bản cài về rồi **từ chối cài vì sai
  checksum** — hỏng khó lần hơn hẳn lỗi 404, vì nhìn bề ngoài release đã đủ ba file.

Nhận biết nhanh bằng mốc thời gian — `latest.yml` phải mới **bằng hoặc hơn** `.exe`:

```powershell
Get-ChildItem dist -File | Sort-Object LastWriteTime |
  Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
```

Nếu chỉ muốn dựng lại `latest.yml` cho khớp `.exe` đang có (không build lại, giữ
nguyên binary đã lên release):

```powershell
node -e "const c=require('crypto'),f=require('fs');const e='dist/QC-Lab-Setup-<ver>.exe';const b=f.readFileSync(e);const s=c.createHash('sha512').update(b).digest('base64');f.writeFileSync('dist/latest.yml',`version: <ver>\nfiles:\n  - url: ${e.split('/').pop()}\n    sha512: ${s}\n    size: ${b.length}\npath: ${e.split('/').pop()}\nsha512: ${s}\nreleaseDate: '${new Date(f.statSync(e).mtime).toISOString()}'\n`);console.log('da dung lai dist/latest.yml')"
```

Rồi **bắt buộc** chạy khối đối chiếu ở Cách B trước khi upload.

## 2. Cách B — upload đúng binary đã kiểm chứng

Dùng khi hồ sơ thẩm định đã chốt SHA-256 của bản trong `dist/` và không muốn build lại,
hoặc để kiểm tra sau một lần `dist:publish` lỗi giữa chừng (xem 1b).

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

## 3. Kiểm tra sau khi phát hành (bắt buộc, đủ 5 mục)

Chạy bằng Node cho gọn và tránh một cái bẫy có thật của PowerShell: trong môi trường
này `(Invoke-WebRequest ...).Content` trả về **mảng byte** chứ không phải chuỗi, nên
mọi phép `-match` trên đó đều ra `False` — báo sai là release hỏng trong khi nó tốt.

```bash
node -e "
const c=require('crypto'), f=require('fs');
const REPO='bosunrang/qc-lab', VER='2.6.1', EXE='dist/QC-Lab-Setup-'+VER+'.exe';
const H={'User-Agent':'qclab-release-check'};
(async()=>{
  const rel=await (await fetch('https://api.github.com/repos/'+REPO+'/releases/latest',{headers:H})).json();
  console.log('(1) latest =', rel.tag_name, 'draft='+rel.draft, 'prerelease='+rel.prerelease);
  const have=rel.assets.map(a=>a.name);
  console.log('(2) assets:', rel.assets.map(a=>a.name+' ('+a.size+'B)').join(' | '));
  const need=['latest.yml','QC-Lab-Setup-'+VER+'.exe','QC-Lab-Setup-'+VER+'.exe.blockmap'];
  console.log('    du 3 asset:', need.every(n=>have.includes(n))?'OK':'THIEU '+need.filter(n=>!have.includes(n)));
  const r=await fetch('https://github.com/'+REPO+'/releases/download/'+rel.tag_name+'/latest.yml',{headers:H});
  console.log('(3) GET latest.yml ->', r.status, r.ok?'OK':'LOI');
  const yml=await r.text(); console.log(yml.trim());
  console.log('(4) version:', /version:\s*(\S+)/.exec(yml)[1]===VER?'OK':'LECH');
  const b=f.readFileSync(EXE);
  console.log('(5) sha512 latest.yml == exe:', /sha512:\s*(\S+)/.exec(yml)[1]===c.createHash('sha512').update(b).digest('base64')?'OK':'LECH');
  console.log('    size   latest.yml == exe:', +/size:\s*(\d+)/.exec(yml)[1]===b.length?'OK':'LECH');
  console.log('    size   exe local  == exe GitHub:', b.length===rel.assets.find(a=>a.name.endsWith('.exe')).size?'OK':'LECH');
})();
"
```

Mục **(5)** là mục bắt được cái bẫy ở 1b: `latest.yml` có mặt và trả 200 nhưng trỏ vào
một binary khác. Thiếu mục này thì release nhìn "đủ ba file" mà updater vẫn từ chối cài.

**(6)** Trên một máy đang chạy bản *cũ hơn*: mở app, chờ vài giây, xác nhận không
còn dòng `[auto-update] check failed` trong console (F12) và app báo có bản mới.
Đây là mục duy nhất chứng minh đường cập nhật thật sự thông; năm mục trên chỉ chứng
minh artefact đã nằm đúng chỗ và nhất quán với nhau.

## 4. Dọn release hỏng

Một release thiếu `latest.yml` mà đang là *latest* sẽ chặn cập nhật của mọi máy.
Xử lý một trong hai cách:

- Bổ sung `latest.yml` (và `.blockmap`) đúng của bản đó vào release cũ, **hoặc**
- Xoá / đánh dấu pre-release cho nó, để `latest` rơi về một release đầy đủ.

Đã xử lý: **v2.6.0** (phát hành 2026-07-30, chỉ có `.exe`) được xoá hẳn ngày
2026-07-31, nên `latest` rơi về **v2.6.1** đầy đủ ba asset.

## 4b. Nhật ký phát hành

| Bản | Ngày | Kết quả |
|---|---|---|
| v2.5.5 | 2026-07-2x | Đủ 3 asset |
| v2.6.0 | 2026-07-30 | **Hỏng** — chỉ `.exe`, auto-update 404 trên mọi máy. Đã xoá 2026-07-31 |
| v2.6.1 | 2026-07-31 | Đạt cả 6 mục kiểm tra. exe `sha256:f9c011f1…`, size 100 563 254 B |

## 5. Ghi vào hồ sơ

- Tag, ngày phát hành, danh sách asset.
- SHA-256 của installer thật sự được upload.
- stdout của bộ bằng chứng ở mục 0.
- Kết quả 5 mục kiểm tra ở mục 3.
