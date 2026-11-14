// Tổng quan theo dữ liệu giống báo cáo RIQAS: tỷ lệ, bộ lọc và điểm đang chọn.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

async function failNextRead(app, channel) {
  await app.evaluate(({ ipcMain }, channel) => {
    const handlers = ipcMain._invokeHandlers;
    const original = handlers.get(channel);
    if (!original) throw new Error(`Không tìm thấy handler ${channel}`);
    handlers.set(channel, () => {
      handlers.set(channel, original);
      throw new Error('Lỗi đọc ngoại kiểm để kiểm tra khôi phục');
    });
  }, channel);
}

test('ngoại kiểm: tổng quan gọn, lọc đúng xét nghiệm và chi tiết khớp ô đã chọn', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  const shots = process.env.QCLAB_EQA_SCREENSHOT_DIR || userDataDir;
  mkdirSync(shots, { recursive: true });
  try {
    await bootstrapAndLogin(page);
    await page.evaluate(async () => {
      const api = window.qcApi;
      const must = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
      const machine = must(await api.saveInstrument({ data: { name: 'EasyLyte Plus' } }));
      const assays = [
        { code: 'Cl', name: 'Chloride (Cl)', z: [0.56, -0.81, 0.36, 1.21, 2.34, 0.62, -0.38, 0.3, 0.1, 0.4] },
        { code: 'K', name: 'Potassium (K)', z: [-0.64, 0.38, -0.26, 0.92, -0.44, 0.33, 0, 2.42, 0.1, 0.5] },
        { code: 'Na', name: 'Sodium (Na)', z: [0.4, -0.37, 0.71, -0.57, 0.23, -1.14, -0.31, 2.4, -3.12, -3.45] },
      ];
      const mappings = [];
      for (const assay of assays) {
        const saved = must(await api.saveTest({ data: { name: assay.name, instrumentId: machine.id, unit: 'mmol/L' } }));
        mappings.push({ code: assay.code, instrument: machine.name, testId: saved.id });
      }
      for (const [year, count] of [[2025, 6], [2026, 10]]) {
        for (let n = 1; n <= count; n++) {
          must(await api.importEqaRound({ data: {
            round: { program: 'MONTHLY CLINICAL CHEMISTRY', provider: 'Trung tâm ngoại kiểm', programCode: 'MC', unitCode: 'E2E', year,
              round: `CYCLE ${year === 2026 ? 23 : 22} SAMPLE ${n}`, reportCode: `${year}-${n}`, reportDate: `${year}-${String(n).padStart(2, '0')}-20`, assignedLevel: '' },
            rows: assays.map((assay) => { const z = year === 2025 ? 0.2 : assay.z[n - 1]; return { ref: assay.code, code: assay.code, instrument: machine.name, sample: '', unit: 'mmol/L',
              result: Number((100 + z * 2).toFixed(4)), assigned: 100, sigmaP: 2, zProvider: z, method: 'Điện cực chọn lọc ion', peerGroup: machine.name, peer: {} }; }),
            mappings, source: 'pdf', sourceName: `RIQAS_${year}_${n}.pdf`,
          } }));
        }
      }
    });
    await page.setViewportSize({ width: 1630, height: 1000 });
    await openPage(page, 'Phân tích ngoại kiểm');
    const map = page.getByRole('region', { name: 'Bảng tổng hợp z-score', exact: true });
    const summary = page.locator('.eqa-overview-summary');
    await summary.getByText('83.3%', { exact: true }).waitFor();
    await summary.getByText('25/30 kết quả', { exact: true }).waitFor();
    const toolbar = page.locator('.eqa-scope-controls');
    const importButton = toolbar.getByRole('button', { name: 'Nhập báo cáo PDF', exact: true });
    const importBox = await importButton.boundingBox();
    for (const id of ['eqa-scope-year', 'eqa-scope-program', 'eqa-scope-machine']) {
      const box = await toolbar.locator(`#${id}`).boundingBox();
      assert.ok(Math.abs(box.y + box.height - importBox.y - importBox.height) <= 1, 'bộ lọc và nút nhập PDF căn cùng hàng');
    }
    assert.equal(await page.getByRole('region', { name: 'Kết quả đang chọn' }).count(), 0, 'chưa chọn điểm thì dành toàn bộ chiều rộng cho bản đồ');
    assert.equal(await page.getByRole('region', { name: 'Kết quả cần xem xét' }).count(), 0, 'không lặp lại danh sách kết quả phía trên bản đồ');
    assert.equal(await page.locator('.eqa-chain-cue').count(), 0, 'không còn dải vàng phía trên bản đồ');
    assert.equal(await map.locator('tbody tr').count(), 3);
    await map.getByRole('columnheader', { name: '1/2026', exact: true }).waitFor();
    await map.getByRole('columnheader', { name: '10/2026', exact: true }).waitFor();
    assert.equal(await map.locator('.eqa-row-trend').count(), 3);
    assert.equal(await map.locator('.eqa-zmap-wrap').evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true, '10 đợt một mẫu không phải cuộn ngang ở cửa sổ rộng');
    await page.screenshot({ path: path.join(shots, 'eqa-overview-wide.png') });

    await summary.locator('.eqa-summary-count.is-rej').click();
    assert.equal(await map.getByRole('combobox').inputValue(), 'rej');
    assert.equal(await map.locator('tbody tr').count(), 1);
    assert.equal(await map.locator('tbody .eqa-cell-button').count(), 10, 'lọc xét nghiệm vẫn giữ các đợt đạt để đối chiếu');
    assert.equal(await summary.getByText('25/30 kết quả', { exact: true }).count(), 1, 'lọc không làm đổi mẫu số của tổng hợp');
    await summary.locator('.eqa-summary-count.is-warn').click();
    assert.equal(await map.locator('tbody tr').count(), 3);
    await map.getByRole('combobox').selectOption('all');
    await map.getByRole('button', { name: 'Sodium (Na) · CYCLE 23 SAMPLE 10: z = -3.45 · Không chấp nhận', exact: true }).click();
    const inspector = page.getByRole('region', { name: 'Kết quả đang chọn' });
    await inspector.locator('.eqa-result-score>b', { hasText: '-3.45' }).waitFor();
    assert.equal(await map.getByRole('combobox').inputValue(), 'all');
    assert.equal(await map.locator('.eqa-cell-button[aria-pressed=true]').count(), 1);
    assert.equal(await map.locator('.eqa-cell-button[aria-pressed=true]').innerText(), '-3.45');
    await inspector.getByRole('heading', { name: 'Sodium (Na)', exact: true }).waitFor();
    const mapFrame = await map.locator('.eqa-zmap-wrap').boundingBox();
    const assayLabel = await map.getByRole('button', { name: 'Chloride (Cl)', exact: true }).boundingBox();
    assert.ok(assayLabel.x >= mapFrame.x && assayLabel.x + assayLabel.width <= mapFrame.x + mapFrame.width, 'cột tên xét nghiệm vẫn thấy được khi bảng thu lại để mở chi tiết');
    await page.screenshot({ path: path.join(shots, 'eqa-overview-selected.png') });
    await inspector.getByRole('button', { name: 'Đóng chi tiết kết quả' }).click();
    await inspector.waitFor({ state: 'detached' });
    assert.equal(await map.locator('[aria-pressed=true]').count(), 0);

    await summary.locator('.eqa-summary-count.is-rej').click();
    await page.locator('#eqa-scope-year').selectOption('2025');
    await summary.getByText('18/18 kết quả', { exact: true }).waitFor();
    assert.equal(await map.getByRole('combobox').inputValue(), 'all', 'đổi sang phạm vi khác đặt lại bộ lọc');
    await page.locator('#eqa-scope-year').selectOption('2026');
    await summary.getByText('25/30 kết quả', { exact: true }).waitFor();
    assert.equal(await map.getByRole('combobox').inputValue(), 'all', 'quay về phạm vi cũ không khôi phục bộ lọc đã bỏ');

    await page.locator('#eqa-scope-year').selectOption('2025');
    await summary.getByText('100.0%', { exact: true }).waitFor();
    await summary.getByText('18/18 kết quả', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: /^Ngoài phạm vi đang xem/ }).count(), 0, 'không hiển thị bảng tín hiệu ngoài phạm vi');
    assert.equal(await page.locator('.eqa-action-alert').count(), 0, 'tín hiệu ở năm khác không tạo thông báo phía trên tổng quan');
    assert.equal(await page.getByRole('region', { name: 'Kết quả cần xem xét' }).count(), 0);
    const chainBadge = map.locator('.eqa-zmap-heading').getByRole('button', { name: '3 xét nghiệm cần xem xét chuỗi', exact: true });
    await chainBadge.waitFor();
    const attention = page.getByRole('region', { name: 'Xét nghiệm cần chú ý' });
    assert.equal(await attention.locator('tbody tr').count(), 3);
    assert.doesNotMatch(await attention.innerText(), /2026/, 'xem năm 2025 không lẫn tín hiệu năm 2026');
    await chainBadge.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const top = document.querySelector('.eqa-attention-panel').getBoundingClientRect().top;
      return top >= document.querySelector('.head').getBoundingClientRect().bottom && top < innerHeight - 80;
    });
    assert.equal(await summary.locator('.eqa-summary-count.is-rej>b').innerText(), '0', 'tỷ lệ 100% vẫn phải hiện tín hiệu chuỗi, không gộp thành kết quả không chấp nhận');
    await summary.locator('.eqa-summary-count.is-rej').click();
    await map.getByText('Không có xét nghiệm phù hợp bộ lọc', { exact: true }).waitFor();
    await map.getByRole('button', { name: 'Hiện tất cả' }).click();
    await page.locator('#eqa-scope-year').selectOption('2026');
    await summary.getByText('83.3%', { exact: true }).waitFor();
    assert.equal(await map.getByRole('combobox').inputValue(), 'all', 'đổi phạm vi đặt lại bộ lọc');
    for (const width of [1366, 1000, 800]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => { document.querySelector('main').scrollTop = 0; });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `không cuộn ngang trang tại ${width}px`);
      const overflow = await page.locator('.eqa-overview-summary, .eqa-zmap-panel>.panel-head').evaluateAll((nodes) => nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className));
      assert.deepEqual(overflow, [], `khối tổng hợp không tràn tại ${width}px`);
      await page.screenshot({ path: path.join(shots, `eqa-overview-${width}.png`) });
    }
    await page.setViewportSize({ width: 1630, height: 1000 });
    await failNextRead(app, 'eqa:getInstrumentGrid');
    await page.locator('#eqa-scope-year').selectOption('2025');
    await map.getByText('Không tải được bảng tổng hợp z-score', { exact: true }).waitFor();
    await summary.getByText('Không tải được số liệu', { exact: true }).waitFor();
    assert.equal(await summary.locator('.eqa-accept-bar i').count(), 0, 'lỗi tải không giữ thanh tỷ lệ như số liệu đã xác nhận');
    assert.equal(await inspector.count(), 0);
    await map.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await summary.getByText('18/18 kết quả', { exact: true }).waitFor();

    await failNextRead(app, 'eqa:listAttention');
    await page.locator('#eqa-scope-year').selectOption('2026');
    await attention.getByText('Không tải được tín hiệu chuỗi', { exact: true }).waitFor();
    assert.equal(await attention.getByText('Không có tín hiệu ở đợt mới nhất của phạm vi này', { exact: true }).count(), 0, 'lỗi tải không được coi là không có tín hiệu');
    await attention.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await attention.locator('tbody tr').waitFor({ state: 'visible' });

    await failNextRead(app, 'eqa:listRounds');
    await page.reload();
    await map.getByText('Không tải được ngoại kiểm', { exact: true }).waitFor();
    const reports = page.getByRole('region', { name: 'Danh sách kỳ ngoại kiểm' });
    await reports.getByText('Không tải được danh sách kỳ', { exact: true }).waitFor();
    assert.equal(await reports.getByText('Chưa có kỳ ngoại kiểm nào', { exact: true }).count(), 0, 'không báo rỗng khi danh sách bị lỗi');
    await reports.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await summary.getByText('25/30 kết quả', { exact: true }).waitFor();
    assert.equal(await reports.locator('tbody tr').count(), 10);
    assert.deepEqual(errors, []);
    console.log(`Ảnh tổng quan ngoại kiểm: ${shots}`);
  } finally { await app.close(); }
});

test('ngoại kiểm: tổng quan chưa có dữ liệu hiển thị trống, không kết luận tỷ lệ hoặc tín hiệu', { timeout: 60_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await openPage(page, 'Phân tích ngoại kiểm');
    await page.getByText('Chưa có kỳ ngoại kiểm nào', { exact: true }).waitFor();
    await page.getByRole('region', { name: 'Bảng tổng hợp z-score', exact: true }).getByText('Máy chưa có kết quả trong chương trình này', { exact: true }).waitFor();
    const summary = page.locator('.eqa-overview-summary');
    assert.equal(await summary.locator('.eqa-accept-value>b').innerText(), '—');
    assert.equal(await summary.locator('.eqa-accept-bar i').count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Xét nghiệm cần chú ý' }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
