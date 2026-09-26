// Tiện ích xuất CSV/Excel/in PDF dùng chung cho mọi trang. CSV và Excel tải
// về bằng Blob (không cần hộp thoại lưu file native, nhẹ hơn cho việc tải
// nhanh 1 bảng); Excel do main dựng và trả base64 (`exportTableXlsx`).
// PDF: gọi thẳng IPC, main tự lo cửa sổ ẩn + hộp thoại lưu file native (khác
// Excel có chủ đích — xem export-handlers.ts).
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** BOM UTF-8 ở đầu tệp CSV. */
export const CSV_BOM = '\uFEFF';

/** Tải một chuỗi CSV về máy, LUÔN kèm BOM UTF-8.
 *
 * `type: 'text/csv;charset=utf-8'` chỉ là MIME của Blob — Excel trên Windows
 * KHÔNG đọc MIME khi mở một tệp cục bộ, nó đoán mã hoá theo codepage hệ
 * thống. Thiếu BOM thì toàn bộ tiếng Việt ("Người thực hiện", "Đã huỷ", tên
 * xét nghiệm) mở ra là ký tự rác. Trước 2026-09-26 chỉ Báo cáo có BOM; Nhật
 * ký hoạt động và Khắc phục sự cố thì không (kế hoạch kiến trúc D.9). */
export function downloadCsv(csv: string, filename: string): void {
  downloadBlob(new Blob([CSV_BOM, csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function exportTableXlsx(sheetName: string, headers: string[], rows: (string | number | null)[][], filename: string): Promise<string | null> {
  const result = await window.qcApi.exportTableXlsx({ sheetName, headers, rows });
  if (!result.ok) return result.error.message;
  const bytes = atob(result.data);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  return null;
}

export async function printHtmlToPdf(html: string, defaultFileName: string, options: { pageNumbers?: boolean } = {}): Promise<string | null> {
  const result = await window.qcApi.printHtmlToPdf({ html, defaultFileName, pageNumbers: options.pageNumbers });
  if (!result.ok) return result.error.code === 'cancelled' ? null : result.error.message;
  return null;
}

