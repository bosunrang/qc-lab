// Gate của hệ thiết kế app (dựng lại 2026-09-18, xem docs/DESIGN-SYSTEM.md).
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
  assert.doesNotMatch(entryCss, /\.lj-mini\.on\{/,
    'thẻ biểu đồ không giữ trạng thái chọn chỉ để đổi màu mà không đổi dữ liệu');
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
  assert.match(manage, /\.config-shell input[^}]*height:var\(--control-h\)[^}]*min-height:var\(--control-h\)/,
    'toàn bộ control trong Cấu hình dùng mật độ 36px, không kéo theo modal');
  assert.match(manage, /\.target-head\{[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/);
  assert.match(sigma, /\.sg-opspec-table th\{[^}]*height:var\(--table-header-h\)[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/);
  assert.match(sigma, /\.sg-opspec-table td\{[^}]*height:var\(--table-row-h\)[^}]*vertical-align:middle/);
  assert.match(sigma, /\.sg-level-matrix-head\{[^}]*min-height:var\(--table-header-h\)[^}]*font-size:var\(--table-head-size\)[^}]*letter-spacing:var\(--table-head-tracking\)/,
    'workspace kỳ dùng header dữ liệu chuẩn 40px/13px');
  assert.match(sigma, /\.sg-period-history-item\.is-selected\{[^}]*border-color:var\(--accent-border\)[^}]*border-left:3px solid var\(--teal\)[^}]*background:var\(--accent-surface\)[^}]*color:var\(--text-accent\);\}/,
    'kỳ đang chọn dùng vạch active teal 3px cùng viền và nền accent chung');
  assert.match(sigma, /\.sg-level-input-row input\.sg-number\{[^}]*height:var\(--control-h\)[^}]*font-size:var\(--text-base\)[^}]*font-weight:var\(--weight-normal\)/,
    'CV/Bias trong hàng dữ liệu Sigma dùng control 36px, cân với bảng đọc');
  assert.match(sigma, /\.sg-level-input-row \.btn\{height:var\(--control-h\);min-height:var\(--control-h\);\}/,
    'nút cạnh ô CV/Bias cùng dùng token hàng dữ liệu 36px');
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
    /\.wg-guide th,\.wg-guide td\{[^}]*padding:var\(--table-cell-py\) var\(--table-cell-px-compact\)[^}]*font-size:var\(--table-body-size\)/,
    'bảng hướng dẫn Westgard dùng chiều cao hàng chuẩn: padding dọc 10px, ngang gọn 8px',
  );
  assert.match(
    westgard,
    /\.wg-lot-name\.is-current\{color:var\(--text-accent\);\}/,
    'mã lô đang vận hành dùng màu teal ngữ nghĩa của hệ thống',
  );
  assert.match(
    westgard,
    /\.wg-chart-control\{margin:var\(--space-section\) var\(--panel-padding\);\}/,
    'vùng đổi biểu đồ Westgard có khoảng thở section ở trên và dưới, cùng gutter panel',
  );
  assert.match(
    westgard,
    /\.wg-observed-meta\{color:var\(--text-secondary\);font-weight:var\(--weight-semibold\);\}/,
    'thống kê quan sát ở tiêu đề mức là thông tin phụ, không lấn át Mean/SD đích',
  );
});

test('nhãn đứng trên control dùng thang form chung', () => {
  const appCss = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  const settings = readFileSync(join(STYLE_DIR, 'pages', 'settings.css'), 'utf8');
  const reagent = readFileSync(join(STYLE_DIR, 'pages', 'reagent.css'), 'utf8');
  const sigma = readFileSync(join(STYLE_DIR, 'pages', 'sigma.css'), 'utf8');

  assert.match(appCss, /label\{[^}]*font-size:var\(--text-sm\)[^}]*color:var\(--text-secondary\)[^}]*font-weight:var\(--weight-semibold\);\}/,
    'nhãn field toàn app dùng token 13px/600/màu phụ — 12px làm dấu tiếng Việt chồng lên nhau khó đọc');
  assert.match(settings, /\.settings-unit-fields label,[\s\S]*?\{\s*margin-top:0;\s*\}/,
    'Cài đặt chỉ chỉnh nhịp giữa các field, không đổi thang chữ hay khoảng nhãn → ô');
  assert.match(reagent, /\.rc-field label\s*\{\s*display:\s*block;\s*margin:\s*0 0 var\(--field-label-gap\);\s*\}/,
    'nhãn field So sánh hóa chất dùng khoảng cách chuẩn');
  assert.doesNotMatch(reagent, /\.rc-field label,.rc-toolbar-selcol label\{[^}]*font-size/,
    'Reagent không tự nâng nhãn control lên 13px/700');
  assert.match(sigma, /\.sg-setup-heading \+ \.sg-control-row label\{margin-top:0;\}/,
    'nhãn đầu tiên của thẻ Sigma không cộng thêm khoảng hở so với gutter panel');
  assert.doesNotMatch(appCss, /\.auth-card label\{font-size:var\(--text-base\)/,
    'nhãn đăng nhập không được tự tăng lên bằng cỡ control');
});

