export function dashboardProgressHtml(completeTests: number, testCount: number, percent: number) {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return `<div class="dash-progress"><span style="width:${safePercent}%"></span></div><div class="hint flow-item">${completeTests}/${testCount || 0} xét nghiệm đã đủ QC hôm nay · ${safePercent}% hoàn tất</div>`;
}
