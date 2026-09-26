// Xuất tệp khi renderer chạy trong trình duyệt — bản xem trước (cổng 5174) và
// máy trạm LAN. App Electron trên máy chính vẫn dùng handler native (ExcelJS ở
// main process + webContents.printToPDF); ở trình duyệt thì tự tạo XLSX và gọi
// hộp in của chính trình duyệt. Hai đường dùng cùng dữ liệu/headers từ renderer.
import type { IpcResult } from '../../shared/qc-api';

type ExportTableInput = { sheetName: string; headers: string[]; rows: (string | number | null)[][] };

function error(code: string, fallback: string, cause: unknown): IpcResult<never> {
  return { ok: false, error: { code, message: cause instanceof Error ? cause.message : fallback } };
}

function bytesToBase64(bytes: Uint8Array): string {
  // `String.fromCharCode(...bytes)` vượt giới hạn call stack với báo cáo lớn.
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function exportTableXlsxInBrowser(input: ExportTableInput): Promise<IpcResult<string>> {
  try {
    // ExcelJS khá lớn; chỉ nạp khi người dùng thực sự bấm Xuất Excel, không
    // làm chậm việc mở trang xem trước thông thường.
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet((input.sheetName || 'Sheet1').slice(0, 31));
    const headerRow = sheet.addRow(input.headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F4' } }; });
    for (const row of input.rows) sheet.addRow(row);
    sheet.columns.forEach((column) => { column.width = 18; });
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    return { ok: true, data: bytesToBase64(bytes) };
  } catch (cause) {
    return error('xlsx-failed', 'Không tạo được file Excel trong trình duyệt.', cause);
  }
}

export function printHtmlToPdfInBrowser(html: string): Promise<IpcResult<{ path: string }>> {
  return new Promise((resolve) => {
    try {
      // Iframe giữ nguyên HTML trang in, không làm người dùng rời khỏi báo cáo.
      // Hộp thoại hệ điều hành/trình duyệt cho phép chọn "Save as PDF".
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
      frame.onload = () => {
        try {
          const target = frame.contentWindow;
          if (!target) throw new Error('Không tạo được tài liệu để in.');
          target.focus();
          target.print();
          // Trình duyệt quyết định nơi lưu, nên không có đường dẫn cục bộ để trả về.
          resolve({ ok: true, data: { path: '' } });
        } catch (cause) {
          resolve(error('print-failed', 'Không mở được hộp in của trình duyệt.', cause));
        } finally {
          window.setTimeout(() => frame.remove(), 1_000);
        }
      };
      frame.srcdoc = html;
      document.body.appendChild(frame);
    } catch (cause) {
      resolve(error('print-failed', 'Không mở được hộp in của trình duyệt.', cause));
    }
  });
}


