// Đọc báo cáo ngoại kiểm dạng PDF. Hiện hỗ trợ:
//   - VEQAS của Trung tâm Kiểm chuẩn Xét nghiệm TP.HCM;
//   - RIQAS Monthly Clinical Chemistry của Randox.
// Hàm thuần: renderer trích chữ kèm toạ độ bằng pdf.js rồi gọi
// `parseEqaPdfReport`; main vẫn kiểm lại toàn bộ khi xem trước và khi ghi qua
// cổng nghiệp vụ `checkEqaImport`.
//
// Bố cục một báo cáo (một đơn vị × một nhóm thiết bị × một đợt):
//   - trang bìa: mã đơn vị, tên nhóm thiết bị, chương trình, mã chương trình,
//     đợt, mã vạch báo cáo;
//   - mỗi thông số một trang: tiêu đề "THÔNG SỐ: Tên (MÃ) đơn vị", bảng nhóm
//     so sánh (Tất cả phương pháp / nhóm phương pháp / nhóm thiết bị: N, giá
//     trị ấn định, SD, %CV, số KQ loại), rồi Kết quả đơn vị, Giá trị ấn định
//     so sánh, σp, z-score;
//   - trang tổng hợp: mỗi thông số một dòng (mã, đơn vị, kết quả, giá trị ấn
//     định, σp, z) — dùng để đối chiếu, lệch trang chi tiết là lỗi chặn.
// Báo cáo không ghi năm: lấy theo ngày tạo file PDF và cho người dùng sửa.
import { eqaAssignedLevel, eqaFold, eqaSameValue, type EqaPeer, type EqaPeerLevel, type EqaPeerStats } from './evaluation';
import type { EqaParsedSource, EqaRowInput } from './import';

export interface EqaPdfTextItem { str: string; x: number; y: number }
export interface EqaPdfDocument {
  fileName: string;
  /** Chữ của từng trang, toạ độ PDF (y tăng lên trên). */
  pages: readonly (readonly EqaPdfTextItem[])[];
  /** Ngày tạo file `YYYY-MM-DD` (siêu dữ liệu PDF), rỗng nếu không có. */
  creationDate: string;
}

export interface EqaPdfReport extends EqaParsedSource {
  fileName: string;
  /** Nhóm thiết bị đồng đẳng ghi trên báo cáo (không phải tên máy của PXN). */
  instrumentGroup: string;
  /** VEQAS: mỗi tệp là một mẫu nhưng nội dung báo cáo không ghi mã mẫu, chỉ tên
   * tệp gốc của trung tâm có (dạng `_09-01_`). Người dùng kiểm/sửa mã mẫu khi
   * nhập để hai mẫu cùng máy không ghi đè nhau (rà soát 17/11/2026, S3). */
  samplePerFile?: boolean;
}

interface Line { y: number; items: EqaPdfTextItem[]; text: string }

/** Bỏ dấu, chữ thường, gộp khoảng trắng — để so nhãn cố định của báo cáo
 * (báo cáo có chỗ gõ thiếu dấu như "Tât cả phương pháp"). */
const fold = (value: string) => eqaFold(value).replace(/\s+/g, ' ').trim();

/** Gom chữ cùng hàng (lệch y ≤ 3 điểm) thành dòng, trên xuống dưới, trái sang phải. */
function linesOf(items: readonly EqaPdfTextItem[]): Line[] {
  const rows: { y: number; items: EqaPdfTextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) <= 3);
    if (row) row.items.push(item); else rows.push({ y: item.y, items: [item] });
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => {
    const sorted = row.items.sort((a, b) => a.x - b.x);
    return { y: row.y, items: sorted, text: sorted.map((i) => i.str.trim()).join(' ') };
  });
}

/** Số trong báo cáo: dấu chấm thập phân; chấp nhận dấu phẩy thập phân nếu
 * không có dấu chấm, và dấu phẩy phân nghìn khi có cả hai. */
