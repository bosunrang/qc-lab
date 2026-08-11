export type WestgardXlsxHeaderCell = { v: string; s: number };
export type WestgardXlsxHeader = { rows: WestgardXlsxHeaderCell[][]; merges: string[]; rowHeights: Record<number, number> };

export function createWestgardXlsxHeader(input: {
  styles: { TITLE: number; SUB: number; LABEL: number; VAL: number };
  title: string; labName: string; department: string; address: string; exportedAt: string; exportedBy: string;
  testName: string; testUnit: string; machine: string; appName: string; appVersion: string; withinRules: string; acrossRules: string;
}): WestgardXlsxHeader {
  const S = (v: string, s: number): WestgardXlsxHeaderCell => ({ v, s });
  const pair = (l1: string, v1: string, l2: string, v2: string) => [S(l1, input.styles.LABEL), S('', input.styles.LABEL), S(v1, input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S(l2, input.styles.LABEL), S('', input.styles.LABEL), S(v2, input.styles.VAL), S('', input.styles.VAL)];
  const wide = (label: string, value: string) => [S(label, input.styles.LABEL), S('', input.styles.LABEL), S(value, input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL), S('', input.styles.VAL)];
  const brand = (input.labName || 'BỆNH VIỆN / ĐƠN VỊ') + ' · ' + (input.department || 'Khoa Xét nghiệm') + (input.address ? ' · ' + input.address : '') + '   ·   Xuất ' + input.exportedAt + ' · Người xuất: ' + input.exportedBy;
  const rows = [
    [S(input.title, input.styles.TITLE)], [S(brand, input.styles.SUB)], [],
    pair('Xét nghiệm', input.testName + (input.testUnit ? ' · ' + input.testUnit : ''), 'Thiết bị', input.machine),
    pair('Phiên bản app', (input.appName || 'QC Lab') + ' ' + (input.appVersion || 'dev'), 'Phạm vi', 'Lô/mức đang xem'),
    wide('Luật theo từng mức', input.withinRules || 'Không có'), wide('Luật liên mức / lần chạy', input.acrossRules || 'Không có'),
    wide('Dữ liệu chi tiết', 'Chỉ gồm điểm cảnh báo/loại và điểm lịch sử cấu thành quy tắc; các điểm QC bình thường không được xuất.'),
  ];
  return { rows, merges: ['A1:I1', 'A2:I2', 'A4:B4', 'C4:E4', 'F4:G4', 'H4:I4', 'A5:B5', 'C5:E5', 'F5:G5', 'H5:I5', 'A6:B6', 'C6:I6', 'A7:B7', 'C7:I7', 'A8:B8', 'C8:I8'], rowHeights: { 1: 24, 2: brand.length > 115 ? 29 : 15, 4: 21, 5: 21, 6: Math.min(48, 18 + Math.ceil(rows[5][2].v.length / 105) * 12), 7: Math.min(48, 18 + Math.ceil(rows[6][2].v.length / 105) * 12), 8: Math.min(48, 18 + Math.ceil(rows[7][2].v.length / 105) * 12) } };
}
