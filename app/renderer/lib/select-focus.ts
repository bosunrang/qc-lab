/** Phân biệt thao tác chuột/bàn phím cho vòng focus của danh sách xổ xuống. */
export function installSelectFocusHandling(): void {
  const root = document.documentElement;
  // Chromium có thể tự gán :focus-visible cho option khi mở bằng chuột.
  // Ghi nhận trước thao tác mặc định để lần mở đầu cũng có kiểu nhất quán.
  document.addEventListener('pointerdown', () => {
    root.dataset.selectFocus = 'pointer';
  }, true);
  document.addEventListener('keydown', (event) => {
    // Phím bổ trợ đứng riêng chưa phải thao tác điều hướng danh sách.
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    delete root.dataset.selectFocus;
  }, true);
}
