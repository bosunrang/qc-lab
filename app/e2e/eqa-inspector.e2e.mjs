// Chi tiết phải gọn khi khớp báo cáo, nhưng vẫn lộ sai lệch và tín hiệu đã có.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

const sourceName = 'VEQAS_BC20C_09_09-01_10026_Beckman_DxC700_AU_3_bao_cao_ngoai_kiem.pdf';
async function addRound(page, context, number, z, zProvider = z) {
  await page.evaluate(async ({ context, number, z, zProvider, sourceName }) => {
    const result = await window.qcApi.importEqaRound({ data: {
      round: { program: 'Sinh hóa', provider: 'Trung tâm ngoại kiểm', programCode: 'BC', unitCode: 'E2E', year: 2026,
        round: `ĐỢT ${String(number).padStart(2, '0')}`, reportCode: `VEQAS-2026-${String(number).padStart(2, '0')}`,
        reportDate: `2026-${String(number).padStart(2, '0')}-20`, assignedLevel: '' },
      rows: [{ ref: 'UA', code: 'UA', instrument: context.machine.name, sample: 'A', unit: 'umol/L',
        result: number === 1 ? 548 : Number((548.68 + z * 31.092).toFixed(5)), assigned: 548.68, sigmaP: 31.092,
        zProvider, method: 'Phương pháp enzyme', peerGroup: 'Beckman', peer: {} }],
      mappings: [{ code: 'UA', instrument: context.machine.name, testId: context.test.id }], source: 'pdf', sourceName,
    } });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  }, { context, number, z, zProvider, sourceName });
}

