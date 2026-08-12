type ActivityAuditPageHtmlInput = {
  head: string;
  exportButton: string;
  archiveButton: string;
  total: number;
  chainHtml: string;
  oversizeWarn: string;
  searchValue: string;
  fromDate: string;
  toDate: string;
  pageSizeOptions: string;
  clearFiltersButton: string;
  filteredCount: number;
  rowsOrEmptyState: string;
  pagination: string;
};

export function createActivityAuditPageHtml() {
  return (input: ActivityAuditPageHtmlInput) => `${input.head}
    <div class="panel"><h2 class="panel-title">Công cụ</h2><div class="row-flex">
      ${input.exportButton}
      ${input.archiveButton}
      <div class="hint audit-summary-status">${input.total} dòng hoạt động đã ghi nhận. ${input.chainHtml}${input.oversizeWarn}</div>
    </div></div>
    <div class="panel audit-log-panel"><div class="audit-log-head"><h2 class="panel-title">Hoạt động gần đây</h2><input id="auditSearch" type="search" aria-label="Tìm nhật ký hoạt động" placeholder="Tìm người dùng, hành động, đối tượng..." value="${input.searchValue}" oninput="auditSetQuery(this.value)"></div>
      <div class="audit-filterbar"><div><label>Từ ngày</label>${input.fromDate}</div><div><label>Đến ngày</label>${input.toDate}</div><div><label>Số dòng mỗi trang</label><select aria-label="Số dòng nhật ký mỗi trang" onchange="auditSetPageSize(this.value)">${input.pageSizeOptions}</select></div>${input.clearFiltersButton}<div class="audit-filter-summary" role="status">${input.filteredCount}/${input.total} dòng</div></div>
      ${input.rowsOrEmptyState}
      ${input.pagination}</div>`;
}
