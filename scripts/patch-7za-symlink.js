// Vá cục bộ cho electron-builder trên Windows KHÔNG có quyền tạo symbolic link
// (không phải Administrator và chưa bật Developer Mode).
//
// Vấn đề: khi đóng gói Windows, electron-builder tải gói "winCodeSign" rồi dùng
// 7za giải nén. Gói này chứa vài symlink .dylib của macOS; tạo symlink trên
// Windows cần đặc quyền, nếu không 7za báo lỗi "A required privilege is not held"
// (exit 2) khiến toàn bộ build thất bại — dù ta không hề ký số và không cần
// các file macOS đó.
//
// Cách vá (idempotent, chỉ chạm node_modules, an toàn chạy lại nhiều lần):
//   1. Tạo wrapper node_modules/7zip-bin/win/x64/7za.cmd: với lệnh giải nén
//      ("x") thì thêm "-xr!*.dylib" để bỏ qua các symlink macOS; lệnh khác giữ
//      nguyên. Wrapper gọi bản 7za.exe gốc (sao thành 7za_orig.exe).
//   2. Vá builder-util/out/util.js: chỉ đặt SZA_PATH (đường 7za mà app-builder
//      Go dùng — Go chạy được .cmd) trỏ tới wrapper. Node vẫn dùng 7za.exe thật
//      qua getPath7za() cho bước nén app (bước này không có symlink).
//
// Chạy tự động trước "npm run dist" (xem package.json). Nếu build trên máy có
// quyền symlink / Developer Mode thì vá này vô hại.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const binDir = path.join(root, 'node_modules', '7zip-bin', 'win', 'x64');
const exe = path.join(binDir, '7za.exe');
const orig = path.join(binDir, '7za_orig.exe');
const wrapper = path.join(binDir, '7za.cmd');
const utilJs = path.join(root, 'node_modules', 'builder-util', 'out', 'util.js');

function log(msg) { console.log('[patch-7za] ' + msg); }

if (process.platform !== 'win32') {
  log('Bỏ qua: chỉ cần trên Windows.');
  process.exit(0);
}
if (!fs.existsSync(binDir)) {
  log('Không thấy 7zip-bin — bỏ qua (electron-builder chưa cài?).');
  process.exit(0);
}

// 1. Sao 7za.exe gốc -> 7za_orig.exe (wrapper sẽ gọi bản này).
if (fs.existsSync(exe) && !fs.existsSync(orig)) {
  fs.copyFileSync(exe, orig);
  log('Đã sao 7za.exe -> 7za_orig.exe');
}

// 2. Ghi wrapper 7za.cmd.
const wrapperBody = [
  '@echo off',
  'rem Wrapper tu dong (scripts/patch-7za-symlink.js): khi giai nen loai tru',
  'rem symlink .dylib cua macOS de tranh loi thieu quyen tao symbolic link.',
  'if /I "%~1"=="x" (',
  '  "%~dp0\\7za_orig.exe" %* "-xr!*.dylib"',
  ') else (',
  '  "%~dp0\\7za_orig.exe" %*',
  ')',
  'exit /b %ERRORLEVEL%',
  ''
].join('\r\n');
fs.writeFileSync(wrapper, wrapperBody);
log('Đã ghi wrapper 7za.cmd');

// 3. Vá SZA_PATH trong builder-util/out/util.js (idempotent).
if (fs.existsSync(utilJs)) {
  let src = fs.readFileSync(utilJs, 'utf8');
  const marker = 'SZA_PATH: await (0, _7za_1.getPath7za)(),';
  if (src.includes('/* patch-7za */')) {
    log('util.js đã vá trước đó — bỏ qua.');
  } else if (src.includes(marker)) {
    const replacement =
      '/* patch-7za */ SZA_PATH: (function () {' +
      ' const _r = require("path"); const _f = require("fs");' +
      ' const _real = _7zip_bin_1_path(); const _w = _r.join(_r.dirname(_real), "7za.cmd");' +
      ' return _f.existsSync(_w) ? _w : _real; })(),';
    // getPath7za là async; ta lấy đường dẫn 7za.exe trực tiếp từ 7zip-bin.
    src = src.replace(
      "const _7za_1 = require(\"./7za\");",
      "const _7za_1 = require(\"./7za\");\nfunction _7zip_bin_1_path(){ return require(\"7zip-bin\").path7za; }"
    );
    src = src.replace(marker, replacement);
    fs.writeFileSync(utilJs, src);
    log('Đã vá SZA_PATH trong util.js');
  } else {
    log('CẢNH BÁO: không tìm thấy điểm neo SZA_PATH trong util.js (phiên bản electron-builder khác?). Bỏ qua.');
  }
} else {
  log('Không thấy builder-util/out/util.js — bỏ qua.');
}

log('Xong.');
