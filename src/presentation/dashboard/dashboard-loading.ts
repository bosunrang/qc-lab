type Value = Record<string, any>;

export function createDashboardLoading(deps: { headHtml: (lab: Value) => string; kpisHtml: (items: any[]) => string }) {
  return (tests: Value[], pending: number, data: Record<string, Value[]>, lab: Value) => {
    const points = (tests || []).reduce((sum, test) => sum + (data[test.id] || []).length, 0);
    return `${deps.headHtml(lab)}
    <div class="dash-hero dash-analysis-loading">
      <div class="dash-status"><div class="eyebrow">Đang chuẩn bị dữ liệu</div><h2>Phân tích Westgard chạy nền</h2><p>Bạn có thể tiếp tục sử dụng ứng dụng. Bảng điều khiển sẽ tự cập nhật khi phân tích hoàn tất.</p><div class="dash-loading-bar"><span></span></div></div>
      ${deps.kpisHtml([{label:'Xét nghiệm',value:tests.length},{label:'Điểm QC',value:points},{label:'Đang xử lý',value:pending},{label:'Giao diện',value:'✓',className:'dash-ready-mark'}])}
    </div>
    <div class="panel dash-loading-panel"><div class="dash-spinner"></div><div><h2 class="panel-title">Đang tính trạng thái kiểm soát chất lượng</h2><p class="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div></div>`;
  };
}
