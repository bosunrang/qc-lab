/** Hàm thuần của lớp giải TEa. Không import module khác để oracle test có thể
 * chạy trực tiếp trên TypeScript; adapter `sigma-tea.ts` cung cấp catalog và
 * kiểu dữ liệu ứng dụng. */
export type SigmaTeaSourceCore = 'lab' | 'eflm' | 'clia' | 'ricos';
export type TeaCatalogCore = { id: string; name: string; abbr: string; aliases?: readonly string[]; unit: string; section?: string; clia: number | null; ricos: number | null; cliaAbsolute?: number; cliaAbsoluteUnit?: string };
export type TeaRefCore = { name: string; analyte_id?: string; aliases_json?: string; lab: number | null; lab_source: string; clia?: number | null; ricos?: number | null; clia_rule?: string; clia_absolute?: number | null; clia_absolute_unit?: string };
export type TeaTestCore = {
  name: string; tea_ref_key: string; unit: string; tea: number;
  /** Cổng truy vết EFLM: `tea` là một ô nhập tay dùng chung, nên nó CHỈ được
   * coi là TEa EFLM khi xét nghiệm thật sự khai nguồn EFLM hoặc có ít nhất
   * một dấu vết tra cứu (analyte/tài liệu/ngày). Thiếu cổng này, mọi xét
   * nghiệm có `tea` (kể cả TEa gõ tay cho nguồn khác) đều hiện thành "TEa
   * EFLM đã truy vết". */
  tea_source?: string; eflm_analyte?: string; eflm_ref?: string; eflm_lookup_date?: string;
  eflm_tea?: number | null;
};
/** Tiêu chí CLIA đã phân giải, dạng có cấu trúc — để lớp trình bày in được
 * "±4.0000 mmol/L" thay vì một con số % đã quy đổi (giá trị % chỉ đúng tại
 * đúng một Mean). `null` với mọi nguồn không phải CLIA. */
export type TeaCriterionCore = { rule: 'percent' | 'absolute' | 'greater-of'; percent: number | null; absolute: number | null; unit: string; absoluteUsable: boolean; unitMismatch: boolean; needsTarget: boolean };
export type ResolvedTeaCore<T extends TeaCatalogCore = TeaCatalogCore> = { value: number | null; criterion: string; catalog: T | null; note: string | null; criterionDetail: TeaCriterionCore | null };

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

/** Mọi cách gọi HỢP LỆ của một dòng danh mục. Ngoài mã/tên/viết tắt/alias,
 * phải có cả dạng `Tên (Viết tắt)` — đó chính là định dạng mà ô "Tên xét
 * nghiệm" ở Cấu hình chung TỰ SINH khi gợi ý analyte ("Sodium (Na)"). Thiếu
 * nó thì một xét nghiệm mang đúng tên do app đặt ra lại không tra được
 * analyte của mình, và trang Six Sigma chỉ nói "chưa có" mà không nói vì sao.
 *
 * Vẫn là khớp TUYỆT ĐỐI, không phải đoán theo tiền tố: "CK" không bao giờ
 * khớp "CK-MB", vì mỗi ứng viên phải bằng nhau nguyên chuỗi sau khi chuẩn
 * hoá. Đây là điều kiện không được nới, TEa là tiêu chí lâm sàng. */
function catalogAliases(item: TeaCatalogCore): string[] {
  const names = [item.id, item.name, item.abbr, ...aliasesOf(item)];
  if (item.name && item.abbr && key(item.abbr) !== key(item.name)) names.push(`${item.name} (${item.abbr})`);
  return names;
}

export function findCatalog<T extends TeaCatalogCore>(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, catalog: readonly T[]): T | null {
  const wanted = key(test.tea_ref_key || test.name);
  if (!wanted) return null;
  return catalog.find((item) => catalogAliases(item).some((value) => key(value) === wanted)) || null;
}

/** `catalogId` là dòng danh mục đã tra được cho xét nghiệm này. Cần nó vì hồ
 * sơ TEa PXN của một analyte CÓ SẴN được lưu với `analyte_id` của danh mục và
 * `name` là tên danh mục ("Sodium"), trong khi xét nghiệm mang tên app tự sinh
 * ("Sodium (Na)") — so tên trần thì không bao giờ gặp nhau. */
function findRef(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, refs: readonly TeaRefCore[], catalogId?: string): TeaRefCore | null {
  const wanted = key(test.tea_ref_key || test.name);
  const keys = new Set([wanted, catalogId ? key(catalogId) : ''].filter(Boolean));
  return refs.find((ref) => [ref.analyte_id || '', ref.name, ...aliasesOf(ref)].some((value) => keys.has(key(value)))) || null;
}

