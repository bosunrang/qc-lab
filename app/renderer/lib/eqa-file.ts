// Đọc file nguồn của một lần nhập ngoại kiểm ở renderer: Excel theo mẫu cũ
// (exceljs, chỉ chuyển ô thành giá trị thuần) và dữ liệu đã lưu của công cụ
// `phan_tich_ngoai_kiem.html`. Phần hiểu nội dung nằm ở
// `main/domain/eqa/import.ts`; main kiểm lại toàn bộ trước khi ghi.
import { mergeEqaSources, parseEqaWorkbook, parseLegacyEqa, type EqaParsedSource } from '../../main/domain/eqa/import';

const pad = (n: number) => String(n).padStart(2, '0');

/** Giá trị thuần của một ô exceljs: công thức lấy kết quả, chữ định dạng lấy
 * nội dung, ngày đổi thành `YYYY-MM-DD` (exceljs trả ngày theo UTC). */
function cellValue(value: unknown): unknown {
  if (value instanceof Date) return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  if (value && typeof value === 'object') {
    const v = value as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if ('result' in v) return cellValue(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text).join('');
    if (v.text !== undefined) return String(v.text);
    return null;
  }
  return value ?? null;
}

async function readWorkbook(file: File): Promise<EqaParsedSource> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer()); }
  catch (error) { return { round: parseEqaWorkbook({}).round, rows: [], errors: [`${file.name}: không đọc được file Excel (${error instanceof Error ? error.message : 'lỗi không rõ'}).`] }; }
  const sheets: Record<string, unknown[][]> = {};
  workbook.eachSheet((sheet) => {
    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows[rowNumber - 1] = values.map(cellValue);
    });
    sheets[sheet.name] = Array.from(rows, (row) => row ?? []);
  });
  return parseEqaWorkbook(sheets, file.name);
}

/** Một hoặc nhiều file Excel của CÙNG một kỳ (mỗi máy một file). */
export async function readEqaExcelFiles(files: readonly File[]): Promise<EqaParsedSource> {
  const sources = await Promise.all(files.map(readWorkbook));
  return mergeEqaSources(sources, files.map((file) => file.name));
}

/** Dữ liệu đã lưu của công cụ cũ (`.html` hoặc `.json` sao lưu), tách theo kỳ. */
export async function readLegacyEqaFile(file: File): Promise<{ sources: EqaParsedSource[]; error: string }> {
  return parseLegacyEqa(await file.text());
}
