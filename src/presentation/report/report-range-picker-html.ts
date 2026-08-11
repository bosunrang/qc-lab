export function createReportRangePickerHtml(deps: { dateBox: (id: string, value: string, placeholder: string, attrs: string) => string }) {
  return (start: string, end: string) => `<div><label>Từ ngày</label>${deps.dateBox('rStartDate', start, '', 'onchange="reportRangeChanged()"')}</div><div><label>Đến ngày</label>${deps.dateBox('rEndDate', end, '', 'onchange="reportRangeChanged()"')}</div>`;
}
