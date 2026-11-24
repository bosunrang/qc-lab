import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('bấm xét nghiệm cuộn tới hôm nay và giữ viền mặc định của ô nhập', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootstrapAndLogin(page);
    // Dùng ngày 20 của tháng trước để hàng hôm nay luôn nằm ngoài vùng xem ban đầu.
    const now = new Date();
    await page.clock.setFixedTime(new Date(now.getFullYear(), now.getMonth() - 1, 20, 12));
    const today = await todayIn(page);
    const yesterday = `${today.slice(0, 7)}-19`;
    const partial = await seedOperationalTest(page);
    const emptyName = 'Ure E2E';
    await page.evaluate(async ({ partial, emptyName, today }) => {
      const api = window.qcApi;
      const must = (result) => {
        if (!result.ok) throw new Error(result.error.message);
        return result.data;
      };
      const levels = await api.listTestLevels(partial.testId);
      const empty = must(await api.saveTest({ data: { name: emptyName, instrumentId: partial.instrumentId, unit: 'mmol/L' } }));
      must(await api.saveTestLevel({ testId: empty.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: levels.find((l) => l.level === 1).qc_lot_id } }));
      must(await api.savePanel({ data: { name: 'Panel Ure E2E', instrumentId: partial.instrumentId, testIds: [empty.id] } }));
      must(await api.addPoint({ data: { testId: partial.testId, level: 1, date: today, val: 5 } }));

      const scrollIntoView = Element.prototype.scrollIntoView;
      window.entryJumps = [];
      Element.prototype.scrollIntoView = function (...args) {
        if (this.closest('.qc-sheet')) window.entryJumps.push(this.matches('tr.today') ? 'today' : 'other');
        return scrollIntoView.apply(this, args);
      };
    }, { partial, emptyName, today });

    const sheet = page.locator('.qc-sheet-wrap');
    const jumpLog = () => page.evaluate(() => window.entryJumps);
    const choose = async (name, count) => {
      await page.locator('.tn-config').getByText(name, { exact: true }).click();
      await page.waitForFunction((expected) => window.entryJumps.length >= expected, count);
      assert.deepEqual(await jumpLog(), Array(count).fill('today'));
      assert.ok(await sheet.evaluate((el) => el.scrollTop > 0));
    };
    const assertPlainInput = async (date, level) => {
      const input = sheet.locator(`input[data-focus-date="${date}"][data-focus-level="${level}"]`);
      const style = await input.evaluate((el) => ({ border: getComputedStyle(el).borderTopStyle, focused: el === document.activeElement }));
      assert.deepEqual(style, { border: 'dashed', focused: false });
    };
    const filledToday = sheet.locator('tr.today .qc-run-cell.has-data');

    await openPage(page, 'Nhập QC & Biểu đồ');
    await filledToday.first().waitFor();
    assert.deepEqual(await jumpLog(), []);
    await choose(emptyName, 1);
    await assertPlainInput(today, 1);

    await choose(partial.testName, 2);
    await assertPlainInput(today, 2);

    const added = await page.evaluate(({ testId, date }) => window.qcApi.addPoint({ data: { testId, level: 2, date, val: 15 } }),
      { testId: partial.testId, date: today });
    assert.equal(added.ok, true, JSON.stringify(added));
    await filledToday.nth(1).waitFor();
    await choose(partial.testName, 3);
    await assertPlainInput(yesterday, 2);

    await openPage(page, 'Tổng quan');
    await openPage(page, 'Nhập QC & Biểu đồ');
    await filledToday.nth(1).waitFor();
    assert.equal(await sheet.evaluate((el) => el.scrollTop), 0);
    assert.deepEqual(await jumpLog(), ['today', 'today', 'today']);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
