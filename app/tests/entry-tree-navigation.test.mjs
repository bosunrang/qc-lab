// Điều hướng bàn phím trong CÂY danh mục nội kiểm — logic THUẦN (chỉ đọc phím
// + `aria-expanded`), nên test thẳng trên `.ts` qua ESM type-stripping, cùng
// cách `entry-sheet-navigation.test.mjs` làm.
import assert from 'node:assert/strict';
import { entryTreeKeyCommand, treeNavigationTarget, isTreeNavigationKey } from '../renderer/lib/entry-tree-navigation.ts';

// ---- Enter/Space luôn là "kích hoạt nút đang focus"
{
  for (const expanded of ['true', 'false', null]) {
    assert.equal(entryTreeKeyCommand('Enter', expanded), 'toggle', 'Enter phải kích hoạt nút');
    assert.equal(entryTreeKeyCommand(' ', expanded), 'toggle', 'Space phải kích hoạt nút');
  }
}

// ---- Mũi tên trái/phải CHỈ có nghĩa khi nó đổi được trạng thái
{
  assert.equal(entryTreeKeyCommand('ArrowRight', 'false'), 'toggle', 'mũi tên phải MỞ nhóm đang đóng');
  assert.equal(entryTreeKeyCommand('ArrowLeft', 'true'), 'toggle', 'mũi tên trái ĐÓNG nhóm đang mở');
  // Đây là nửa dễ quên: nếu trả 'toggle' ở đây thì mũi tên phải trên một nhóm
  // ĐÃ MỞ sẽ đóng sập nó lại — ngược hẳn ý người dùng.
  assert.equal(entryTreeKeyCommand('ArrowRight', 'true'), null, 'mũi tên phải trên nhóm đã mở không làm gì');
  assert.equal(entryTreeKeyCommand('ArrowLeft', 'false'), null, 'mũi tên trái trên nhóm đã đóng không làm gì');
  // Nút LÁ (xét nghiệm) không có aria-expanded → trái/phải không đụng tới;
  // máy và nhóm lô đều có aria-expanded nên dùng cùng nhánh mở/đóng ở trên.
  assert.equal(entryTreeKeyCommand('ArrowRight', null), null, 'nút lá không mở-đóng được');
  assert.equal(entryTreeKeyCommand('ArrowLeft', null), null, 'nút lá không mở-đóng được');
}

// ---- Lên/xuống/Home/End là điều hướng; phím khác thì trả về cho trình duyệt
{
  for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End']) {
    assert.equal(entryTreeKeyCommand(key, null), 'navigate', key + ' phải là phím điều hướng');
    assert.equal(isTreeNavigationKey(key), true, key + ' phải nằm trong bộ phím điều hướng');
  }
  for (const key of ['a', 'Escape', 'Tab', 'PageDown', 'F2']) {
    assert.equal(entryTreeKeyCommand(key, 'true'), null, key + ' không được nuốt');
    assert.equal(isTreeNavigationKey(key), false, key + ' không phải phím điều hướng');
  }
  // Tab phải rơi xuống trình duyệt: đó là đường THOÁT khỏi cây sang bảng nhập.
  assert.equal(entryTreeKeyCommand('Tab', 'false'), null, 'Tab không được cây giữ lại');
}

// ---- Đích di chuyển trong danh sách nút đang thấy
{
  const nodes = ['may-a', 'nhom-1', 'glucose', 'ure'];
  assert.equal(treeNavigationTarget(nodes, 'nhom-1', 'ArrowDown'), 'glucose', 'xuống một nút');
  assert.equal(treeNavigationTarget(nodes, 'nhom-1', 'ArrowUp'), 'may-a', 'lên một nút');
  assert.equal(treeNavigationTarget(nodes, 'may-a', 'Home'), 'may-a', 'Home về nút đầu');
  assert.equal(treeNavigationTarget(nodes, 'may-a', 'End'), 'ure', 'End xuống nút cuối');
  // Quay vòng: cây dài hơn màn hình, dừng câm ở nút cuối làm người dùng tưởng
  // bàn phím hỏng.
  assert.equal(treeNavigationTarget(nodes, 'ure', 'ArrowDown'), 'may-a', 'xuống ở nút cuối quay về đầu');
  assert.equal(treeNavigationTarget(nodes, 'may-a', 'ArrowUp'), 'ure', 'lên ở nút đầu quay về cuối');
}

// ---- Nút lạ / danh sách rỗng thì không điều hướng
{
  assert.equal(treeNavigationTarget(['a', 'b'], 'khong-co', 'ArrowDown'), null, 'nút không thuộc cây');
  assert.equal(treeNavigationTarget([], 'a', 'ArrowDown'), null, 'cây rỗng');
  assert.equal(treeNavigationTarget(null, 'a', 'ArrowDown'), null, 'chưa có danh sách nút');
  // Một nút duy nhất: quay vòng về chính nó, không phải null — focus() lại
  // chính nó là vô hại, còn trả null sẽ khiến nhánh gọi tưởng có lỗi.
  assert.equal(treeNavigationTarget(['a'], 'a', 'ArrowDown'), 'a', 'một nút thì quay về chính nó');
}

console.log('app entry tree navigation tests passed');