test('Six Sigma dùng trực tiếp danh mục QC, không giữ bộ chọn theo dõi riêng', () => {
  const sigmaPage = readFileSync(join(ROOT, 'renderer', 'pages', 'SigmaPage.tsx'), 'utf8');
  const sigma = readFileSync(join(STYLE_DIR, 'pages', 'sigma.css'), 'utf8');

  assert.match(sigmaPage, /const sigmaTests = tests;/,
    'tất cả xét nghiệm từ Cấu hình chung đều hiện trong Six Sigma');
  assert.doesNotMatch(sigmaPage, /SigmaTrackingModal|trackingPickerOpen|setTracking\(/,
    'không còn luồng thêm hoặc gỡ xét nghiệm riêng trong Six Sigma');
  assert.doesNotMatch(sigma, /\.sg-tracking-/,
    'không giữ CSS chết của hộp chọn theo dõi đã bỏ');
  assert.doesNotMatch(sigmaPage, /<label>Tên xét nghiệm<\/label>/,
    'tên xét nghiệm đã thể hiện ở selector, không lặp lại ở trường chỉ đọc');
  assert.match(sigma, /\.sg-setup-heading \+ \.sg-control-row\{display:grid;grid-template-columns:minmax\(0,1fr\) 118px minmax\(0,1fr\);/,
    'chọn xét nghiệm, đơn vị và thiết bị dùng chung một hàng');
  assert.match(sigmaPage, /<div className="field sg-unit-field"><label>Đơn vị<\/label>/,
    'đơn vị nằm trong hàng nhận diện xét nghiệm');
  assert.match(sigmaPage, /const sigmaTestLabel = \(item: typeof tests\[number\]\) => \{[\s\S]*?item\.instrument_id[\s\S]*?`\$\{item\.name\} — \$\{machine\}`/,
    'lựa chọn Sigma nêu cả máy khi một xét nghiệm có nhiều cấu hình máy');
  assert.match(sigmaPage, /placeholder="Tìm nhanh xét nghiệm…" aria-label="Tìm nhanh xét nghiệm"/,
    'header thiết lập có ô lọc nhanh xét nghiệm');
  assert.match(sigmaPage, /const visibleSigmaTests = useMemo\(\(\) => sigmaTests\.filter\(/,
    'ô tìm kiếm lọc danh sách xét nghiệm trước khi chọn');
  assert.match(sigma, /\.sg-setup-search input\[type="search"\]\{[^}]*height:var\(--control-h-compact\)/,
    'ô tìm nhanh dùng chiều cao control gọn của header');
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
  // Ba bậc, tên theo cỡ. Bảy tên cũ cùng bằng 36px và hai bậc lẻ 30/34 đã bị
  // gom; không khai lại tên theo nơi dùng.
  const controlTokens = Object.keys(TOKEN).filter((k) => /^--control-h(?:-|$)/.test(k)).sort();
  assert.deepEqual(controlTokens, ['--control-h', '--control-h-compact', '--control-h-sm']);
  assert.deepEqual(
    ['sm', 'compact', ''].map((k) => TOKEN[`--control-h${k ? `-${k}` : ''}`]),
    ['28px', '32px', '36px'],
  );
  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8');
  assert.match(app, /select\{height:var\(--control-h\);min-height:var\(--control-h\);\}/,
    'select chuẩn toàn app dùng token riêng 36px');
  assert.match(app, /input\[type="search"\][^{]*\{height:var\(--control-h\);min-height:var\(--control-h\);\}/,
    'ô tìm nhanh toàn app dùng token riêng 36px');
  assert.match(app, /input\[type="date"\][^{]*\{height:var\(--control-h\);min-height:var\(--control-h\);\}/,
    'ô ngày gốc toàn app dùng 36px');
  assert.match(app, /\.datebox input\.date-text\{[^}]*height:var\(--control-h\)[^}]*min-height:var\(--control-h\)/,
    'DatePicker dùng chung cao 36px');
  for (const name of ['audit.css', 'entry.css', 'manage.css', 'reagent.css']) {
    const css = readFileSync(join(STYLE_DIR, 'pages', name), 'utf8');
    assert.doesNotMatch(css, /(?:datebox|date-text)[^{]*\{[^}]*height:var\(--control-h-(?:sm|compact)\)/,
      `${name} không được thu DatePicker xuống bậc control nhỏ hơn chuẩn 36px`);
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
    /\.btn\.danger:hover:not\(:disabled\)\{background:var\(--danger-text\);box-shadow:var\(--shadow-button-hover-danger\)/,
    'nút danger phải giữ nền và bóng danger khi hover',
  );
  assert.match(TOKEN['--shadow-button-hover-danger'], /var\(--danger-accent\)/,
    'bóng hover của nút danger lấy màu danger, không lấy teal');
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



// Thông báo trống từng có ít nhất bốn kiểu tự dựng (`.empty` có viền + nền
// xám, `.analysis-empty-state`, `.wg-empty-message`, `.action-*-empty`), và gần
// như trang nào cũng phải viết thêm CSS để gỡ viền/nền của `.empty`. Mỗi kiểu
// đều dùng token hợp lệ nên các luật token ở trên không bắt được; trang Báo
// cáo vì thế lọt ra một hộp xám lồng trong panel trắng. Luật này khoá ở mức
// component: chỉ `EmptyState` được dựng thông báo trống.
test('thông báo trống chỉ dựng qua EmptyState, CSS trang không đè viền/nền', () => {
  const RENDERER = join(ROOT, 'renderer');
  const COMPONENT = join(RENDERER, 'components', 'EmptyState.tsx');
  const tsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
  const RETIRED = new Set(['empty', 'empty-title', 'empty-actions', 'analysis-empty-state', 'wg-empty-message']);
  const markup = [];
  for (const file of tsxFiles(RENDERER)) {
    if (file === COMPONENT) continue;
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
      for (const name of (m[1] ?? m[2] ?? m[3]).split(/\s+/)) {
        if (RETIRED.has(name) || name.startsWith('empty-notice')) markup.push(`${relative(ROOT, file)}: className "${name}"`);
      }
    }
  }
  assert.deepEqual(markup, [], 'dùng <EmptyState> (components/EmptyState.tsx), không tự dựng khối thông báo trống');

  const styles = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim();
      if (/\.(?:empty|empty-title|empty-actions|analysis-empty-state|wg-empty-message)(?![\w-])/.test(selector)) {
        styles.push(`${relative(ROOT, file)}: ${selector} (lớp đã bỏ)`);
      }
      // Chỉ app.css định nghĩa kiểu dáng; trang khác chỉ được chỉnh bố cục.
      if (file.endsWith('app.css') || !/empty-notice/.test(selector)) continue;
      const visual = m[2].match(/(?:^|;)\s*(border[\w-]*|background[\w-]*|color|font[\w-]*|box-shadow)\s*:/g);
      if (visual) styles.push(`${relative(ROOT, file)}: ${selector} đè ${visual.map((v) => v.replace(/[;:\s]/g, '')).join(', ')}`);
    }
  }
  assert.deepEqual(styles, [], 'CSS trang không được dựng lại hay đè viền/nền/chữ của thông báo trống');

  const component = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const base = component.match(/\.empty-notice\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(base, /(?:^|;)\s*(?:border|background)[\w-]*\s*:/, 'thông báo trống nằm thẳng trên bề mặt khối chứa, không có viền hay nền riêng');
});

// Chiều cao control và hàng bảng đi theo hai thang ba bậc. Trước 2026-09-24
// không luật nào kiểm `height`, nên CSS trang tự đặt 22/26/38/46/48/50/52/54px
// cho nút, hàng và đầu thẻ, và `tbody tr{min-height}` toàn cục không có tác
// dụng (trình duyệt bỏ qua min-height trên <tr>) mà không ai biết.
test('chiều cao control và hàng bảng nằm trên thang, không tự đặt số', () => {
  assert.equal(flat('--table-row-h-compact'), '36px');
  assert.equal(flat('--table-row-h'), '44px');
  assert.equal(TOKEN['--table-row-h-input'], 'calc(var(--control-h) + var(--space-4))',
    'hàng có ô nhập = control chuẩn + 8px đệm mỗi bên');

  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(app, /(?:^|\})\s*tbody tr\{height:var\(--table-row-h\);/,
    'hàng chuẩn đặt bằng `height` (tối thiểu với <tr>), không phải `min-height`');

  const rules = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ file, selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  }

  // Header gọn phải đi với hàng gọn, không ghép header 30px với hàng 44px.
  const unpaired = [];
  for (const { selector, body } of rules) {
    if (!/height:var\(--table-header-h-sm\)/.test(body)) continue;
    const table = selector.match(/^(.+?) th$/)?.[1];
    if (table && !rules.some((r) => r.selector === `${table} tbody tr` && /height:var\(--table-row-h-compact\)/.test(r.body))) unpaired.push(table);
  }
  assert.deepEqual(unpaired, [], 'bảng dùng header gọn phải khai `tbody tr{height:var(--table-row-h-compact)}`');

  // Khoảng 20–56px là cỡ của control, hàng và đầu thẻ: phải dùng token. Ngoại
  // lệ chỉ dành cho thứ không phải control — icon, logo, badge/pill — và phải
  // ghi lý do tại đây.
  const EXEMPT = {
    '.dash-test-filterbar button b': 'badge đếm số trong tab lọc',
    '.settings-admin-icon': 'icon SVG',
    '.rc-pending-icon svg': 'icon SVG',
    '.sg-chart-empty-icon svg': 'icon SVG',
    '.confirm-modal-icon': 'icon cảnh báo của hộp xác nhận',
    '.sg-chart-empty-icon': 'khung icon minh hoạ',
    '.auth-head .brand-mark': 'logo đơn vị ở màn đăng nhập',
  };
  const raw = [];
  for (const { file, selector, body } of rules) {
    if (EXEMPT[selector]) continue;
    for (const d of body.matchAll(/(?:^|;)\s*((?:min-|max-)?height)\s*:\s*(\d+)px/g)) {
      const px = Number(d[2]);
      if (px >= 20 && px <= 56) raw.push(`${relative(ROOT, file)}: ${selector} ${d[1]}:${px}px`);
    }
  }
  assert.deepEqual(raw, [], 'dùng --control-h-sm/-compact/--control-h, --table-row-h-compact/--table-row-h/-input hoặc --panel-header-min-height');
});

// Khoảng cách nhãn → ô nhập từng đến từ ba nguồn cộng dồn tuỳ trang: margin
// đáy của nhãn (4px), `gap` của khối bao (6px ở Cài đặt, 6 + 4 = 10px ở bộ
// chọn So sánh hoá chất) và `gap` của lưới cha khi nhãn đứng thẳng trong lưới
// (16 + 4 = 20px ở cấu hình Firebase). Luật: một nguồn duy nhất.
test('nhãn → ô nhập: một khoảng cách, một nguồn, trong khối .field', () => {
  assert.equal(flat('--field-label-gap'), '6px');
  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(app, /(?:^|\})\s*label\{[^}]*margin:[^;]*\s0\svar\(--field-label-gap\);/, 'nhãn chuẩn mang khoảng cách qua margin đáy');
  assert.match(app, /label\.field>span:first-child\{[^}]*margin-bottom:var\(--field-label-gap\)/, 'kiểu nhãn bọc control dùng cùng khoảng cách');

  // 1) Mọi nhãn đứng ngay trước control phải nằm trong khối có class `field`.
  const RENDERER = join(ROOT, 'renderer');
  const tsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
  const CONTROL = /^<(input|select|textarea|DateField)\b/;
  const outside = [];
  const wrapperClasses = new Set(['field']);
  for (const file of tsxFiles(RENDERER)) {
    const src = readFileSync(file, 'utf8');
    const stack = [];
    let label = null;
    const tagRe = /<\/?([A-Za-z][\w.]*)((?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*?)(\/?)>/g;
    for (let m; (m = tagRe.exec(src));) {
      const [whole, name, attrs, selfClose] = m;
      if (whole.startsWith('</')) {
        const i = stack.map((s) => s.name).lastIndexOf(name);
        if (i >= 0) stack.length = i;
        if (name === 'label' && label && !label.wraps && CONTROL.test(src.slice(tagRe.lastIndex).trimStart())) {
          const parent = stack[stack.length - 1];
          const classes = (parent?.cls || '').split(/\s+/).filter(Boolean);
          if (classes.includes('field')) classes.forEach((c) => wrapperClasses.add(c));
          else outside.push(`${relative(ROOT, file)}:${src.slice(0, m.index).split('\n').length} <${parent?.name || '?'} class="${parent?.cls || ''}">`);
        }
        continue;
      }
      const cls = (attrs.match(/className="([^"]*)"/) || attrs.match(/className=\{`([^`]*)`\}/) || [])[1] || '';
      if (name === 'label') {
        const end = src.indexOf('</label>', tagRe.lastIndex);
        label = { wraps: /<(input|select|textarea)\b/.test(end >= 0 ? src.slice(tagRe.lastIndex, end) : '') };
      }
      if (!selfClose && !['input', 'img', 'br', 'hr'].includes(name)) stack.push({ name, cls });
    }
  }
  assert.deepEqual(outside, [], 'bọc nhãn + control trong <div className="field"> (thêm lớp riêng bên cạnh nếu cần)');

  // 2) CSS trang không đổi margin đáy của nhãn trong khối field, và khối field
  //    không dùng gap chen giữa nhãn và control.
  const hasWrapper = (compound) => [...wrapperClasses].some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(compound));
  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      for (const part of m[1].split(',').map((p) => p.trim()).filter(Boolean)) {
        const compounds = part.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
        const last = compounds.at(-1) || '';
        if (/^label(?:[.:\[]|$)/.test(last) && compounds.slice(0, -1).some(hasWrapper)) {
          const longhand = body.match(/(?:^|;)\s*margin-(?:bottom|block-end)\s*:\s*([^;]+)/);
          const shorthand = body.match(/(?:^|;)\s*margin\s*:\s*([^;]+)/);
          const values = shorthand ? shorthand[1].trim().split(/\s+/) : null;
          const bottom = longhand ? longhand[1].trim() : values ? (values[2] ?? values[0]) : null;
          if (bottom !== null && bottom !== 'var(--field-label-gap)') bad.push(`${relative(ROOT, file)}: ${part} đặt margin đáy nhãn = ${bottom}`);
        }
        if (hasWrapper(last) && !/label/.test(last)) {
          const gap = body.match(/(?:^|;)\s*(?:gap|row-gap)\s*:\s*([^;]+)/);
          if (gap && gap[1].trim() !== '0') bad.push(`${relative(ROOT, file)}: ${part} dùng gap ${gap[1].trim()} giữa nhãn và control`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], 'khoảng nhãn → ô nhập chỉ đến từ margin đáy chuẩn của nhãn');
});

// Một comment mất dấu đóng sẽ nuốt mọi rule phía sau cho đến `*/` kế tiếp —
// trình duyệt bỏ qua im lặng, và mọi test ở trên cũng bỏ qua vì chúng bỏ
// comment trước khi đọc CSS. Đã xảy ra hai lần: quy tắc `label{}` gốc cùng
// kiểu readonly/disabled của ô nhập (app.css), và toàn bộ CSS thẻ nguồn TEa
// (manage.css). Dấu hiệu: bên trong comment có một dòng là rule CSS hoàn chỉnh.
test('không comment nào nuốt mất rule CSS', () => {
  const swallowed = [];
  for (const file of ALL) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/\/\*[\s\S]*?\*\//g)) {
      const rule = m[0].slice(2, -2).split('\n').find((line) => /^\s*[.#:a-z*[][^{}]*\{[^{}]*:[^{}]*;[^{}]*\}\s*$/i.test(line) && !/`/.test(line));
      if (rule) swallowed.push(`${relative(ROOT, file)}:${source.slice(0, m.index).split('\n').length}: ${rule.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(swallowed, [], 'đóng comment bằng */ trước rule tiếp theo');
});

// Khoảng cách GIỮA các field từng lẫn 8/10/12/14/16/20px tuỳ trang (cùng một
// thẻ Cài đặt: cột trái 16px, cột phải 12px), cộng thêm margin-top 8px của
// nhãn ở mọi nơi ngoài <form>. Luật: khối cha tạo khoảng cách bằng
// `gap:var(--field-gap)`; nhãn trong `.field` không mang margin-top.
test('khoảng cách giữa các field: một token, do khối cha tạo', () => {
  assert.equal(flat('--field-gap'), '16px');
  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(app, /(?:^|\})\s*\.field>label\{margin:0 0 var\(--field-label-gap\);\}/, 'nhãn trong .field không có margin-top ở bất kỳ đâu');

  // Khối cha = thẻ HTML chứa trực tiếp từ hai `.field` trở lên.
  const RENDERER = join(ROOT, 'renderer');
  const tsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
  const counts = new Map();
  for (const file of tsxFiles(RENDERER)) {
    const src = readFileSync(file, 'utf8');
    const stack = [];
    const tagRe = /<\/?([A-Za-z][\w.]*)((?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*?)(\/?)>/g;
    for (let m; (m = tagRe.exec(src));) {
      const [whole, name, attrs, selfClose] = m;
      if (whole.startsWith('</')) {
        const i = stack.map((s) => s.name).lastIndexOf(name);
        if (i >= 0) stack.length = i;
        continue;
      }
      const cls = (attrs.match(/className="([^"]*)"/) || [])[1] || '';
      const parent = stack[stack.length - 1];
      if (/(^|\s)field(\s|$)/.test(cls) && parent && /^[a-z]/.test(parent.name)) {
        for (const c of parent.cls.split(/\s+/).filter(Boolean)) counts.set(c, (counts.get(c) || 0) + 1);
      }
      if (!selfClose && !['input', 'img', 'br', 'hr'].includes(name)) stack.push({ name, cls });
    }
  }
  const containers = [...counts].filter(([, n]) => n >= 2).map(([c]) => c);
  assert.ok(containers.length >= 15, 'không nhận ra khối chứa field nào — bộ đọc TSX hỏng?');

  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      for (const part of m[1].split(',').map((p) => p.trim()).filter(Boolean)) {
        const compounds = part.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
        const last = compounds.at(-1) || '';
        if (containers.some((c) => new RegExp(`\.${c}(?![\w-])`).test(last))) {
          for (const d of m[2].matchAll(/(?:^|;)\s*((?:row-|column-)?gap)\s*:\s*([^;]+)/g)) {
            if (d[2].trim() !== 'var(--field-gap)') bad.push(`${relative(ROOT, file)}: ${part} ${d[1]}:${d[2].trim()}`);
          }
        }
        // Nhãn của field không được tự thêm margin-top để giãn nhịp.
        if (/^label(?:[.:\[]|$)/.test(last) && compounds.slice(0, -1).some((c) => /\.field(?![\w-])/.test(c))) {
          const top = m[2].match(/(?:^|;)\s*margin-top\s*:\s*([^;]+)/);
          const short = m[2].match(/(?:^|;)\s*margin\s*:\s*([^;]+)/);
          const value = top ? top[1].trim() : short ? short[1].trim().split(/\s+/)[0] : null;
          if (value !== null && value !== '0') bad.push(`${relative(ROOT, file)}: ${part} margin-top:${value}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], 'khối chứa field dùng gap:var(--field-gap); nhãn field không có margin-top');
});

// Badge từng có 7 bản tự dựng (`.badge`, `.action-chip`, `.rc-crit-badge`,
// `.dash-level-pill`, `.qc-staff`…) với chiều cao 20/22/25/26px, và `.tag`
// gốc ăn theo dãn dòng của phần tử cha. `.action-chip` còn dùng lớp `bad`
// không có trong CSS, nên chip "trả lại/không hiệu quả" hiện không màu.
test('badge: hai kiểu .tag/.pill, một chiều cao, trang không đổi hình dạng', () => {
  assert.equal(flat('--badge-h'), '24px');
  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(app, /\.tag,\.pill\{[^}]*display:inline-flex;[^}]*min-height:var\(--badge-h\)/);
  for (const tone of ['ok', 'warn', 'rej', 'none']) assert.match(app, new RegExp(`\.tag\.${tone}\{`), `thiếu tông .tag.${tone}`);

  const RENDERER = join(ROOT, 'renderer');
  const tsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
  const TONES = ['ok', 'warn', 'rej', 'none'];
  const markup = [];
  for (const file of tsxFiles(RENDERER)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const raw = m[1] ?? m[2];
      const names = raw.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean);
      for (const name of names) {
        if (name === 'badge' || /-(?:chip|pill|badge)$/.test(name)) markup.push(`${relative(ROOT, file)}: lớp "${name}"`);
      }
      if (!names.includes('tag')) continue;
      // Tông của `.tag` phải là một trong bốn lớp có CSS — `bad` từng lọt qua.
      if (m[1] !== undefined && !names.some((n) => TONES.includes(n))) markup.push(`${relative(ROOT, file)}: "tag" thiếu tông ok|warn|rej|none`);
      if (m[2] !== undefined) {
        // Chỉ đọc giá trị trả về của phép chọn (`? 'x'` / `: 'y'`), không đọc
        // chuỗi đem so sánh (`=== 'approved'`).
        for (const q of raw.matchAll(/[?:]\s*'([a-z-]+)'/g)) if (!TONES.includes(q[1])) markup.push(`${relative(ROOT, file)}: tông lạ '${q[1]}' cho .tag`);
      }
    }
  }
  assert.deepEqual(markup, [], 'dùng .tag + ok|warn|rej|none cho trạng thái, .pill cho nhãn thông tin');

  const SHAPE = /^(?:height|min-height|max-height|padding(?:-[a-z]+)?|font(?:-[a-z]+)?|line-height|letter-spacing|border(?:-[a-z]+)?|background(?:-[a-z]+)?|color|box-shadow)$/;
  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const parts = m[1].split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.some((p) => /\.badge(?![\w-])|\.[\w-]+-(?:chip|pill|badge)(?![\w-])/.test(p))) bad.push(`${relative(ROOT, file)}: ${m[1].trim()} dựng badge riêng`);
      if (file.endsWith('app.css')) continue;
      const targetsBadge = parts.some((p) => /\.(?:tag|pill)(?![\w-])/.test(p.split(/\s*[>+~]\s*|\s+/).pop() || ''));
      if (!targetsBadge) continue;
      for (const d of m[2].matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/g)) {
        if (SHAPE.test(d[1])) bad.push(`${relative(ROOT, file)}: ${m[1].trim()} đổi ${d[1]}`);
        if (d[1] === 'display' && !['flex', 'inline-flex', 'none'].includes(d[2].trim())) bad.push(`${relative(ROOT, file)}: ${m[1].trim()} display:${d[2].trim()}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'CSS trang chỉ chỉnh bố cục quanh badge, không đổi kích thước, chữ hay màu');
});

// Modal từng có 16 độ rộng khác nhau (400–1160px): mỗi trang tự đặt `width`
// cho lớp modal của mình, và `<Modal width={…}>` nhận số tuỳ ý. Luật: bốn cỡ
// sm/md/lg/xl chọn qua prop `size`; chỉ app.css đặt độ rộng.
test('modal: bốn cỡ qua prop size, trang không tự đặt độ rộng', () => {
  assert.deepEqual(['sm', 'md', 'lg', 'xl'].map((k) => flat(`--modal-w-${k}`)), ['440px', '600px', '800px', '1120px']);
  const modalSrc = readFileSync(join(ROOT, 'renderer', 'components', 'Modal.tsx'), 'utf8');
  assert.match(modalSrc, /size = 'md'/, 'cỡ mặc định là md');
  assert.doesNotMatch(modalSrc, /width\?:|style=\{width/, 'Modal không nhận độ rộng tự do');

  const RENDERER = join(ROOT, 'renderer');
  const tsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
  const markup = [];
  for (const file of tsxFiles(RENDERER)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<Modal\b((?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)>/g)) {
      if (/\bwidth=|\bstyle=/.test(m[1])) markup.push(`${relative(ROOT, file)}: <Modal> tự đặt độ rộng`);
      const size = m[1].match(/\bsize="([a-z]+)"/);
      if (size && !['sm', 'md', 'lg', 'xl'].includes(size[1])) markup.push(`${relative(ROOT, file)}: size="${size[1]}"`);
    }
  }
  assert.deepEqual(markup, [], 'chọn cỡ bằng size="sm|md|lg|xl"');

  const bad = [];
  for (const file of PAGE_CSS) {
    if (file.endsWith('app.css')) continue;
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const targetsModal = m[1].split(',').some((p) => /\.(?:modal|[\w-]+-modal)(?![\w-])/.test(p.trim().split(/\s*[>+~]\s*|\s+/).pop() || ''));
      if (targetsModal && /(?:^|;)\s*(?:min-|max-)?width\s*:/.test(m[2])) bad.push(`${relative(ROOT, file)}: ${m[1].trim()}`);
    }
  }
  assert.deepEqual(bad, [], 'độ rộng modal chỉ đặt ở app.css theo 4 cỡ');
});

// Thứ tự lớp từng có 17 số (1, 2, 3, 4, 5, 8, 12, 20, 21, 24, 40, 41, 90, 900,
// 1100, 1200, 1400) chọn tuỳ chỗ, nên không ai biết một lớp mới phải đặt bao
// nhiêu. Luật: đặt theo vai trò bằng `--z-*`; `1` chỉ để nâng trong cùng khối.
test('z-index: thang theo vai trò, không số thô', () => {
  const ORDER = ['--z-sticky', '--z-sticky-head', '--z-float', '--z-page-head', '--z-sidebar',
    '--z-modal', '--z-dialog', '--z-tooltip', '--z-picker'];
  const values = ORDER.map((k) => Number(flat(k)));
  for (let i = 0; i < ORDER.length; i += 1) {
    assert.ok(Number.isInteger(values[i]) && values[i] > (i ? values[i - 1] : 1),
      `${ORDER[i]} phải là số nguyên lớn hơn lớp đứng trước (thang: ${ORDER.join(' < ')})`);
  }
  const zTokens = Object.keys(TOKEN).filter((k) => k.startsWith('--z-')).sort();
  assert.deepEqual(zTokens, [...ORDER].sort(), 'thêm vai trò mới vào ORDER cùng lý do trong tokens.css');

  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/z-index\s*:\s*([^;}]+)/g)) {
      const value = m[1].trim();
      if (!/^(?:0|1|auto|var\(--z-[a-z-]+\))$/.test(value)) bad.push(`${relative(ROOT, file)}: z-index:${value}`);
    }
  }
  assert.deepEqual(bad, [], 'dùng var(--z-*) theo vai trò; chỉ 0, 1, auto được viết thô');
});

// Icon SVG từng có 8 cỡ (10/14/15/16/17/21/23/27px): nút xoá hàng Nhập QC
// 15px nằm cạnh nút sửa/xoá dùng chung 14px, sidebar 17px, icon minh hoạ
// 23 và 27px. Luật: width/height của SVG đặt bằng var(--icon*); biểu đồ SVG
// co theo khung nên được dùng %/auto.
test('cỡ icon: năm bậc theo khung chứa, không số thô', () => {
  assert.deepEqual(['xs', 'sm', '', 'md', 'lg'].map((k) => flat(`--icon${k ? `-${k}` : ''}`)),
    ['10px', '14px', '16px', '20px', '24px']);

  // Lớp CSS gắn thẳng lên thẻ <svg> trong TSX (ví dụ `btn-ico`) cũng là icon.
  const RENDERER = join(ROOT, 'renderer');
  const tsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });
  const svgClasses = new Set();
  for (const file of tsxFiles(RENDERER)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<svg\b[^>]*className="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => svgClasses.add(c));
    for (const m of src.matchAll(/className:\s*'([^']+)'/g)) m[1].split(/\s+/).forEach((c) => svgClasses.add(c));
  }
  assert.ok(svgClasses.has('btn-ico'), 'không đọc được lớp của icon nút — bộ đọc TSX hỏng?');

  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const targetsSvg = m[1].split(',').some((p) => {
        const last = p.trim().split(/\s*[>+~]\s*|\s+/).pop() || '';
        return /^svg(?![\w-])/.test(last) || [...svgClasses].some((c) => new RegExp(`\.${c}(?![\w-])`).test(last));
      });
      if (!targetsSvg) continue;
      for (const d of m[2].matchAll(/(?:^|;)\s*(width|height)\s*:\s*([^;]+)/g)) {
        const value = d[2].trim();
        if (!/^var\(--icon(?:-[a-z]+)?\)$/.test(value) && !/%|^auto$/.test(value)) bad.push(`${relative(ROOT, file)}: ${m[1].trim()} ${d[1]}:${value}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'đặt cỡ icon bằng var(--icon-xs|sm|md|lg) hoặc var(--icon)');
});

// Bóng đổ từng viết tay ở 10 chỗ (sidebar, logo, header trang, nút…) và
// thời lượng chuyển động có sáu số .12/.14/.15/.16/.18/.2s cho cùng việc đổi
// màu khi rê chuột. Luật: box-shadow là token hoặc `inset` (vạch chỉ báo vẽ
// bằng bóng trong); thời lượng là --motion-fast/--motion/--motion-loading.
test('bóng đổ và chuyển động chỉ dùng token', () => {
  assert.equal(flat('--motion-fast'), '150ms');
  assert.equal(flat('--motion'), '200ms');
  assert.match(tokensSrc, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{[^}]*--motion-fast:\s*0ms;[^}]*--motion:\s*0ms;/,
    'giảm chuyển động hạ cả hai bậc về 0');

  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/(?<![-\w])box-shadow\s*:\s*([^;}]+)/g)) {
      const layers = m[1].trim().split(/,(?![^(]*\))/).map((l) => l.trim());
      for (const layer of layers) {
        if (!/^(?:none|var\(--[a-z0-9-]+\)|inset\s.+)$/.test(layer)) bad.push(`${relative(ROOT, file)}: box-shadow:${layer}`);
      }
    }
    for (const m of source.matchAll(/(?<![-\w])(transition|animation)(?:-duration|-delay)?\s*:\s*([^;}]+)/g)) {
      for (const t of m[2].matchAll(/(?:^|[\s,])(\d*\.?\d+m?s)(?=[\s,]|$)/g)) bad.push(`${relative(ROOT, file)}: ${m[1]} ${t[1]}`);
    }
  }
  assert.deepEqual(bad, [], 'thêm bóng/thời lượng vào tokens.css theo vai trò, đừng viết tay tại trang');
});

