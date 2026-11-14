import { _electron } from 'playwright-core';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createSampleRecords, startMockGateway } from './lis-gateway.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
export const DEMO_USER = { username: 'admin', name: 'Quản trị LIS Demo', password: 'lis-demo-123' };

async function freeLanPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

/** Tạo hồ sơ riêng mỗi lần chạy; mọi danh mục được ghi qua IPC thật có nhật ký. */
export async function launchLisDemo({ failAckOnce = false, persistent = false } = {}) {
  const cache = path.join(ROOT, '.cache');
  mkdirSync(cache, { recursive: true });
  const userDataDir = mkdtempSync(path.join(cache, 'lis-demo-'));
  const env = { ...process.env, QCLAB_USER_DATA_DIR: userDataDir, QCLAB_LAN_PORT: String(await freeLanPort()) };
  delete env.QCLAB_DEV_SERVER_URL;
  const app = await _electron.launch({ args: ['.'], cwd: ROOT, env });
  let gateway;
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20_000);
    await page.locator('#bootstrap-username').fill(DEMO_USER.username);
    await page.locator('#bootstrap-name').fill(DEMO_USER.name);
    await page.locator('#bootstrap-password').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Tạo tài khoản quản trị', exact: true }).click();
    await page.locator('#login-username').fill(DEMO_USER.username);
    await page.locator('#login-password').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).waitFor();
    const seeded = await page.evaluate(async () => {
      const api = window.qcApi;
      const must = (result) => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const instrument = must(await api.saveInstrument({ data: { name: 'Máy LIS Demo' } }));
      const test = must(await api.saveTest({ data: { name: 'Glucose LIS Demo', instrumentId: instrument.id, unit: 'mmol/L' } }));
      const lots = [];
      for (const level of [1, 2]) {
        lots.push(must(await api.saveLot({ data: { lotNo: `LIS-DEMO-L${level}`, level } })));
      }
      must(await api.saveLotGroup({ data: { name: 'Nhóm lô LIS Demo', lotIds: lots.map((lot) => lot.id) } }));
      for (const level of [1, 2]) {
        must(await api.saveTestLevel({ testId: test.id, data: { level, mean: level === 1 ? 5 : 15,
          sd: level === 1 ? 0.2 : 0.5, qcLotId: lots[level - 1].id } }));
      }
      must(await api.savePanel({ data: { name: 'Panel LIS Demo', instrumentId: instrument.id, testIds: [test.id] } }));
      return { testId: test.id };
    });
    let records = createSampleRecords(seeded.testId);
    if (persistent) {
      if (failAckOnce) throw new Error('Lỗi xác nhận giả lập chỉ có trong Gateway giả lập.');
      const { GatewayStore, LOCAL_ADMIN } = require('../../app-dist/main/gateway/store.js');
      const { startGateway } = require('../../app-dist/main/gateway/server.js');
      const store = new GatewayStore(path.join(userDataDir, 'gateway.sqlite'));
      try {
        const tokens = store.initialize();
        const source = store.createToken(LOCAL_ADMIN, { role: 'ingest', sourceId: 'LIS-DEMO', label: 'Nguồn QC mẫu' });
        store.saveMappings(LOCAL_ADMIN, [1, 2].map((level) => ({ sourceId: 'LIS-DEMO', analyzerId: 'MAY-LIS-DEMO',
          testCode: 'GLU', qcLevel: String(level), qcLotCode: `LIS-DEMO-L${level}`, qclabTestId: seeded.testId,
          level, lot: `LIS-DEMO-L${level}`, unit: 'mmol/L', displayName: 'Glucose LIS Demo' })));
        const server = await startGateway({ store });
        let closing;
        gateway = { ...server, token: tokens.app.token, store, sourceToken: source.token,
          close: () => closing ??= server.close().finally(() => store.close()) };
        // Dữ liệu mẫu đi qua cùng API HTTP và cổng xác thực như bộ kết nối thật.
        for (const record of records) {
          const response = await fetch(server.url + '/api/v1/qc-results', { method: 'POST',
            headers: { authorization: `Bearer ${source.token}`, 'content-type': 'application/json' }, body: JSON.stringify(record.message) });
          if (!response.ok) throw new Error(`Không nạp được mẫu QC: HTTP ${response.status}`);
        }
        const response = await fetch(server.url + '/api/v1/qc-results?status=pending&limit=500', { headers: { authorization: `Bearer ${tokens.app.token}` } });
        records = (await response.json()).items;
      } catch (error) { if (!gateway) store.close(); throw error; }
    } else gateway = await startMockGateway({ records, failAckOnce });
    const saved = await page.evaluate(async (settings) => window.qcApi.saveLisSettings({ data: settings }),
      { enabled: true, url: gateway.url, token: gateway.token });
    if (!saved.ok) throw new Error(saved.error.message);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Cài đặt & Đám mây' }).click();
    await page.getByRole('button', { name: 'Xem hàng chờ QC', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Hàng chờ QC từ LIS Gateway', exact: true });
    await modal.getByText('Sẵn sàng nhận (3)', { exact: true }).waitFor();
    await modal.getByText('Chưa khớp cấu hình (3)', { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }, persistent) => { BrowserWindow.getAllWindows()[0].setTitle(persistent ? 'QC Lab — DEMO Gateway SQLite' : 'QC Lab — DEMO LIS'); }, persistent);
    // Đóng Electron thì dừng cả Gateway thuộc phiên demo này.
    app.once('close', () => { void gateway.close(); });
    return { app, page, gateway, userDataDir, records, testId: seeded.testId };
  } catch (error) {
    if (gateway) await gateway.close();
    await app.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const demo = await launchLisDemo({ failAckOnce: process.argv.includes('--fail-ack-once'), persistent: process.argv.includes('--persistent') });
    console.log(`Electron DEMO LIS đã sẵn sàng: 3 bản tin hợp lệ, 3 bản tin lỗi.\nGateway: ${demo.gateway.url}\nBearer token: ${demo.gateway.token}\nTài khoản demo: ${DEMO_USER.username} / ${DEMO_USER.password}\nDữ liệu demo: ${demo.userDataDir}\nCtrl+C để thoát Electron và Gateway.`);
    const stop = () => { void demo.app.close(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(`Không mở được demo LIS: ${error.message}`);
    process.exitCode = 1;
  }
}
