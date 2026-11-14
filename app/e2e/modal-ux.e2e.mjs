// Hộp thoại trên app thật (U2, U3, U7 của đánh giá 2026-10-31): mở form là gõ
// được ngay, Esc chỉ đóng lớp trên cùng và hỏi trước khi bỏ dữ liệu đã nhập,
// bấm Lưu hai lần liền chỉ tạo một bản ghi, đóng xong focus về nút đã mở.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

const activeName = (page) => page.evaluate(() => document.activeElement?.getAttribute('name') ?? '');
const activeText = (page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');

async function assertInvalidAppearance(control) {
  const appearance = await control.evaluate((input) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger-accent)';
    input.parentElement.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(input.closest('.datebox') ?? input);
    return { danger, outline: style.outlineColor, outlineStyle: style.outlineStyle, focusVisible: input.matches(':focus-visible') };
  });
  assert.equal(appearance.focusVisible, true, 'ô nhập lỗi có vòng focus hiển thị');
  assert.notEqual(appearance.outlineStyle, 'none');
  assert.equal(appearance.outline, appearance.danger, 'vòng focus phải đỏ, không che viền lỗi bằng màu xanh');
}

test('modal: focus, Esc theo lớp, hỏi khi bỏ dữ liệu, chặn lưu trùng', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await openPage(page, 'Cấu hình chung');

    // U2: mở form là con trỏ nằm ở ô đầu tiên, gõ được ngay.
    await page.getByRole('button', { name: '＋ Thêm máy xét nghiệm' }).click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Thêm máy xét nghiệm' });
    await modal.waitFor();
    assert.equal(await activeName(page), 'name', 'focus vào ô Tên hiển thị, không phải nút ✕');
    await page.keyboard.type('Máy E2E');
    const nameInput = modal.locator('input[name=name]');
    assert.equal(await nameInput.inputValue(), 'Máy E2E');

    // U3: Esc khi form đã sửa thì hỏi; Esc lần nữa chỉ đóng hộp hỏi.
    await page.keyboard.press('Escape');
    const confirm = page.locator('.confirm-modal', { hasText: 'Bỏ thay đổi chưa lưu?' });
    await confirm.waitFor();
    await page.keyboard.press('Escape');
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await modal.isVisible(), true, 'Esc trên hộp hỏi không đóng luôn form');
    // Bấm ra nền cũng hỏi; chọn "Tiếp tục sửa" thì giữ nguyên dữ liệu.
    await page.mouse.click(5, 5);
    await confirm.waitFor();
    await confirm.getByRole('button', { name: 'Tiếp tục sửa' }).click();
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await nameInput.inputValue(), 'Máy E2E');

    // U7: hai cú bấm trong cùng một khung hình — trước khi nút kịp khoá.
    await modal.locator('button[type=submit]').evaluate((button) => { button.click(); button.click(); });
    await modal.waitFor({ state: 'detached' });
    const saved = await page.evaluate(async () => (await window.qcApi.listInstruments()).filter((item) => item.name === 'Máy E2E').length);
    assert.equal(saved, 1, 'bấm Lưu hai lần liền chỉ tạo một máy');
    assert.equal(await activeText(page), '＋ Thêm máy xét nghiệm', 'đóng xong focus về nút đã mở form');

    // U7: nhãn gắn với ô — bấm "Tên hiển thị" thì con trỏ về ô tên.
    await page.getByRole('button', { name: '＋ Thêm máy xét nghiệm' }).click();
    await modal.waitFor();
    await modal.locator('input[name=section]').click();
    assert.equal(await activeName(page), 'section');
    await modal.getByText('Tên hiển thị', { exact: true }).click();
    assert.equal(await activeName(page), 'name', 'bấm nhãn focus vào ô tên');
    await modal.locator('button[type=submit]').click();
    await modal.locator('.field-error').waitFor();
    assert.equal(await nameInput.getAttribute('aria-invalid'), 'true', 'bỏ trống ô bắt buộc thì có viền đỏ');
    assert.equal(await activeName(page), 'name', 'focus về ô bắt buộc còn trống');
    assert.equal(await page.getByRole('alertdialog').count(), 0, 'thiếu dữ liệu báo tại ô nhập');
    await assertInvalidAppearance(nameInput);
    const nameError = modal.locator('.field:has(> input[name=name]) > .field-error');
    assert.equal(await nameError.innerText(), 'Nhập tên máy.');
    assert.equal(await modal.locator('form > .field-error').count(), 0, 'không còn lỗi gom ở đầu biểu mẫu');
    const inputBox = await nameInput.boundingBox();
    const messageBox = await nameError.boundingBox();
    assert.ok(messageBox.y >= inputBox.y + inputBox.height, 'lời nhắc nằm dưới ô lỗi');
    assert.ok(Math.abs(messageBox.x - inputBox.x) < 1, 'lời nhắc thẳng hàng với ô lỗi');
    await page.screenshot({ path: 'dist/inline-field-error-preview.png' });
    // U7: lưu trùng tên thì ô tên bị đánh dấu sai, nối với dòng lỗi và nhận focus.
    await nameInput.fill('Máy E2E');
    await nameError.waitFor({ state: 'detached' });
    await modal.locator('input[name=section]').click();
    await modal.locator('button[type=submit]').click();
    const fieldError = modal.locator('.field-error');
    await fieldError.waitFor();
    await page.waitForFunction(() => document.querySelector('#instrument-name')?.getAttribute('aria-invalid') === 'true');
    assert.equal(await nameInput.getAttribute('aria-invalid'), 'true', 'ô tên mang aria-invalid');
    assert.equal(await activeName(page), 'name', 'focus về ô tên bị lỗi');
    assert.equal(await page.getByRole('alertdialog').count(), 0, 'lỗi ô nhập không mở hộp thoại hệ thống');
    const errorId = await fieldError.getAttribute('id');
    assert.ok(errorId && (await nameInput.getAttribute('aria-describedby'))?.split(' ').includes(errorId), 'ô tên trỏ tới dòng lỗi');
    await page.keyboard.type(' 2');
    assert.equal(await nameInput.getAttribute('aria-invalid'), null, 'sửa ô thì gỡ dấu lỗi');
    await modal.getByRole('button', { name: 'Huỷ' }).click();
    await modal.waitFor({ state: 'detached' });

    // Lỗi của một nhóm checkbox nằm dưới cả nhóm và focus vào khung chọn,
    // không dạt lên đầu form hoặc chỉ khoanh đỏ checkbox đầu tiên.
    await page.locator('.config-shell-tabs').getByRole('button', { name: /Danh mục xét nghiệm/ }).click();
    await page.getByRole('button', { name: '＋ Thêm xét nghiệm' }).click();
    const testModal = page.locator('.modal[role=dialog]', { hasText: 'Thêm xét nghiệm' });
    await testModal.waitFor();
    assert.equal(await testModal.evaluate((modal) => modal.classList.contains('modal-xl')), true, 'form xét nghiệm dùng cỡ rộng chuẩn của hệ thống');
    assert.ok((await testModal.boundingBox()).width > 900, 'form xét nghiệm đủ rộng để ô tên không bị bó hẹp');
    const testNameInput = testModal.locator('input[name=name]');
    const machineGroup = testModal.locator('.assay-machine-picker');
    await testModal.locator('button[type=submit]').click();
    const testNameError = testModal.locator('.field:has(input[name=name]) > .field-error');
    await testNameError.waitFor();
    assert.equal(await testNameError.innerText(), 'Nhập tên xét nghiệm.');
    assert.equal(await testNameInput.getAttribute('aria-invalid'), 'true', 'thiếu tên phải đánh dấu tên trước');
    assert.equal(await machineGroup.getAttribute('aria-invalid'), null, 'chưa được báo thiếu máy khi tên còn trống');
    const testNameBox = await testNameInput.boundingBox();
    const testUnitBox = await testModal.locator('input[name=unit]').boundingBox();
    const testNameErrorBox = await testNameError.boundingBox();
    const testMethodBox = await testModal.locator('input[name=method]').boundingBox();
    assert.ok(Math.abs(testNameBox.y - testUnitBox.y) < 1, 'ô tên và đơn vị vẫn thẳng hàng khi tên có lỗi');
    assert.ok(testMethodBox.y >= testNameErrorBox.y + testNameErrorBox.height, 'dòng lỗi đẩy cả hàng kế tiếp xuống dưới');
    await testModal.screenshot({ path: 'dist/test-name-inline-error-preview.png' });
    await testNameInput.fill('Xét nghiệm nhóm lỗi E2E');
    await testNameError.waitFor({ state: 'detached' });
    await testModal.locator('button[type=submit]').click();
    const machineError = machineGroup.locator(':scope > .field-error');
    await machineError.waitFor();
    assert.equal(await machineError.innerText(), 'Chọn ít nhất một máy xét nghiệm.');
    assert.equal(await machineGroup.getAttribute('aria-invalid'), 'true', 'đánh dấu cả nhóm máy');
    assert.equal(await machineGroup.locator('input[type=checkbox]').first().getAttribute('aria-invalid'), null, 'không khoanh riêng checkbox đầu');
    assert.equal(await testModal.locator('form > .field-error').count(), 0, 'lỗi nhóm không nằm ở đầu form');
    assert.equal(await machineGroup.evaluate((group) => document.activeElement === group), true, 'focus vào nhóm máy');
    const lastMachineBox = await machineGroup.locator('.choice-card').last().boundingBox();
    const machineErrorBox = await machineError.boundingBox();
    assert.ok(machineErrorBox.y >= lastMachineBox.y + lastMachineBox.height, 'lời nhắc nằm dưới danh sách máy');
    await testModal.screenshot({ path: 'dist/group-inline-field-error-preview.png' });
    await testModal.getByRole('button', { name: 'Huỷ' }).click();
    await testModal.waitFor({ state: 'detached' });

    // U3: Esc khi lịch chọn ngày đang mở trong modal chỉ đóng lịch.
    await page.locator('.config-shell-tabs').getByRole('button', { name: /Lô & Nhóm QC/ }).click();
    await page.getByRole('button', { name: '+ Thêm lô' }).click();
    const lotModal = page.locator('.modal[role=dialog]', { hasText: 'Thêm lô QC' });
    await lotModal.waitFor();
    await lotModal.locator('.field', { hasText: 'Hạn sử dụng' }).locator('.datepick').click();
    const picker = page.locator('#vnDatePicker');
    await picker.waitFor();
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    assert.equal(await lotModal.isVisible(), true, 'Esc chỉ đóng lịch, không đóng modal');
    // Kiểm tra quy tắc CSS trên khung ngày thật: khung nhận vòng focus từ ô
    // chữ bên trong, không được quay về màu xanh khi có aria-invalid.
    const dateInput = lotModal.getByRole('textbox', { name: 'Hạn sử dụng', exact: true });
    await dateInput.evaluate((input) => { input.setAttribute('aria-invalid', 'true'); input.focus(); });
    await assertInvalidAppearance(dateInput);
    await dateInput.evaluate((input) => input.removeAttribute('aria-invalid'));
    // Chưa gõ gì thì Esc đóng ngay, không hỏi.
    await page.keyboard.press('Escape');
    await lotModal.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.confirm-modal').count(), 0);

    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
