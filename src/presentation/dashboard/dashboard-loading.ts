type Value = Record<string, any>;

export function createDashboardLoading(deps: { escape: (value: unknown) => string; topUserBox: () => string }) {
  return (tests: Value[], pending: number, data: Record<string, Value[]>, lab: Value) => {
    const points = (tests || []).reduce((sum, test) => sum + (data[test.id] || []).length, 0);
    const department = lab.dept ? ' · ' + deps.escape(lab.dept) : '';
    return `<div class="head"><div><h1>Bảng điều khiển</h1><p>${deps.escape(lab.name || 'Khoa Xét nghiệm')}${department}</p></div>${deps.topUserBox()}</div>
    <div class="dash-hero dash-analysis-loading">
      <div class="dash-status"><div class="eyebrow">Đang chuẩn bị dữ liệu</div><h2>Phân tích Westgard chạy nền</h2><p>Bạn có thể tiếp tục sử dụng ứng dụng. Bảng điều khiển sẽ tự cập nhật khi phân tích hoàn tất.</p><div class="dash-loading-bar"><span></span></div></div>
      <div class="dash-kpis"><div class="dash-kpi"><div class="k">Xét nghiệm</div><div class="v">${tests.length}</div></div><div class="dash-kpi"><div class="k">Điểm QC</div><div class="v">${points}</div></div><div class="dash-kpi"><div class="k">Đang xử lý</div><div class="v">${pending}</div></div><div class="dash-kpi"><div class="k">Giao diện</div><div class="v dash-ready-mark">✓</div></div></div>
    </div>
    <div class="panel dash-loading-panel"><div class="dash-spinner"></div><div><h2 class="panel-title">Đang tính trạng thái kiểm soát chất lượng</h2><p class="hint">Công việc nặng đã được chuyển khỏi luồng giao diện để thao tác không bị đóng băng.</p></div></div>`;
  };
}
