// Gate của hệ thiết kế app-v2 (dựng lại 2026-09-18, xem docs/DESIGN-SYSTEM.md).
//
// Chia làm hai loại kiểm, đừng lẫn:
//   · HỢP ĐỒNG — hình dạng của hệ thống và tương phản màu. Đây là luật cứng,
//     sai là sai, không có baseline nào để nới.
//   · RATCHET  — số chỗ CSS trang còn viết giá trị thô thay vì token. Việc
//     chuyển 14 file làm theo từng đợt, nên ở đây chỉ chặn TĂNG. Sau mỗi đợt
//     dọn thì hạ baseline xuống, không bao giờ nâng lên.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_DIR = join(ROOT, 'renderer/styles');

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? cssFiles(path)
      : entry.name.endsWith('.css') ? [path] : [];
  });
}
const ALL = cssFiles(STYLE_DIR);
const TOKENS_FILE = join(STYLE_DIR, 'tokens.css');
const PAGE_CSS = ALL.filter((f) => f !== TOKENS_FILE);
const tokensSrc = readFileSync(TOKENS_FILE, 'utf8');
// Bỏ comment trước khi đếm: phần giải thích được phép nhắc lại một mã hex cũ
// để ghi lý do, đó là tài liệu chứ không phải giá trị đang có hiệu lực.
const pageSrc = PAGE_CSS.map((f) => readFileSync(f, 'utf8')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Bảng token = mọi khai báo trong khối :root (nhiều token nằm chung một dòng,
// nên không neo theo đầu dòng được).
const rootBlock = tokensSrc.slice(tokensSrc.indexOf(':root{'), tokensSrc.indexOf('*,*::before'));
const TOKEN = {};
for (const m of rootBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) TOKEN[m[1]] = m[2].trim();

function flat(name, depth = 0) {
  if (depth > 8) return null;
  const v = TOKEN[name];
  if (v === undefined) return null;
  const m = v.match(/^var\((--[a-z0-9-]+)\)$/);
  return m ? flat(m[1], depth + 1) : v;
}

/* ───────────────────────── HỢP ĐỒNG ───────────────────────── */

test('bảng màu Clinical Precision giữ đúng các neo nhận diện', () => {
  // Bảng màu là clinical navy + mineral teal + cool neutral. Test chốt các
  // neo nhận diện để một trang không tự kéo app về tông xám/teal khác.
  const ANCHORS = {
    '--teal-500': '#0b7c83',   // màu thương hiệu
    '--teal-600': '#086871',
    '--teal-700': '#07545c',
    '--teal-300': '#97c8c6',
    '--teal-100': '#e2f1f0',
    '--gray-900': '#172b35',   // mực chữ + nền tối chung
    '--navy-950': '#14242e',   // nền sidebar navy đặc
    '--gray-200': '#dce5e9',   // đường kẻ
    '--canvas': '#f5f7f9',     // nền trang
    '--red-600': '#9f3030',
    '--amber-600': '#7a4508',
    '--blue-600': '#285d82',
  };
  for (const [name, value] of Object.entries(ANCHORS)) {
    assert.equal(TOKEN[name], value, `${name} là neo nhận diện Clinical Precision`);
  }
  // Mỗi họ phải đủ 4 bậc để 4 vai trò trạng thái có chỗ lấy.
  for (const fam of ['teal', 'blue', 'amber', 'red']) {
    for (const step of [100, 300, 500, 600]) {
      assert.ok(TOKEN[`--${fam}-${step}`], `thiếu --${fam}-${step}`);
    }
  }
});

test('viền bề mặt mảnh được tách khỏi đường chia và trạng thái active', () => {
  assert.equal(TOKEN['--surface-border'], 'var(--border)',
    'mọi bề mặt có viền dùng cùng một mức 1px rõ ràng');
  assert.equal(TOKEN['--surface-divider'], 'var(--border-subtle)',
    'đường chia nội bộ nhẹ hơn viền bề mặt');
  assert.doesNotMatch(pageSrc, /--surface-border-soft/,
    'không giữ alias viền trung gian khi đã có --surface-divider');
  assert.doesNotMatch(pageSrc, /border:1px solid var\(--(?:line|line-strong|border-subtle)\)/,
    'viền bề mặt không quay lại các alias/độ nhạt không nhất quán');

  const appCss = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  assert.match(appCss, /\.panel\{[^}]*border:1px solid var\(--surface-divider\)/,
    'panel Clinical Precision dùng viền nhẹ và bóng khuếch tán');
  assert.match(appCss, /table\{border:1px solid var\(--surface-divider\)/,
    'bảng độc lập dùng cùng viền nhẹ với panel');
  assert.match(appCss, /\.modal\{[^}]*border:1px solid var\(--surface-divider\)/,
    'modal dùng cùng viền nhẹ với panel');
  const entryCss = readFileSync(join(STYLE_DIR, 'pages', 'entry.css'), 'utf8');
  assert.match(entryCss, /\.lj-mini\.on\{[^}]*border-color:var\(--teal\)/,
    'teal vẫn chỉ biểu đạt trạng thái active, không phải viền mặc định');
});

test('thang chữ, độ đậm, dãn dòng, khoảng cách, bo góc đúng hình dạng', () => {
  assert.deepEqual(
    ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl'].map((k) => TOKEN[`--text-${k}`]),
    ['11px', '12px', '13px', '14px', '16px', '20px', '24px', '30px'],
    'thang chữ 8 bậc, toàn số nguyên',
  );
  assert.deepEqual(
    ['normal', 'medium', 'semibold', 'bold'].map((k) => TOKEN[`--weight-${k}`]),
    ['400', '500', '600', '700'],
  );
  assert.deepEqual(
    ['none', 'display', 'heading', 'snug', 'body'].map((k) => TOKEN[`--leading-${k}`]),
    ['1', '1.15', '1.3', '1.4', '1.55'],
  );
  // Lưới 4px + nửa bậc 2/6/10/14 cho mật độ dày. Không có số lẻ nào.
  const space = Object.entries(TOKEN)
    .filter(([k, v]) => /^--space-[0-9]/.test(k) && /px$/.test(v))
    .map(([, v]) => parseInt(v, 10));
  assert.ok(space.length >= 11, 'thiếu bậc trong thang khoảng cách');
  for (const v of space) assert.equal(v % 2, 0, `--space-* = ${v}px là số lẻ, không thuộc lưới`);
  assert.deepEqual(
    ['xs', 'sm', 'md', 'lg'].map((k) => TOKEN[`--radius-${k}`]),
    ['8px', '8px', '8px', '8px'],
  );
});

test('tiêu đề và header bảng đi theo thang, không tự đặt cỡ', () => {
  // Trước khi chuẩn hoá, cùng một cấp cấu trúc lại ra ba cỡ khác nhau tuỳ
  // trang: header khối con trong panel là 16px ở Sigma/So sánh hoá chất, 14px
  // ở Nhập QC/Cấu hình chung, 13px ở Cài đặt. Tiêu đề hộp thoại thì 20/16/16.
  assert.deepEqual(
    ['page', 'hero', 'panel', 'sub', 'card', 'overline'].map((k) => flat(`--title-${k}`)),
    ['24px', '24px', '16px', '14px', '13px', '11px'],
    'thang tiêu đề 6 cấp',
  );
  // Một hệ typography bảng; bảng gọn trong panel chỉ thu nhịp cao/đệm.
  assert.equal(flat('--table-head-size'), '13px');
  assert.equal(flat('--table-head-size-sm'), '13px');
  assert.equal(flat('--table-header-h'), '40px');
  assert.equal(flat('--table-header-h-sm'), '30px');
  assert.equal(flat('--table-radius'), '8px', 'bảng dữ liệu chỉ bo nhẹ 8px');
  assert.equal(flat('--table-head-tracking-sm'), flat('--table-head-tracking'),
    'bảng gọn không tự đổi typography so với bảng chính');

  // Mọi khai báo cỡ chữ trong CSS trang phải trỏ vào thang, không viết tên
  // riêng. 16 alias cũ (--type-*, --section-head-size…) đã bị xoá; danh sách
  // dưới đây là TẤT CẢ những gì được phép đứng sau `font-size:`.
  const ALLOWED = new Set([
    '--text-2xs', '--text-xs', '--text-sm', '--text-base', '--text-md',
    '--text-lg', '--text-xl', '--text-2xl',
    '--title-page', '--title-hero', '--title-panel', '--title-sub',
    '--title-card', '--title-overline',
    '--table-head-size', '--table-head-size-sm', '--table-body-size',
    '--button-font-size',
  ]);
  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/font-size:\s*var\((--[a-z0-9-]+)\)/g)) {
      if (!ALLOWED.has(m[1])) bad.push(`${relative(ROOT, file)}: font-size:var(${m[1]})`);
    }
  }
  assert.deepEqual(bad, [], 'dùng một bậc của thang, đừng thêm tên cỡ chữ mới');
});

