import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('đợt báo cáo ngoại kiểm: bộ lọc máy riêng mặc định tất cả, mỗi dòng mở đúng máy', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const data = await page.evaluate(async () => {
      const api = window.qcApi, must = r => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      const machines = [], mappings = [], rows = [];
      for (const [name, zs] of [['Máy khí máu 1', [0, 1]], ['Máy khí máu 2', [0, 2.5, 3.5]]]) {
        const machine = must(await api.saveInstrument({ data: { name } }));
        machines.push(machine);
        for (const [index, z] of zs.entries()) {
          const code = `T${index + 1}`;
          const assay = must(await api.saveTest({ data: { name: `Thông số ${index + 1}`, instrumentId: machine.id, unit: 'mmHg' } }));
          mappings.push({ code, instrument: name, testId: assay.id });
          rows.push({ ref: `${machine.id}-${code}`, code, instrument: name, sample: 'A', unit: 'mmHg', result: 100 + z, assigned: 100, sigmaP: 1, zProvider: z, peer: {} });
        }
      }
      const rounds = [];
      let focusedResultId;
      for (const [number, machineNames, cancelled] of [[1, machines.map(m => m.name), false], [2, [machines[0].name], false], [3, [machines[1].name], false], [4, machines.map(m => m.name), true], [5, [machines[0].name], true]]) {
        let view = must(await api.importEqaRound({ data: {
          source: 'pdf', sourceName: `bao-cao-${number}.pdf`,
          round: { program: 'Ngoại kiểm khí máu', provider: 'Kiểm thử', programCode: 'BG', unitCode: 'TEST', year: 2026, round: `ĐỢT ${number}`, reportDate: `2026-0${number}-20` },
          rows: rows.filter(row => machineNames.includes(row.instrument)), mappings,
        } }));
        if (cancelled) view = must(await api.cancelEqaRound({ data: { id: view.round.id, expectedVersion: view.round.row_version, reason: 'Huỷ báo cáo để kiểm tra đúng phạm vi máy' } }));
        if (number === 1) focusedResultId = view.results.find(row => row.instrument_id === machines[1].id).id;
        rounds.push(view.round);
      }
      must(await api.saveEqaSchedule({ data: { programId: rounds[0].program_id, provider: 'Kiểm thử', year: 2026, round: 'ĐỢT 1', receiveDate: '', runDate: '2026-11-18', dueDate: '2026-11-20', assignee: '', note: '', instrumentIds: [machines[0].id] } }));
      must(await api.importEqaRound({ data: {
        source: 'pdf', sourceName: 'bao-cao-2025.pdf',
        round: { program: 'Ngoại kiểm khí máu', provider: 'Kiểm thử', programCode: 'BG', unitCode: 'TEST', year: 2025, round: 'ĐỢT 1', reportDate: '2025-01-20' },
        rows: rows.filter(row => row.instrument === machines[1].name), mappings,
      } }));
      return { machines, rounds, focusedResultId, programId: rounds[0].program_id };
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'Phân tích ngoại kiểm');
    const list = page.getByRole('region', { name: 'Danh sách đợt ngoại kiểm', exact: true });
    const topMachine = page.locator('#eqa-scope-machine');
    const reportMachine = list.getByRole('combobox', { name: 'Lọc máy trong danh sách đợt báo cáo' });
    const reportRound = list.getByRole('combobox', { name: 'Lọc đợt trong danh sách đợt báo cáo' });
    const sharedRow = machineName => list.locator('tbody>tr')
      .filter({ has: page.getByText('ĐỢT 1 / 2026', { exact: true }) })
      .filter({ has: page.getByText(machineName, { exact: true }) });
    await list.locator('tbody>tr').first().waitFor();
    assert.equal(await topMachine.inputValue(), data.machines[0].id);
    assert.equal(await reportMachine.inputValue(), '', 'danh sách đợt mặc định Tất cả máy');
    assert.equal(await list.locator('tbody>tr').count(), 4, 'đợt chung có dòng riêng cho từng máy');
    assert.equal(await reportRound.inputValue(), '', 'mặc định Tất cả đợt');
    await reportRound.selectOption(data.rounds[0].id);
    assert.equal(await list.locator('tbody>tr').count(), 2, 'đợt 1 hiện đúng cả hai máy');
    await reportMachine.selectOption(data.machines[1].id);
    assert.equal(await list.locator('tbody>tr').count(), 1, 'kết hợp bộ lọc đợt và máy');
    await reportRound.selectOption(data.rounds[1].id);
    assert.equal(await list.locator('tbody>tr').count(), 0, 'không hiện đợt khác khi máy chưa có dữ liệu của đợt đã chọn');
    assert.equal(await reportRound.inputValue(), data.rounds[1].id);
    await reportMachine.selectOption(data.machines[0].id);
    assert.equal(await list.locator('tbody>tr').count(), 1);
    assert.equal(await topMachine.inputValue(), data.machines[0].id, 'bộ lọc đợt không đổi phạm vi z-score');
    await reportRound.selectOption('');
    await reportMachine.selectOption('');
    assert.equal(await sharedRow(data.machines[0].name).locator('td').nth(2).innerText(), '2');
    assert.equal(await sharedRow(data.machines[1].name).locator('td').nth(2).innerText(), '3');
    // Mở một dòng máy 2 ngay khi bộ lọc Tổng quan vẫn đang chọn máy 1.
    await sharedRow(data.machines[1].name).getByRole('button', { name: 'Xem', exact: true }).click();
    await page.locator('.eqa-overview-summary').getByText('1/3 kết quả', { exact: true }).waitFor();
    assert.equal(await page.locator('#eqaInstrument').count(), 0);
    await page.getByRole('button', { name: '← Quay lại', exact: true }).click();
    await reportMachine.waitFor();
    assert.equal(await reportMachine.inputValue(), '');
    await reportRound.selectOption(data.rounds[0].id);
    await sharedRow(data.machines[1].name).getByRole('button', { name: 'Xem', exact: true }).click();
    await page.locator('.eqa-overview-summary').getByText('1/3 kết quả', { exact: true }).waitFor();
    await page.getByRole('button', { name: '← Quay lại', exact: true }).click();
    await reportRound.waitFor();
    assert.equal(await reportRound.inputValue(), data.rounds[0].id, 'quay lại giữ bộ lọc đợt');
    await reportRound.selectOption('');
    await topMachine.selectOption(data.machines[1].id);
    assert.equal(await list.locator('tbody>tr').count(), 4, 'đổi máy z-score không lọc danh sách đợt');
    await topMachine.selectOption(data.machines[0].id);
    await reportMachine.selectOption(data.machines[1].id);
    await sharedRow(data.machines[1].name).waitFor();
    assert.equal(await topMachine.inputValue(), data.machines[0].id, 'bộ lọc danh sách không đổi máy của z-score');
    assert.equal(await list.locator('tbody>tr').count(), 2);
    assert.deepEqual(await sharedRow(data.machines[1].name).locator('td').allInnerTexts().then(cells => cells.slice(1, 6)), ['Máy khí máu 2', '3', '1', '1', '1']);
    await reportMachine.selectOption(data.machines[0].id);
    assert.equal(await list.locator('tbody>tr').count(), 2);
    assert.equal(await sharedRow(data.machines[1].name).count(), 0);
    await reportMachine.selectOption('');
    assert.equal(await list.locator('tbody>tr').count(), 4);
    for (const width of [1440, 820]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await reportMachine.evaluate(el => {
        const box = el.getBoundingClientRect(), head = el.closest('.panel-head').getBoundingClientRect();
        return box.left >= head.left && box.right <= head.right && box.top >= head.top && box.bottom <= head.bottom;
      }), 'ô chọn máy nằm gọn trong tiêu đề bảng');
      assert(await reportRound.evaluate(el => {
        const box = el.getBoundingClientRect(), head = el.closest('.panel-head').getBoundingClientRect();
        return box.left >= head.left && box.right <= head.right && box.top >= head.top && box.bottom <= head.bottom;
      }), 'ô chọn đợt nằm gọn trong tiêu đề bảng');
      await list.screenshot({ path: path.join(userDataDir, `eqa-round-machine-filter-${width}.png`) });
    }
    await reportMachine.selectOption(data.machines[1].id);
    await reportRound.selectOption(data.rounds[0].id);
    await page.reload();
    await reportMachine.waitFor();
    assert.equal(await reportMachine.inputValue(), data.machines[1].id, 'tải lại giữ bộ lọc danh sách');
    assert.equal(await reportRound.inputValue(), data.rounds[0].id, 'tải lại giữ bộ lọc đợt');
    await page.locator('#eqa-scope-year').selectOption('2025');
    await list.locator('tbody>tr').first().waitFor();
    assert.equal(await reportMachine.inputValue(), '', 'đổi năm đặt lại Tất cả máy');
    assert.equal(await reportRound.inputValue(), '', 'đổi năm đặt lại Tất cả đợt');
    assert.equal(await list.locator('tbody>tr').count(), 1);
    await page.locator('#eqa-scope-year').selectOption('2026');
    assert.equal(await reportMachine.inputValue(), '');
    await reportMachine.selectOption(data.machines[1].id);
    await list.getByRole('checkbox', { name: 'Hiện đợt đã huỷ' }).check();
    assert.equal(await list.locator('tbody>tr').count(), 3, 'chỉ thêm đợt đã huỷ có máy 2');
    await reportRound.selectOption(data.rounds[3].id);
    await page.reload();
    await reportRound.waitFor();
    assert.equal(await list.getByRole('checkbox', { name: 'Hiện đợt đã huỷ' }).isChecked(), true, 'tải lại giữ trạng thái xem đợt đã huỷ');
    assert.equal(await reportRound.inputValue(), data.rounds[3].id, 'không tự bỏ bộ lọc đợt đã huỷ');
    assert.equal(await list.locator('tbody>tr').count(), 1);
    await list.getByRole('button', { name: 'Xem', exact: true }).click();
    await page.locator('.eqa-overview-summary').getByText('1/3 kết quả', { exact: true }).waitFor();
    await page.getByRole('button', { name: '← Quay lại', exact: true }).click();
    await reportRound.waitFor();
    assert.equal(await reportRound.inputValue(), data.rounds[3].id, 'quay lại giữ đợt đã huỷ đang xem');
    await list.getByRole('checkbox', { name: 'Hiện đợt đã huỷ' }).uncheck();
    assert.equal(await reportRound.inputValue(), '', 'ẩn đợt đã huỷ thì xoá lựa chọn đợt đã huỷ');
    assert.equal(await list.locator('tbody>tr').count(), 2);
    await list.getByRole('checkbox', { name: 'Hiện đợt đã huỷ' }).check();
    await page.getByRole('combobox', { name: 'Lọc xét nghiệm trong bảng tổng hợp z-score' }).selectOption('rej');
    assert.equal(await list.locator('tbody>tr').count(), 3, 'lọc xếp loại không đổi danh sách đợt');
    await sharedRow(data.machines[1].name).getByRole('button', { name: 'Xem', exact: true }).click();
    const results = page.locator('.eqa-results-table');
    await results.locator('tbody>tr').first().waitFor();
    assert.equal(await page.locator('#eqaInstrument').count(), 0);
    assert.equal(await results.locator('tbody>tr:not(.eqa-detail-row)').count(), 3);
    await page.locator('.eqa-overview-summary').getByText('1/3 kết quả', { exact: true }).waitFor();
    const info = page.getByRole('region', { name: 'Thông tin đợt', exact: true });
    assert.match(await info.innerText(), /Máy khí máu 2/);
    assert.doesNotMatch(await info.innerText(), /Máy khí máu 1/);
    assert.equal(await page.getByRole('region', { name: 'Tổng hợp theo máy', exact: true }).count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Kết quả ngoại kiểm', exact: true }).getByRole('combobox').count(), 1, 'chỉ còn bộ lọc đánh giá');
    await page.screenshot({ path: path.join(userDataDir, 'eqa-round-fixed-machine.png') });
    await page.reload();
    await page.locator('.eqa-overview-summary').getByText('1/3 kết quả', { exact: true }).waitFor();
    await page.getByRole('button', { name: '← Quay lại', exact: true }).click();
    await reportMachine.waitFor();
    assert.equal(await reportMachine.inputValue(), data.machines[1].id, 'quay lại giữ bộ lọc danh sách');
    // Máy không có dữ liệu trong đợt không được mở rộng sang máy khác.
    await page.evaluate(({ roundId, machineId }) => { location.hash = `#/eqa?id=${roundId}&machine=${machineId}`; }, { roundId: data.rounds[1].id, machineId: data.machines[1].id });
    await page.getByText('Không có kết quả phù hợp bộ lọc', { exact: true }).waitFor();
    assert.equal(await results.count(), 0);
    await page.evaluate(roundId => { location.hash = `#/eqa?id=${roundId}`; }, data.rounds[1].id);
    await page.locator('.eqa-overview-summary').getByText('2/2 kết quả', { exact: true }).waitFor();
    await page.evaluate(({ roundId, point }) => { location.hash = `#/eqa?id=${roundId}&point=${point}`; }, { roundId: data.rounds[0].id, point: data.focusedResultId });
    await page.locator('.eqa-overview-summary').getByText('1/3 kết quả', { exact: true }).waitFor();
    await page.evaluate(roundId => { location.hash = `#/eqa?id=${roundId}`; }, data.rounds[0].id);
    await page.getByText('Chọn máy từ danh sách đợt báo cáo', { exact: true }).waitFor();
    assert.equal(await results.count(), 0, 'liên kết thiếu máy không gộp kết quả các máy');
    await page.getByRole('button', { name: 'Về danh sách', exact: true }).click();
    await reportMachine.waitFor();
    await page.evaluate(machineId => { location.hash = `#/eqa?view=lich&machine=${machineId}`; }, data.machines[1].id);
    await page.getByRole('button', { name: 'Danh sách', exact: true }).click();
    await page.getByRole('button', { name: 'Mở đợt báo cáo', exact: true }).first().click();
    await page.locator('.eqa-overview-summary').getByText('2/2 kết quả', { exact: true }).waitFor();
    assert.match(await page.getByRole('region', { name: 'Thông tin đợt', exact: true }).innerText(), /Máy khí máu 1/);
    await page.evaluate(async (machineId) => {
      for (const round of await window.qcApi.listEqaRounds()) if (round.status === 'open' && round.year === 2026 && round.by_instrument.some(i => i.instrument_id === machineId)) {
        const result = await window.qcApi.cancelEqaRound({ data: { id: round.id, expectedVersion: round.row_version, reason: 'Huỷ các đợt của máy để thử tra cứu lịch sử' } });
        if (!result.ok) throw new Error(JSON.stringify(result.error));
      }
    }, data.machines[0].id);
    await page.evaluate(programId => { location.hash = `#/eqa?year=2026&program=${programId}`; }, data.programId);
    await list.locator('tbody>tr').first().waitFor();
    assert.equal(await topMachine.inputValue(), data.machines[1].id, 'ưu tiên máy còn đợt đang dùng cho z-score');
    assert.equal(await reportMachine.inputValue(), '');
    await reportMachine.selectOption(data.machines[0].id);
    await list.getByRole('checkbox', { name: 'Hiện đợt đã huỷ' }).check();
    assert.equal(await list.locator('tbody>tr').count(), 4);
    await page.evaluate(async () => {
      for (const round of await window.qcApi.listEqaRounds()) if (round.status === 'open') {
        const result = await window.qcApi.cancelEqaRound({ data: { id: round.id, expectedVersion: round.row_version, reason: 'Huỷ toàn bộ dữ liệu thử để kiểm tra tra cứu' } });
        if (!result.ok) throw new Error(JSON.stringify(result.error));
      }
    });
    await page.evaluate(({ programId, machineId }) => { location.hash = `#/eqa?year=2026&program=${programId}&machine=${machineId}&roundMachine=${machineId}`; }, { programId: data.programId, machineId: data.machines[1].id });
    await reportMachine.waitFor();
    assert.equal(await reportMachine.inputValue(), data.machines[1].id);
    await list.getByRole('checkbox', { name: 'Hiện đợt đã huỷ' }).check();
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Danh sách đợt ngoại kiểm"] tbody>tr').length === 3);
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra đợt theo máy: ${userDataDir}`);
  } finally { await app.close(); }
});
