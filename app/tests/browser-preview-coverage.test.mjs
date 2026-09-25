// Ratchet: bản xem trước qua trình duyệt phải chạy CHÍNH handler thật, và
// danh sách hàm "cần Electron thật" KHÔNG được phình ra.
//
// Nền: từ 2026-09-09 `renderer/browser-mock/real-api.ts` nối thẳng các
// handler `main/ipc/*` lên SQLite (sql.js/WASM) thay cho `api.ts` cũ — 1.748
// dòng dịch lại logic bằng mảng JS, nguồn của 18 lệch hành vi mà C7 phải đi
// bắt từng cái. `satisfies QcApiSurface` trong file đó đã canh ĐỦ và ĐÚNG
// TÊN 122 hàm ở tầng `tsc`; test này canh thứ `tsc` không thấy: đường dễ đi
// nhất khi thêm hàm mới là nhét nó vào nhóm `notAvailable()` thay vì nối
// handler, và làm vậy nhiều lần thì bản xem trước lặng lẽ quay về chỗ cũ.
//
// Đây là SOURCE SCANNER (đọc mã nguồn như văn bản), cùng kiểu với
// tests/global-name-uniqueness.test.js của hệ thống — không phải test hành vi.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBusinessOperations } = require('../../app-dist/main/ipc/operations.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const realApi = readFileSync(join(ROOT, 'renderer/browser-mock/real-api.ts'), 'utf8');
const preload = readFileSync(join(ROOT, 'main/preload.ts'), 'utf8');

/** Số hàm được phép trả `not-available-in-browser-preview`. Khớp đúng danh
 * sách mà `api.ts` cũ đã trả như vậy: 3 Firebase (connect/sync/disconnect),
 * và 3 LIS (pull/import/reject) — tổng 12.
 *
 * SIẾT xuống khi một hàm được nối vào handler thật; chỉ NÂNG khi có lý do
 * kỹ thuật thật (cần file system / BrowserWindow / HTTP ra ngoài) và ghi lý
 * do ngay tại chỗ trong real-api.ts. */
const NOT_AVAILABLE_BUDGET = 12;

test('real-api nối handler thật, không tự cài đặt lại nghiệp vụ', () => {
  // Phải dựng handler thật từ main/ipc — đây là điều làm nên cả đợt này.
  for (const factory of ['createConfigHandlers', 'createEntryHandlers', 'createWestgardHandlers',
    'createSigmaHandlers', 'createNceHandlers', 'createReagentHandlers', 'createAuthHandlers',
    'createAuditHandlers', 'createSettingsHandlers', 'createReportHandlers']) {
    assert.ok(realApi.includes(factory), `real-api.ts phải dùng ${factory} của main/ipc`);
  }
  // Và phải chạy trên SQLite thật, không phải mảng JS trong localStorage.
  assert.ok(realApi.includes('openPreviewDatabase'), 'phải mở SQLite qua sqlite-loader');
  assert.doesNotMatch(realApi, /localStorage\s*\.\s*(get|set|remove)Item/,
    'không được quay lại lưu bằng localStorage');
});

test('số hàm cần Electron thật không phình ra', () => {
  // Đếm PROPERTY trả not-available: `=> notAvailable()` (không khớp dòng khai
  // báo `function notAvailable()`), cộng các property tự viết mã lỗi đó —
  // trừ 1 cho chính thân hàm notAvailable().
  const count = (realApi.match(/=> notAvailable\(\)/g) || []).length
    + (realApi.match(/code: 'not-available-in-browser-preview'/g) || []).length - 1;
  assert.ok(count <= NOT_AVAILABLE_BUDGET,
    `${count} hàm trả not-available, vượt ngưỡng ${NOT_AVAILABLE_BUDGET}. ` +
    'Nối hàm mới vào handler thật thay vì thêm vào nhóm này; nếu thật sự cần ' +
    'Electron thì nâng ngưỡng KÈM lý do kỹ thuật ghi trong real-api.ts.');
});

test('mọi kênh IPC trong preload đều có mặt ở bản xem trước', () => {
  // `satisfies QcApiSurface` canh theo `QcApi`; test này canh theo PRELOAD,
  // nên một hàm được thêm vào preload+QcApi mà quên real-api sẽ bị bắt kể cả
  // khi ai đó nới lỏng kiểu. Hàm nghiệp vụ tới từ bảng dùng chung
  // (`...business` trong real-api.ts); phần còn lại phải tự khai tại chỗ.
  const names = [...preload.matchAll(/^ {2}([a-zA-Z]+): \(/gm)].map((m) => m[1]);
  assert.ok(names.length >= 120, `preload chỉ có ${names.length} hàm — regex có còn đúng?`);
  assert.match(realApi, /\.\.\.business,/, 'real-api.ts phải trải bảng nghiệp vụ dùng chung');
  const businessNames = new Set(Object.keys(createBusinessOperations({})));
  // Dựng regex bằng chuỗi THƯỜNG: trong template literal, `` là ký tự
  // BACKSPACE chứ không phải word-boundary — bản đầu của test này vì thế
  // báo thiếu cả 122 hàm.
  const missing = names.filter((name) => !businessNames.has(name) && !new RegExp('(^|[^A-Za-z])' + name + ':').test(realApi));
  assert.deepEqual(missing, [], `real-api.ts thiếu: ${missing.join(', ')}`);
});