test('hai mật độ bảng không bị rule trang ghi đè ngược', () => {
  const source = (name) => readFileSync(join(STYLE_DIR, 'pages', name), 'utf8');
  const manage = source('manage.css');
  const sigma = source('sigma.css');
  const reagent = source('reagent.css');

  // Bảng danh sách Cấu hình, ma trận mục tiêu và OPSpecs là bảng lớn: 13px/40px.
  assert.match(manage, /\.rcfg-list>table thead th\{[^}]*font-size:var\(--table-head-size\)/);
  assert.match(manage, /\.config-shell input[^}]*height:var\(--control-h-config\)[^}]*min-height:var\(--control-h-config\)/,
    'toàn bộ control trong Cấu hình dùng mật độ 36px, không kéo theo modal');
  assert.match(manage, /\.target-head\{[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/);
  assert.match(sigma, /\.sg-opspec-table th\{[^}]*height:var\(--table-header-h\)[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/);
  assert.match(sigma, /\.sg-opspec-table td\{[^}]*height:var\(--table-row-h\)[^}]*vertical-align:middle/);
  assert.match(sigma, /\.sg-level-matrix-head\{[^}]*min-height:var\(--table-header-h\)[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/,
    'workspace kỳ dùng header dữ liệu chuẩn 40px/13px');
  assert.match(sigma, /\.sg-period-history-item\.is-selected\{[^}]*border-color:var\(--accent-border\)[^}]*border-left:3px solid var\(--teal\)[^}]*background:var\(--accent-surface\)[^}]*color:var\(--text-accent\);\}/,
    'kỳ đang chọn dùng vạch active teal 3px cùng viền và nền accent chung');
  assert.match(sigma, /\.sg-level-input-row input\.sg-number\{[^}]*height:var\(--control-h-data\)[^}]*font-size:var\(--text-base\)[^}]*font-weight:var\(--weight-normal\)/,
    'CV/Bias trong hàng dữ liệu Sigma dùng control 36px, cân với bảng đọc');
  assert.match(sigma, /\.sg-level-input-row \.btn\{height:var\(--control-h-data\);min-height:var\(--control-h-data\);\}/,
    'nút cạnh ô CV/Bias cùng dùng 36px, không giữ control 40px trong hàng dữ liệu');
  assert.match(sigma, /\.sg-period-history-list\{[^}]*grid-auto-rows:58px[^}]*max-height:244px[^}]*overflow-y:auto/,
    'lịch sử kỳ hiển thị tối đa bốn mục rồi cuộn nội bộ, không kéo dài panel');
  assert.doesNotMatch(readFileSync(join(ROOT, 'renderer', 'pages', 'SigmaPage.tsx'), 'utf8'), /Ngân sách MU/,
    'MU chỉ được đánh giá ở bảng chi tiết bên dưới, không lặp lại trong workspace Sigma');
  assert.doesNotMatch(readFileSync(join(ROOT, 'renderer', 'pages', 'SigmaPage.tsx'), 'utf8'), /<aside className="sg-period-history"/,
    'lịch sử kỳ không dùng thẻ aside vì selector sidebar toàn cục sẽ biến nó thành nền tối cao toàn viewport');
  // Cohort và cặp mẫu là bảng phụ: cùng chữ 13px/.02em, chỉ header 30px.
  for (const selector of ['\\.sg-cohort-table th']) {
    assert.match(sigma, new RegExp(`${selector}\\{[^}]*font-size:var\\(--table-head-size-sm\\)[^}]*letter-spacing:var\\(--table-head-tracking-sm\\)[^}]*height:var\\(--table-header-h-sm\\)`));
  }
  assert.match(sigma, /\.sg-eqa-table th\{[^}]*height:var\(--table-header-h\)[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/);
  assert.match(sigma, /\.sg-eqa-del\{min-width:0;margin:0 auto;\}/);
  assert.match(sigma, /\.sg-eqa-table td input\[type=number\]\{[^}]*width:min\(100%,120px\)[^}]*height:var\(--control-h\)[^}]*margin:0 auto;/);
  assert.match(
    sigma,
    /\.sg-eqa-summary\.is-empty\{[^}]*border-left:3px solid var\(--warning-accent\)[^}]*border-radius:var\(--radius-md\)[^}]*font-size:var\(--text-sm\)[^}]*line-height:var\(--leading-body\);\}/,
    'hướng dẫn thiếu vòng EQA dùng vạch cảnh báo tại chỗ 3px, góc bo 8px và chữ 13px',
  );
  assert.match(
    sigma,
    /\.sg-eqa-summary\.is-empty \.sg-eqa-empty\{color:var\(--warning-ink\);font-weight:var\(--weight-normal\);\}/,
    'nội dung hướng dẫn EQA không được đậm quá mức cần thiết',
  );
  assert.match(reagent, /\.rc-pair-head \{[^}]*min-height:\s*var\(--table-header-h-sm\)[^}]*font-size:\s*var\(--table-head-size-sm\)[^}]*letter-spacing:\s*var\(--table-head-tracking-sm\)/);
  const westgard = source('westgard.css');
  assert.match(
    westgard,
    /\.wg-guide th,\.wg-guide td\{[^}]*padding:var\(--table-cell-py-compact\) var\(--table-cell-px-compact\)[^}]*font-size:var\(--table-body-size\)/,
    'bảng hướng dẫn Westgard là bảng gọn: ô dùng padding 6px × 8px',
  );
  assert.match(
    westgard,
    /\.wg-chart-mode\{margin:var\(--space-section\) var\(--panel-padding\);\}/,
    'vùng đổi biểu đồ Westgard có khoảng thở section ở trên và dưới, cùng gutter panel',
  );
});

