export function createActionReportHtml(escape:(value:any)=>string) {
  const summary = (parts:[any,any][]) => '<div class="nce-summary">' + parts.map(([label,text]) => '<div><b>' + escape(label) + ':</b> ' + escape(text) + '</div>').join('') + '</div>';
  const detailField = (label:any, value:any, wide=false) => '<div' + (wide ? ' class="nce-detail-wide"' : '') + '><span>' + escape(label) + '</span><b>' + escape(value || '—') + '</b></div>';
  return Object.freeze({ summary, detailField });
}
