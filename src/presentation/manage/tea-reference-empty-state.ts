export function teaReferenceEmptyState(hasSearchQuery: boolean) {
  return hasSearchQuery
    ? { title: 'Không tìm thấy', description: 'Thử từ khóa khác.' }
    : { title: 'Chưa có bảng tham chiếu', description: 'Không có xét nghiệm nào.' };
}
