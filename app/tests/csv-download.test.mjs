// CSV tải về từ mọi trang (Báo cáo, Nhật ký hoạt động, Khắc phục sự cố) đi
// qua MỘT hàm `downloadCsv()` luôn kèm BOM UTF-8 (kế hoạch kiến trúc D.9):
// Excel trên Windows đoán mã hoá theo codepage hệ thống, thiếu BOM là tiếng
// Việt thành ký tự rác. Trước 2026-09-26 chỉ Báo cáo có BOM.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const RENDERER = fileURLToPath(new URL('../renderer', import.meta.url));
let server;
before(async () => {
  server = await createServer({
    configFile: false, root: RENDERER, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
  });
});
after(() => server?.close());

test('downloadCsv ghi BOM UTF-8 trước nội dung', async () => {
  const blobs = [];
  const clicked = [];
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:csv'; };
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    createElement: () => ({ click() { clicked.push(this.download); } }),
    body: { appendChild() {}, removeChild() {} },
  };
  try {
    const { downloadCsv } = await server.ssrLoadModule('/lib/export.ts');
    downloadCsv('Người thực hiện,Đã huỷ\n', 'nhat-ky.csv');
    assert.deepEqual(clicked, ['nhat-ky.csv']);
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'tệp bắt đầu bằng BOM');
    assert.equal(new TextDecoder().decode(bytes.slice(3)), 'Người thực hiện,Đã huỷ\n', 'nội dung giữ nguyên sau BOM');
    assert.match(blobs[0].type, /^text\/csv/);
  } finally {
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    delete globalThis.document;
  }
});

test('không trang nào tự dựng tệp CSV ngoài downloadCsv', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) { if (name !== 'browser-mock') walk(full); continue; }
      if (!/\.tsx?$/.test(name) || full.endsWith(path.join('lib', 'export.ts'))) continue;
      if (/text\/csv/.test(readFileSync(full, 'utf8'))) offenders.push(path.relative(RENDERER, full));
    }
  };
  walk(RENDERER);
  assert.deepEqual(offenders, [], 'CSV phải đi qua downloadCsv() của lib/export.ts để có BOM');
});