test('nhãn đứng trên control dùng thang form chung', () => {
  const appCss = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  const settings = readFileSync(join(STYLE_DIR, 'pages', 'settings.css'), 'utf8');
  const reagent = readFileSync(join(STYLE_DIR, 'pages', 'reagent.css'), 'utf8');
  const sigma = readFileSync(join(STYLE_DIR, 'pages', 'sigma.css'), 'utf8');

  assert.match(appCss, /label\{[^}]*font-size:var\(--text-xs\)[^}]*color:var\(--text-secondary\)[^}]*font-weight:var\(--weight-semibold\);\}/,
    'nhãn field toàn app dùng token 12px/600/màu phụ');
  assert.match(settings, /\.settings-unit-fields label,[\s\S]*?\{\s*margin:0;\s*\}/,
    'Cài đặt chỉ chỉnh nhịp label, không tự đổi thang chữ');
  assert.match(reagent, /\.rc-field label\s*\{\s*display:\s*block;\s*margin:\s*0 0 var\(--field-label-gap\);\s*\}/,
    'nhãn field So sánh hóa chất dùng khoảng cách chuẩn');
  assert.doesNotMatch(reagent, /\.rc-field label,.rc-toolbar-selcol label\{[^}]*font-size/,
    'Reagent không tự nâng nhãn control lên 13px/700');
  assert.match(sigma, /\.sg-tracking-toolbar>label\{margin:0;\}/,
    'nhãn field Sigma chỉ chỉnh margin, còn thang chữ lấy từ label chung');
  assert.doesNotMatch(appCss, /\.auth-card label\{font-size:var\(--text-base\)/,
    'nhãn đăng nhập không được tự tăng lên bằng cỡ control');
});