test('ngoại kiểm: chi tiết điểm và xét nghiệm gọn, giữ đúng đối chiếu và trạng thái chuỗi', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  const shots = process.env.QCLAB_EQA_SCREENSHOT_DIR || userDataDir;
  mkdirSync(shots, { recursive: true });
  try {
    await bootstrapAndLogin(page);
    const context = await page.evaluate(async () => {
      const must = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
      const machine = must(await window.qcApi.saveInstrument({ data: { name: 'DxC700 AU' } }));
      const test = must(await window.qcApi.saveTest({ data: { name: 'Uric acid (UA)', instrumentId: machine.id, unit: 'umol/L' } }));
      return { machine, test };
    });
    await addRound(page, context, 1, -0.02);
    await page.setViewportSize({ width: 1630, height: 1000 });
    await openPage(page, 'Phân tích ngoại kiểm');
    const map = page.getByRole('region', { name: 'Bảng tổng hợp z-score', exact: true });
    const inspector = page.getByRole('region', { name: 'Kết quả đang chọn' });
    async function selectRound(number) {
      await map.getByRole('button', { name: new RegExp(`Uric acid \\(UA\\) · ĐỢT ${String(number).padStart(2, '0')} · mẫu A:`) }).click();
      await inspector.getByText(`ĐỢT ${String(number).padStart(2, '0')} / 2026 · Mẫu A`, { exact: true }).waitFor();
    }
    await selectRound(1);
    await inspector.getByText('Chưa đủ số đợt để kết luận về xu hướng', { exact: true }).waitFor();
    assert.equal(await inspector.locator('.eqa-z-discrepancy').count(), 0);
    assert.equal(await inspector.getByText('Không có tín hiệu chuỗi', { exact: true }).count(), 0);
    assert.equal(await inspector.getByText('z tính lại', { exact: true }).isVisible(), false);
    assert.equal(await inspector.getByText(sourceName, { exact: true }).isVisible(), false);
    await inspector.getByText('VEQAS-2026-01', { exact: true }).waitFor();
    await inspector.getByText('Ngày báo cáo: 20/01/2026', { exact: true }).waitFor();
    await inspector.screenshot({ path: path.join(shots, 'eqa-inspector-compact.png') });
    await inspector.locator('summary', { hasText: 'Đối chiếu và nhóm so sánh' }).click();
    await inspector.getByText('z tính lại', { exact: true }).waitFor();
    await inspector.getByText('z nhà cung cấp', { exact: true }).waitFor();
    await inspector.locator('summary', { hasText: 'Tệp báo cáo' }).click();
    await inspector.getByText(sourceName, { exact: true }).waitFor();
    await inspector.getByRole('button', { name: 'Phân tích xét nghiệm →', exact: true }).click();
    const chart = page.getByRole('region', { name: 'Biểu đồ phân tích xét nghiệm' });
    const table = page.getByRole('region', { name: 'Kết quả từng đợt', exact: true });
    assert.equal(await page.locator('.eqa-series-summary').count(), 0, 'không có khối kết quả riêng phía trên biểu đồ');
    await chart.getByText('1 đợt · 1 mẫu · Chấp nhận 1/1 (100.0%)', { exact: true }).waitFor();
    await chart.getByText('Chưa đủ đợt đánh giá xu hướng · 1/6', { exact: true }).waitFor();
    assert.equal(await page.locator('.eqa-analysis-main>.eqa-stats').count(), 0);
    assert.equal(await chart.locator('.alert').count(), 0, 'thiếu đợt dùng nhãn nhỏ thay dải thông báo');
    assert.ok((await chart.locator('canvas').boundingBox()).height <= 221, 'một đợt chỉ dùng biểu đồ cao 220px');
    assert.equal(await chart.getByText('Không có tín hiệu chuỗi', { exact: true }).count(), 0, 'chưa đủ đợt không kết luận không có tín hiệu');
    assert.equal(await table.locator('thead th').count(), 6, 'bảng gồm năm cột số liệu và một cột thao tác');
    await table.getByRole('columnheader', { name: 'Giá trị ấn định', exact: false }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Chi tiết dòng kết quả' }).count(), 0, 'bảng không có khối chi tiết mở rộng');
    assert.equal(await table.locator('tbody>tr').count(), 1);
    assert.equal(await table.getByRole('button', { name: 'Chi tiết', exact: true }).count(), 0);
    await page.screenshot({ path: path.join(shots, 'eqa-test-detail-single.png') });
    const selectedPoint = await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('point'));
    await table.getByRole('button', { name: 'Mở kỳ báo cáo', exact: true }).click();
    await page.locator(`.eqa-results-table tr[data-eqa-result="${selectedPoint}"].is-selected`).waitFor();
    await page.getByText('VEQAS-2026-01', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Danh sách kỳ', exact: false }).click();
    await chart.waitFor();
    await page.getByRole('button', { name: 'Quay lại', exact: false }).click();
    await inspector.getByRole('heading', { name: 'Uric acid (UA)', exact: true }).waitFor();

    await addRound(page, context, 2, 3.4);
    await selectRound(2);
    await inspector.locator('.eqa-tags').getByText('|z| ≥ 3', { exact: true }).waitFor();
    await inspector.getByText('Chưa đủ số đợt để kết luận về xu hướng', { exact: true }).waitFor();
    assert.equal(await inspector.getByText(sourceName, { exact: true }).isVisible(), false, 'đổi kỳ thì tên tệp mới thu gọn lại');
    await addRound(page, context, 3, -3.4);
    await selectRound(3);
    await inspector.locator('.eqa-tags').getByText('Không thành công', { exact: true }).waitFor();
    await inspector.getByText('Chưa đủ số đợt để kết luận về xu hướng', { exact: true }).waitFor();
    await inspector.getByRole('button', { name: 'Phân tích xét nghiệm →', exact: true }).click();
    await chart.getByText('Chưa đủ đợt đánh giá xu hướng · 3/6', { exact: true }).waitFor();
    await chart.locator('.eqa-zmap-legend').getByText('Không thành công', { exact: true }).waitFor();
    assert.ok((await chart.locator('canvas').boundingBox()).height >= 300, 'nhiều đợt giữ biểu đồ đủ cao');
    await page.getByRole('button', { name: 'Quay lại', exact: false }).click();
    await inspector.getByRole('heading', { name: 'Uric acid (UA)', exact: true }).waitFor();

    for (const [number, z] of [[4, 0.2], [5, -0.2], [6, 0.2]]) await addRound(page, context, number, z);
    await selectRound(6);
    await inspector.getByText('Không có tín hiệu chuỗi', { exact: true }).waitFor();
    assert.equal(await inspector.getByText('Chưa đủ số đợt để kết luận về xu hướng', { exact: true }).count(), 0);
    assert.equal(await inspector.getByText('z tính lại', { exact: true }).isVisible(), false);

    await addRound(page, context, 7, 0.5, 2.4);
    await selectRound(7);
    await inspector.locator('.eqa-z-discrepancy', { hasText: 'z tính lại: 0.50 · Lệch nhà cung cấp' }).waitFor();
    assert.equal(await inspector.locator('.eqa-result-score>b').innerText(), '2.40', 'z lớn giữ số chính thức từ nhà cung cấp');
    await inspector.locator('.eqa-result-score').getByText('Cảnh báo', { exact: true }).waitFor();
    await inspector.screenshot({ path: path.join(shots, 'eqa-inspector-mismatch.png') });
    for (const width of [1000, 800]) {
      await page.setViewportSize({ width, height: 1000 });
      await inspector.locator('summary', { hasText: 'Tệp báo cáo' }).click();
      await inspector.getByText(sourceName, { exact: true }).waitFor();
      assert.equal(await inspector.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true, 'tên tệp dài không đẩy tràn bảng chi tiết');
      await inspector.locator('summary', { hasText: 'Tệp báo cáo' }).click();
    }
    // Giá trị TEa đã khai không đồng nghĩa với việc main tính được % lệch.
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      const original = handlers.get('eqa:getRound');
      handlers.set('eqa:getRound', async (...args) => {
        handlers.set('eqa:getRound', original);
        const view = await original(...args);
        return { ...view, results: view.results.map((row) => ({ ...row, pct: null, tea_pct: 5, within_tea: null })) };
      });
    });
    await page.reload();
    await inspector.getByText('5.0% · chưa đủ dữ liệu đối chiếu', { exact: true }).waitFor();
    assert.doesNotMatch(await inspector.innerText(), /vượt TEa|trong TEa/);
    assert.deepEqual(errors, []);
    console.log(`Ảnh chi tiết ngoại kiểm: ${shots}`);
  } finally { await app.close(); }
});
