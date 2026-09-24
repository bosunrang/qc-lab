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
export async function printHtmlToPdf(parentWin: BrowserWindow, html: string, defaultFileName: string, pageNumbers = false): Promise<IpcResult<{ path: string }>> {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: pageNumbers,
      headerTemplate: '<span></span>',
      footerTemplate: pageNumbers ? '<div style="width:100%;text-align:center;font:8px Arial,sans-serif;color:#526975">Trang <span class="pageNumber"></span> / <span class="totalPages"></span></div>' : '<span></span>',
    });
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