export function resolveTea<T extends TeaCatalogCore>(test: TeaTestCore, refs: readonly TeaRefCore[], catalogRows: readonly T[], source: SigmaTeaSourceCore, targetMean?: number | null): ResolvedTeaCore<T> {
  const catalog = findCatalog(test, catalogRows);
  const ref = findRef(test, refs, catalog?.id);
  if (source === 'eflm') {
    const hasTrace = test.tea_source === 'eflm' || !!(test.eflm_analyte || test.eflm_ref || test.eflm_lookup_date);
    const value = Number(test.eflm_tea === undefined ? test.tea : test.eflm_tea);
    return {
      value: hasTrace && Number.isFinite(value) && value > 0 ? value : null,
      criterion: 'TEa EFLM nhập và được truy vết bởi phòng xét nghiệm', catalog,
      note: hasTrace ? null : 'Chọn EFLM thì cần tra database EFLM và nhập TEa% cùng thông tin truy xuất.',
      criterionDetail: null,
    };
  }
  if (source === 'lab') {
    const value = Number(ref?.lab);
    return { value: Number.isFinite(value) && value > 0 ? value : null, criterion: ref?.lab_source || 'Hồ sơ TEa chuẩn hóa của phòng xét nghiệm', catalog, note: null, criterionDetail: null };
  }
  const percent = Number(source === 'clia' ? (ref?.clia ?? catalog?.clia) : (ref?.ricos ?? catalog?.ricos));
  if (source === 'ricos') return { value: Number.isFinite(percent) && percent > 0 ? percent : null, criterion: 'Ricos / Westgard biological variation', catalog, note: null, criterionDetail: null };
  // Hồ sơ PXN có thể ghi đè cả quy tắc/giới hạn tuyệt đối CLIA. Catalog tích
  // hợp chỉ là fallback; không được bỏ qua dữ liệu đã được phòng xét nghiệm
  // phê duyệt.
  const rawRule = String(ref?.clia_rule || '').trim();
  const refAbsolute = Number(ref?.clia_absolute);
  const absolute = Number.isFinite(refAbsolute) && refAbsolute > 0 ? refAbsolute : catalog?.cliaAbsolute;
  // Không khai `clia_rule` thì suy từ dữ liệu:
  // chỉ có giới hạn tuyệt đối là 'absolute', có cả hai mới là 'greater-of'.
  // Mặc định cứng 'greater-of' cho ra cùng CON SỐ (nhánh đó tự rơi về
  // absolute khi thiếu %) nhưng in sai NHÃN tiêu chí.
  const hasPercent = Number.isFinite(percent) && percent > 0;
  const rule: TeaCriterionCore['rule'] = rawRule === 'percent' || rawRule === 'absolute' || rawRule === 'greater-of'
    ? rawRule
    : absolute != null && absolute > 0 ? (hasPercent ? 'greater-of' : 'absolute') : 'percent';
  const absoluteUnit = ref?.clia_absolute_unit || catalog?.cliaAbsoluteUnit || '', mean = Number(targetMean);
  const percentValue = Number.isFinite(percent) && percent > 0 ? percent : null;
  const detail = (over: Partial<TeaCriterionCore>): TeaCriterionCore => ({
    rule, percent: percentValue, absolute: absolute ?? null, unit: absoluteUnit, absoluteUsable: false, unitMismatch: false, needsTarget: false, ...over,
  });
  if (absolute != null && rule !== 'percent' && unitsMatch(test.unit, absoluteUnit)) {
    if (Number.isFinite(mean) && mean !== 0) {
      const absolutePct = Math.abs(absolute / mean) * 100;
      const value = rule === 'absolute' ? absolutePct : percentValue == null ? absolutePct : Math.max(percentValue, absolutePct);
      const criterion = rule === 'absolute' ? `CLIA: ±${absolute} ${absoluteUnit}` : `CLIA: lớn hơn giữa ±${percentValue != null ? `${percentValue}%` : '—'} và ±${absolute} ${absoluteUnit}`;
      return { value, criterion, catalog, note: null, criterionDetail: detail({ absoluteUsable: true }) };
    }
    return { value: rule === 'absolute' ? null : percentValue, criterion: `CLIA: ±${absolute} ${absoluteUnit}`, catalog, note: 'Cần Mean của mức QC để quy đổi giới hạn tuyệt đối CLIA sang %.', criterionDetail: detail({ absoluteUsable: true, needsTarget: true }) };
  }
  if (absolute != null && rule !== 'percent') return { value: percentValue, criterion: `CLIA: ±${absolute} ${absoluteUnit}`, catalog, note: `Không áp dụng giới hạn tuyệt đối vì đơn vị xét nghiệm (${test.unit || 'trống'}) không khớp ${absoluteUnit || 'tiêu chí'}.`, criterionDetail: detail({ unitMismatch: true }) };
  return { value: percentValue, criterion: 'CLIA PT (CMS-3355-F)', catalog, note: null, criterionDetail: detail({ rule: 'percent' }) };
}

const criterionNum = (value: number | null, digits: number) => (value == null ? '—' : value.toFixed(digits));

/** Nhãn tiêu chí để hiển thị. Với CLIA dạng tuyệt đối, in nguyên giới hạn
 * ("±4.0000 mmol/L") thay vì con số % đã
 * quy đổi: TEa% chỉ đúng tại đúng MỘT Mean, nên in một số % ở thẻ thiết lập
 * (chưa gắn với mức QC nào) là nói sai. Nguồn khác vẫn in giá trị %.
 *
 * Nằm trong file thuần, không import adapter renderer, để có thể kiểm thử
 * trực tiếp bằng TypeScript. */
export function teaCriterionText(resolved: Pick<ResolvedTeaCore, 'value' | 'criterionDetail'>): string {
  const c = resolved.criterionDetail;
  if (!c) return resolved.value != null ? `${resolved.value.toFixed(2)}%` : 'chưa có';
  if (c.unitMismatch) {
    const note = ` (không áp dụng giới hạn tuyệt đối: đơn vị phải là ${c.unit || 'đơn vị quy định'})`;
    return (c.percent != null ? `±${criterionNum(c.percent, 2)}%` : 'chưa tính được') + note;
  }
  if (c.rule === 'absolute') return `±${criterionNum(c.absolute, 4)} ${c.unit || 'đơn vị'}`;
  if (c.rule === 'greater-of') return `mức lớn hơn giữa ±${criterionNum(c.percent, 2)}% và ±${criterionNum(c.absolute, 4)} ${c.unit || 'đơn vị'}`;
  return c.percent != null ? `±${criterionNum(c.percent, 2)}%` : 'chưa có';
}


