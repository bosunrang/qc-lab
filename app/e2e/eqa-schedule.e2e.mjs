// Kiểm tra trên Electron với CSDL tạm: cảnh báo quá hạn và các thao tác của lịch.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bootstrapAndLogin, launchApp, login, openPage, showEqaCalendarMonth } from './helpers.mjs';

async function failNextSchedule(app) {
  await app.evaluate(({ ipcMain }) => {
    const handlers = ipcMain._invokeHandlers;
    const original = handlers.get('eqa:listSchedule');
    if (!original) throw new Error('Thiếu handler lịch');
    handlers.set('eqa:listSchedule', () => {
      handlers.set('eqa:listSchedule', original);
      throw new Error('Lỗi tải lịch dùng cho kiểm thử');
    });
  });
}

test('lịch ngoại kiểm: hai cách xem, lọc năm, cảnh báo quá hạn, nộp từng máy và quyền chỉ xem', { timeout: 150_000 }, async () => {
  const { app, page, errors } = await launchApp();
  const shots = path.resolve('.cache/eqa-schedule-review');
  mkdirSync(shots, { recursive: true });
  try {
    await bootstrapAndLogin(page);
    const currentDate = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    const selectToday = async () => {
      await showEqaCalendarMonth(page, currentDate);
      await page.locator(`.eqa-cal-day[data-date="${currentDate}"]`).click();
    };
    // Rời Tổng quan trước khi gây lỗi đọc; màn đó cũng đọc lịch để nhắc hạn.
    await openPage(page, 'Phân tích Westgard');
    await failNextSchedule(app);
    await openPage(page, 'Phân tích ngoại kiểm');
    await page.getByRole('button', { name: 'Lịch', exact: true }).click();
    await page.getByText('Không tải được lịch ngoại kiểm', { exact: true }).waitFor();
    assert.equal(await page.getByText('Chưa khai lịch ngoại kiểm', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.getByText('Chưa khai lịch ngoại kiểm', { exact: true }).waitFor();
    await page.setViewportSize({ width: 1630, height: 1000 });
    const emptyMain = page.getByRole('region', { name: 'Lịch và danh sách đợt', exact: true });
    await emptyMain.getByRole('grid').waitFor();
    assert.equal(await page.getByRole('group', { name: 'Nhắc việc hiện tại, mọi năm' }).count(), 0, 'chưa khai lịch thì không bày các số 0');
    assert.equal(await emptyMain.getByRole('combobox', { name: 'Loại mẫu trong lịch' }).count(), 0, 'chưa có đợt thì chưa cần lọc mẫu');
    await page.screenshot({ path: path.join(shots, 'empty.png'), fullPage: true });
    await page.getByRole('button', { name: 'Thêm đợt đầu tiên' }).click();
    await page.getByRole('dialog', { name: 'Thêm đợt ngoại kiểm' }).waitFor();
    await page.getByRole('button', { name: 'Huỷ', exact: true }).click();
    const otherMonth = String(Number(currentDate.slice(5,7)) % 12 + 1).padStart(2,'0');
    await showEqaCalendarMonth(page, `${currentDate.slice(0,4)}-${otherMonth}-01`);
    const pickedDay = emptyMain.locator('.eqa-cal-day').nth(10);
    const pickedDate = await pickedDay.getAttribute('data-date');
    await pickedDay.click();
    await page.getByRole('button', { name: 'Dùng làm hạn nộp', exact: true }).click();
    const creation = page.getByRole('dialog', { name: 'Thêm đợt ngoại kiểm' });
    assert.equal(await creation.getByLabel('Ngày nhận mẫu', { exact: true }).count(), 0, 'biểu mẫu chỉ còn ngày chạy và hạn nộp');
    const dateFields = await creation.evaluate(node => {
      const run = node.querySelector('#eqa-s-run').closest('.field').getBoundingClientRect();
      const due = node.querySelector('#eqa-s-due').closest('.field').getBoundingClientRect();
      return { sameRow: Math.abs(run.y-due.y)<=1, sameWidth: Math.abs(run.width-due.width)<=1 };
    });
    assert.deepEqual(dateFields, { sameRow: true, sameWidth: true });
    assert.equal(await creation.locator('input[name="dueDate"]').inputValue(), pickedDate);
    assert.equal(await creation.locator('#eqa-s-year').inputValue(), pickedDate.slice(0, 4));
    assert.equal(await creation.locator('input[name="runDate"]').inputValue(), '', 'không tự gán ngày chạy mẫu');
    await creation.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await emptyMain.getByRole('button', { name: 'Thêm đợt', exact: true }).click();
    assert.equal(await creation.locator('input[name="dueDate"]').inputValue(), '', 'tạo từ thanh công cụ không giữ ngày gợi ý lần trước');
    await creation.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await selectToday();
    await page.setViewportSize({ width: 1050, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const emptyWidths = await page.evaluate(() => ({
      guide: document.querySelector('.eqa-schedule-rail > .panel').getBoundingClientRect().width,
      calendar: document.querySelector('.eqa-schedule-main').getBoundingClientRect().width,
    }));
    assert.ok(Math.abs(emptyWidths.guide - emptyWidths.calendar) <= 1, 'khung hướng dẫn dùng đủ chiều ngang khi xuống dưới lịch');
    await page.screenshot({ path: path.join(shots, 'empty-narrow.png'), fullPage: true });

    const seed = await page.evaluate(async () => {
      const api = window.qcApi;
      const must = result => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
      const now = new Date();
      const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const at = delta => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()+delta));
      const year = now.getFullYear();
      const machines = [];
      for (const name of ['AU5800', 'DxC700']) machines.push(must(await api.saveInstrument({ data: { name } })));
      const soon = must(await api.saveEqaSchedule({ data: { programName: 'EQA Sinh hóa', sampleType: 'Sinh hóa', year, round: 'ĐỢT 01', receiveDate: at(-1), runDate: at(0), dueDate: at(3), assignee: 'KTV A', instrumentIds: machines.map(m=>m.id) } }));
      must(await api.saveEqaSchedule({ data: { programId: soon.program_id, year, round: 'ĐỢT 02', receiveDate: at(0), runDate: at(0), dueDate: at(0), instrumentIds: machines.map(m=>m.id) } }));
      const waiting = must(await api.saveEqaSchedule({ data: { programName: 'EQA Huyết học', sampleType: 'Huyết học', year, round: 'ĐỢT 01', dueDate: at(4) } }));
      must(await api.markEqaSubmitted({ data: { id: waiting.id, submitted: true } }));
      must(await api.createUser({ data: { username: 'calendar_viewer', name: 'Người xem lịch', role: 'viewer', password: 'mat-khau-lich-123' } }));
      const assignee = must(await api.createUser({ data: { username: 'calendar_assignee', name: 'KTV B', role: 'technician', password: 'mat-khau-lich-123', pagePerms: ['eqa'] } }));
      return { year, today: at(0), due: at(3), soonId: soon.id, received: at(-1), beforeReceived: at(-2), assigneeId: assignee.id };
    });
    const main = page.getByRole('region', { name: 'Lịch và danh sách đợt', exact: true });
    const selected = page.getByRole('region', { name: 'Công việc ngày được chọn', exact: true });
    const overdueAlert = page.locator('.eqa-schedule').getByRole('status').filter({ hasText: 'lịch quá hạn' });
    await main.getByRole('button', { name: 'Danh sách', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.eqa-schedule-main tbody tr').length === 3);
    assert.equal(await overdueAlert.count(), 0, 'sắp đến hạn và đã nộp chờ báo cáo không tạo cảnh báo');
    assert.equal(await page.getByRole('region', { name: 'Nhắc việc mọi năm', exact: true }).count(), 0, 'đã bỏ khung Cần xử lý');
    assert.equal(await page.locator('.eqa-schedule-reminders').count(), 0, 'đã bỏ dải nhắc việc khi có dữ liệu');
    await main.getByRole('button', { name: 'Lịch tháng', exact: true }).click();
    await page.evaluate(async (year) => {
      const result = await window.qcApi.saveEqaSchedule({ data: { programName: 'EQA Năm trước', sampleType: 'Điện giải', year: year-1, round: 'ĐỢT 12', dueDate: `${year-1}-12-20` } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
    }, seed.year);
    await overdueAlert.waitFor();
    assert.equal(await overdueAlert.locator('details').evaluate(node => node.open), false, 'cảnh báo ban đầu chỉ có một dòng');
    await page.setViewportSize({ width: 1630, height: 1000 });
    await main.getByRole('grid').waitFor();
    const todayCell = main.getByRole('button', { name: new RegExp(`^${seed.today.split('-').reverse().join('/')}: 4 việc`) });
    await todayCell.waitFor();
    assert.equal(await todayCell.getByText('+2', { exact: true }).count(), 1, 'hiện số mốc bị thu gọn');
    assert.equal(await selected.locator('.eqa-schedule-task').count(), 2, 'gộp ba mốc cùng đợt thành một mục chi tiết');
    await selected.getByText('Hạn nộp · Chạy mẫu · Nhận mẫu', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(shots, 'month-wide.png'), fullPage: true });
    const dayButtons = main.locator('.eqa-cal-day');
    await dayButtons.nth(7).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await dayButtons.nth(8).evaluate(node => node === document.activeElement), true, 'điều hướng ngày bằng bàn phím');
    await page.keyboard.press('Enter');
    assert.equal(await dayButtons.nth(8).getAttribute('aria-pressed'), 'true');
    await selectToday();

    await main.getByRole('combobox', { name: 'Loại mẫu trong lịch' }).selectOption('Huyết học');
    assert.equal(await main.locator('.eqa-cal-event', { hasText: 'EQA Sinh hóa' }).count(), 0);
    await overdueAlert.waitFor();
    assert.equal(await selected.locator('.eqa-schedule-task').count(), 0, 'lọc đúng công việc ngày');
    await overdueAlert.locator('summary').click();
    await overdueAlert.getByText('EQA Năm trước', { exact: false }).waitFor();
    await overdueAlert.getByRole('button', { name: 'Xem trong lịch', exact: true }).click();
    assert.equal(await main.getByRole('combobox', { name: 'Năm trong lịch' }).inputValue(), String(seed.year-1));
    assert.equal(await main.getByRole('combobox', { name: 'Loại mẫu trong lịch' }).inputValue(), '', 'định vị gỡ bộ lọc đang che đợt');
    await selected.getByText('EQA Năm trước', { exact: false }).waitFor();
    assert.equal(await overdueAlert.locator('details').evaluate(node => node.open), false, 'định vị xong thì thu gọn cảnh báo');
    await selectToday();
    assert.deepEqual(await main.getByRole('group', { name: 'Cách xem lịch', exact: true }).getByRole('button').allTextContents(), ['Lịch tháng', 'Danh sách']);
    await main.getByRole('button', { name: 'Danh sách', exact: true }).click();
    assert.equal(await main.locator('tbody tr').count(), 3);
    await main.getByRole('combobox', { name: 'Năm trong lịch' }).selectOption(String(seed.year-1));
    await main.locator('tbody tr').filter({ hasText: 'EQA Năm trước' }).waitFor();
    assert.equal(await main.locator('tbody tr').count(), 1);
    await main.getByRole('button', { name: 'Lịch tháng', exact: true }).click();
    assert.equal(await main.getByRole('combobox', { name: 'Năm trong lịch' }).inputValue(), String(seed.year-1), 'đổi cách xem giữ năm đang chọn');
    await main.getByRole('grid').waitFor();
    const monthPicker = main.getByRole('combobox', { name: 'Tháng trong lịch', exact: true });
    await monthPicker.selectOption('12');
    await main.getByRole('grid', { name: `Lịch tháng 12/${seed.year-1}`, exact: true }).waitFor();
    await main.getByRole('combobox', { name: 'Năm trong lịch' }).selectOption(String(seed.year));
    assert.equal(await monthPicker.inputValue(), '12', 'đổi năm giữ tháng đang chọn');
    await monthPicker.selectOption('01');
    await main.getByRole('grid', { name: `Lịch tháng 01/${seed.year}`, exact: true }).waitFor();
    assert.equal(await main.getByRole('combobox', { name: 'Năm trong lịch' }).inputValue(), String(seed.year));
    await selectToday();
    assert.equal(await monthPicker.inputValue(), seed.today.slice(5, 7));
    await page.screenshot({ path: path.join(shots, 'month-picker.png'), fullPage: true });
    await main.getByRole('button', { name: 'Danh sách', exact: true }).click();
    assert.equal(await monthPicker.count(), 0, 'danh sách chỉ lọc theo năm');
    await page.screenshot({ path: path.join(shots, 'list-two-views.png'), fullPage: true });
    await main.getByRole('combobox', { name: 'Loại mẫu trong lịch' }).selectOption('Khí máu');
    await main.getByText('Không có đợt thuộc loại mẫu đã chọn', { exact: true }).waitFor();
    await main.getByRole('button', { name: 'Xem mọi loại mẫu' }).click();
    const soonRow = main.locator(`tbody tr[data-schedule-id="${seed.soonId}"]`);
    await soonRow.getByRole('button', { name: 'Ghi nhận nộp', exact: true }).click();
    const submission = page.getByRole('dialog', { name: 'Đánh dấu đã nộp', exact: true });
    await submission.getByLabel('AU5800', { exact: false }).check();
    await submission.getByRole('button', { name: 'Lưu', exact: true }).click();
    await soonRow.getByText('Đã nộp 1/2 máy', { exact: true }).waitFor();
    assert.equal(await soonRow.getByRole('button', { name: /Xoá/ }).count(), 0, 'không xoá đợt nộp một phần');
    await soonRow.getByRole('button', { name: 'Ghi nhận nộp', exact: true }).click();
    await submission.getByLabel('DxC700', { exact: false }).check();
    await submission.getByRole('button', { name: 'Lưu', exact: true }).click();
    await soonRow.getByRole('button', { name: 'Sửa đã nộp', exact: true }).waitFor();
    await soonRow.getByRole('button', { name: 'Sửa đã nộp', exact: true }).click();
    await submission.getByLabel('DxC700', { exact: false }).uncheck();
    await submission.getByRole('button', { name: 'Lưu', exact: true }).click();
    await soonRow.getByText('Đã nộp 1/2 máy', { exact: true }).waitFor();
    await soonRow.getByRole('button', { name: 'Sửa EQA Sinh hóa ĐỢT 01', exact: true }).click();
    await page.getByRole('dialog', { name: 'Sửa đợt ngoại kiểm' }).waitFor();
    assert.equal(await page.getByLabel('Ngày nhận mẫu', { exact: true }).count(), 0);
    await page.locator('#eqa-s-run').fill(seed.beforeReceived);
    await page.locator('#eqa-s-run').press('Tab');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await page.locator('.field:has(#eqa-s-run) .field-error').waitFor();
    assert.equal(await page.locator('#eqa-s-run').getAttribute('aria-invalid'), 'true', 'ràng buộc ngày nhận cũ chỉ đúng ô ngày chạy hiện có');
    await page.locator('#eqa-s-run').fill(seed.today);
    await page.locator('#eqa-s-run').press('Tab');
    const assignee = page.getByRole('combobox', { name: 'Người phụ trách', exact: true });
    assert.equal(await assignee.inputValue(), '__saved_name__');
    assert.match(await assignee.locator('option:checked').textContent(), /KTV A.*đã lưu/);
    await assignee.selectOption(seed.assigneeId);
    const dropdownStyles = await page.getByRole('dialog', { name: 'Sửa đợt ngoại kiểm' }).evaluate(node => {
      const read = id => {
        const select = node.querySelector(id), style = getComputedStyle(select), icon = getComputedStyle(select, '::picker-icon');
        return [style.appearance, style.fontFamily, style.fontSize, style.height, style.borderRadius, style.borderColor,
          style.backgroundColor, icon.width, icon.height, icon.maskImage, icon.backgroundColor];
      };
      return { program: read('#eqa-s-program'), sample: read('#eqa-s-sample'), assignee: read('#eqa-s-assignee') };
    });
    assert.deepEqual(dropdownStyles.assignee, dropdownStyles.program, 'người phụ trách dùng cùng kiểu dropdown và mũi tên với chương trình');
    assert.deepEqual(dropdownStyles.assignee, dropdownStyles.sample, 'người phụ trách dùng cùng kiểu dropdown và mũi tên với loại mẫu');
    const assignmentLayout = await page.locator('.eqa-form-assignment').evaluate(node => {
      const person = node.querySelector('#eqa-s-assignee').getBoundingClientRect(), note = node.querySelector('#eqa-s-note').getBoundingClientRect();
      return { aligned: Math.abs(person.y - note.y) <= 1, smaller: person.width < note.width, contained: person.right <= note.left };
    });
    assert.deepEqual(assignmentLayout, { aligned: true, smaller: true, contained: true });
    await page.getByRole('dialog', { name: 'Sửa đợt ngoại kiểm' }).screenshot({ path: path.join(shots, 'assignee-note.png') });
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await soonRow.getByText('KTV B', { exact: true }).waitFor();
    const retainedReceiveDate = await page.evaluate(async id => (await window.qcApi.listEqaSchedule()).find(row => row.id===id).receive_date, seed.soonId);
    assert.equal(retainedReceiveDate, seed.received, 'sửa biểu mẫu không làm mất ngày nhận mẫu đã lưu');
    for (const width of [1630, 1050]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await selected.count(), 0, 'danh sách không dựng khung chi tiết ngày');
      const listWidths = await main.evaluate(node => ({
        main: node.getBoundingClientRect().width,
        workspace: node.closest('.eqa-schedule-workspace').getBoundingClientRect().width,
      }));
      assert.ok(Math.abs(listWidths.main-listWidths.workspace)<=1, 'danh sách chiếm đủ chiều ngang khung');
      await page.screenshot({ path: path.join(shots, `list-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), true, 'chỉ bảng cuộn ngang, toàn trang không tràn');
    }

    // Lỗi làm mới phải giữ dữ liệu cũ, kèm nhắc rõ và nút khôi phục.
    await openPage(page, 'Phân tích Westgard');
    await failNextSchedule(app);
    await openPage(page, 'Phân tích ngoại kiểm');
    await page.getByRole('button', { name: 'Lịch', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Dữ liệu đang hiển thị là lần tải trước' }).waitFor();
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Dữ liệu đang hiển thị là lần tải trước' }).waitFor({ state: 'hidden' });
    await main.getByRole('button', { name: 'Danh sách', exact: true }).click();
    const waitingTask = main.locator('tbody tr').filter({ hasText: 'EQA Huyết học' });
    await waitingTask.getByRole('button', { name: 'Bỏ đã nộp', exact: true }).click();
    await waitingTask.getByRole('button', { name: 'Ghi nhận nộp', exact: true }).click();
    await waitingTask.getByRole('button', { name: 'Bỏ đã nộp', exact: true }).waitFor();
    await overdueAlert.locator('summary').click();
    await overdueAlert.getByRole('button', { name: 'Xem trong lịch', exact: true }).click();
    await selected.getByText('EQA Năm trước', { exact: false }).waitFor();
    await selected.getByRole('button', { name: /^Xoá / }).click();
    const removal = page.getByRole('dialog', { name: 'Xoá đợt trong lịch', exact: true });
    await removal.getByRole('button', { name: 'Xoá', exact: true }).click();
    await overdueAlert.waitFor({ state: 'hidden' });
    await selectToday();
    await page.setViewportSize({ width: 1630, height: 1000 });
    await page.screenshot({ path: path.join(shots, 'no-overdue.png'), fullPage: true });
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await login(page, { username: 'calendar_viewer', password: 'mat-khau-lich-123' });
    await openPage(page, 'Phân tích ngoại kiểm');
    await page.getByRole('button', { name: 'Lịch', exact: true }).click();
    await main.getByRole('grid').waitFor();
    await main.locator(`button[data-date="${seed.today}"]`).click();
    await selected.locator('.eqa-schedule-task').first().waitFor();
    assert.equal(await page.locator('.eqa-schedule').getByRole('button', { name: /Thêm đợt|Dùng làm hạn nộp|Ghi nhận nộp|Sửa đã nộp|Bỏ đã nộp|^Sửa |^Xoá / }).count(), 0, 'vai trò chỉ xem không có thao tác ghi');
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: path.join(shots, 'failure.png'), fullPage: true });
    console.error(await page.locator('body').innerText());
    throw error;
  } finally { await app.close(); }
});
