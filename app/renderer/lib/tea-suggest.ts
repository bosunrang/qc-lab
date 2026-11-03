import { TEA_CATALOG, type TeaCatalogItem } from '../../main/domain/tea-catalog';
import type { TeaRef } from '../../shared/qc-api';

export interface TeaSuggestion {
  /** Giá trị điền vào ô tên — tên chuẩn hoá, kèm viết tắt khi nó khác tên. */
  displayName: string;
  unit: string;
  section: string;
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


/** Danh mục xét nghiệm sau khi áp tên, đơn vị, nhóm do phòng xét nghiệm sửa.
 * Gợi ý KHÔNG mang TEa (từ 2026-11-03): TEa vận hành đọc thẳng từ Bảng TEa
 * tham chiếu (`resolveOperationalTea()`), không chép CLIA/Ricos sang xét
 * nghiệm như trước. */
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
    };
  });
}

function toSuggestion(item: TeaCatalogItem): TeaSuggestion {
  const displayName = analyteDisplayName(item);
  const abbrHint = item.abbr && normalizeName(item.abbr) !== normalizeName(item.name) ? item.abbr : '';
  return {
    displayName,
    unit: item.unit,
    section: item.section,
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


