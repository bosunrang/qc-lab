/**
 * Trang trả cho máy nhân viên còn mở địa chỉ `http://` cũ. Máy chủ không nhận
 * đăng nhập hay API qua HTTP thường; trang này chỉ hướng dẫn cài chứng chỉ gốc
 * rồi chuyển sang `https://`.
 *
 * Trang đi qua kết nối KHÔNG mã hoá nên không chứa dữ liệu nào của máy chủ:
 * địa chỉ lấy từ `location` của trình duyệt, và dấu vân tay để đối chiếu phải
 * đọc trên máy chính (kẻ nghe lén sửa được cả trang lẫn tệp chứng chỉ, nhưng
 * không sửa được màn hình máy chính).
 */
export const CA_DOWNLOAD_PATH = '/qclab-ca.crt';

export const PLAIN_HTTP_PAGE = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QC Lab — kết nối bảo mật</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f7f9; --card: #fff; --text: #1d2330; --muted: #5b6475; --accent: #0b63ce; --border: #d9dde5; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14171c; --card: #1d2129; --text: #e6e9ef; --muted: #9aa3b2; --accent: #6aa8ff; --border: #323845; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 "Segoe UI", system-ui, sans-serif; }
  main { max-width: 640px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p, li { color: var(--text); }
  .muted { color: var(--muted); }
  ol { padding-left: 20px; }
  li { margin: 6px 0; }
  a.button { display: inline-block; background: var(--accent); color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; }
  code { font-family: Consolas, monospace; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <div class="card">
    <h1>QC Lab đã chuyển sang kết nối bảo mật</h1>
    <p id="checking" class="muted">Đang kiểm tra kết nối bảo mật…</p>
    <div id="setup" hidden>
      <p>Máy này chưa tin chứng chỉ của QC Lab. Chỉ cần làm một lần trên mỗi máy:</p>
      <ol>
        <li><a class="button" href="${CA_DOWNLOAD_PATH}" download="QC-Lab-CA.crt">Tải chứng chỉ gốc</a></li>
        <li>Mở tệp <code>QC-Lab-CA.crt</code> vừa tải → <b>Install Certificate</b> (Cài đặt chứng chỉ) → chọn <b>Current User</b> → <b>Next</b>.</li>
        <li>Chọn <b>Place all certificates in the following store</b> → <b>Browse</b> → <b>Trusted Root Certification Authorities</b> → <b>Next</b> → <b>Finish</b>.</li>
        <li>Windows hỏi xác nhận và hiện <b>Thumbprint</b>. So từng ký tự với dấu vân tay trên <b>máy chính</b> (biểu tượng QC Lab ở khay hệ thống → <i>Địa chỉ cho máy nhân viên…</i>). Khác nhau thì bấm <b>No</b> và báo quản trị viên.</li>
        <li>Đóng hết cửa sổ trình duyệt rồi mở lại: <a id="secure-link" href="#"></a></li>
      </ol>
      <p class="muted">Dùng Microsoft Edge hoặc Google Chrome. Firefox có kho chứng chỉ riêng, có thể phải cài chứng chỉ trong phần Cài đặt của Firefox.</p>
    </div>
  </div>
</main>
<script>
  (function () {
    var url = 'https://' + location.host + '/';
    var link = document.getElementById('secure-link');
    link.href = url; link.textContent = url;
    // Máy đã tin chứng chỉ thì yêu cầu HTTPS thành công: chuyển thẳng sang.
    // Khác nguồn (http → https) nên dùng no-cors: không đọc được nội dung,
    // nhưng lời hứa chỉ bị từ chối khi bắt tay TLS hỏng.
    fetch(url + 'api/health', { mode: 'no-cors', cache: 'no-store' })
      .then(function () { location.replace(url); })
      .catch(function () {
        document.getElementById('checking').hidden = true;
        document.getElementById('setup').hidden = false;
      });
  })();
</script>
</body>
</html>
`;
