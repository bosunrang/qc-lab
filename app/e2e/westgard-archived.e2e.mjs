// Tab "Nhóm lô đã dừng/lưu trữ" của trang Phân tích Westgard trên app thật:
// dừng một nhóm lô đang có điểm QC, tab hiện đúng nhóm, đúng xét nghiệm từng
// dùng nhóm đó và bảng Westgard lịch sử có điểm đã nhập.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, countIpcCalls, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

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

test('Westgard hiện lô hiện hành trước và bảng Nhập QC mở đúng tháng lô cũ', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const { testId, instrumentId } = await seedOperationalTest(page);
    await page.evaluate(async ({ testId, instrumentId }) => {
      const api = window.qcApi;
      const must = (result) => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const mainLot = (await api.listTestLevels(testId))[0].qc_lot_id;
      const other = must(await api.saveTest({ data: { name: 'Ure đổi xét nghiệm', instrumentId, unit: 'mmol/L' } }));
      must(await api.saveTestLevel({ testId: other.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: mainLot } }));
      must(await api.savePanel({ data: { name: 'Panel thử đổi xét nghiệm', instrumentId, testIds: [other.id] } }));
    }, { testId, instrumentId });
    const today = await todayIn(page);
    const oldDay = await page.evaluate(() => {
      const now = new Date();
      const old = new Date(now.getFullYear(), now.getMonth() - 3, 15);
      return [old.getFullYear(), String(old.getMonth() + 1).padStart(2, '0'), '15'].join('-');
    });
    const added = await page.evaluate(({ testId, today }) => window.qcApi.addPoint({ data: { testId, level: 1, date: today, val: 5.1 } }), { testId, today });
    assert.equal(added.ok, true);
    await app.evaluate(({ app, ipcMain }, { testId, oldDay, today }) => {
      const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
      const path = process.getBuiltinModule('node:path');
      const db = new DatabaseSync(path.join(app.getPath('userData'), 'qclab.sqlite'));
      try {
        const lot = db.prepare('SELECT ql.id, ql.group_id FROM test_levels tl JOIN qc_lots ql ON ql.id=tl.qc_lot_id WHERE tl.test_id=? AND tl.level=1').get(testId);
        const panel = db.prepare('SELECT panel_id FROM qc_panel_tests WHERE test_id=?').get(testId);
        db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('old-e2e',?,'LO-CU-E2E',1)").run(lot.group_id);
        db.prepare('UPDATE test_levels SET mean_sd_history_json=? WHERE test_id=? AND level=1')
          .run(JSON.stringify([{ qcLotId: 'old-e2e', mean: 7, sd: 0.5 }]), testId);
        db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,status,start_date,approved_at)
          VALUES ('transition-e2e',?,'old-e2e',?,'accepted',?,?)`).run(panel.panel_id, lot.id, today, today);
        db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd)
          VALUES ('old-point-e2e',?,1,?,'1',7.25,'LO-CU-E2E',7,0.5)`).run(testId, oldDay);
      } finally {
        db.close();
      }
      const channel = 'westgard:listPreviousLotBlocks';
      const calculate = ipcMain._invokeHandlers.get(channel);
      const gate = new Promise(resolve => { globalThis.releaseOldLots = resolve; });
      ipcMain._invokeHandlers.set(channel, async (...args) => {
        await gate;
        return calculate(...args);
      });
    }, { testId, today, oldDay });
    const historyChannel = 'westgard:listPreviousLotBlocks';
    const calls = await countIpcCalls(app, [historyChannel]);

    await openPage(page, 'Phân tích Westgard');
    await page.locator('.wg-table tr', { hasText: '5.10' }).waitFor();
    const showOld = page.getByRole('button', { name: 'Xem lô cũ', exact: true });
    await showOld.waitFor();
    assert.equal((await calls.read())[historyChannel], 0, 'mở kết quả hiện hành không tính lô cũ');
    await showOld.click();
    await page.getByRole('status').filter({ hasText: 'Đang tải lô cũ…' }).waitFor();
    assert.equal(await page.locator('.wg-table tr', { hasText: '5.10' }).count(), 1, 'bảng hiện hành vẫn đọc được trong lúc chờ');
    await app.evaluate(() => globalThis.releaseOldLots());
    await page.locator('.wg-prev-lot .wg-table tr', { hasText: '7.25' }).waitFor();
    assert.equal((await calls.read())[historyChannel], 1);
    for (const name of ['Ure đổi xét nghiệm', 'Glucose E2E']) {
      await page.locator('#wgTestSelect').fill(name);
      await page.getByRole('option', { name: new RegExp(name) }).click();
    }
    await page.locator('.wg-prev-lot .wg-table tr', { hasText: '7.25' }).waitFor();
    assert.equal((await calls.read())[historyChannel], 2, 'quay lại dùng một yêu cầu mới cho lô cũ đang mở');
    await page.getByRole('button', { name: 'Xem lô mới', exact: true }).click();
    await page.locator('.wg-table tr', { hasText: '5.10' }).waitFor();

    await page.locator('main').evaluate(main => { main.scrollTop = main.scrollHeight; });
    assert.ok(await page.locator('main').evaluate(main => main.scrollTop > 0));
    await openPage(page, 'Nhập QC & Biểu đồ');
    const entry = page.locator('.entry-main[aria-busy="false"]');
    await entry.locator('.qc-value-cell', { hasText: '5.10' }).first().waitFor();
    assert.equal(await page.locator('main').evaluate(main => main.scrollTop), 0, 'đổi trang mở ở đầu');
    assert.equal(await entry.locator('.qc-value-cell.prev').count(), 0);
    const chartRange = await entry.locator('.lj-range').innerText();
    await page.getByRole('combobox', { name: 'Năm của bảng nhập' }).selectOption(oldDay.slice(0, 4));
    await page.getByRole('combobox', { name: 'Tháng của bảng nhập' }).selectOption(String(Number(oldDay.slice(5, 7))));
    await entry.locator('.qc-value-cell.prev', { hasText: '7.25' }).waitFor();
    assert.equal(await entry.locator('.lj-range').innerText(), chartRange, 'đổi tháng giữ khoảng biểu đồ');
    await page.locator('.lj-mini').getByRole('button', { name: 'Xem lô cũ', exact: true }).click();
    const chartInputs = page.locator('.lj-date-field .date-text');
    for (const date of await chartInputs.all()) {
      await date.fill(oldDay.split('-').reverse().join('/'));
      await date.press('Enter');
    }
    const chart = entry.locator('.lj-mini', { hasText: 'Lô cũ LO-CU-E2E' });
    await chart.locator('.lj-point-count', { hasText: '1 điểm' }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
