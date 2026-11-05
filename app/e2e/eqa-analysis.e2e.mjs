// Kiểm tra luồng phân tích trên Electron với CSDL tạm, không dùng dữ liệu thật.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

async function seed(page) {
  return page.evaluate(async () => {
    const api = window.qcApi;
    const must = (r) => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
    const names = ['Glucose', 'Creatinin', 'ALT', 'AST', 'Cholesterol', 'Triglycerid', 'Ure', 'Acid uric',
      'Albumin', 'Chloride', 'Potassium', 'Sodium', 'HDL cholesterol (HDL-C)', 'LDL cholesterol (LDL-C)', 'Total bilirubin (TBIL)', 'Direct bilirubin (DBIL)'];
    const devices = [];
    const tests = {};
    for (const name of ['AU5800', 'DxC700']) {
      const machine = must(await api.saveInstrument({ data: { name } }));
      devices.push(machine);
      for (const assay of names) tests[`${name}:${assay}`] = must(await api.saveTest({ data: { name: assay === 'ALT' ? 'Alanine aminotransferase (ALT)' : assay === 'AST' ? 'Aspartate aminotransferase (AST)' : assay, instrumentId: machine.id, unit: 'mmol/L' } })).id;
    }
    const imports = [];
    for (const [program, year, count] of [['Sinh hóa', 2025, 2], ['Sinh hóa', 2026, 9], ['Đối chiếu', 2026, 1]]) {
      for (let n = 1; n <= count; n++) {
        const rows = [];
        const mappings = [];
        for (const device of devices) {
          if (device.name === 'DxC700' && n === 9) continue;
          for (const [index, assay] of names.entries()) {
            mappings.push({ code: assay, instrument: device.name, testId: tests[`${device.name}:${assay}`] });
            for (const sample of program === 'Đối chiếu' ? ['A'] : ['A', 'B']) {
              if (assay === 'Creatinin' && n === 4 && sample === 'B') continue;
              const z = program === 'Đối chiếu' ? -0.6 : assay === 'Glucose' && n === 9 && sample === 'A' ? 3.4
                : assay === 'ALT' && n >= 7 ? 2.3 : Number((Math.sin(n + index) * 1.4).toFixed(2));
              rows.push({ ref: `${device.id}-${assay}-${sample}`, code: assay, instrument: device.name, sample, unit: 'mmol/L', result: 10 + z, assigned: 10, sigmaP: 1, zProvider: z, method: 'Phương pháp thử', peerGroup: device.name, peer: {} });
            }
          }
        }
        imports.push(must(await api.importEqaRound({ data: {
          round: { program, provider: 'Trung tâm ngoại kiểm', programCode: program === 'Sinh hóa' ? 'BC' : 'DC', unitCode: 'E2E', year, round: `ĐỢT ${String(n).padStart(2, '0')}`, reportCode: `${year}-${n}`, reportDate: `${year}-${String(n).padStart(2, '0')}-20`, assignedLevel: '' },
          rows, mappings, source: 'pdf', sourceName: `${program}_${year}_${n}.pdf`,
        } })));
      }
    }
    const latest = imports.find((r) => r.round.year === 2026 && r.round.round === 'ĐỢT 09');
    const other = imports.find((r) => r.round.program_name === 'Đối chiếu');
    must(await api.saveEqaSchedule({ data: { programId: latest.round.program_id, provider: 'Trung tâm ngoại kiểm', year: 2026, round: 'ĐỢT 09', receiveDate: '2026-09-01', runDate: '2026-09-10', dueDate: '2026-09-15', assignee: 'Kỹ thuật viên', note: '', instrumentIds: devices.map((d) => d.id) } }));
    return { devices, tests, programId: latest.round.program_id, otherProgramId: other.round.program_id, latestRound: latest.round.id,
      selected: latest.results.find((r) => r.test_id === tests['AU5800:Glucose'] && r.sample === 'A').id };
  });
}

/** Màn chi tiết chỉ có chọn chương trình và khoảng xem của chuỗi; kiểm thử
 * deep-link bằng cách đổi đúng các tham số mà màn tổng quan truyền sang URL. */
async function setDetailScope(page, next) {
  await page.evaluate((scope) => {
    const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const mark = raw.indexOf('?');
    const route = mark >= 0 ? raw.slice(0, mark) : raw;
    const params = new URLSearchParams(mark >= 0 ? raw.slice(mark + 1) : '');
    if (scope.year !== undefined) params.set('year', String(scope.year));
    if (scope.programId) params.set('program', scope.programId);
    if (scope.instrumentId) params.set('machine', scope.instrumentId);
    params.delete('point');
    params.delete('round');
    location.hash = `#${route}?${params}`;
  }, next);
}

