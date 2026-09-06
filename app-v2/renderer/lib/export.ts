// Giai đoạn C1 (docs/APP-V2-PLAN.md) — tiện ích xuất Excel/in PDF dùng chung
// cho mọi trang. Excel: main trả base64 (`exportTableXlsx`), ở đây chỉ giải
// mã thành Blob rồi tải về — cùng cơ chế `downloadCsv` đã dùng ở Audit/Report
// (không cần hộp thoại lưu file native, nhẹ hơn cho việc tải nhanh 1 bảng).
// PDF: gọi thẳng IPC, main tự lo cửa sổ ẩn + hộp thoại lưu file native (khác
// Excel có chủ đích — xem export-handlers.ts).
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

export async function printHtmlToPdf(html: string, defaultFileName: string): Promise<string | null> {
  const result = await window.qcApi.printHtmlToPdf({ html, defaultFileName });
  if (!result.ok) return result.error.code === 'cancelled' ? null : result.error.message;
  return null;
}
