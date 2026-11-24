// U12: chữ tiếng Việt thống nhất trên giao diện.
// - Dấu thanh đặt trên âm chính (QĐ 1989/QĐ-BGDĐT 2018): "xoá", "huỷ", "khoá",
//   không viết "xóa", "hủy", "khóa" ở vần mở.
// - Chuỗi hiển thị không còn "backup", "app", "dữ liệu test".
// - Tiêu đề mỗi trang trùng nhãn của trang đó trên menu.
// Phần EQA (đang làm riêng) và câu SQL migration chưa nằm trong phạm vi.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PAGE_DEFS } from '../main/domain/page-roles.ts';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /[\\/](node_modules|pages[\\/]eqa|domain[\\/]eqa)([\\/]|$)/;
const SKIP_FILES = new Set(['main/ipc/eqa-handlers.ts', 'main/ipc/operations.ts', 'main/preload.ts', 'shared/qc-api.d.ts', 'main/db/schema.ts']);

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.test(full)) continue;
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const rel = path.relative(APP, full).split(path.sep).join('/');
      if (!SKIP_FILES.has(rel)) out.push({ rel, text: fs.readFileSync(full, 'utf8') });
    }
  }
  return out;
}
const FILES = ['main', 'renderer', 'shared'].flatMap((dir) => sourceFiles(path.join(APP, dir)));

test('dấu thanh đặt trên âm chính ở vần mở (oá, oà, uỷ…)', () => {
  const OLD = /[\p{L}]*(?:[óòỏõọÓÒỎÕỌ][aeAE]|[úùủũụÚÙỦŨỤ][yY])(?![\p{L}\p{M}])/gu;
  const found = FILES.flatMap(({ rel, text }) => [...text.matchAll(OLD)].map((m) => `${rel}: ${m[0]}`));
  assert.deepEqual(found, []);
});

test('chuỗi hiển thị không còn backup / app / dữ liệu test', () => {
  const VN = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
  const EN = /(?<![\w.\/-])(app|App|backup|Backup|test)(?![\w\/(-])/;
  const found = [];
  for (const { rel, text } of FILES) {
    text.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const code = line.replace(/\/\/.*$/, '');
      for (const m of code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)) {
        const s = m[1] ?? m[2] ?? m[3] ?? m[4];
        // `${test.name}` là biến, không phải chữ hiển thị.
        const shown = s.replace(/\$\{[^}]*\}/g, '');
        if (VN.test(shown) && EN.test(shown)) found.push(`${rel}:${i + 1}: ${s.slice(0, 80)}`);
      }
    });
  }
  // Thông báo chỉ dành cho lập trình viên chạy bản xem trước trên trình duyệt.
  assert.deepEqual(found.filter((f) => !f.startsWith('renderer/browser-mock/')), []);
});

test('tiêu đề trang trùng nhãn menu', () => {
  const PAGE_FILES = {
    dash: 'DashboardPage', entry: 'EntryPage', westgard: 'WestgardPage', sigma: 'SigmaPage', reagent: 'ReagentPage',
    eqa: 'EqaPage', actions: 'ActionsPage', report: 'ReportPage', manage: 'ManagePage', users: 'UsersPage',
    audit: 'AuditPage', settings: 'SettingsPage',
  };
  assert.deepEqual(Object.keys(PAGE_FILES).sort(), PAGE_DEFS.map((p) => p.id).sort());
  for (const page of PAGE_DEFS) {
    const text = fs.readFileSync(path.join(APP, 'renderer', 'pages', `${PAGE_FILES[page.id]}.tsx`), 'utf8');
    const titles = [...text.matchAll(/<PageHeader title="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(titles.length, `${page.id} có PageHeader`);
    for (const title of titles) assert.equal(title, page.label, `tiêu đề trang ${page.id}`);
  }
});
