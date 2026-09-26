// Số lần nạp lại sau một thao tác ghi (kế hoạch kiến trúc, E.6/D.1). Mỗi lần
// `listTestSummaries` là một lượt tính Westgard cho mọi xét nghiệm trên main
// process (khoảng 0,5 s với dữ liệu 5 năm), và mọi máy trạm LAN chờ trong lúc
// đó. Trước 2026-09-26: nhập một điểm ở Nhập QC gọi lệnh này 2 lần và nạp lại
// dữ liệu xét nghiệm 2 lần; Tổng quan nạp lại sau cả thao tác không liên quan
// tới QC (đổi hồ sơ đơn vị) vì nghe bảng `activity`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, countIpcCalls, enterValue, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

const SUMMARIES = 'westgard:listTestSummaries';
const QUERY_POINTS = 'entry:queryPoints';

/** Chờ các lệnh nạp lại do thông báo thay đổi kịp chạy xong. */
const settle = (page) => page.waitForTimeout(800);

test('một thao tác ghi chỉ làm nạp lại một lần', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const today = await todayIn(page);
    const counter = await countIpcCalls(app, [SUMMARIES, QUERY_POINTS]);

    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.locator('.qc-sheet-title strong', { hasText: seeded.testName }).waitFor();
    await settle(page);
    await counter.reset();
    await enterValue(page, today, 1, 5.1);
    await page.locator('.entry-sheet-message .alert.ok').waitFor();
    await settle(page);
    assert.deepEqual(await counter.read(), { [SUMMARIES]: 1, [QUERY_POINTS]: 2 },
      'nhập một điểm: cây xét nghiệm nạp lại 1 lần, bảng hai mức nạp lại 1 lần');

    await openPage(page, 'Tổng quan');
    await settle(page);
    await counter.reset();
    const profile = await page.evaluate(() => window.qcApi.saveLabProfile({ data: { name: 'Khoa Xét nghiệm E2E' } }));
    assert.equal(profile.ok, true, JSON.stringify(profile));
    await settle(page);
    assert.equal((await counter.read())[SUMMARIES], 0, 'đổi hồ sơ đơn vị không làm Tổng quan tính lại Westgard');

    const added = await page.evaluate(({ testId, date }) => window.qcApi.addPoint({ data: { testId, level: 2, date, val: 15.2 } }), { testId: seeded.testId, date: today });
    assert.equal(added.ok, true, JSON.stringify(added));
    await settle(page);
    assert.equal((await counter.read())[SUMMARIES], 1, 'điểm QC mới làm Tổng quan nạp lại đúng một lần');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
