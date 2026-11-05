export interface SearchSelectOption {
  value: string;
  label: string;
  /** Từ khoá không cần hiển thị, ví dụ đơn vị, phương pháp hoặc tên máy. */
  keywords?: string;
  suggested?: boolean;
}

/** Chuẩn hoá chữ tìm kiếm: không phân biệt hoa thường, dấu tiếng Việt và
 * khoảng trắng. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Từng từ người dùng gõ đều phải xuất hiện trong lựa chọn. */
export function filterSearchOptions(options: readonly SearchSelectOption[], query: string): SearchSelectOption[] {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return [...options];
  return options.filter((option) => {
    const haystack = normalizeSearchText(`${option.label} ${option.keywords ?? ''}`);
    return terms.every((term) => haystack.includes(term));
  });
}

/** Đưa gợi ý lên đầu nhưng không nhân đôi lựa chọn và vẫn giữ thứ tự gốc
 * trong từng nhóm. */
export function prioritizeSearchOptions(options: readonly SearchSelectOption[], suggestedValues: readonly string[]): SearchSelectOption[] {
  if (!suggestedValues.length) return [...options];
  const suggested = new Set(suggestedValues);
  return options.map((option) => ({ ...option, suggested: suggested.has(option.value) }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
}
