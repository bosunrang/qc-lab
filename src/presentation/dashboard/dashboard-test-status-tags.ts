export const dashboardTestStatusTags = Object.freeze({
  westgard(status: string) {
    if (status === 'rej') return '<span class="tag rej">Loại bỏ</span>';
    if (status === 'warn') return '<span class="tag warn">Cảnh báo</span>';
    if (status === 'ok') return '<span class="tag ok">Đạt</span>';
    return '<span class="pill">chưa có</span>';
  },
  today(todayCount: number, levelCount: number) {
    if (todayCount >= levelCount && levelCount) return '<span class="tag ok">Đủ hôm nay</span>';
    if (todayCount) return `<span class="tag warn">${todayCount}/${levelCount} mức</span>`;
    return '<span class="tag none">Chưa QC</span>';
  },
});
