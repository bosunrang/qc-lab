// Hộp thoại chi tiết lô ở Cấu hình chung → Lịch sử dữ liệu phân trang 100
// điểm mỗi trang (kế hoạch kiến trúc D.11), thay vì vẽ mọi điểm của lô.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('lịch sử lô xếp mới đến cũ trong từng mức và lọc mức ở phía trên bên phải', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const other = await page.evaluate((instrumentId) => window.qcApi.saveTest({ data: {
      name: 'Xét nghiệm đổi bộ lọc', instrumentId, unit: 'mmol/L',
    } }), seeded.instrumentId);
    assert.equal(other.ok, true);
    // Giả lập lịch sử cũ không theo ngày để kiểm tra thứ tự trình bày độc lập
    // với thứ tự lưu, gồm cả mốc trùng ngày và mốc không xác định ngày mở.
    await app.evaluate(({ ipcMain }, testId) => {
      const original = ipcMain._invokeHandlers.get('config:listTestLevels');
      ipcMain._invokeHandlers.set('config:listTestLevels', async (...args) => {
        const levels = await original(...args);
        if (args[1] !== testId) return levels;
        return levels.map((level) => ({ ...level, mean_sd_history_json: JSON.stringify([
          { qcLotId: 'khong-ngay', lot: `M${level.level}-khong-ngay`, mean: 1, sd: 0.1 },
          { qcLotId: 'thang-9', lot: `M${level.level}-thang-9`, effectiveFrom: '2026-09-01', mean: 2, sd: 0.1 },
          { qcLotId: level.qc_lot_id, lot: `E2E-${level.level}A`, effectiveFrom: '2026-10-01', mean: 3, sd: 0.1 },
          { qcLotId: 'thang-8', lot: `M${level.level}-thang-8`, effectiveFrom: '2026-08-01', mean: 4, sd: 0.1 },
          { qcLotId: level.qc_lot_id, lot: `E2E-${level.level}A`, effectiveFrom: '2026-10-01', mean: 6, sd: 0.1 },
        ]) }));
      });
    }, seeded.testId);
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: 'Lịch sử dữ liệu', exact: true }).click();
    const rows = page.locator('.history-table tbody tr');
    await rows.nth(11).waitFor();
    assert.deepEqual(await rows.locator('td:first-child').allTextContents(), [
      ...Array(6).fill('M1'), ...Array(6).fill('M2'),
    ]);
    const lots = await rows.locator('td:nth-child(2) b').allTextContents();
    for (const level of [1, 2]) {
      assert.deepEqual(lots.slice((level - 1) * 6, level * 6), [
        `E2E-${level}A`, `E2E-${level}A`, `E2E-${level}A`,
        `M${level}-thang-9`, `M${level}-thang-8`, `M${level}-khong-ngay`,
      ]);
    }
    assert.deepEqual(await rows.locator('td:nth-child(3)').allTextContents(), [
      '5.00', '6.00', '3.00', '2.00', '4.00', '1.00',
      '15.00', '6.00', '3.00', '2.00', '4.00', '1.00',
    ], 'trùng ngày ưu tiên mốc ghi sau');
    const filter = page.getByRole('group', { name: 'Lọc theo mức QC' });
    await filter.getByRole('button', { name: 'Mức 2', exact: true }).click();
    assert.equal(await filter.getByRole('button', { name: 'Mức 2', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await rows.locator('td:first-child').allTextContents(), Array(6).fill('M2'));
    assert.deepEqual(await rows.locator('td:nth-child(2) b').allTextContents(), lots.slice(6));
    await filter.getByRole('button', { name: 'Mức 1', exact: true }).click();
    assert.deepEqual(await rows.locator('td:first-child').allTextContents(), Array(6).fill('M1'));
    const assayPicker = page.locator('#history-test');
    await assayPicker.fill('Xét nghiệm đổi bộ lọc');
    await page.getByRole('option').first().click();
    await assayPicker.fill('Glucose E2E');
    await page.getByRole('option').first().click();
    await rows.nth(11).waitFor();
    assert.equal(await filter.getByRole('button', { name: 'Tất cả', exact: true }).getAttribute('aria-pressed'), 'true', 'đổi xét nghiệm trở về tất cả mức');
    await filter.getByRole('button', { name: 'Mức 2', exact: true }).click();
    await filter.getByRole('button', { name: 'Tất cả', exact: true }).click();
    assert.equal(await rows.count(), 12);
    for (const width of [700, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await filter.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `bộ lọc vừa màn hình ${width}px`);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    const filterBox = await filter.boundingBox();
    const selectorBox = await page.locator('#history-test').boundingBox();
    assert.ok(filterBox.x > selectorBox.x + selectorBox.width, 'bộ lọc nằm bên phải ô xét nghiệm');
    assert.ok(Math.abs(filterBox.y - selectorBox.y) < 1, 'bộ lọc thẳng hàng với ô xét nghiệm');
    assert.equal(selectorBox.width, 380, 'giữ ô xét nghiệm đã thu gọn');
    await page.locator('.target-matrix-panel').screenshot({ path: path.join(userDataDir, 'history-lot-order-filter.png') });
    await rows.first().getByRole('button', { name: 'Chi tiết' }).click();
    assert.deepEqual(await page.locator('.hist-meansd-table tbody td:nth-child(2)').allTextContents(), [
      '5.00', '6.00', '3.00',
    ], 'chi tiết giữ cùng thứ tự các mốc của lô');
    console.log(`Ảnh lịch sử lô và bộ lọc: ${userDataDir}`);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});

test('chi tiết lô xếp điểm mới nhất trước, cùng ngày lần chạy sau trước, rồi phân trang', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const added = await page.evaluate(async (testId) => {
      let ok = 0;
      const dates = [];
      for (let i = 0; i < 130; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(date);
        const result = await window.qcApi.addPoint({ data: { testId, level: 1, date, runId: `${date}-1`, val: 5 + ((i % 5) - 2) * 0.05 } });
        if (result.ok) ok++;
      }
      // Chạy 10 phải đứng trước 2; không xếp mã lần chạy như chuỗi chữ.
      for (const run of [2, 10]) {
        const date = dates[0];
        const result = await window.qcApi.addPoint({ data: { testId, level: 1, date, runId: `${date}-${run}`, val: 5 } });
        if (result.ok) ok++;
      }
      return { ok, dates };
    }, seeded.testId);
    assert.equal(added.ok, 132);

    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: 'Lịch sử dữ liệu' }).click();
    await page.locator('tr', { hasText: 'E2E-1A' }).getByRole('button', { name: 'Chi tiết' }).first().click();
    const dialog = page.locator('.rcfg-history-detail-modal');
    await dialog.getByText('Điểm QC đã nhập (132)').waitFor();
    const rows = dialog.locator('.hist-points-table tbody tr');
    assert.equal(await rows.count(), 100, 'trang đầu chỉ vẽ 100 điểm');
    assert.deepEqual((await rows.locator('td:nth-child(2)').allTextContents()).slice(0, 3),
      [10, 2, 1].map((run) => `${added.dates[0]}-${run}`));
    const firstDates = await rows.locator('td:first-child').allTextContents();
    assert.match(await dialog.locator('.table-pagination').innerText(), /Trang 1\/2/);
    await dialog.getByRole('button', { name: 'Sau ›' }).click();
    await dialog.getByText('Trang 2/2').waitFor();
    assert.equal(await rows.count(), 32, 'trang sau là 32 điểm cũ hơn còn lại');
    const allDates = [...firstDates, ...await rows.locator('td:first-child').allTextContents()];
    assert.deepEqual(allDates, [added.dates[0], added.dates[0], ...added.dates].map((date) => date.split('-').reverse().join('/')),
      'thứ tự mới đến cũ liên tục qua hai trang, không thiếu hoặc lặp điểm');
    const filter = dialog.getByRole('group', { name: 'Lọc kết luận QC' });
    await filter.getByRole('button', { name: 'Đạt', exact: true }).click();
    await dialog.getByText('Trang 1/2').waitFor();
    assert.equal(await rows.count(), 100, 'đổi bộ lọc về trang đầu và lọc trên cả hai trang');
    await dialog.getByText('Điểm QC đã nhập (132/132)', { exact: true }).waitFor();
    await filter.getByRole('button', { name: 'Loại', exact: true }).click();
    await dialog.getByText('Không có điểm QC phù hợp', { exact: true }).waitFor();
    assert.equal(await rows.count(), 0);
    await dialog.getByText('Điểm QC đã nhập (0/132)', { exact: true }).waitFor();
    await filter.getByRole('button', { name: 'Tất cả', exact: true }).click();
    await dialog.getByText('Trang 1/2').waitFor();
    assert.equal(await rows.first().locator('td').nth(1).innerText(), `${added.dates[0]}-10`);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});

