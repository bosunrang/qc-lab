// Hồi quy cho tải lại, cấu hình thay đổi và phản hồi chồng nhau ở hai màn chi tiết.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

async function seed(page) {
  return page.evaluate(async () => {
    const api = window.qcApi;
    const must = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
    const instrument = must(await api.saveInstrument({ data: { name: 'Máy rà soát' } }));
    const assay = must(await api.saveTest({ data: { name: 'Xét nghiệm gốc', instrumentId: instrument.id, unit: 'mmol/L' } }));
    let latest;
    for (const [year, round, z] of [[2025, 'ĐỢT 01', 0.4], [2026, 'ĐỢT 02', 3.4]]) {
      latest = must(await api.importEqaRound({ data: {
        round: { program: 'Chương trình rà soát', provider: 'Trung tâm ngoại kiểm', programCode: 'REVIEW', unitCode: 'E2E',
          year, round, reportCode: `REVIEW-${year}`, reportDate: `${year}-02-20`, assignedLevel: '' },
        rows: [{ ref: 'R', code: 'R', instrument: instrument.name, sample: 'A', unit: 'mmol/L', result: 100 + z,
          assigned: 100, sigmaP: 1, zProvider: z, method: '', peerGroup: '', peer: {} }],
        mappings: [{ code: 'R', instrument: instrument.name, testId: assay.id }], source: 'pdf', sourceName: 'review.pdf',
      } }));
    }
    return { instrument, assay, round: latest.round, resultId: latest.results[0].id };
  });
}

async function rename(page, context, name) {
  await page.evaluate(async ({ context, name }) => {
    const result = await window.qcApi.saveTest({ id: context.assay.id,
      data: { name, instrumentId: context.instrument.id, unit: 'mmol/L' } });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  }, { context, name });
}

async function failNextRead(app, channel) {
  await app.evaluate(({ ipcMain }, channel) => {
    const handlers = ipcMain._invokeHandlers;
    const original = handlers.get(channel);
    handlers.set(channel, () => {
      handlers.set(channel, original);
      throw new Error('Lỗi đọc để kiểm tra màn chi tiết');
    });
  }, channel);
}

async function navigate(page, query) {
  await page.evaluate((query) => { location.hash = `/eqa?${new URLSearchParams(query)}`; }, query);
}

