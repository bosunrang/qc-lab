// Điều hướng bàn phím trong bảng nhập QC — logic THUẦN (chỉ đọc `dataset`/
// `classList`), nên test thẳng trên `.ts` qua ESM type-stripping, cùng cách
// `entry-run-id.test.mjs` làm. Trước đó phần này không có test nào, dù nó là
// thao tác người dùng gõ liên tục cả ngày: sai một nhánh là kỹ thuật viên gõ
// nhầm ô mà không có gì báo.
import assert from 'node:assert/strict';
import { sheetInputOrder, sheetNavigationTarget, pickSheetFocusCandidate, isSheetNavigationKey } from '../renderer/lib/entry-sheet-navigation.ts';

const cell = (date, column, opts = {}) => ({
  dataset: {
    focusDate: date,
    focusColumn: String(column),
    focusColumnOrder: String(opts.order ?? column),
    focusLevel: String(column),
  },
  classList: { contains: (name) => (opts.classes || []).includes(name) },
});

// ---- Thứ tự ô: theo NGÀY trước, rồi tới cột trong ngày
{
  const shuffled = [cell('2026-09-02', 1), cell('2026-09-01', 2), cell('2026-09-01', 1)];
  const sorted = sheetInputOrder(shuffled);
  assert.deepEqual(
    sorted.map((c) => `${c.dataset.focusDate}#${c.dataset.focusColumn}`),
    ['2026-09-01#1', '2026-09-01#2', '2026-09-02#1'],
    'sắp theo ngày trước rồi tới cột',
  );
  // Cột lô song song dùng `focusColumnOrder` riêng để chen đúng chỗ giữa các
  // mức, không bị `focusLevel` kéo về sai vị trí.
  const parallel = sheetInputOrder([
    cell('2026-09-01', 'p1', { order: 2 }), cell('2026-09-01', 1, { order: 1 }),
  ]);
  assert.equal(parallel[0].dataset.focusColumn, '1', 'focusColumnOrder quyết định thứ tự, không phải tên cột');
}

// ---- Di chuyển NGANG trong cùng một ngày
{
  const row = sheetInputOrder([cell('2026-09-01', 1), cell('2026-09-01', 2), cell('2026-09-01', 3)]);
  const at = (i) => row[i];
  assert.equal(sheetNavigationTarget(row, at(0), 'ArrowRight'), at(1), 'mũi tên phải sang cột kế');
  assert.equal(sheetNavigationTarget(row, at(1), 'ArrowLeft'), at(0), 'mũi tên trái lùi một cột');
  assert.equal(sheetNavigationTarget(row, at(2), 'ArrowRight'), null, 'mũi tên KHÔNG quay vòng ở cuối hàng');
  assert.equal(sheetNavigationTarget(row, at(0), 'ArrowLeft'), null, 'mũi tên KHÔNG quay vòng ở đầu hàng');
  // Tab thì CÓ quay vòng — đúng nếp gõ bảng tính.
  assert.equal(sheetNavigationTarget(row, at(2), 'Tab'), at(0), 'Tab ở cột cuối quay về cột đầu');
  assert.equal(sheetNavigationTarget(row, at(0), 'Tab', true), at(2), 'Shift+Tab ở cột đầu quay về cột cuối');
}

// ---- Di chuyển DỌC trong cùng một cột mức
{
  const column = sheetInputOrder([cell('2026-09-01', 1), cell('2026-09-02', 1), cell('2026-09-03', 1)]);
  const at = (i) => column[i];
  assert.equal(sheetNavigationTarget(column, at(0), 'ArrowDown'), at(1), 'mũi tên xuống sang ngày kế');
  assert.equal(sheetNavigationTarget(column, at(2), 'ArrowUp'), at(1), 'mũi tên lên lùi một ngày');
  assert.equal(sheetNavigationTarget(column, at(2), 'ArrowDown'), null, 'mũi tên KHÔNG quay vòng ở cuối cột');
  // Enter LUÔN xuống hàng dưới và quay vòng — "gõ rồi Enter" chạy liên tục
  // hết cột rồi lại về đầu, không dừng ở hàng cuối.
  assert.equal(sheetNavigationTarget(column, at(2), 'Enter'), at(0), 'Enter ở hàng cuối quay về hàng đầu');
  assert.equal(sheetNavigationTarget(column, at(0), 'Enter'), at(1), 'Enter giữa cột vẫn đi xuống');
}

// ---- Hai chiều KHÔNG lẫn vào nhau
{
  const grid = sheetInputOrder([
    cell('2026-09-01', 1), cell('2026-09-01', 2),
    cell('2026-09-02', 1), cell('2026-09-02', 2),
  ]);
  const firstDayLevel1 = grid[0];
  assert.equal(sheetNavigationTarget(grid, firstDayLevel1, 'ArrowRight').dataset.focusColumn, '2',
    'đi ngang phải ở nguyên NGÀY đó');
  assert.equal(sheetNavigationTarget(grid, firstDayLevel1, 'ArrowRight').dataset.focusDate, '2026-09-01',
    'đi ngang không được nhảy sang ngày khác');
  assert.equal(sheetNavigationTarget(grid, firstDayLevel1, 'ArrowDown').dataset.focusDate, '2026-09-02',
    'đi dọc sang ngày kế');
  assert.equal(sheetNavigationTarget(grid, firstDayLevel1, 'ArrowDown').dataset.focusColumn, '1',
    'đi dọc phải ở nguyên CỘT đó');
}

// ---- Ô không thuộc bảng thì không điều hướng
{
  const row = [cell('2026-09-01', 1), cell('2026-09-01', 2)];
  assert.equal(sheetNavigationTarget(row, cell('2026-09-09', 9), 'ArrowRight'), null, 'ô lạ không điều hướng');
  assert.equal(sheetNavigationTarget([], cell('2026-09-01', 1), 'Enter'), null, 'bảng rỗng không điều hướng');
  assert.equal(sheetNavigationTarget([row[0]], row[0], 'ArrowRight'), null, 'chỉ một ô thì không có đích');
}

// ---- Chọn ô để focus lại sau khi vẽ: ưu tiên ô CÒN TRỐNG
{
  const filled = cell('2026-09-01', 1);
  const empty = cell('2026-09-01', 1, { classes: ['empty'] });
  assert.equal(pickSheetFocusCandidate([filled, empty]), empty, 'ưu tiên ô còn trống dù nó đứng sau');
  assert.equal(pickSheetFocusCandidate([filled]), filled, 'không có ô trống thì lấy ô đầu');
  assert.equal(pickSheetFocusCandidate([]), null, 'không có ứng viên nào');
}

// ---- Chỉ nhận đúng bộ phím điều hướng
{
  for (const key of ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    assert.equal(isSheetNavigationKey(key), true, `${key} phải là phím điều hướng`);
  for (const key of ['a', 'Escape', 'Home', 'PageDown', ' '])
    assert.equal(isSheetNavigationKey(key), false, `${key} không được coi là phím điều hướng`);
}

console.log('app entry sheet navigation tests passed');