test('chi tiết lịch sử hiện kết luận cả lần chạy từ Westgard, giữ Z và tự cập nhật điểm mới', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    await page.evaluate(async (testId) => {
      for (let n = 1; n <= 4; n++) {
        const date = `2026-10-0${n}`;
        const saved = await window.qcApi.addPoint({ data: { testId, level: 1, date, runId: '1', val: 5.24 } });
        if (!saved.ok) throw new Error(saved.error.message);
      }
      const peer = await window.qcApi.addPoint({ data: { testId, level: 2, date: '2026-10-04', runId: '1', val: 15 } });
      if (!peer.ok) throw new Error(peer.error.message);
    }, seeded.testId);
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: 'Lịch sử dữ liệu', exact: true }).click();
    await page.locator('tr', { hasText: 'E2E-1A' }).getByRole('button', { name: 'Chi tiết' }).first().click();
    const dialog = page.locator('.rcfg-history-detail-modal');
    await dialog.getByText('Điểm QC đã nhập (4)', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('columnheader', { name: 'Kết luận QC', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('columnheader', { name: 'Z', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('columnheader', { name: 'Phân loại Z-score' }).count(), 0);
    const latest = dialog.locator('.hist-points-table tbody tr').first();
    assert.equal(await latest.locator('td').first().innerText(), '04/10/2026');
    assert.equal(await latest.locator('td').nth(3).innerText(), '+1.20s');
    assert.equal(await latest.locator('td').nth(6).locator('.tag').innerText(), 'Loại');
    await latest.locator('td').nth(6).getByText('4-1s', { exact: true }).waitFor();
    assert.equal(await latest.locator('td').nth(6).locator('.hint').count(), 1, 'điểm tự vi phạm chỉ hiện tên luật, không lặp lý do lần chạy');
    assert.match(await latest.locator('td').nth(6).locator('.tag').getAttribute('title'), /4-1s/);
    const filter = dialog.getByRole('group', { name: 'Lọc kết luận QC' });
    const pointRows = dialog.locator('.hist-points-table tbody tr');
    const fullStats = await dialog.locator('.hist-meansd-table tbody').innerText();
    await filter.getByRole('button', { name: 'Loại', exact: true }).click();
    await dialog.getByText('Điểm QC đã nhập (1/4)', { exact: true }).waitFor();
    assert.equal(await pointRows.count(), 1);
    assert.equal(await latest.locator('td').first().innerText(), '04/10/2026');
    await filter.getByRole('button', { name: 'Đạt', exact: true }).click();
    await dialog.getByText('Điểm QC đã nhập (3/4)', { exact: true }).waitFor();
    assert.deepEqual(await pointRows.locator('td:nth-child(7) .tag').allTextContents(), ['Đạt', 'Đạt', 'Đạt']);
    assert.deepEqual(await pointRows.locator('td:first-child').allTextContents(), ['03/10/2026', '02/10/2026', '01/10/2026']);
    assert.equal(await dialog.locator('.hist-meansd-table tbody').innerText(), fullStats, 'lọc kết luận không đổi số liệu tích luỹ');
    await filter.getByRole('button', { name: 'Cảnh báo', exact: true }).click();
    await dialog.getByText('Không có điểm QC phù hợp', { exact: true }).waitFor();
    await filter.getByRole('button', { name: 'Tất cả', exact: true }).click();
    assert.equal(await pointRows.count(), 4);
    await dialog.screenshot({ path: path.join(userDataDir, 'history-qc-rules.png') });
    // Đang mở chi tiết mà máy khác nhập điểm thì dữ liệu/kết luận cũng phải cập nhật.
    const saved = await page.evaluate((testId) => window.qcApi.addPoint({ data: { testId, level: 1, date: '2026-10-05', runId: '1', val: 5 } }), seeded.testId);
    assert.equal(saved.ok, true);
    await dialog.getByText('Điểm QC đã nhập (5)', { exact: true }).waitFor();
    assert.equal(await latest.locator('td').first().innerText(), '05/10/2026');
    assert.equal(await latest.locator('td').nth(6).innerText(), 'Đạt');
    await filter.getByRole('button', { name: 'Cảnh báo', exact: true }).click();
    await dialog.getByText('Không có điểm QC phù hợp', { exact: true }).waitFor();
    const warned = await page.evaluate((testId) => window.qcApi.addPoint({ data: { testId, level: 1, date: '2026-10-06', runId: '1', val: 5.45 } }), seeded.testId);
    assert.equal(warned.ok, true);
    await dialog.getByText('Điểm QC đã nhập (1/6)', { exact: true }).waitFor();
    assert.equal(await latest.locator('td').first().innerText(), '06/10/2026');
    assert.equal(await latest.locator('td').nth(6).locator('.tag').innerText(), 'Cảnh báo');
    const toolbarBox = await dialog.locator('.history-points-toolbar').boundingBox();
    const filterBox = await filter.boundingBox();
    assert.ok(Math.abs(toolbarBox.x + toolbarBox.width - filterBox.x - filterBox.width) < 1, 'bộ lọc căn phải phía trên bảng điểm');
    const tableBox = await dialog.locator('.hist-points-table').boundingBox();
    assert.ok(tableBox.y >= filterBox.y + filterBox.height, 'bộ lọc không đè lên bảng');
    await dialog.screenshot({ path: path.join(userDataDir, 'history-qc-status-filter.png') });
    await page.setViewportSize({ width: 390, height: 900 });
    const narrowFilter = await filter.boundingBox();
    assert.ok(narrowFilter.x >= 0 && narrowFilter.x + narrowFilter.width <= 390, 'bộ lọc vừa màn hình hẹp');
    await page.setViewportSize({ width: 1366, height: 900 });
    await filter.getByRole('button', { name: 'Loại', exact: true }).click();
    await dialog.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await page.locator('tr', { hasText: 'E2E-2A' }).getByRole('button', { name: 'Chi tiết' }).first().click();
    await dialog.getByText('Điểm QC đã nhập (1)', { exact: true }).waitFor();
    assert.equal(await filter.getByRole('button', { name: 'Tất cả', exact: true }).getAttribute('aria-pressed'), 'true', 'mở lô/mức khác trở về Tất cả');
    const peer = dialog.locator('.hist-points-table tbody tr').first();
    assert.equal(await peer.locator('td').nth(3).innerText(), '+0.00s');
    assert.equal(await peer.locator('td').nth(6).locator('.tag').innerText(), 'Loại');
    await peer.locator('td').nth(6).getByText('Bị loại theo Mức 1', { exact: true }).waitFor();
    assert.match(await peer.locator('td').nth(6).locator('.tag').getAttribute('title'), /Mức 1/);
    await filter.getByRole('button', { name: 'Đạt', exact: true }).click();
    await dialog.getByText('Không có điểm QC phù hợp', { exact: true }).waitFor();
    await filter.getByRole('button', { name: 'Loại', exact: true }).click();
    assert.equal(await pointRows.count(), 1, 'điểm có Z bằng 0 vẫn thuộc Loại do mức khác gây loại lần chạy');
    await dialog.screenshot({ path: path.join(userDataDir, 'history-qc-conclusion.png') });
    console.log(`Ảnh kết luận QC lịch sử: ${path.join(userDataDir, 'history-qc-conclusion.png')}`);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