test('ngoại kiểm: chi tiết xét nghiệm cập nhật cả chuỗi và danh sách, khôi phục được khi đọc lỗi', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const context = await seed(page);
    await openPage(page, 'Phân tích ngoại kiểm');
    await navigate(page, { test: context.assay.id, year: '2026', program: context.round.program_id, machine: context.instrument.id });
    await page.getByRole('heading', { name: 'Xét nghiệm gốc · Máy rà soát', exact: true }).waitFor();
    await rename(page, context, 'Xét nghiệm đã đổi tên');
    await page.getByRole('heading', { name: 'Xét nghiệm đã đổi tên · Máy rà soát', exact: true }).waitFor();
    const list = page.getByRole('region', { name: 'Danh sách xét nghiệm', exact: true });
    await list.getByText('Xét nghiệm đã đổi tên', { exact: true }).waitFor();
    assert.equal(await list.getByText('Xét nghiệm gốc', { exact: true }).count(), 0, 'chuỗi và danh sách không dùng hai phiên bản tên khác nhau');
    await page.getByRole('button', { name: '% lệch / TEa', exact: true }).click();
    await page.getByText('Chưa có đối chiếu TEa', { exact: true }).waitFor();
    const canvas = page.locator('[data-eqa-chart] canvas');
    await canvas.focus();
    await page.keyboard.press('End');
    // Hai đợt có % lệch 0,4 và 3,4; thang phần trăm được vẽ từ -4 đến +4.
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 66 + 1.5 * (box.width - 100) / 2, box.y + 34 + (4 - 3.4) / 8 * (box.height - 82));
    await page.locator('.qc-chart-tooltip').getByText('Đối chiếu TEa: Chưa khai TEa', { exact: true }).waitFor();

    await failNextRead(app, 'eqa:getInstrumentGrid');
    await rename(page, context, 'Xét nghiệm cập nhật lần hai');
    await list.getByText('Không tải được danh sách', { exact: true }).waitFor();
    await list.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await list.getByText('Xét nghiệm cập nhật lần hai', { exact: true }).waitFor();

    // Giữ lỗi qua cả lượt tải trước và sau khi danh sách kỳ khởi tạo xong.
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      ipcMain.__eqaReviewSeries = handlers.get('eqa:getSeries');
      handlers.set('eqa:getSeries', () => { throw new Error('Lỗi đọc chuỗi để kiểm tra tải lại'); });
    });
    await page.reload();
    const main = page.locator('.eqa-analysis-main');
    await main.getByText('Không tải được chuỗi ngoại kiểm', { exact: true }).waitFor();
    await list.getByText('Xét nghiệm cập nhật lần hai', { exact: true }).waitFor();
    await app.evaluate(({ ipcMain }) => { ipcMain._invokeHandlers.set('eqa:getSeries', ipcMain.__eqaReviewSeries); });
    await main.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.getByRole('heading', { name: 'Xét nghiệm cập nhật lần hai · Máy rà soát', exact: true }).waitFor();
    await main.getByRole('region', { name: 'Kết quả từng đợt', exact: true }).getByRole('button', { name: 'Mở kỳ báo cáo', exact: true }).first().waitFor();
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test('ngoại kiểm: chi tiết kỳ bỏ phản hồi cũ, thử lại đúng khi đọc lỗi và xử lý kỳ không tồn tại', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const context = await seed(page);
    await openPage(page, 'Phân tích ngoại kiểm');
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      const original = handlers.get('eqa:getRound');
      const held = { started: false, release: null };
      ipcMain.__eqaReviewHeld = held;
      handlers.set('eqa:getRound', async (...args) => {
        const data = await original(...args);
        if (!held.started) {
          held.started = true;
          await new Promise((resolve) => { held.release = resolve; });
          handlers.set('eqa:getRound', original);
        }
        return data;
      });
    });
    await navigate(page, { id: context.round.id, point: context.resultId });
    await page.getByText('Đang tải kỳ ngoại kiểm…', { exact: true }).waitFor();
    await rename(page, context, 'Tên mới khi đang tải kỳ');
    const results = page.locator('.eqa-results-table');
    await results.getByText('Tên mới khi đang tải kỳ', { exact: true }).waitFor();
    await app.evaluate(({ ipcMain }) => { ipcMain.__eqaReviewHeld.release(); });
    await page.waitForTimeout(150);
    assert.equal(await results.getByText('Xét nghiệm gốc', { exact: true }).count(), 0, 'phản hồi cũ không thay dữ liệu đã cập nhật');
    assert.equal(await results.locator(`tr[data-eqa-result="${context.resultId}"].is-selected`).count(), 1);

    await failNextRead(app, 'eqa:getRound');
    await page.reload();
    await page.getByText('Không tải được kỳ ngoại kiểm', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await results.getByText('Tên mới khi đang tải kỳ', { exact: true }).waitFor();
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      const original = handlers.get('eqa:getRound');
      handlers.set('eqa:getRound', () => { handlers.set('eqa:getRound', original); return null; });
    });
    await page.reload();
    await page.getByText('Không tìm thấy kỳ ngoại kiểm', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Về danh sách', exact: true }).click();
    await page.getByRole('region', { name: 'Bảng tổng hợp z-score', exact: true }).waitFor();
    // Một kết quả ngoại kiểm chấp nhận vẫn cần rà soát khi vượt TEa nội bộ.
    const older = await page.evaluate(async () => (await window.qcApi.listEqaRounds()).find((round) => round.year === 2025));
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      const original = handlers.get('eqa:getRound');
      handlers.set('eqa:getRound', async (...args) => {
        handlers.set('eqa:getRound', original);
        const view = await original(...args);
        return { ...view, results: view.results.map((row) => ({ ...row, tea_pct: 0.1, within_tea: false })) };
      });
    });
    await navigate(page, { id: older.id });
    await results.getByText('Chấp nhận', { exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Lọc xét nghiệm theo đánh giá' }).selectOption('attention');
    assert.equal(await results.locator('tbody>tr:not(.eqa-detail-row)').count(), 1, 'Cần xem giữ kết quả vượt TEa nội bộ');
    await results.getByText('Chấp nhận', { exact: true }).waitFor();
    await page.locator('.eqa-overview-summary').getByText('1/1 kết quả', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await app.evaluate(({ ipcMain }) => { ipcMain.__eqaReviewHeld?.release?.(); });
    await app.close();
  }
});