test('thao tác xóa kỳ dùng RowActionButton chung', () => {
  const sigmaPage = readFileSync(join(ROOT, 'renderer', 'pages', 'SigmaPage.tsx'), 'utf8');
  assert.match(
    sigmaPage,
    /<RowActionButton kind="delete" label=\{`Xóa kỳ \$\{vnPeriod\(displayPeriod\.period\)\}`\} onClick=\{\(\) => removePeriodRow\(displayPeriod\)\} \/>/,
    'Xóa kỳ là thao tác của workspace, không dùng nút danger có chữ riêng',
  );
});

test('header sticky chỉ có một đường đáy', () => {
  const entry = readFileSync(join(STYLE_DIR, 'pages', 'entry.css'), 'utf8');
  assert.match(entry, /\.qc-sheet th\{[^}]*box-shadow:none;/,
    'header bảng Nhập QC dùng border-bottom chung, không tự đổ shadow theo từng ô');
  assert.doesNotMatch(entry, /box-shadow:0 1px 0 var\(--table-head-border\)/,
    'không chồng shadow lên border-bottom của header');
});

test('header mức QC có tooltip nhưng không giả làm liên kết', () => {
  const entry = readFileSync(join(STYLE_DIR, 'pages', 'entry.css'), 'utf8');
  assert.match(entry, /\.qc-sheet th\.qc-level-head\{cursor:help;text-decoration:none;/,
    'giữ dấu hiệu trợ giúp, không gạch chân tên Mức/Lô');
});

test('Nhập QC không rò kiểu dáng sang Sigma và không giữ dữ liệu ghi chú cũ', () => {
  const entry = readFileSync(join(STYLE_DIR, 'pages', 'entry.css'), 'utf8');
  const page = readFileSync(join(ROOT, 'renderer', 'pages', 'EntryPage.tsx'), 'utf8');
  assert.doesNotMatch(entry, /\.sg-chart-box/,
    'CSS Nhập QC không được sở hữu selector của thẻ Sigma');
  assert.doesNotMatch(entry, /\.entrygrid>\.tree/,
    'cây Nhập QC dùng một rule hoàn chỉnh, không để cascade selector riêng đè lại');
  assert.match(entry, /\.legend \.dot\.qc-legend-ok\{background:var\(--success-accent\);\}/,
    'legend trạng thái dùng token thay vì mã màu trong JSX');
  assert.doesNotMatch(page, /style=\{\{\s*background:/,
    'legend Nhập QC không được viết màu trực tiếp trong JSX');
  assert.match(page, /key=\{`note:\$\{testId\}:\$\{date\}:\$\{dayNote\}`\}/,
    'textarea ghi chú phải remount khi dữ liệu nguồn đổi, tránh ghi đè ghi chú mới');
});

test('mật độ control dùng token component, không viết lại số chuẩn tại trang', () => {
  assert.deepEqual(
    ['sm', 'row', 'compact', 'table', 'select', 'search', 'data', 'config', 'date', ''].map((k) => TOKEN[`--control-h${k ? `-${k}` : ''}`]),
    ['28px', '30px', '32px', '34px', '36px', '36px', '36px', '36px', '36px', '40px'],
  );
  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  assert.match(app, /select\{height:var\(--control-h-select\);min-height:var\(--control-h-select\);\}/,
    'select chuẩn toàn app dùng 36px, tách khỏi input form 40px');
  assert.match(app, /input\[type="search"\][^{]*\{height:var\(--control-h-search\);min-height:var\(--control-h-search\);\}/,
    'ô tìm nhanh toàn app dùng 36px, tách khỏi input nhập liệu 40px');
  assert.match(app, /input\[type="date"\][^{]*\{height:var\(--control-h-date\);min-height:var\(--control-h-date\);\}/,
    'ô ngày gốc toàn app dùng 36px');
  assert.match(app, /\.datebox input\.date-text\{[^}]*height:var\(--control-h-date\)[^}]*min-height:var\(--control-h-date\)/,
    'DatePicker dùng chung cao 36px');
  for (const name of ['audit.css', 'entry.css', 'manage.css', 'reagent.css']) {
    const css = readFileSync(join(STYLE_DIR, 'pages', name), 'utf8');
    assert.doesNotMatch(css, /(?:datebox|date-text)[^{]*\{[^}]*height:var\(--control-h(?:;|\))/,
      `${name} không được đè DatePicker về chiều cao form 40px`);
  }
  const common = /(?<![-\w])(?:min-)?height\s*:\s*(?:28|30|32|34|36|40)px/g;
  const raw = PAGE_CSS.flatMap((file) => [...readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(common)]
    .map((m) => `${relative(ROOT, file)}: ${m[0]}`));
  assert.deepEqual(raw, [], 'dùng --control-h* cho mật độ control đã chuẩn hóa');
});

test('mọi var() trong CSS đều có định nghĩa và không tham chiếu vòng', () => {
  const RUNTIME = new Set(['--sg-color']); // đặt inline từ SigmaPage.tsx
  const missing = new Set();
  for (const file of ALL) {
    for (const m of readFileSync(file, 'utf8').matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!(m[1] in TOKEN) && !RUNTIME.has(m[1])) missing.add(`${relative(ROOT, file)}: ${m[1]}`);
    }
  }
  assert.deepEqual([...missing], [], 'var() trỏ vào token không tồn tại — trình duyệt bỏ qua cả khai báo');
  for (const name of Object.keys(TOKEN)) {
    assert.ok(flat(name) !== null, `${name} tham chiếu vòng hoặc trỏ vào khoảng không`);
  }
});

test('mọi cặp màu chữ/nền đạt WCAG AA', () => {
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const x = lum(flat(a)); const y = lum(flat(b));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const fails = [];
  const need = (fg, bg, min) => {
    const v = ratio(fg, bg);
    if (v < min) fails.push(`${fg} trên ${bg} = ${v.toFixed(2)} (cần ${min})`);
  };
  // Chữ trên mọi bề mặt sáng mà nó thực sự nằm lên.
  for (const bg of ['--surface', '--surface-page', '--surface-subtle', '--surface-sunken']) {
    for (const fg of ['--text-primary', '--text-secondary', '--text-tertiary', '--accent-text']) need(fg, bg, 4.5);
    need('--text-disabled', bg, 3);
  }
  // Chữ trắng trên nền hành động. Nút huỷ tô bằng --danger-text (xem
  // app.css `.btn.danger`), KHÔNG phải --danger-accent — accent chỉ là thanh
  // màu và biểu tượng, thuộc nhóm phi văn bản ngưỡng 3:1 ở dưới.
  for (const bg of ['--accent', '--accent-hover', '--danger-text']) need('--on-accent', bg, 4.5);
  // Chip trạng thái: chữ trên nền chip VÀ trên panel trắng (chip có thể không nền).
  for (const k of ['success', 'info', 'warning', 'danger', 'neutral']) {
    need(`--${k}-text`, `--${k}-surface`, 4.5);
    need(`--${k}-text`, '--surface', 4.5);
    need(`--${k}-accent`, '--surface', 3); // thanh accent là thông tin phi văn bản
  }
  // Ranh giới control và vòng focus: WCAG 1.4.11 đòi 3:1.
  for (const bg of ['--surface', '--surface-page']) {
    need('--border-strong', bg, 3);
    need('--focus-ring', bg, 3);
  }
  // Sidebar là bề mặt tối, hệ màu riêng.
  for (const fg of ['--sidebar-text', '--sidebar-text-muted', '--sidebar-icon']) need(fg, '--sidebar-bg', 4.5);
  need('--sidebar-active-accent', '--sidebar-bg', 3);
  need('--sidebar-active-ink', '--sidebar-active-bg', 4.5);

  assert.deepEqual(fails, [],
    'mọi cặp màu vai trò phải đạt WCAG; Clinical Precision không giữ ngoại lệ');
});

test('chỉ dùng độ đậm có file font thật', () => {
  const faces = new Set([...tokensSrc.matchAll(/@font-face\{[^}]*font-weight:(\d+)/g)].map((m) => m[1]));
  assert.deepEqual([...faces].sort(), ['400', '500', '600', '700'],
    'danh sách @font-face đã đổi — cập nhật kỳ vọng của test này');
  const offenders = [];
  for (const file of ALL) {
    const source = readFileSync(file, 'utf8').replace(/@font-face\{[^}]*\}/g, '');
    for (const m of source.matchAll(/font-weight:\s*(\d+)/g)) {
      if (!faces.has(m[1])) offenders.push(`${relative(ROOT, file)}: font-weight:${m[1]}`);
    }
  }
  for (const m of readFileSync(join(ROOT, 'renderer/components/SigmaCharts.tsx'), 'utf8').matchAll(/fontWeight="(\d+)"/g)) {
    if (!faces.has(m[1])) offenders.push(`SigmaCharts.tsx: fontWeight="${m[1]}"`);
  }
  assert.deepEqual(offenders, [], 'độ đậm không có file font — trình duyệt làm tròn về face gần nhất');
});

test('CSS trang không được đụng thẳng vào lớp primitive', () => {
  // Primitive là nguyên liệu của tokens.css. Trang dùng chúng nghĩa là đang
  // tự quyết "màu gì" thay vì "dùng để làm gì" — đúng thứ làm UI trôi.
  const hits = [];
  for (const file of PAGE_CSS) {
    for (const m of readFileSync(file, 'utf8').matchAll(/var\((--(?:gray|teal|green|blue|amber|red)-\d+)\)/g)) {
      hits.push(`${relative(ROOT, file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(hits, [], 'dùng token vai trò ở Lớp 2 thay vì bậc màu thô');
});

test('mọi padding/margin/gap đều nằm trên thang khoảng cách', () => {
  // Thang: 0/2/4/6/8/10/12/14 rồi mọi bội số của 4 — đúng thang Tailwind
  // (bội số 4 cộng nửa bậc ở đầu nhỏ). Định vị (top/left/right/bottom/inset)
  // KHÔNG thuộc luật này: phần lớn là bù quang học 1px quanh đường viền.
  const allowed = new Set([0, 2, 4, 6, 8, 10, 12, 14]);
  for (let n = 16; n <= 400; n += 4) allowed.add(n);
  const prop = /(?<![-\w])((?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?)\s*:\s*([^;}]+)/g;
  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(prop)) {
      for (const v of m[2].matchAll(/\b(\d+)px\b/g)) {
        if (!allowed.has(Number(v[1]))) bad.push(`${relative(ROOT, file)}: ${m[1]}: ${v[1]}px`);
      }
    }
  }
  assert.deepEqual(bad, [], 'làm tròn về bậc gần nhất của thang, đừng thêm giá trị mới');
});

test('chỉ có một vòng focus dùng chung', () => {
  const appCss = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  assert.equal(TOKEN['--focus-ring-offset'], '-1px',
    'vòng focus phải nằm đè lên viền control, không bao thêm viền thứ hai');
  assert.match(
    appCss,
    /:focus-visible\{outline:var\(--focus-ring-width\) solid var\(--focus-ring\);outline-offset:var\(--focus-ring-offset\);\}/,
    'app.css phải có đúng một rule :focus-visible toàn cục',
  );
  const offenders = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}]*:focus[a-z-]*[^{}]*)\{([^}]*)\}/g)) {
      const sel = m[1].trim();
      const body = m[2];
      // Ngoại lệ DUY NHẤT: ô nhập bên trong .datebox cố ý không vẽ vòng, vì
      // chính khung .datebox nhận vòng focus — nếu không sẽ có hai vòng lồng.
      if (sel.includes('.datebox input.date-text')) continue;
      if (/outline\s*:\s*(?:none|0)\b/.test(body)) offenders.push(`${relative(ROOT, file)}: ${sel} tắt outline`);
      if (/outline\s*:\s*\d/.test(body)) offenders.push(`${relative(ROOT, file)}: ${sel} tự đặt độ dày/màu vòng`);
      if (/box-shadow\s*:\s*0 0 0/.test(body)) offenders.push(`${relative(ROOT, file)}: ${sel} tự vẽ vòng bằng box-shadow`);
    }
  }
  assert.deepEqual(offenders, [],
    'chỉ được ghi đè outline-offset; màu và độ dày lấy từ --focus-ring-*');
});

test('focus chuột và bàn phím không tạo hai viền accent', () => {
  const cssFiles = [join(STYLE_DIR, 'app.css'), ...PAGE_CSS];
  const offenders = [];
  for (const file of cssFiles) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}]*:focus(?!-visible|-within)[^{}]*)\{([^}]*)\}/g)) {
      const sel = m[1].trim();
      const body = m[2];
      if (/border(?:-color)?\s*:[^;}]*var\(--accent-border/.test(body)
          && !sel.includes(':not(:focus-visible)')) {
        offenders.push(`${relative(ROOT, file)}: ${sel}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'viền accent chỉ dành cho click chuột; focus bàn phím chỉ dùng một vòng --focus-ring');
});

test('nút nguy hiểm giữ ngữ nghĩa danger khi tương tác', () => {
  const appCss = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  assert.match(
    appCss,
    /\.btn\.teal:hover:not\(:disabled\),\.btn:not\(\.danger\):not\(\.ghost\):hover:not\(:disabled\)\{background:var\(--accent-hover\)/,
    'hover teal chỉ dành cho nút chính, không được bắt cả nút danger',
  );
  assert.match(
    appCss,
    /\.btn\.danger:hover:not\(:disabled\)\{background:var\(--danger-text\);box-shadow:[^;}]*var\(--danger-accent\)/,
    'nút danger phải giữ nền và bóng danger khi hover',
  );
});

test('thanh thông báo info dùng trạng thái xanh dương chung', () => {
  const appCss = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  assert.match(
    appCss,
    /\.alert\{[^}]*border-left:3px solid transparent[^}]*font-size:var\(--text-sm\)[^}]*line-height:var\(--leading-body\);\}/,
    'mọi thanh thông báo dùng dải nhấn 3px và chữ 13px',
  );
  assert.match(
    appCss,
    /\.alert\.info\{background:var\(--info-bg\);color:var\(--info-ink\);border-left-color:var\(--info-accent\);\}/,
    'mọi alert info phải dùng cùng nền, chữ và thanh nhấn xanh dương',
  );
});

test('ghi chú OPSpecs chảy như một đoạn văn, không tách text node thành cột', () => {
  const sigma = readFileSync(join(STYLE_DIR, 'pages', 'sigma.css'), 'utf8');
  assert.match(
    sigma,
    /\.sg-opspec-note\{display:block;width:100%;margin:12px 0 0;\}/,
    'ghi chú Sigma có chữ đậm xen giữa phải bỏ flex của alert',
  );
});

/* ─────────────────── KHÔNG CÒN RATCHET NÀO ───────────────────
   Bốn loại giá trị thô dưới đây từng là ratchet mềm (baseline 18/09: 141 màu,
   6 cỡ chữ, 85 dãn dòng, 28 bo góc). Bước B đã dọn hết về 0, nên chúng thành
   LUẬT CỨNG: CSS trang không được viết thẳng màu, cỡ chữ, dãn dòng hay bo góc
   nữa — tất cả đi qua tokens.css. */
test('CSS trang không còn giá trị thô nào', () => {
  const found = {
    'màu hex': [...pageSrc.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]),
    'màu hàm': [...pageSrc.matchAll(/\b(?:rgba?|hsla?)\(/g)].map((m) => m[0]),
    '`!important`': [...pageSrc.matchAll(/!important\b/g)].map((m) => m[0]),
    'cỡ chữ': [...pageSrc.matchAll(/font-size:\s*[0-9.]+(?:px|rem|em)/g)].map((m) => m[0]),
    // Dãn dòng tính bằng px được phép: đó là thủ thuật căn giữa theo chiều dọc
    // trong control cao cố định, không phải nhịp chữ.
    'dãn dòng': [...pageSrc.matchAll(/line-height:\s*[0-9.]+\s*[;}]/g)].map((m) => m[0]),
    'bo góc': [...pageSrc.matchAll(/border-radius:\s*[0-9]+px/g)].map((m) => m[0]),
  };
  const bad = Object.entries(found).filter(([, v]) => v.length)
    .map(([k, v]) => `${k}: ${v.length} chỗ — ${[...new Set(v)].slice(0, 6).join(', ')}`);
  assert.deepEqual(bad, [], 'dùng token trong tokens.css, đừng viết thẳng giá trị');
});
