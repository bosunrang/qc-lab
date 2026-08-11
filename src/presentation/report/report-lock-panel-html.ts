export function createReportLockPanelHtml(deps: {
  button: (label: string, action: string, variant: string, title?: string, options?: unknown) => string;
}) {
  return (input: { isAdmin: boolean; year: number; month: number; months: number[]; years: number[]; already: boolean; lockListHtml: string }) => {
    const monthOptions = input.months.map(month => `<option value="${month}" ${input.month === month ? 'selected' : ''}>Tháng ${month}</option>`).join('');
    const yearOptions = input.years.map(year => `<option value="${year}" ${input.year === year ? 'selected' : ''}>${year}</option>`).join('');
    const action = input.isAdmin
      ? (input.already ? deps.button('Kỳ này đã khóa', '', 'ghost', '', { disabled: true }) : deps.button('Khóa kỳ này', 'reportLockPeriod()', 'teal'))
      : '<span class="hint">Chỉ admin mới khóa/mở khóa được kỳ báo cáo.</span>';
    return `<div class="panel"><h2 class="panel-title">Khóa kỳ báo cáo</h2>
     <div class="hint">Khóa 1 kỳ (theo tháng) sẽ chặn sửa/hủy điểm QC của kỳ đó ở <b>mọi xét nghiệm</b> — nên làm sau khi đã xuất xong báo cáo chính thức của kỳ.</div>
     <div class="report-lock-controls">
       <div><label>Tháng</label><select aria-label="Tháng" ${input.isAdmin ? '' : 'disabled'} onchange="reportSetLockPart('month',this.value)">${monthOptions}</select></div>
       <div><label>Năm</label><select aria-label="Năm" ${input.isAdmin ? '' : 'disabled'} onchange="reportSetLockPart('year',this.value)">${yearOptions}</select></div>
       <div style="align-self:end">${action}</div>
     </div>
     <div class="flow-panel">${input.lockListHtml}</div>
   </div>`;
  };
}
