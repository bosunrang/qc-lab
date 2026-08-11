export type ReportXlsxHeaderCell = { v: string; s: number };
export type ReportXlsxHeader = { rows: ReportXlsxHeaderCell[][]; merges: string[]; rowHeights: Record<number, number> };

export type ReportXlsxHeaderInput = {
  styles: { TITLE: number; SUB: number; LABEL: number; VAL: number };
  appName: string;
  appVersion: string;
  rules: string;
  labName: string;
  department: string;
  address: string;
  exportedAt: string;
  exportedBy: string;
  testName: string;
  testUnit: string;
  machine: string;
  range: string;
  tea: string | number;
  teaSource: string;
  teaReference: string;
  teaDocument: string;
  teaApprovedBy: string;
};

export function createReportXlsxHeader(input: ReportXlsxHeaderInput): ReportXlsxHeader {
  const S = (v: string, s: number): ReportXlsxHeaderCell => ({ v, s });
  const row = (l1: string, v1: string, l2: string, v2: string) => [S(l1, input.styles.LABEL), S('', input.styles.LABEL), S(v1, input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S(l2, input.styles.LABEL), S('', input.styles.LABEL), S(v2, input.styles.VAL), S('', input.styles.VAL)];
  const wide = (label: string, value: string) => [S(label, input.styles.LABEL), S('', input.styles.LABEL), S(value, input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL)];
  const brand = (input.labName || 'BỆNH VIỆN / ĐƠN VỊ') + ' · ' + (input.department || 'Khoa Xét nghiệm') + (input.address ? ' · ' + input.address : '') + '   ·   Xuất ' + input.exportedAt + ' · Người xuất: ' + input.exportedBy;
  const teaSource = input.teaSource + (input.teaReference ? ' · ' + input.teaReference : '') + (input.teaDocument ? ' · ' + input.teaDocument : '') + (input.teaApprovedBy ? ' · duyệt ' + input.teaApprovedBy : '');
  const rows = [
    [S('BÁO CÁO NỘI KIỂM CHẤT LƯỢNG XÉT NGHIỆM', input.styles.TITLE)],
    [S(brand, input.styles.SUB)],
    [],
    row('Phiên bản app', (input.appName || 'QC Lab') + ' ' + (input.appVersion || 'dev'), 'Bộ luật áp dụng', input.rules || 'Chưa cấu hình'),
    row('Xét nghiệm', input.testName + (input.testUnit ? ' · ' + input.testUnit : ''), 'Máy', input.machine),
    row('Khoảng ngày', input.range, 'TEa%', String(input.tea || '—')),
    wide('Nguồn TEa', teaSource),
    wide('Ghi chú Sigma', 'Sigma (kỳ) tính từ Mean/CV thực tế trong đúng khoảng ngày báo cáo này, khác với Sigma đã thẩm định ở trang Six Sigma & Sai số. Dấu * nghĩa là kỳ có n < 20 kết quả, CV/Sigma chưa đủ ổn định.'),
  ];
  return {
    rows,
    merges: ['A1:J1', 'A2:J2', 'A4:B4', 'C4:F4', 'G4:H4', 'I4:J4', 'A5:B5', 'C5:F5', 'G5:H5', 'I5:J5', 'A6:B6', 'C6:F6', 'G6:H6', 'I6:J6', 'A7:B7', 'C7:J7', 'A8:B8', 'C8:J8'],
    rowHeights: { 1: 24, 2: brand.length > 120 ? 29 : 15, 4: 21, 5: 21, 6: 21, 7: Math.min(54, 18 + Math.ceil(teaSource.length / 110) * 12), 8: Math.min(54, 18 + Math.ceil(rows[7][2].v.length / 110) * 12) },
  };
}
