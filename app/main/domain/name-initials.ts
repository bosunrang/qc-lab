/** Mã nhân viên từ họ tên, ví dụ "Nguyễn Thị Lan" → "NTL". */
export function initialsFromName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part.charAt(0)).join('').toLocaleUpperCase('vi').slice(0, 12);
}
