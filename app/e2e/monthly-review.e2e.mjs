// Kiểm tra vùng thông tin thu/mở và trạng thái ký trên Electron thật, dùng
// dữ liệu tạm để không ảnh hưởng hồ sơ xét nghiệm của người dùng.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('biên bản tháng: gom việc còn tồn, ký và đổi tháng không giữ thông báo cũ', { timeout: 90_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const { testId } = await seedOperationalTest(page);
    const ym = (await todayIn(page)).slice(0, 7);
    const review = await page.evaluate(async ({ testId, ym }) => {
      const api = window.qcApi;
      const must = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
      const date = `${ym}-01`;
      for (const run of [1, 2]) for (const level of [1, 2]) {
        must(await api.addPoint({ data: { testId, level, date, runId: `${date}-${run}`, val: level === 1 ? 5 : run === 1 ? 15 : 17.1 } }));
      }
      const user = await api.currentUser();
      must(await api.createNce({ data: { source: 'iqc', testId, trigger: { date, runId: `${date}-2` }, description: 'Theo dõi hồ sơ QC trong kỳ xem xét tháng', correction: 'Đã dừng trả kết quả và kiểm soát lần chạy QC bị loại', holdResults: true, detectedAt: date, ownerUserId: user.id } }));
      const first = (await api.queryPoints(testId, 1)).find((point) => point.run_id === `${date}-1`);
      must(await api.voidPoint({ data: { pointId: first.id, reason: 'Nhập nhầm giá trị, giữ lại dấu vết điểm đã huỷ', kind: 'data-entry' } }));
      return api.getQcMonthlyReview(ym);
    }, { testId, ym });
    await openPage(page, 'Báo cáo & Biểu mẫu');
    const panel = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Biên bản xem xét QC tháng', exact: true }) });
    await panel.locator('.monthly-review-table tbody tr').first().waitFor();
    assert.deepEqual((await panel.locator('.monthly-review-table thead th').allTextContents()).slice(0, 2), ['Máy', 'Xét nghiệm']);
    assert.equal(await panel.locator('.monthly-review-table td[data-column="0"]').count(), 1);
    assert.equal(await panel.locator('.monthly-review-table td[data-column="0"]').getAttribute('rowspan'), '2');
    assert.equal(await panel.locator('.monthly-review-table td[data-column="1"]').count(), 1);
    assert.equal(await panel.locator('.monthly-review-table td[data-column="1"]').getAttribute('rowspan'), '2');
    const borders = await panel.locator('.monthly-review-table').evaluate((table) => {
      const body = table.tBodies[table.tBodies.length - 1];
      const bottom = [...body.rows].flatMap((row, index) => [...row.cells]
        .filter((cell) => index + cell.rowSpan === body.rows.length)
        .map((cell) => getComputedStyle(cell).borderBottomWidth));
      return { bottom, outer: getComputedStyle(table).borderBottomWidth, divider: getComputedStyle(body.rows[0].querySelector('[data-column="2"]')).borderBottomWidth };
    });
    assert.deepEqual(borders.bottom, Array(15).fill('0px'), 'đáy các ô gộp và ô thường không chồng viền');
    assert.equal(borders.outer, '1px', 'chỉ giữ một nét viền ngoài mảnh');
    assert.equal(borders.divider, '1px', 'vẫn giữ đường chia giữa các mức');
    assert.equal(await panel.getByRole('group', { name: 'Tổng hợp số liệu tháng' }).count(), 0);
    for (const [index, row] of review.rows.entries()) {
      const tableRow = panel.locator('.monthly-review-table tbody tr').nth(index);
      for (const [column, count] of [[6, row.rejected], [14, row.voided]]) {
        assert.equal(await tableRow.locator(`td[data-column="${column}"]`).evaluate((el) => el.classList.contains('monthly-review-attention')), count > 0, 'chỉ nhấn vàng khi có điểm bị loại hoặc đã huỷ');
      }
    }
    assert.ok(await panel.locator('.monthly-review-attention').count() > 0);
    // Đọc màu nền thực tế cả khi ô trong suốt và nhận màu từ hàng phía sau.
    const background = (cell) => cell.evaluate((el) => {
      for (let node = el; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'transparent';
    });
    const rows = panel.locator('.monthly-review-table tbody tr');
    const m1 = rows.nth(0).locator('td[data-column="2"]');
    const m2 = rows.nth(1).locator('td[data-column="2"]');
    const machine = panel.locator('td[data-column="0"]');
    const testName = panel.locator('td[data-column="1"]');
    const rejected = rows.nth(0).locator('td[data-column="6"]');
    await panel.getByRole('heading', { name: 'Biên bản xem xét QC tháng', exact: true }).hover();
    const neutral = await background(m1), warning = await background(rejected);
    await m1.hover();
    assert.notEqual(await background(m1), neutral);
    assert.equal(await background(m2), neutral);
    assert.equal(await background(machine), neutral);
    assert.equal(await background(testName), neutral);
    assert.equal(await background(rejected), warning, 'giữ màu vàng khi rê vào dòng mức');
    await m2.hover();
    assert.notEqual(await background(m2), neutral);
    assert.equal(await background(m1), neutral);
    for (const merged of [machine, testName]) {
      await merged.hover();
      assert.equal(await background(m1), neutral, 'rê ô gộp không nhấn hàng đầu');
      assert.equal(await background(m2), neutral);
      assert.equal(await background(machine), neutral);
      assert.equal(await background(testName), neutral);
    }
    const followup = panel.locator('.monthly-review-followup');
    const tableBox = await panel.locator('.monthly-review-table-wrap').boundingBox();
    const followupBox = await followup.boundingBox();
    assert.ok(followupBox.y >= tableBox.y + tableBox.height, 'hồ sơ NCE nằm dưới bảng thống kê');
    assert.equal(await followup.getAttribute('open'), null);
    await followup.locator('summary .tag').getByText('Cần rà soát', { exact: true }).waitFor();
    assert.equal(await followup.locator('.monthly-review-nce-list').isVisible(), false);
    assert.equal(await panel.locator('.alert').count(), 0, 'không còn các dải thông báo tách rời');
    await followup.locator('summary').focus();
    await page.keyboard.press('Enter');
    await followup.locator('.monthly-review-nce-list').waitFor();
    assert.doesNotMatch(await followup.innerText(), /hồ sơ NCE chưa đóng/, 'không nhắc lại mã hồ sơ đã có trong danh sách');
    assert.equal(await followup.locator('.monthly-review-nce-list li').count(), 1);
    assert.match(await followup.locator('.monthly-review-nce-list').innerText(), /Glucose E2E/);
    await panel.screenshot({ path: path.join(userDataDir, 'monthly-review-expanded.png') });
    await followup.locator('summary').click();
    await panel.getByText(`Chưa ký · tháng ${ym.slice(5)}/${ym.slice(0, 4)}`, { exact: true }).waitFor();
    await panel.locator('#review-conclusion').selectOption('monitor');
    await panel.locator('#review-note').fill('Theo dõi hồ sơ NCE chưa đóng và hiệu lực hành động.');
    await panel.getByRole('button', { name: 'Ký xem xét', exact: true }).click();
    await panel.getByRole('button', { name: 'Ký lại', exact: true }).waitFor();
    assert.match(await panel.locator('.monthly-review-status').innerText(), /Đã ký.*Quản trị E2E/);
    assert.match(await panel.locator('.monthly-review-signed-conclusion').innerText(), /Cần theo dõi thêm.*Theo dõi hồ sơ NCE/);
    await panel.screenshot({ path: path.join(userDataDir, 'monthly-review-desktop.png') });
    await page.setViewportSize({ width: 800, height: 900 });
    await followup.locator('summary').click();
    const previousMonth = Number(ym.slice(5)) === 1 ? 12 : Number(ym.slice(5)) - 1;
    if (previousMonth === 12) await panel.locator('#review-year').selectOption(String(Number(ym.slice(0, 4)) - 1));
    await panel.locator('#review-month').selectOption(String(previousMonth));
    await panel.getByText(/Không có kết quả QC trong tháng/).waitFor();
    assert.equal(await panel.locator('.monthly-review-followup').count(), 0);
    assert.equal(await panel.locator('.monthly-review-signed-conclusion').count(), 0);
    assert.match(await panel.locator('.monthly-review-status').innerText(), /Chưa ký/);
    await panel.screenshot({ path: path.join(userDataDir, 'monthly-review-narrow-empty.png') });
    console.log(`Ảnh kiểm tra biên bản tháng: ${userDataDir}`);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
