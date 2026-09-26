/**
 * Tên bảng/cột ghép vào câu SQL (kế hoạch kiến trúc C.6). Tham số `?` chỉ dùng
 * được cho GIÁ TRỊ, không cho tên bảng hay tên cột, nên những chỗ phải ghép tên
 * đi qua đây: chỉ nhận tên dạng định danh SQL thường và luôn đặt trong nháy kép.
 *
 * Hiện các tên đó đều lấy từ `sqlite_master`, `PRAGMA table_info` hoặc hằng số
 * trong mã, nên chưa có đường nào đưa tên lạ vào; đây là lớp phòng xa — đặc
 * biệt với tệp backup người dùng chọn, nơi danh sách cột đến từ tệp ngoài.
 */
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Tên bảng/cột không hợp lệ: ${JSON.stringify(name)}`);
  return `"${name}"`;
}

/** Danh sách cột đã đặt nháy, nối bằng dấu phẩy. */
export function quoteIdents(names: readonly string[]): string {
  return names.map(quoteIdent).join(',');
}
