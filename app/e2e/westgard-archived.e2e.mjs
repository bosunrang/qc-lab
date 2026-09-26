// Tab "Nhóm lô đã dừng/lưu trữ" của trang Phân tích Westgard trên app thật:
// dừng một nhóm lô đang có điểm QC, tab hiện đúng nhóm, đúng xét nghiệm từng
// dùng nhóm đó và bảng Westgard lịch sử có điểm đã nhập.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('tab nhóm lô đã dừng hiện dữ liệu Westgard lịch sử', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const today = await todayIn(page);
    const stopped = await page.evaluate(async ({ instrumentId, date }) => {
      const api = window.qcApi;
      const must = (result, step) => { if (!result?.ok) throw new Error(`${step}: ${JSON.stringify(result?.error)}`); return result.data; };
      const test = must(await api.saveTest({ data: { name: 'Ure E2E', instrumentId, unit: 'mmol/L' } }), 'saveTest');
      const lotA = must(await api.saveLot({ data: { lotNo: 'URE-1A', level: 1 } }), 'saveLot A');
      const lotB = must(await api.saveLot({ data: { lotNo: 'URE-1B', level: 1 } }), 'saveLot B');
      const group = must(await api.saveLotGroup({ data: { name: 'Nhóm Ure E2E', lotIds: [lotA.id, lotB.id] } }), 'saveLotGroup');
      must(await api.saveTestLevel({ testId: test.id, data: { level: 1, mean: 6, sd: 0.3, qcLotId: lotA.id } }), 'saveTestLevel');
      must(await api.savePanel({ data: { name: 'Panel Ure E2E', instrumentId, testIds: [test.id] } }), 'savePanel');
      must(await api.addPoint({ data: { testId: test.id, level: 1, date, val: 6.12 } }), 'addPoint');
      must(await api.stopLotGroup({ id: group.id }), 'stopLotGroup');
      return { testName: test.name, groupName: group.name };
    }, { instrumentId: seeded.instrumentId, date: today });

    await openPage(page, 'Phân tích Westgard');
    await page.getByRole('button', { name: /Nhóm lô đã dừng\/lưu trữ \(1\)/ }).click();
    await page.locator('select option', { hasText: stopped.groupName }).first().waitFor({ state: 'attached' });
    await page.locator('select option', { hasText: stopped.testName }).first().waitFor({ state: 'attached' });
    const row = page.locator('.wg-table tbody tr', { hasText: '6.12' }).first();
    await row.waitFor();
    assert.match(await row.innerText(), /Đạt/);
    assert.match(await page.locator('.wg-level-meta .tag.rej').first().innerText(), /Đã dừng/);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
