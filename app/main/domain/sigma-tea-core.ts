/** Hàm thuần của lớp giải TEa. Không import module khác để oracle test có thể
 * chạy trực tiếp trên TypeScript; adapter `sigma-tea.ts` cung cấp catalog và
 * kiểu dữ liệu ứng dụng. */
export type SigmaTeaSourceCore = 'lab' | 'eflm' | 'clia' | 'ricos';
export type TeaCatalogCore = { id: string; name: string; abbr: string; aliases?: readonly string[]; unit: string; section?: string; clia: number | null; ricos: number | null; cliaAbsolute?: number; cliaAbsoluteUnit?: string };
export type TeaRefLevelDefaultCore = { level: number; tea: number };
export type TeaRefCore = { name: string; analyte_id?: string; aliases_json?: string; lab: number | null; lab_source: string; lab_level_defaults?: readonly TeaRefLevelDefaultCore[]; clia?: number | null; ricos?: number | null; clia_rule?: string; clia_absolute?: number | null; clia_absolute_unit?: string };
export type TeaTestCore = {
  name: string; tea_ref_key: string; unit: string; tea: number;
  /** Cổng truy vết EFLM: `tea` là một ô nhập tay dùng chung, nên nó CHỈ được
   * coi là TEa EFLM khi có ngày tra cứu database EFLM (xem `resolveTea`).
   * Thiếu cổng này, mọi xét nghiệm có `tea` (kể cả TEa gõ tay cho nguồn khác)
   * đều hiện thành "TEa EFLM đã truy vết". */
  tea_source?: string; eflm_analyte?: string; eflm_ref?: string; eflm_lookup_date?: string;
  operational_tea_source?: string;
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
  // Ưu tiên khoá đã gán; nếu khoá của dữ liệu cũ không còn hợp lệ thì thử
  // lại bằng tên hiển thị. Cả hai nhánh vẫn khớp TUYỆT ĐỐI với alias catalog,
  // không nới thành so gần đúng.
  const wanted = [test.tea_ref_key, test.name].map(key).filter(Boolean);
  for (const candidate of wanted) {
    const found = catalog.find((item) => catalogAliases(item).some((value) => key(value) === candidate));
    if (found) return found;
  }
  return null;
}

/** `catalogId` là dòng danh mục đã tra được cho xét nghiệm này. Cần nó vì hồ
 * sơ TEa PXN của một analyte CÓ SẴN được lưu với `analyte_id` của danh mục và
 * `name` là tên danh mục ("Sodium"), trong khi xét nghiệm mang tên app tự sinh
 * ("Sodium (Na)") — so tên trần thì không bao giờ gặp nhau. */
function findRefs(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, refs: readonly TeaRefCore[], catalog?: TeaCatalogCore | null): TeaRefCore[] {
  // Hồ sơ tạo bởi các bản cũ chưa có `analyte_id`, chỉ lưu tên danh mục.
  // Khi đã tra được catalog, nhận mọi alias CHÍNH XÁC của đúng dòng đó để
  // tương thích dữ liệu cũ; vẫn không ghép tiền tố hay đoán tên gần giống.
  const keys = new Set([test.tea_ref_key, test.name, ...(catalog ? catalogAliases(catalog) : [])].map(key).filter(Boolean));
  return refs.filter((ref) => [ref.analyte_id || '', ref.name, ...aliasesOf(ref)].some((value) => keys.has(key(value))));
}

/** Hồ sơ TEa PXN có dữ liệu (TEa chung hoặc theo mức) trong các hồ sơ khớp. */
function pickLabRef(refs: readonly TeaRefCore[]): TeaRefCore | null {
  return refs.find((item) => item.lab != null || !!item.lab_level_defaults?.length) || null;
}

/** Xét nghiệm có hồ sơ TEa của PXN (TEa chung hoặc theo mức) không. Có thì TEa
 * PXN là TEa vận hành và là nguồn mặc định ở trang Six Sigma. */
export function hasLabTea(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, refs: readonly TeaRefCore[], catalogRows: readonly TeaCatalogCore[]): boolean {
  return !!pickLabRef(findRefs(test, refs, findCatalog(test, catalogRows)));
}

/** TEa PXN khai riêng theo số mức QC của analyte mà xét nghiệm này khớp. Lớp
 * trình bày dùng để nói rõ "theo mức QC" thay vì chỉ in TEa chung. */
export function labLevelTeas(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, refs: readonly TeaRefCore[], catalogRows: readonly TeaCatalogCore[]): readonly TeaRefLevelDefaultCore[] {
  const catalog = findCatalog(test, catalogRows);
  return pickLabRef(findRefs(test, refs, catalog))?.lab_level_defaults || [];
}

