// Tên sheet Excel an toàn: Excel (và ExcelJS) từ chối `/ \ * ? : [ ]`, dấu
// nháy đơn ở đầu/cuối và tên dài quá 31 ký tự. Tên sheet thường lấy từ tên
// xét nghiệm ("PT/INR", "Na/K", "HbA1c [NGSP]") nên phải làm sạch trước khi
// tạo sheet, nếu không nút "Xuất Excel" báo lỗi và không ra tệp.
export function safeSheetName(name: string, fallback = 'Sheet1'): string {
  const cleaned = String(name ?? '').replace(/[\\/*?:[\]]/g, '-').replace(/^'+|'+$/g, '').trim().slice(0, 31).trim();
  return cleaned || fallback;
}
