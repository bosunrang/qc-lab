const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Thoát chuỗi để nhúng an toàn vào một literal JavaScript trong thuộc tính
 * onclick="..." (khác `esc()`/`escAttr()` — hai hàm đó thoát HTML, không phải
 * cú pháp chuỗi JS). Được nhiều trang gọi làm global bridge (`root.jsq`).
 */
export function jsq(value: unknown): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .split(LINE_SEPARATOR).join('\\u2028')
    .split(PARAGRAPH_SEPARATOR).join('\\u2029');
}