function findRef(test: Pick<TeaTestCore, 'name' | 'tea_ref_key'>, refs: readonly TeaRefCore[], catalog?: TeaCatalogCore | null): TeaRefCore | null {
  return findRefs(test, refs, catalog)[0] || null;
}

export function resolveTea<T extends TeaCatalogCore>(test: TeaTestCore, refs: readonly TeaRefCore[], catalogRows: readonly T[], source: SigmaTeaSourceCore, targetMean?: number | null, level?: number | null): ResolvedTeaCore<T> {
  const catalog = findCatalog(test, catalogRows);
  const matchingRefs = findRefs(test, refs, catalog);
  let ref = findRef(test, refs, catalog);
  if (source === 'eflm') {
    // Truy vết tối thiểu là NGÀY TRA: database biến thiên sinh học EFLM được
    // cập nhật theo thời gian, thiếu ngày thì không biết TEa lấy từ phiên bản
    // nào. Tên xét nghiệm EFLM để trống thì hiểu là tên xét nghiệm (ô nhập ở
    // trang Sigma mặc định hiện đúng tên đó). Trước đây chỉ cần chọn nguồn
    // `eflm` là được coi là đã truy vết.
    const hasTrace = !!String(test.eflm_lookup_date || '').trim();
    const value = Number(test.eflm_tea === undefined ? test.tea : test.eflm_tea);
    return {
      value: hasTrace && Number.isFinite(value) && value > 0 ? value : null,
      criterion: 'TEa EFLM nhập và được truy vết bởi phòng xét nghiệm', catalog,
      note: hasTrace ? null : 'Chọn EFLM thì cần tra database EFLM, nhập TEa% và ngày tra cứu.',
      criterionDetail: null,
    };
  }
  if (source === 'lab') {
    ref = pickLabRef(matchingRefs) || ref;
    // TEa riêng của đúng số mức QC thắng TEa chung; mức chưa khai riêng mới
    // rơi về TEa chung, không bao giờ mượn giá trị của mức khác.
    const levelTea = Number.isInteger(level) ? ref?.lab_level_defaults?.find((item) => item.level === level) : undefined;
    const value = Number(levelTea?.tea ?? ref?.lab);
    return { value: Number.isFinite(value) && value > 0 ? value : null, criterion: ref?.lab_source || 'Hồ sơ TEa chuẩn hoá của phòng xét nghiệm', catalog, note: null, criterionDetail: null };
  }
  if (source === 'ricos') ref = matchingRefs.find((item) => item.ricos != null) || ref;
  if (source === 'clia') ref = matchingRefs.find((item) => item.clia != null || item.clia_absolute != null || !!item.clia_rule) || ref;
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

const KNOWN_SOURCES: readonly SigmaTeaSourceCore[] = ['lab', 'eflm', 'clia', 'ricos'];
/** Chỉ các nguồn được chọn rõ ở danh mục mới thay cách phân giải cũ. */
function explicitOperationalSource(test: TeaTestCore): SigmaTeaSourceCore | null {
  const source = String(test.operational_tea_source || '').trim().toLowerCase();
  return KNOWN_SOURCES.includes(source as SigmaTeaSourceCore) ? source as SigmaTeaSourceCore : null;
}

/** Nguồn mặc định khi mở Sigma hoặc tạo kỳ chưa có snapshot TEa. */
export function operationalTeaSource(test: TeaTestCore, refs: readonly TeaRefCore[], catalogRows: readonly TeaCatalogCore[]): SigmaTeaSourceCore | '' {
  const explicit = explicitOperationalSource(test);
  if (explicit) return explicit;
  if (hasLabTea(test, refs, catalogRows)) return 'lab';
  const legacy = String(test.tea_source || '').trim().toLowerCase() as SigmaTeaSourceCore;
  return KNOWN_SOURCES.includes(legacy) ? legacy : '';
}
export const MISSING_LAB_TEA_NOTE = 'Chưa có TEa của PXN: khai ở Cấu hình chung → Bảng TEa tham chiếu.';
export type OperationalTeaCore<T extends TeaCatalogCore = TeaCatalogCore> = ResolvedTeaCore<T> & {
  /** Nguồn đã chọn hoặc nguồn được phân giải; `null` khi chưa xác định nguồn. */
  source: SigmaTeaSourceCore | null;
};

/** TEa VẬN HÀNH của một xét nghiệm — căn cứ của cổng Bias khi lập dải, cột
 * "Trong TEa" của ngoại kiểm và mục TEa ở danh mục xét nghiệm. Phòng xét
 * nghiệm tự xác định yêu cầu chất lượng (ISO 15189:2022 7.3.7). Nguồn được
 * chọn rõ ở danh mục (`operational_tea_source`) được dùng trực tiếp, không
 * đổi nguồn khi thiếu giá trị. Với cấu hình cũ chưa chọn riêng, thứ tự là:
 *
 * 1. Hồ sơ TEa của PXN (Bảng TEa tham chiếu): TEa riêng của mức nếu truyền
 *    `level` và mức đó có khai, không thì TEa chung.
 * 2. Nguồn mà PXN đã chọn cho xét nghiệm ở trang Six Sigma (`tea_source`).
 * 3. Không có: trả `value = null` kèm lời nhắc, KHÔNG lấy `tests.tea`. Ô đó
 *    từng được điền một lần từ gợi ý danh mục (vd Natri 0,73% theo Ricos)
 *    nên lệch với TEa PXN thực dùng (2026-11-03).
 *
 * `targetMean` là nồng độ để quy đổi giới hạn tuyệt đối CLIA sang %: Mean của
 * mức QC, hoặc giá trị ấn định của mẫu ngoại kiểm. */
export function resolveOperationalTea<T extends TeaCatalogCore>(test: TeaTestCore, refs: readonly TeaRefCore[], catalogRows: readonly T[], targetMean?: number | null, level?: number | null): OperationalTeaCore<T> {
  const explicit = explicitOperationalSource(test);
  if (explicit) {
    const resolved = resolveTea(test, refs, catalogRows, explicit, targetMean, level);
    // Nguồn đã chọn thiếu dữ liệu thì báo thiếu, không âm thầm đổi sang nguồn khác.
    return { ...resolved, source: explicit, note: resolved.note || (resolved.value == null ? `Chưa có TEa cho nguồn ${SOURCE_SHORT_LABEL[explicit]} đã chọn.` : null) };
  }
  const lab = resolveTea(test, refs, catalogRows, 'lab', targetMean, level);
  if (lab.value != null) return { ...lab, source: 'lab' };
  const chosen = String(test.tea_source || '').trim().toLowerCase() as SigmaTeaSourceCore;
  if (chosen !== 'lab' && KNOWN_SOURCES.includes(chosen)) {
    const resolved = resolveTea(test, refs, catalogRows, chosen, targetMean, level);
    if (resolved.value != null) return { ...resolved, source: chosen };
  }
  return { ...lab, value: null, source: null, note: MISSING_LAB_TEA_NOTE };
}

const SOURCE_SHORT_LABEL: Record<SigmaTeaSourceCore, string> = { lab: 'PXN', eflm: 'EFLM', clia: 'CLIA', ricos: 'Ricos' };
const pct = (value: number) => `${Number(value.toFixed(2))}%`;

/** Dòng hiển thị TEa vận hành của một xét nghiệm khi CHƯA gắn với mức QC hay
 * nồng độ nào (danh mục xét nghiệm): TEa chung và TEa riêng từng mức của hồ
 * sơ PXN, hoặc tiêu chí của nguồn dự phòng (CLIA tuyệt đối in nguyên
 * "±4 mmol/L" vì chưa có nồng độ để quy đổi). */
export function operationalTeaSummary(test: TeaTestCore, refs: readonly TeaRefCore[], catalogRows: readonly TeaCatalogCore[]): { text: string; source: SigmaTeaSourceCore | null; sourceLabel: string } {
  const explicit = explicitOperationalSource(test);
  if (explicit && explicit !== 'lab') {
    const resolved = resolveTea(test, refs, catalogRows, explicit);
    return { text: resolved.value != null || resolved.criterionDetail ? teaCriterionText(resolved) : 'Chưa có TEa', source: explicit, sourceLabel: SOURCE_SHORT_LABEL[explicit] };
  }
  const general = resolveTea(test, refs, catalogRows, 'lab').value;
  const levels = labLevelTeas(test, refs, catalogRows);
  if (general != null || levels.length) {
    const parts = [
      ...(general != null ? [levels.length ? `Chung ${pct(general)}` : pct(general)] : []),
      ...[...levels].sort((a, b) => a.level - b.level).map((item) => `M${item.level} ${pct(item.tea)}`),
    ];
    return { text: parts.join(' · '), source: 'lab', sourceLabel: SOURCE_SHORT_LABEL.lab };
  }
  if (explicit === 'lab') return { text: 'Chưa có TEa của PXN', source: 'lab', sourceLabel: SOURCE_SHORT_LABEL.lab };
  const chosen = String(test.tea_source || '').trim().toLowerCase() as SigmaTeaSourceCore;
  if (chosen !== 'lab' && KNOWN_SOURCES.includes(chosen)) {
    const resolved = resolveTea(test, refs, catalogRows, chosen);
    if (resolved.value != null || resolved.criterionDetail?.absoluteUsable) {
      return { text: teaCriterionText(resolved), source: chosen, sourceLabel: SOURCE_SHORT_LABEL[chosen] };
    }
  }
  return { text: '', source: null, sourceLabel: '' };
}


