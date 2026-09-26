// Khởi chạy app Electron thật (bản đã build ở `app-dist/`) cho test
// end-to-end. Mỗi lần chạy dùng một thư mục dữ liệu tạm và một cổng LAN trống
// (xem `QCLAB_USER_DATA_DIR`/`QCLAB_LAN_PORT` ở `main/index.ts`), nên không
// đụng CSDL của người dùng và chạy được cả khi QC Lab thật đang mở.
import { _electron } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const ADMIN = { username: 'admin', name: 'Quản trị E2E', password: 'mat-khau-e2e-1' };
export const TECH = { username: 'ktv', name: 'Kỹ thuật viên E2E', password: 'mat-khau-ktv-1' };

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Ghi lại lỗi console và lỗi không được bắt của một cửa sổ. */
export function watchErrors(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export async function launchApp() {
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'qclab-e2e-'));
  const port = await freePort();
  const env = { ...process.env, QCLAB_USER_DATA_DIR: userDataDir, QCLAB_LAN_PORT: String(port) };
  // Bản build phải nạp tệp trong `app-dist/renderer`, không trỏ sang Vite.
  delete env.APP_V2_DEV_SERVER_URL;
  const app = await _electron.launch({ args: ['.'], cwd: REPO_ROOT, env });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20_000);
  const errors = watchErrors(page);
  return { app, page, errors, port, userDataDir };
}

/** Máy mới: tạo tài khoản quản trị đầu tiên rồi đăng nhập. */
export async function bootstrapAndLogin(page, user = ADMIN) {
  await page.fill('#bootstrap-username', user.username);
  await page.fill('#bootstrap-name', user.name);
  await page.fill('#bootstrap-password', user.password);
  await page.getByRole('button', { name: 'Tạo tài khoản quản trị' }).click();
  await login(page, user);
}

export async function login(page, user) {
  await page.fill('#login-username', user.username);
  await page.fill('#login-password', user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).waitFor();
}

/** Ngày hôm nay theo giờ địa phương của cửa sổ, dạng YYYY-MM-DD. */
export function todayIn(page) {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

/** Dựng một xét nghiệm hai mức sẵn sàng nhập QC qua đúng API công bố cho
 * renderer (preload → IPC → handler thật), cùng trình tự người quản trị làm ở
 * Cấu hình chung: máy, xét nghiệm, lô, nhóm lô, Mean/SD gắn lô, Panel QC. */
export async function seedOperationalTest(page) {
  return page.evaluate(async () => {
    const api = window.qcApi;
    const must = (result, step) => {
      if (!result?.ok) throw new Error(`${step}: ${JSON.stringify(result?.error)}`);
      return result.data;
    };
    const instrument = must(await api.saveInstrument({ data: { name: 'Máy E2E' } }), 'saveInstrument');
    const test = must(await api.saveTest({ data: { name: 'Glucose E2E', instrumentId: instrument.id, unit: 'mmol/L' } }), 'saveTest');
    const lots = [];
    for (const [lotNo, level] of [['E2E-1A', 1], ['E2E-2A', 2]]) {
      lots.push(must(await api.saveLot({ data: { lotNo, level } }), `saveLot ${lotNo}`));
    }
    must(await api.saveLotGroup({ data: { name: 'Nhóm lô E2E', lotIds: lots.map((lot) => lot.id) } }), 'saveLotGroup');
    must(await api.saveTestLevel({ testId: test.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: lots[0].id } }), 'saveTestLevel 1');
    must(await api.saveTestLevel({ testId: test.id, data: { level: 2, mean: 15, sd: 0.5, qcLotId: lots[1].id } }), 'saveTestLevel 2');
    must(await api.savePanel({ data: { name: 'Panel E2E', instrumentId: instrument.id, testIds: [test.id] } }), 'savePanel');
    return { instrumentId: instrument.id, testId: test.id, testName: test.name };
  });
}

/** Chuyển trang bằng thanh điều hướng như người dùng. */
export async function openPage(page, label) {
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: label }).click();
}

/** Ô nhập của một mức trong ngày trên bảng Nhập QC. */
export function entryCell(page, date, level) {
  return page.locator(`.qc-sheet input.qc-inline-input[data-focus-date="${date}"][data-focus-level="${level}"]`).first();
}

export async function enterValue(page, date, level, value) {
  const cell = entryCell(page, date, level);
  await cell.fill(String(value));
  await cell.blur();
}

/** Đếm số lần main process nhận từng kênh IPC, để test canh số lần nạp lại
 * dữ liệu sau một thao tác ghi. Bọc handler đã đăng ký trong bảng nội bộ của
 * `ipcMain`; Electron đổi cấu trúc này thì hàm báo lỗi rõ thay vì đếm sai. */
export async function countIpcCalls(app, channels) {
  await app.evaluate(({ ipcMain }, names) => {
    const handlers = ipcMain._invokeHandlers;
    if (!(handlers instanceof Map)) throw new Error('ipcMain._invokeHandlers không còn là Map — cần sửa countIpcCalls().');
    globalThis.__ipcCounts = Object.fromEntries(names.map((name) => [name, 0]));
    for (const name of names) {
      const original = handlers.get(name);
      if (!original) throw new Error(`Không có kênh IPC ${name}.`);
      handlers.set(name, (...args) => { globalThis.__ipcCounts[name] += 1; return original(...args); });
    }
  }, channels);
  return {
    read: () => app.evaluate(() => ({ ...globalThis.__ipcCounts })),
    reset: () => app.evaluate(() => { for (const key of Object.keys(globalThis.__ipcCounts)) globalThis.__ipcCounts[key] = 0; }),
  };
}
