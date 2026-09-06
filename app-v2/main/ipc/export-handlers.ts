// Giai đoạn C1 (docs/APP-V2-PLAN.md): in PDF + xuất Excel. Quyết định kiến
// trúc đã chốt (người dùng uỷ quyền chọn): dùng thư viện npm thật `exceljs`
// cho Excel thay vì port `XlsxCore` viết tay của bản cũ — main process giờ
// là Node thật, không còn ràng buộc "0 dependency runtime" mà bản cũ phải
// tuân theo vì chạy trong trình duyệt (xem CLAUDE.md). PDF dùng thẳng
// `webContents.printToPDF` của Electron, không cần thư viện gì thêm.
//
// Renderer tự dựng nội dung (đã có sẵn dữ liệu + định dạng tiếng Việt) rồi
// gửi qua IPC — main chỉ lo phần CƠ CHẾ (đóng gói .xlsx thật, mở cửa sổ ẩn
// để in PDF thật, hộp thoại lưu file) để giữ đúng ranh giới "renderer không
// chạm hệ thống file trực tiếp".
import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { type IpcResult } from './shared';

export interface ExportTableInput { sheetName: string; headers: string[]; rows: (string | number | null)[][] }

export async function buildXlsxBase64(input: ExportTableInput): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet((input.sheetName || 'Sheet1').slice(0, 31));
  const headerRow = sheet.addRow(input.headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F4' } }; });
  for (const row of input.rows) sheet.addRow(row);
  sheet.columns.forEach((col) => { col.width = 18; });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

/** Mở 1 cửa sổ Electron ẩn, nạp đúng HTML renderer đã dựng sẵn, in ra PDF
 * thật rồi hỏi nơi lưu qua hộp thoại native — không cần preload/JS chạy
 * trong cửa sổ này (chỉ hiển thị tĩnh để in), nên tắt hẳn cả contextIsolation
 * lẫn mọi quyền Node để giảm bề mặt tấn công tối đa dù nội dung do renderer
 * đưa vào chỉ là HTML tĩnh do chính app dựng (không phải dữ liệu bên ngoài). */
export async function printHtmlToPdf(parentWin: BrowserWindow, html: string, defaultFileName: string): Promise<IpcResult<{ path: string }>> {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdfBuffer = await printWin.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { ok: false, error: { code: 'cancelled', message: 'Đã huỷ lưu file.' } };
    await writeFile(filePath, pdfBuffer);
    return { ok: true, data: { path: filePath } };
  } catch (e) {
    return { ok: false, error: { code: 'print-failed', message: e instanceof Error ? e.message : 'Không in được PDF.' } };
  } finally {
    printWin.destroy();
  }
}
