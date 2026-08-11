type TestLike = Record<string, any>;

export function createReportPageHtml(deps: {
  head: (title: string, subtitle: string) => string;
  empty: (title: string, message: string, action?: string) => string;
  button: (label: string, action: string, variant: string, title?: string, options?: unknown) => string;
  escape: (value: unknown) => string;
  escapeAttr: (value: unknown) => string;
  label: (test: TestLike, tests: TestLike[]) => string;
  rangePicker: (start: string, end: string) => string;
  actionIcon: (type: string) => string;
}) {
  return (input: { tests: TestLike[]; matched: TestLike[]; selectedId: string; query: string; start: string; end: string; isAdmin: boolean; lockPanelHtml: string }) => {
    if (!input.tests.length) return deps.head('Báo cáo & Biểu mẫu', '') + `<div class="panel">${deps.empty('Chưa có xét nghiệm đang vận hành', 'Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.', input.isAdmin ? deps.button('Cấu hình Mean/SD', "go('manage');setManageTab('targets')", 'teal') : '')}</div>${input.lockPanelHtml}`;
    const options = input.matched.length ? input.matched.map(test => `<option value="${deps.escapeAttr(test.id)}" ${test.id === input.selectedId ? 'selected' : ''}>${deps.escape(deps.label(test, input.tests))}</option>`).join('') : '<option value="">Không tìm thấy xét nghiệm phù hợp</option>';
    const disabled = !input.matched.length;
    const actionOptions = { disabled, attrs: { 'data-report-action': '' } };
    return deps.head('Báo cáo & Biểu mẫu', 'Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn') +
      `<div class="panel"><h2 class="panel-title">Báo cáo nội kiểm theo ngày</h2>
       <div class="grid4"><div><label>Tìm xét nghiệm</label><input id="reportSearch" type="search" placeholder="Tìm tên xét nghiệm" value="${deps.escapeAttr(input.query)}" oninput="reportSearchSet(this.value)"></div>
         <div><label>Xét nghiệm <span id="reportTestCount" class="hint">(${input.matched.length}/${input.tests.length})</span></label><select id="rTest" aria-label="Xét nghiệm" ${input.matched.length ? '' : 'disabled'} onchange="reportTest=this.value">${options}</select></div>
         ${deps.rangePicker(input.start, input.end)}</div>
       <div class="report-export-options"><label class="report-nce-option"><input id="reportNceAppendix" type="checkbox" checked><span><b>Kèm phụ lục NCE</b><small>(Áp dụng cho PDF và Excel)</small></span></label></div>
       <div class="report-actions">${deps.button(deps.actionIcon('print') + 'Tạo báo cáo &amp; In', 'printReport()', 'teal', '', actionOptions)}${deps.button('Xuất Excel', 'exportReportXLSX()', 'teal', '', actionOptions)}${deps.button('Xuất CSV', 'exportReportCSV()', 'teal', '', actionOptions)}</div>
     </div>${input.lockPanelHtml}`;
  };
}