test('ngoại kiểm: chọn mẫu, đổi xét nghiệm, giữ phạm vi, đối chiếu báo cáo và cửa sổ hẹp', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  const shots = process.env.QCLAB_EQA_SCREENSHOT_DIR || userDataDir;
  mkdirSync(shots, { recursive: true });
  try {
    await bootstrapAndLogin(page);
    const data = await seed(page);
    await page.setViewportSize({ width: 1630, height: 1000 });
    await openPage(page, 'Phân tích ngoại kiểm');
    // Khi danh sách kỳ còn đang tải, ô trống cũng có nút cùng tên; dùng nút ở đầu trang.
    await page.locator('.eqa-intro').getByRole('button', { name: 'Nhập báo cáo PDF', exact: true }).click();
    const importDialog = page.getByRole('dialog', { name: 'Nhập báo cáo ngoại kiểm' });
    await importDialog.getByRole('button', { name: 'Chọn tệp PDF', exact: true }).waitFor();
    assert.equal(await importDialog.locator('input[type=file]').isVisible(), false, 'control file mặc định được thay bằng bộ chọn theo giao diện hệ thống');
    await page.screenshot({ path: path.join(shots, 'eqa-import.png'), fullPage: true });
    await importDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.locator('#eqa-scope-year').selectOption('2026');
    await page.locator('#eqa-scope-program').selectOption(data.programId);
    await page.locator('#eqa-scope-machine').selectOption(data.devices[0].id);
    const cell = page.getByRole('button', { name: 'Glucose · ĐỢT 09 · mẫu A: z = 3.40 · Không chấp nhận', exact: true });
    await cell.click();
    const inspector = page.getByRole('region', { name: 'Kết quả đang chọn' });
    await inspector.getByRole('heading', { name: 'Glucose', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: /Tổng hợp các máy/ }).count(), 0, 'tổng quan không còn khối tổng hợp máy dư thừa');
    assert.equal(await inspector.locator('.eqa-result-score>b').innerText(), '3.40');
    assert.match(await inspector.innerText(), /Mẫu A/);
    await page.screenshot({ path: path.join(shots, 'eqa-overview.png'), fullPage: true });
    await inspector.getByRole('button', { name: 'Phân tích xét nghiệm' }).click();
    const canvas = page.locator('[data-eqa-chart] canvas');
    await canvas.waitFor();
    assert.equal(await page.locator('.eqa-test #eqa-scope-year, .eqa-test #eqa-scope-machine').count(), 0, 'màn chi tiết không lặp bộ chọn Năm và Máy của tổng quan');
    assert.equal(await page.locator('#eqa-series-span').inputValue(), 'all', 'chuỗi mặc định phủ toàn bộ lịch sử của chương trình');
    const listBeforeRightScroll = await page.locator('.eqa-assay-list').boundingBox();
    await page.locator('.eqa-analysis-main').evaluate((node) => { node.scrollTop = 700; });
    await page.waitForFunction(() => document.querySelector('.eqa-analysis-main')?.scrollTop > 0);
    const fixedList = await page.evaluate(() => {
      const list = document.querySelector('.eqa-assay-list')?.getBoundingClientRect();
      return { listTop: list?.top, listBottom: list?.bottom, viewport: innerHeight, pageScroll: document.querySelector('main')?.scrollTop };
    });
    assert.ok(Math.abs(fixedList.listTop - listBeforeRightScroll.y) <= 1, 'cuộn nội dung bên phải không kéo danh sách xét nghiệm');
    assert.ok(fixedList.listBottom <= fixedList.viewport, 'danh sách cố định không vượt đáy cửa sổ');
    assert.ok(fixedList.viewport - fixedList.listBottom <= 24, 'danh sách kéo xuống sát đáy cửa sổ như Cấu hình chung');
    assert.equal(fixedList.pageScroll, 0, 'màn chi tiết không dùng thanh cuộn chung của trang');
    await page.locator('.eqa-analysis-main').evaluate((node) => { node.scrollTop = 0; });
    assert.equal(await page.locator('.eqa-assay-item[aria-pressed=true] .eqa-assay-z').innerText(), '3.40', 'mẫu cuối đạt không che mẫu A không đạt');
    assert.match(await page.locator('.eqa-round-title h2').innerText(), /Glucose · AU5800/);
    await page.screenshot({ path: path.join(shots, 'eqa-analysis.png'), fullPage: true });
    assert.ok((await page.locator('.eqa-assay-list').boundingBox()).width >= 340, 'tên đầy đủ có danh sách rộng hơn bản 220px');
    const series = await page.evaluate((id) => window.qcApi.getEqaSeries(id), data.tests['AU5800:Glucose']);
    // Mặc định phủ toàn bộ lịch sử của chương trình, để thấy các đợt gây tín hiệu (N-07).
    const shown = series.points.filter((p) => p.program_name === 'Sinh hóa');
    assert.ok(shown.some((p) => p.year === 2025) && shown.some((p) => p.year === 2026), 'chuỗi gồm cả năm trước');
    const box = await canvas.boundingBox();
    const peak = Math.max(...shown.map((p) => Math.abs(p.z)));
    const limit = Math.max(3.25, peak * 1.12, peak + 0.5);
    const firstY = 34 + (limit - shown[0].z) / (2 * limit) * (box.height - 34 - 48);
    // Trục X gom theo đợt nên điểm đầu lệch khỏi mép một đoạn tuỳ số đợt; dò
    // dọc theo hàng của điểm đầu tới khi tooltip của nó hiện.
    let firstX = null;
    for (let dx = 56; dx < 160 && firstX === null; dx += 3) {
      await page.mouse.move(box.x + dx, box.y + firstY);
      const tip = page.locator('.qc-chart-tooltip');
      if (await tip.count() && /ĐỢT 01 \/ 2025.*Mẫu A/s.test(await tip.innerText())) firstX = dx;
    }
    assert.ok(firstX !== null, 'tìm thấy điểm đầu của chuỗi');
    assert.doesNotMatch(await page.locator('.qc-chart-tooltip').innerText(), /Lần chạy|Westgard|SD/);
    await page.mouse.click(box.x + firstX, box.y + firstY);
    await page.waitForFunction((id) => new URLSearchParams(location.hash.split('?')[1]).get('point') === id, shown[0].result_id);
    await canvas.focus();
    await page.keyboard.press('End');
    await page.waitForFunction((id) => new URLSearchParams(location.hash.split('?')[1]).get('point') === id, shown.at(-1).result_id);
    await page.keyboard.press('Home');
    await page.waitForFunction((id) => new URLSearchParams(location.hash.split('?')[1]).get('point') === id, shown[0].result_id);
    const separator = page.getByRole('separator', { name: 'Độ rộng danh sách xét nghiệm' });
    await separator.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.eqa-assay-list').getBoundingClientRect().width >= 359);
    const handle = await separator.boundingBox();
    const dragY = Math.max(120, Math.min(page.viewportSize().height - 20, handle.y + 20));
    await page.mouse.move(handle.x + handle.width / 2, dragY);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 20, dragY, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.eqa-assay-list').getBoundingClientRect().width >= 379);
    await page.getByRole('tab', { name: '% lệch / TEa', exact: true }).click();
    await page.getByRole('group', { name: '% lệch qua các đợt ngoại kiểm' }).waitFor();
    const assayItems = page.locator('.eqa-assay-items');
    const ureAssay = page.locator('.eqa-assay-item', { hasText: 'Ure' });
    await ureAssay.evaluate((node) => node.scrollIntoView({ block: 'center' }));
    const assayScrollBefore = await assayItems.evaluate((node) => node.scrollTop);
    assert.ok(assayScrollBefore > 0, 'danh sách thử nghiệm đã cuộn khỏi đầu');
    await ureAssay.click();
    await page.getByRole('heading', { name: 'Ure · AU5800', exact: true }).waitFor();
    await canvas.waitFor();
    await page.waitForFunction((top) => document.querySelector('.eqa-assay-items')?.scrollTop === top, assayScrollBefore);
    assert.equal(await assayItems.evaluate((node) => node.scrollTop), assayScrollBefore, 'đổi xét nghiệm không dựng lại và kéo danh sách về đầu');
    assert.ok((await page.locator('.eqa-assay-list').boundingBox()).width >= 359, 'đổi xét nghiệm giữ độ rộng đã chỉnh');
    assert.equal(await page.getByRole('region', { name: 'Kết quả đang chọn' }).count(), 0, 'màn phân tích không lặp lại bảng kết quả đang chọn');
    await page.locator('.eqa-table tr.is-selected').getByRole('button', { name: 'Mở kỳ', exact: true }).click();
    const highlighted = page.locator('.eqa-results-table tr.is-selected');
    await highlighted.waitFor();
    assert.match(await highlighted.innerText(), /Ure/);
    await page.getByRole('button', { name: 'Danh sách kỳ' }).click();
    await page.getByRole('heading', { name: 'Ure · AU5800', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Quay lại', exact: false }).click();
    await page.locator('.eqa-zmap').waitFor();
    assert.equal(await page.locator('#eqa-scope-program').inputValue(), data.programId);
    assert.equal(await page.locator('#eqa-scope-machine').inputValue(), data.devices[0].id);
    await page.locator('#eqa-scope-machine').selectOption(data.devices[1].id);
    await page.getByRole('button', { name: 'Glucose · ĐỢT 09: chưa có kết quả', exact: true }).click();
    await inspector.getByText('Chưa ghi nhận kết quả ở ô này', { exact: true }).waitFor();
    assert.equal(await inspector.locator('.eqa-result-score').count(), 0);
    await page.locator('#eqa-scope-program').selectOption(data.otherProgramId);
    await page.locator('#eqa-scope-program').selectOption(data.programId);
    await page.locator('#eqa-scope-machine').selectOption(data.devices[0].id);
    await page.getByRole('button', { name: 'Glucose', exact: true }).click();
    await canvas.waitFor();
    // Một lần đọc thất bại phải hiện lỗi và thử lại được ngay trong trang.
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      const original = handlers.get('eqa:getInstrumentGrid');
      handlers.set('eqa:getInstrumentGrid', (...args) => {
        handlers.set('eqa:getInstrumentGrid', original);
        throw new Error('Lỗi đọc thử nghiệm ngoại kiểm');
      });
    });
    await setDetailScope(page, { programId: data.otherProgramId });
    await page.getByText('Không tải được danh sách', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.locator('.eqa-assay-item').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.eqa-stat')]
      .find((node) => node.querySelector('span')?.textContent === 'z đang chọn')?.querySelector('b')?.textContent === '-0.60');
    await page.getByText(/Chương trình này mới có 1 đợt; cần ít nhất 6 đợt/).waitFor();
    await page.screenshot({ path: path.join(shots, 'eqa-analysis-single-round.png'), fullPage: true });
    await setDetailScope(page, { programId: data.programId });
    await page.waitForFunction(() => document.querySelector('.eqa-assay-item[aria-pressed=true] .eqa-assay-z')?.textContent === '3.40');
    for (const width of [1366, 1000, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-eqa-chart] canvas');
        return node && Math.abs(node.width - node.clientWidth * devicePixelRatio) <= 2;
      });
      // Đợi thêm hai frame để thanh cuộn nội bộ ổn định chiều rộng cột phải;
      // ResizeObserver của canvas sẽ vẽ lại theo kích thước cuối cùng đó.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-eqa-chart] canvas');
        return node && Math.abs(node.width - node.clientWidth * devicePixelRatio) <= 2;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `không cuộn ngang toàn trang ở ${width}px`);
      assert.equal(await canvas.evaluate((node) => Math.abs(node.width - node.clientWidth * devicePixelRatio) <= 2), true, `canvas vẽ lại đúng độ phân giải ở ${width}px`);
      await page.screenshot({ path: path.join(shots, `eqa-analysis-${width}.png`), fullPage: true });
    }
    await page.getByRole('img', { name: new RegExp(`${shown.length} kết quả`) }).waitFor();
    await page.locator('#eqa-series-span').selectOption('2025');
    await page.getByRole('img', { name: /4 kết quả/ }).waitFor();
    await page.getByText(/Đang xem năm 2025; tín hiệu chuỗi vẫn tính trên toàn bộ 11 đợt/).waitFor();
    // Ô khoảng xem đổi URL bằng replace; các bước deep-link ở trên lại thêm mục
    // lịch sử. Mở lại bằng đường dẫn để "Quay lại" về tổng quan như khi mở thẳng.
    await setDetailScope(page, { year: 2026 });
    await page.getByText(/Đang xem năm 2026/).waitFor();
    await page.getByRole('button', { name: 'Quay lại', exact: false }).click();
    await page.getByRole('tab', { name: 'Lịch', exact: true }).click();
    await page.locator('.eqa-year-view').waitFor();
    const yearToolbarHeights = await page.evaluate(() => ({
      view: document.querySelector('.eqa-year-view')?.getBoundingClientRect().height,
      selects: [...document.querySelectorAll('.eqa-cal-nav .eqa-year-select')].map((node) => node.getBoundingClientRect().height),
    }));
    assert.equal(yearToolbarHeights.view, 36, 'bộ chuyển cách xem dùng chiều cao control chuẩn');
    assert.deepEqual(yearToolbarHeights.selects, [36, 36], 'hai select cùng hàng cao bằng bộ chuyển cách xem');
    const month = await page.evaluate(() => new Date().getFullYear() * 12 + new Date().getMonth());
    const targetMonth = 2026 * 12 + 8;
    for (let i = 0; i < Math.abs(month - targetMonth); i++) await page.getByRole('button', { name: month > targetMonth ? 'Tháng trước' : 'Tháng sau' }).click();
    await page.getByRole('gridcell', { name: '15/09/2026: 1 việc', exact: true }).click();
    await page.getByRole('heading', { name: /Công việc ngày 15\/09\/2026/ }).waitFor();
    await page.getByRole('button', { name: 'Mở kỳ báo cáo', exact: true }).click();
    await page.getByRole('heading', { name: /Sinh hóa · ĐỢT 09/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra ngoại kiểm: ${shots}`);
  } finally { await app.close(); }
});
