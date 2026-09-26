import { TEA_CATALOG, type TeaCatalogItem } from '../../main/domain/tea-catalog';
import type { TeaRef } from '../../shared/qc-api';

export interface TeaSuggestion {
  /** Giá trị điền vào ô tên — tên chuẩn hoá, kèm viết tắt khi nó khác tên. */
  displayName: string;
  unit: string;
  section: string;
  /** TEa% gợi ý: CLIA% nếu có, không thì Ricos%. */
  tea: number | null;
  /** Nguồn của TEa% ở trên: 'clia' | 'ricos' | '' (không có giá trị nào). */
  teaSource: 'clia' | 'ricos' | '';
  /** Khoá analyte để đối chiếu lại về sau (`tests.tea_ref_key`). */
  teaRefKey: string;
  /** Chuỗi phụ trong danh sách gợi ý: viết tắt · nhóm xét nghiệm. */
  hint: string;
}

/** Chuẩn hoá để so khớp: bỏ dấu, hạ chữ thường, gộp khoảng trắng. */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Chỉ ghép viết tắt khi nó KHÁC tên (bỏ khác biệt hoa/thường):
 * "Sodium (Na)" nhưng chỉ "Urea", "pH", "D-dimer". */
export function analyteDisplayName(item: { name: string; abbr: string }): string {
  const same = !item.abbr || normalizeName(item.abbr) === normalizeName(item.name);
  return same ? item.name : `${item.name} (${item.abbr})`;
}


/** Danh mục TEa sau khi áp hồ sơ ghi đè của phòng xét nghiệm. Ô ghi đè để
 * trống nghĩa là "dùng giá trị mặc định của danh mục", đúng quy tắc main giải
 * TEa (`resolveTea()`: `ref?.clia ?? catalog?.clia`) và đúng ý nghĩa của nút
 * "Khôi phục mặc định" (ghi NULL vào ô ghi đè). Trước 2026-09-26 hàm này thay
 * ô trống bằng `null`: chỉ ghi đè Ricos là gợi ý mất CLIA của danh mục, lệch
 * với TEa mà Six Sigma dùng cho cùng xét nghiệm. */
export function effectiveTeaCatalog(teaRefs: readonly TeaRef[]): TeaCatalogItem[] {
  const overrides = new Map<string, TeaRef>();
  for (const ref of teaRefs) if (ref.analyte_id) overrides.set(ref.analyte_id, ref);
  return TEA_CATALOG.map((item) => {
    const over = overrides.get(item.id);
    if (!over) return item;
    return {
      ...item,
      name: over.name || item.name,
      unit: over.unit || item.unit,
      section: over.section || item.section,
      clia: over.clia ?? item.clia,
      ricos: over.ricos ?? item.ricos,
    };
  });
}

function toSuggestion(item: TeaCatalogItem): TeaSuggestion {
  const tea = item.clia != null ? item.clia : item.ricos;
  const teaSource: 'clia' | 'ricos' | '' = item.clia != null ? 'clia' : item.ricos != null ? 'ricos' : '';
  const displayName = analyteDisplayName(item);
  const abbrHint = item.abbr && normalizeName(item.abbr) !== normalizeName(item.name) ? item.abbr : '';
  return {
    displayName,
    unit: item.unit,
    section: item.section,
    tea: tea ?? null,
    teaSource,
    teaRefKey: item.id,
    hint: [abbrHint, item.section].filter(Boolean).join(' · '),
  };
}

/** Danh sách cho bộ chọn tên xét nghiệm — sắp theo nhóm rồi theo tên. */
export function teaSuggestions(teaRefs: readonly TeaRef[]): TeaSuggestion[] {
  return effectiveTeaCatalog(teaRefs)
    .map(toSuggestion)
    .sort((a, b) => a.section.localeCompare(b.section, 'vi') || a.displayName.localeCompare(b.displayName, 'vi'));
}

/** Tìm analyte khớp CHÍNH XÁC (sau khi chuẩn hoá) với tên/viết tắt/tên kèm
 * viết tắt người dùng vừa gõ — so khớp tuyệt đối sau chuẩn hoá, không so
 * khớp một phần (tránh gõ "Na" mà nhảy sang "Natri niệu"). */
export function findTeaSuggestion(value: unknown, teaRefs: readonly TeaRef[]): TeaSuggestion | null {
  const key = normalizeName(value);
  if (!key) return null;
  for (const item of effectiveTeaCatalog(teaRefs)) {
    const candidates = [item.name, item.abbr, analyteDisplayName(item)];
    if (candidates.some((candidate) => normalizeName(candidate) === key)) return toSuggestion(item);
  }
  return null;
}


