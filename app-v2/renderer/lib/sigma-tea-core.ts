/** Hàm thuần của lớp giải TEa. Không import module khác để oracle test có thể
 * chạy trực tiếp trên TypeScript; adapter `sigma-tea.ts` cung cấp catalog và
 * kiểu dữ liệu ứng dụng. */
export type SigmaTeaSourceCore = 'lab' | 'eflm' | 'clia' | 'ricos';
export type TeaCatalogCore = { id: string; name: string; abbr: string; aliases?: readonly string[]; unit: string; section?: string; clia: number | null; ricos: number | null; cliaAbsolute?: number; cliaAbsoluteUnit?: string };
export type TeaRefCore = { name: string; analyte_id?: string; aliases_json?: string; lab: number | null; lab_source: string; clia?: number | null; ricos?: number | null; clia_rule?: string; clia_absolute?: number | null; clia_absolute_unit?: string };
export type TeaTestCore = { name: string; tea_ref_key: string; unit: string; tea: number };
export type ResolvedTeaCore<T extends TeaCatalogCore = TeaCatalogCore> = { value: number | null; criterion: string; catalog: T | null; note: string | null };

function key(value: string): string { return value.trim().toLocaleLowerCase('vi').replace(/[μµ]/g, 'u').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function unitKey(value: string): string {
  const aliases: Record<string, string> = {
    litre: 'l', liter: 'l', litres: 'l', liters: 'l',
    millilitre: 'ml', milliliter: 'ml', millilitres: 'ml', milliliters: 'ml',
    microlitre: 'ul', microliter: 'ul', microlitres: 'ul', microliters: 'ul',
  };
  return key(value).split(' ').map((part) => aliases[part] || part).join(' ');
}
function unitsMatch(left: string, right: string): boolean { return unitKey(left) !== '' && unitKey(left) === unitKey(right); }
function aliasesOf(value: { aliases?: readonly string[]; aliases_json?: string }): string[] {
  if (Array.isArray(value.aliases)) return value.aliases.filter((alias): alias is string => typeof alias === 'string');
  try { const parsed = JSON.parse(value.aliases_json || '[]'); return Array.isArray(parsed) ? parsed.filter((alias): alias is string => typeof alias === 'string') : []; } catch { return []; }
}

export function findCatalog<T extends TeaCatalogCore>(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, catalog: readonly T[]): T | null {
  const wanted = key(test.tea_ref_key || test.name);
  if (!wanted) return null;
  // TEa là tiêu chí lâm sàng: không "đoán gần đúng" bằng startsWith (CK có
  // thể nuốt CK-MB). Chỉ nhận mã/tên/viết tắt/alias khớp tuyệt đối.
  return catalog.find((item) => [item.id, item.name, item.abbr, ...aliasesOf(item)].some((value) => key(value) === wanted)) || null;
}

function findRef(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, refs: readonly TeaRefCore[]): TeaRefCore | null {
  const wanted = key(test.tea_ref_key || test.name);
  return refs.find((ref) => [ref.analyte_id || '', ref.name, ...aliasesOf(ref)].some((value) => key(value) === wanted)) || null;
}

export function resolveTea<T extends TeaCatalogCore>(test: TeaTestCore, refs: readonly TeaRefCore[], catalogRows: readonly T[], source: SigmaTeaSourceCore, targetMean?: number | null): ResolvedTeaCore<T> {
  const catalog = findCatalog(test, catalogRows);
  const ref = findRef(test, refs);
  if (source === 'eflm') {
    const value = Number(test.tea);
    return { value: Number.isFinite(value) && value > 0 ? value : null, criterion: 'TEa EFLM nhập và được truy vết bởi phòng xét nghiệm', catalog, note: null };
  }
  if (source === 'lab') {
    const value = Number(ref?.lab);
    return { value: Number.isFinite(value) && value > 0 ? value : null, criterion: ref?.lab_source || 'Hồ sơ TEa chuẩn hóa của phòng xét nghiệm', catalog, note: null };
  }
  const percent = Number(source === 'clia' ? (ref?.clia ?? catalog?.clia) : (ref?.ricos ?? catalog?.ricos));
  if (source === 'ricos') return { value: Number.isFinite(percent) && percent > 0 ? percent : null, criterion: 'Ricos / Westgard biological variation', catalog, note: null };
  // Hồ sơ PXN có thể ghi đè cả quy tắc/giới hạn tuyệt đối CLIA. Catalog tích
  // hợp chỉ là fallback; không được bỏ qua dữ liệu đã được phòng xét nghiệm
  // phê duyệt và import từ app cũ.
  const rawRule = String(ref?.clia_rule || '').trim();
  const rule = rawRule === 'percent' || rawRule === 'absolute' || rawRule === 'greater-of' ? rawRule : 'greater-of';
  const refAbsolute = Number(ref?.clia_absolute);
  const absolute = Number.isFinite(refAbsolute) && refAbsolute > 0 ? refAbsolute : catalog?.cliaAbsolute;
  const absoluteUnit = ref?.clia_absolute_unit || catalog?.cliaAbsoluteUnit || '', mean = Number(targetMean);
  if (absolute != null && rule !== 'percent' && unitsMatch(test.unit, absoluteUnit)) {
    if (Number.isFinite(mean) && mean !== 0) {
      const absolutePct = Math.abs(absolute / mean) * 100;
      const percentValue = Number.isFinite(percent) && percent > 0 ? percent : null;
      const value = rule === 'absolute' ? absolutePct : percentValue == null ? absolutePct : Math.max(percentValue, absolutePct);
      const criterion = rule === 'absolute' ? `CLIA: ±${absolute} ${absoluteUnit}` : `CLIA: lớn hơn giữa ±${percentValue != null ? `${percentValue}%` : '—'} và ±${absolute} ${absoluteUnit}`;
      return { value, criterion, catalog, note: null };
    }
    return { value: rule === 'absolute' ? null : Number.isFinite(percent) && percent > 0 ? percent : null, criterion: `CLIA: ±${absolute} ${absoluteUnit}`, catalog, note: 'Cần Mean của mức QC để quy đổi giới hạn tuyệt đối CLIA sang %.' };
  }
  if (absolute != null && rule !== 'percent') return { value: Number.isFinite(percent) && percent > 0 ? percent : null, criterion: `CLIA: ±${absolute} ${absoluteUnit}`, catalog, note: `Không áp dụng giới hạn tuyệt đối vì đơn vị xét nghiệm (${test.unit || 'trống'}) không khớp ${absoluteUnit || 'tiêu chí'}.` };
  return { value: Number.isFinite(percent) && percent > 0 ? percent : null, criterion: 'CLIA PT (CMS-3355-F)', catalog, note: null };
}
