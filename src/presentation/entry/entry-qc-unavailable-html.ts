export function entryQcUnavailableHtml(commit = false) {
  const message = commit
    ? 'Không thể lưu: nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.'
    : 'Nhóm lô đã dừng hoặc không còn sẵn sàng nhập QC.';
  return `<div class="alert warn">${message}</div>`;
}