// Bộ đếm trong tab và số thứ tự bước không phải badge trạng thái nên từng tự
// dựng ở mỗi trang: bộ đếm Tổng quan 20px/12px, Cấu hình tự co theo chữ
// 11px, và tab đang chọn đổi màu bộ đếm theo hai cách. Luật: `.count` và
// `.step-number` dựng ở app.css; trang chỉ được đổi màu nền số thứ tự bước.
test('bộ đếm và số thứ tự bước: hai kiểu dùng chung, một kích thước', () => {
  assert.equal(flat('--count-h'), '20px');
  assert.equal(flat('--step-number-size'), '28px');
  const app = readFileSync(join(STYLE_DIR, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(app, /(?:^|\})\s*\.count\{[^}]*min-width:var\(--count-h\);height:var\(--count-h\)/);
  assert.match(app, /(?:^|\})\s*\.step-number\{[^}]*width:var\(--step-number-size\);height:var\(--step-number-size\)/);

  const SHAPE = /^(?:(?:min-|max-)?(?:width|height)|padding(?:-[a-z]+)?|font(?:-[a-z]+)?|line-height|border-radius|display)$/;
  const bad = [];
  for (const file of PAGE_CSS) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const lasts = m[1].split(',').map((p) => p.trim().split(/\s*[>+~]\s*|\s+/).pop() || '');
      if (file.endsWith('app.css') && lasts.every((l) => /^\.(?:count|step-number)$/.test(l))) continue;
      const hit = lasts.find((l) => /\.(?:count|step-number)(?![\w-])/.test(l));
      if (hit) {
        for (const d of m[2].matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)) {
          if (SHAPE.test(d[1]) || (/count/.test(hit) && /^(?:background|color)$/.test(d[1]))) bad.push(`${relative(ROOT, file)}: ${m[1].trim()} đổi ${d[1]}`);
        }
      }
      // Số thứ tự bước hoặc bộ đếm tự dựng lại: khối tròn cố định cỡ 20/28px.
      if (/-(?:number|count)(?![\w-])/.test(m[1]) && !/\.(?:count|step-number)(?![\w-])/.test(m[1]) && /border-radius:var\(--radius-(?:full|pill)\)/.test(m[2])) {
        bad.push(`${relative(ROOT, file)}: ${m[1].trim()} tự dựng bộ đếm/số thứ tự`);
      }
    }
  }
  assert.deepEqual(bad, [], 'dùng .count / .step-number; trang chỉ đổi màu nền của .step-number');
});