function reportNumber(value: string | undefined): number | null {
  let raw = String(value ?? '').replace(/\s+/g, '').replace('−', '-');
  if (!raw) return null;
  if (raw.includes(',') && raw.includes('.')) raw = raw.replace(/,/g, '');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Tách đuôi số của một dòng: pdf.js có thể gộp hoặc tách các đoạn chữ tuỳ
 * khoảng cách trong file, nên đọc theo từ của cả dòng thay vì theo mục chữ.
 * `count` giới hạn số lấy từ cuối; phần còn lại là nhãn. */
function splitTrailingNumbers(text: string, count = Infinity): { label: string; nums: number[] } {
  const tokens = text.trim().split(/\s+/);
  const nums: number[] = [];
  while (tokens.length && nums.length < count) {
    const n = reportNumber(tokens[tokens.length - 1]);
    if (n === null) break;
    nums.unshift(n);
    tokens.pop();
  }
  return { label: tokens.join(' '), nums };
}

/** Nhãn ở đầu dòng ("Kết quả đơn vị:", "σp", "z-score") có khớp không. */
const startsWithLabel = (line: Line, label: string) => fold(line.text).startsWith(fold(label));

/** Bỏ phần "Mã đơn vị: 10026" ở cuối dòng tiêu đề thông số. So theo từ đã bỏ
 * dấu vì pdf.js có thể trả dấu tiếng Việt ở dạng tổ hợp. */
function withoutUnitCode(text: string): string {
  const tokens = text.trim().split(/\s+/);
  const at = tokens.findIndex((token, i) => fold(token) === 'ma' && fold(tokens[i + 1] ?? '') === 'don' && fold(tokens[i + 2] ?? '').startsWith('vi'));
  return (at < 0 ? tokens : tokens.slice(0, at)).join(' ');
}

/** Giá trị đứng sau một nhãn trên cùng dòng ("Mã đơn vị: 10026", "Đợt: 09"). */
function valueAfter(lines: readonly Line[], label: string): string {
  const key = fold(label);
  for (const line of lines) {
    const i = line.items.findIndex((item) => fold(item.str).startsWith(key));
    if (i < 0) continue;
    const inline = line.items[i].str.slice(line.items[i].str.indexOf(':') + 1).trim();
    if (line.items[i].str.includes(':') && inline) return inline;
    const next = line.items[i + 1];
    if (next) return next.str.trim();
  }
  return '';
}

/** "Alanine Aminotransferase (ALT (GPT)) U/L" → tên, mã "ALT (GPT)", đơn vị "U/L".
 * Mã là cụm ngoặc CUỐI (cân ngoặc), đơn vị là phần sau nó. */
export function splitVeqasTitle(title: string): { name: string; code: string; unit: string } {
  const text = title.trim();
  const close = text.lastIndexOf(')');
  if (close < 0) return { name: text, code: text, unit: '' };
  let depth = 0, open = -1;
  for (let i = close; i >= 0; i--) {
    if (text[i] === ')') depth++;
    else if (text[i] === '(' && --depth === 0) { open = i; break; }
  }
  if (open < 0) return { name: text, code: text, unit: '' };
  return { name: text.slice(0, open).trim(), code: text.slice(open + 1, close).trim(), unit: text.slice(close + 1).trim() };
}

const ASSIGNED_LEVEL_TEXT: Readonly<Record<EqaPeerLevel, string>> = { all: 'Tất cả phương pháp', method: 'Nhóm phương pháp', instrument: 'Nhóm thiết bị' };

interface DetailRow { page: number; name: string; code: string; unit: string; result: number | null; assigned: number | null; sigmaP: number | null; z: number | null; peer: EqaPeer; methodGroup: string; level: EqaPeerLevel | null }

/** Ghép phần chữ nằm trong một vùng ngang. Báo cáo RIQAS đặt nhãn trục biểu
 * đồ cùng hàng với bảng, nên cần giới hạn vùng thay vì đọc cả dòng. */
function textInRange(line: Line, minX: number, maxX: number): string {
  return line.items.filter((item) => item.x >= minX && item.x <= maxX).map((item) => item.str.trim()).filter(Boolean).join(' ');
}

/** Ngày RIQAS `dd/mm/yyyy` → `yyyy-mm-dd`. */
function dateFromDmy(value: string): string {
  const match = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/** Đọc một trang thông số; `null` nếu trang không phải trang thông số. */
function parseDetailPage(lines: readonly Line[], page: number, instrumentGroup: string): DetailRow | { page: number; error: string } | null {
  const titleLine = lines.find((line) => startsWithLabel(line, 'thong so:'));
  if (!titleLine) return null;
  const title = withoutUnitCode(titleLine.text.slice(titleLine.text.indexOf(':') + 1));
  const { name, code, unit } = splitVeqasTitle(title);
  const at = (label: string) => {
    const line = lines.find((l) => startsWithLabel(l, label));
    return line ? splitTrailingNumbers(line.text, 1).nums[0] ?? null : null;
  };
  const result = at('Kết quả đơn vị'), assigned = at('Giá trị ấn định so sánh'), sigmaP = at('σp'), z = at('z-score');
  if (result === null || assigned === null || sigmaP === null) return { page, error: `trang ${page} (${code || 'không rõ mã'}): không đọc được kết quả, giá trị ấn định hoặc σp` };

  // Bảng nhóm so sánh: các dòng giữa tiêu đề cột "N … Số KQ loại" và "Kết quả đơn vị".
  const head = lines.findIndex((l) => /so kq loai/.test(fold(l.text)));
  const end = lines.findIndex((l) => startsWithLabel(l, 'ket qua don vi'));
  const peer: EqaPeer = {};
  let methodGroup = '';
  if (head >= 0 && end > head) {
    // Mỗi dòng: tên nhóm, rồi N, giá trị ấn định, SD, %CV, số KQ loại. Chỉ lấy
    // đúng 5 số cuối để tên nhóm có số (ví dụ "AU 680") không bị ăn mất.
    const rows = lines.slice(head + 1, end).map((line) => splitTrailingNumbers(line.text, 5))
      .filter((row) => row.label && row.nums.length >= 4);
    rows.forEach((row, index) => {
      const folded = fold(row.label);
      const level: EqaPeerLevel = folded.startsWith('tat ca') ? 'all'
        : folded === fold(instrumentGroup) || index === rows.length - 1 ? 'instrument' : 'method';
      const [n, mean, sd, cv] = row.nums;
      peer[level] = { n, mean, sd, cv } satisfies EqaPeerStats;
      if (level === 'method') methodGroup = row.label;
    });
  }
  return { page, name, code, unit, result, assigned, sigmaP, z, peer, methodGroup, level: eqaAssignedLevel(peer, assigned) };
}

/** Bảng tổng hợp: mã → [kết quả, giá trị ấn định, σp, z]. */
function parseSummary(lines: readonly Line[]): Map<string, number[]> | null {
  const head = lines.findIndex((l) => { const t = fold(l.text); return t.startsWith('thong so') && t.includes('don vi do') && t.includes('z-score'); });
  if (head < 0) return null;
  const out = new Map<string, number[]>();
  for (const line of lines.slice(head + 1)) {
    // Mã, đơn vị đo, kết quả, giá trị ấn định, σp, z: đơn vị là từ cuối của phần nhãn.
    const { label, nums } = splitTrailingNumbers(line.text, 4);
    if (nums.length < 4 || !label) continue;
    const code = label.split(/\s+/).slice(0, -1).join(' ') || label;
    out.set(fold(code).replace(/[^a-z0-9]/g, ''), nums);
  }
  return out;
}

/** Đọc một báo cáo PDF. Hàng trả về mang `instrument` = nhóm thiết bị của báo
 * cáo; renderer thay bằng máy của PXN mà người dùng chọn trước khi gửi main. */
export function parseVeqasReport(doc: EqaPdfDocument): EqaPdfReport {
  const pages = doc.pages.map(linesOf);
  const all = pages.flat();
  const errors: string[] = [];
  const warnings: string[] = [];
  const cover = pages[0] ?? [];

  // Tiêu đề lặp ở mỗi trang thông số: "CHƯƠNG TRÌNH … - MÃ CHƯƠNG TRÌNH:BC20C - ĐỢT 09".
  const header = all.find((line) => /ma chuong trinh\s*:/.test(fold(line.text)) && /dot\s*\d+/.test(fold(line.text)))?.text ?? '';
  const headerMatch = header.match(/^(.*?)\s*-\s*MÃ CHƯƠNG TRÌNH\s*:\s*([^\s-]+)\s*-\s*(ĐỢT\s*\d+)/i);
  const roundNo = (headerMatch?.[3] ?? '').match(/\d+/)?.[0] || valueAfter(cover, 'Đợt').match(/\d+/)?.[0] || '';
  const program = (headerMatch?.[1] ?? '').trim() || (valueAfter(cover, 'Chương trình ngoại kiểm tra') ? `CHƯƠNG TRÌNH NGOẠI KIỂM TRA ${valueAfter(cover, 'Chương trình ngoại kiểm tra').toUpperCase()}` : '');
  const programCode = (headerMatch?.[2] ?? '').trim() || valueAfter(cover, 'Mã chương trình');
  const unitCode = valueAfter(all, 'Mã đơn vị').replace(/\D+/g, '');
  const provider = all.find((line) => /^trung tam kiem chuan xet nghiem/.test(fold(line.text)))?.text ?? '';
  const reportCode = cover.find((line) => /^\d{8,}$/.test(line.text.replace(/\s+/g, '')))?.text.replace(/\s+/g, '') ?? '';
  // Tên nhóm thiết bị: dòng ngay dưới "Mã đơn vị" ở trang bìa.
  const unitLine = cover.findIndex((line) => fold(line.text).startsWith('ma don vi'));
  const instrumentGroup = unitLine >= 0 ? cover[unitLine + 1]?.text.trim() ?? '' : '';

  const details: DetailRow[] = [];
  pages.forEach((lines, index) => {
    const parsed = parseDetailPage(lines, index + 1, instrumentGroup);
    if (!parsed) return;
    if ('error' in parsed) errors.push(`${doc.fileName}: ${parsed.error}.`);
    else details.push(parsed);
  });
  if (!details.length) errors.push(`${doc.fileName}: không tìm thấy trang thông số nào — file không phải bản phân tích kết quả ngoại kiểm của TTKCXN TP.HCM.`);

  // Đối chiếu trang tổng hợp: lệch là lỗi chặn (đọc nhầm cột hoặc báo cáo sai).
  const summary = pages.map(parseSummary).find((s) => s && s.size) ?? null;
  if (!summary) warnings.push(`${doc.fileName}: không có trang tổng hợp để đối chiếu.`);
  else {
    const seen = new Set<string>();
    for (const row of details) {
      const key = fold(row.code).replace(/[^a-z0-9]/g, '');
      seen.add(key);
      const values = summary.get(key);
      if (!values) { errors.push(`${doc.fileName}: thông số ${row.code} (trang ${row.page}) không có trong trang tổng hợp.`); continue; }
      const [result, assigned, sigmaP, z] = values;
      if (!eqaSameValue(row.result, result) || !eqaSameValue(row.assigned, assigned) || !eqaSameValue(row.sigmaP, sigmaP) || (row.z !== null && !eqaSameValue(row.z, z))) {
        errors.push(`${doc.fileName}: thông số ${row.code} — số liệu trang ${row.page} khác trang tổng hợp.`);
      }
    }
    for (const key of summary.keys()) if (!seen.has(key)) errors.push(`${doc.fileName}: trang tổng hợp có thông số "${key}" nhưng không có trang chi tiết.`);
  }

  const levels = new Set(details.map((row) => row.level));
  const assignedLevel = levels.size === 1 && details[0]?.level ? ASSIGNED_LEVEL_TEXT[details[0].level] : levels.size > 1 ? 'Theo từng thông số' : '';
  if (details.some((row) => row.level === null)) warnings.push(`${doc.fileName}: có thông số mà giá trị ấn định so sánh không trùng nhóm nào trong bảng so sánh.`);
  const year = doc.creationDate ? Number(doc.creationDate.slice(0, 4)) : null;
  if (year) warnings.push(`Báo cáo không ghi năm: năm ${year} lấy theo ngày tạo file PDF (${doc.creationDate.split('-').reverse().join('/')}). Sửa lại nếu báo cáo thuộc năm khác.`);
  else errors.push(`${doc.fileName}: không xác định được năm của báo cáo; nhập năm trước khi ghi.`);
  const sample = doc.fileName.match(/_(\d{1,3}-\d{1,3})_/)?.[1] ?? '';

  const rows: EqaRowInput[] = details.map((row) => ({
    ref: `${doc.fileName} · trang ${row.page}`, code: row.code, instrument: instrumentGroup, sample, unit: row.unit,
    result: row.result, assigned: row.assigned, sigmaP: row.sigmaP, zProvider: row.z,
    method: row.methodGroup, peerGroup: instrumentGroup, peer: row.peer,
  }));
  return {
    fileName: doc.fileName, instrumentGroup, samplePerFile: true,
    round: {
      program, provider, programCode, unitCode, year: year && year >= 2000 ? year : null, round: roundNo ? `ĐỢT ${roundNo.padStart(2, '0')}` : '',
      reportCode, reportDate: doc.creationDate, assignedLevel,
    },
    rows, errors, warnings,
  };
}

interface RiqasDetailRow extends DetailRow { peerGroup: string }

/** Đọc một trang kết quả RIQAS. Bảng thống kê nằm trong vùng x < 330; phần
 * ngoài vùng này là nhãn trục biểu đồ và không phải dữ liệu bảng. */
function parseRiqasDetailPage(lines: readonly Line[], page: number): RiqasDetailRow | { page: number; error: string } | null {
  const head = lines.findIndex((line) => {
    const text = fold(textInRange(line, 0, 330));
    return text.startsWith('n mean cv%') && text.includes('sdpa');
  });
  if (head < 0) return null;

  const titleLine = lines.slice(0, head).reverse().find((line) => textInRange(line, 0, 160).includes(','));
  const title = titleLine ? textInRange(titleLine, 0, 160).replace(/\0/g, '').trim() : '';
  const comma = title.lastIndexOf(',');
  const name = comma >= 0 ? title.slice(0, comma).trim() : title;
  const unit = comma >= 0 ? title.slice(comma + 1).trim() : '';
  const code = name;
  if (!code) return { page, error: `trang ${page}: không đọc được tên thông số` };

  const resultLine = lines.find((line) => startsWithLabel(line, 'Your Result'));
  const assignedLine = lines.find((line) => startsWithLabel(line, 'Mean for Comparison')
    && /Mean for Comparison\s+-?[\d.,]+/i.test(textInRange(line, 0, 330)));
  const resultText = resultLine ? textInRange(resultLine, 0, 330) : '';
  const assignedText = assignedLine ? textInRange(assignedLine, 0, 330) : '';
  const resultMatch = resultText.match(/Your Result\s+(-?[\d.,]+)\s+SDI\s+(-?[\d.,]+)/i);
  const assignedMatch = assignedText.match(/Mean for Comparison\s+(-?[\d.,]+)/i);
  const result = reportNumber(resultMatch?.[1]);
  const z = reportNumber(resultMatch?.[2]);
  const assigned = reportNumber(assignedMatch?.[1]);
  if (result === null || assigned === null || z === null) {
    return { page, error: `trang ${page} (${code}): không đọc được Your Result, Mean for Comparison hoặc SDI` };
  }

  const end = lines.findIndex((line, index) => index > head && startsWithLabel(line, 'Your Result'));
  const stats = (end > head ? lines.slice(head + 1, end) : []).map((line) => {
    const parsed = splitTrailingNumbers(textInRange(line, 0, 330), 6);
    return { ...parsed, y: line.y };
  }).filter((row) => row.label && row.nums.length === 6);
  const toPeer = (row: typeof stats[number] | undefined): EqaPeerStats | undefined => {
    if (!row) return undefined;
    const [n, mean, cv, _uncertainty, sd] = row.nums;
    return { n, mean, sd, cv };
  };
  const allRow = stats.find((row) => fold(row.label).startsWith('all method'));
  const methodRow = stats.find((row) => fold(row.label).startsWith('ion selective electrode'))
    ?? stats.find((row) => row !== allRow);
  const instrumentRows = stats.filter((row) => row !== allRow && row !== methodRow);
  const instrumentRow = [...instrumentRows].reverse().find((row) => eqaSameValue(row.nums[1], assigned)) ?? instrumentRows.at(-1);
  const peer: EqaPeer = { all: toPeer(allRow), method: toPeer(methodRow), instrument: toPeer(instrumentRow) };
  const sigmaP = peer.instrument?.sd ?? null;
  if (sigmaP === null) return { page, error: `trang ${page} (${code}): không xác định được SDPA của nhóm so sánh` };

  return {
    page, name, code, unit, result, assigned, sigmaP, z, peer,
    methodGroup: methodRow?.label ?? '',
    // Randox cắt mất ký tự cuối của nhãn dài ngay trong lớp chữ của PDF.
    peerGroup: (instrumentRow?.label ?? '').replace(/\binstrumen$/i, 'instrument'), level: 'instrument',
  };
}

/** Trang tổng hợp RIQAS: tên thông số → [Mean for Comparison, Your Result, SDI]. */
function parseRiqasSummary(lines: readonly Line[]): Map<string, number[]> | null {
  const head = lines.findIndex((line) => {
    const text = fold(line.text);
    return text.startsWith('analyte') && text.includes('sdi') && text.includes('rmts');
  });
  if (head < 0) return null;
  const out = new Map<string, number[]>();
  for (const line of lines.slice(head + 1)) {
    const { label, nums } = splitTrailingNumbers(line.text, 8);
    if (!label || nums.length !== 8) continue;
    out.set(fold(label).replace(/[^a-z0-9]/g, ''), nums.slice(0, 3));
  }
  return out;
}

/** Đọc báo cáo RIQAS Monthly Clinical Chemistry. SDI là z-score; SDPA của
 * đúng nhóm dùng để so sánh là σp để ứng dụng tự tính lại và đối chiếu. */
export function parseRiqasReport(doc: EqaPdfDocument): EqaPdfReport {
  const pages = doc.pages.map(linesOf);
  const all = pages.flat();
  const errors: string[] = [];
  const warnings: string[] = [];
  const cover = pages[0] ?? [];
  const allText = all.map((line) => line.text).join(' ');

  const labRef = allText.match(/LABORATORY REF\.?\s*NO\.?\s*([A-Z0-9.-]+)/i)?.[1] ?? '';
  const cycle = allText.match(/\bCYCLE\s+([A-Z0-9.-]+)/i)?.[1] ?? '';
  const sample = allText.match(/\bSAMPLE\s+([A-Z0-9.-]+)/i)?.[1] ?? '';
  const program = all.find((line) => /^monthly clinical chemistry$/i.test(line.text.trim()))?.text.trim()
    ?? (allText.match(/MONTHLY CLINICAL CHEMISTRY/i)?.[0] ?? '');
  const configuration = cover.find((line) => /^\s*[A-Z]{2,8}\s+-\s+/.test(line.text))?.text.trim() ?? '';
  const parts = configuration.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  const programCode = parts[0] ?? '';
  const instrumentGroup = parts.at(-1) ?? '';
  const issueDate = dateFromDmy(allText.match(/Issue Date:\s*\d{2}\/\d{2}\/\d{4}/i)?.[0] ?? '');
  const reportDate = issueDate || doc.creationDate;
  if (!issueDate && doc.creationDate) warnings.push(`${doc.fileName}: không đọc được Issue Date; dùng ngày tạo file PDF ${doc.creationDate}.`);

  const details: RiqasDetailRow[] = [];
  pages.forEach((lines, index) => {
    const parsed = parseRiqasDetailPage(lines, index + 1);
    if (!parsed) return;
    if ('error' in parsed) errors.push(`${doc.fileName}: ${parsed.error}.`);
    else details.push(parsed);
  });
  if (!details.length) errors.push(`${doc.fileName}: không tìm thấy trang kết quả — file không phải báo cáo RIQAS Monthly Clinical Chemistry.`);

  const summary = pages.map(parseRiqasSummary).find((value) => value && value.size) ?? null;
  if (!summary) warnings.push(`${doc.fileName}: không có trang tổng hợp để đối chiếu.`);
  else {
    const seen = new Set<string>();
    for (const row of details) {
      const key = fold(row.code).replace(/[^a-z0-9]/g, '');
      seen.add(key);
      const values = summary.get(key);
      if (!values) {
        errors.push(`${doc.fileName}: thông số ${row.code} (trang ${row.page}) không có trong trang tổng hợp.`);
        continue;
      }
      const [assigned, result, z] = values;
      if (!eqaSameValue(row.assigned, assigned) || !eqaSameValue(row.result, result) || !eqaSameValue(row.z, z)) {
        errors.push(`${doc.fileName}: thông số ${row.code} — số liệu trang ${row.page} khác trang tổng hợp.`);
      }
    }
    for (const key of summary.keys()) if (!seen.has(key)) errors.push(`${doc.fileName}: trang tổng hợp có thông số "${key}" nhưng không có trang chi tiết.`);
  }

  if (!reportDate) errors.push(`${doc.fileName}: không xác định được ngày báo cáo.`);
  if (!labRef) errors.push(`${doc.fileName}: không đọc được mã đơn vị (Laboratory Ref. No.).`);
  if (!cycle || !sample) errors.push(`${doc.fileName}: không đọc được Cycle hoặc Sample.`);

  // Mỗi sample RIQAS là một lần đánh giá riêng (một đợt, N-16): kỳ mang cả
  // cycle lẫn sample, và báo cáo chỉ có một mẫu nên không ghi lại tên mẫu.
  const rows: EqaRowInput[] = details.map((row) => ({
    ref: `${doc.fileName} · trang ${row.page}`, code: row.code, instrument: instrumentGroup, sample: '', unit: row.unit,
    result: row.result, assigned: row.assigned, sigmaP: row.sigmaP, zProvider: row.z,
    method: row.methodGroup, peerGroup: row.peerGroup, peer: row.peer,
  }));
  return {
    fileName: doc.fileName, instrumentGroup,
    round: {
      program, provider: 'RIQAS - Randox Laboratories', programCode, unitCode: labRef,
      year: reportDate ? Number(reportDate.slice(0, 4)) : null, round: cycle && sample ? `CYCLE ${cycle} SAMPLE ${sample}` : '',
      reportCode: labRef && cycle && sample ? `${labRef}-${cycle}-${sample}` : '', reportDate, assignedLevel: 'Nhóm thiết bị',
    },
    rows, errors, warnings,
  };
}

/** Tự nhận dạng nhà cung cấp theo nội dung, không dựa vào tên tệp. */
export function parseEqaPdfReport(doc: EqaPdfDocument): EqaPdfReport {
  const signature = fold(doc.pages.flat().map((item) => item.str).join(' '));
  return signature.includes('monthly clinical chemistry') && (signature.includes('riqas') || signature.includes('sdi'))
    ? parseRiqasReport(doc)
    : parseVeqasReport(doc);
}
