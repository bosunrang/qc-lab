export type ReportHeaderInput = {
  title: string;
  subtitle?: string;
  lab?: Record<string, any>;
  app?: Record<string, any>;
  westgardRules?: Record<string, unknown>;
  exportedAt: string;
  exportedBy: string;
  escape: (value: unknown) => string;
};

export function reportHeaderPresentation(input: ReportHeaderInput) {
  const esc = input.escape;
  const lab = input.lab || {};
  const app = input.app || { version: 'dev' };
  const rules = Object.entries(input.westgardRules || {}).filter(([, enabled]) => enabled !== false).map(([id]) => id).join(', ');
  const subtitle = input.subtitle || 'Nội kiểm chất lượng xét nghiệm';
  return '<div class="rpt-head">' +
    '<div class="rpt-brand"><div><div class="rpt-hosp">' + esc(lab.name || 'BỆNH VIỆN / ĐƠN VỊ') + '</div><div class="rpt-dept">' + esc(lab.dept || 'Khoa Xét nghiệm') + '</div><div class="rpt-addr">' + esc(lab.address || '') + '</div></div></div>' +
    '<div class="rpt-meta"><b>Thời gian xuất</b><span>' + input.exportedAt + '</span><b class="rpt-meta-label">Người xuất</b><span>' + esc(input.exportedBy) + '</span></div></div>' +
    '<table class="meta-table"><tr><th>Phiên bản app</th><td>' + esc((app.name || 'QC Lab') + ' ' + (app.version || 'dev')) + '</td><th>Bộ luật áp dụng</th><td>' + esc(rules || 'Chưa cấu hình') + '</td></tr></table>' +
    '<div class="rpt-title"><div>' + input.title + '</div><span>' + esc(subtitle) + '</span></div>';
}
