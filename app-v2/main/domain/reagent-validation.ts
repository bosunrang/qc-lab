// Validate cho ho so so sanh lo hoa chat (reagent lot comparison).
import { cleanText } from './text-utils';

export interface ReagentMetadataInput {
  reagent?: unknown; lotOld?: unknown; lotNew?: unknown; date?: unknown; operator?: unknown;
  sampleType?: unknown; unit?: unknown; biasTarget?: unknown; alpha?: unknown; coverageConfirmed?: unknown;
}
export interface PreparedReagentMetadata {
  reagent: string; lotOld: string; lotNew: string; date: string; operator: string;
  sampleType: string; unit: string; biasTarget: number; alpha: number; coverageConfirmed: boolean;
}

export type ReagentMetadataValidation =
  | { ok: true; data: PreparedReagentMetadata }
  | { ok: false; error: { code: 'invalid-bias-target' | 'invalid-alpha'; message: string } };

export function prepareReagentMetadata(input: ReagentMetadataInput, existing?: Partial<PreparedReagentMetadata>): PreparedReagentMetadata {
  const biasTargetNum = Number(input.biasTarget);
  const alphaNum = Number(input.alpha);
  // Mỗi ô trên giao diện lưu độc lập khi rời ô. Vì vậy input thường CHỈ có
  // một field; field không có trong input phải giữ nguyên dữ liệu đã lưu,
  // còn field có mặt với chuỗi rỗng mới là yêu cầu xoá giá trị đó.
  const has = (field: keyof ReagentMetadataInput) => Object.prototype.hasOwnProperty.call(input, field);
  const text = (field: 'reagent' | 'lotOld' | 'lotNew' | 'date' | 'operator' | 'sampleType' | 'unit', max: number, fallback = '') =>
    has(field) ? cleanText(input[field], max).trim() : String(existing?.[field] ?? fallback);
  return {
    reagent: text('reagent', 120) || existing?.reagent || 'Hóa chất mới',
    lotOld: text('lotOld', 80),
    lotNew: text('lotNew', 80),
    date: text('date', 20),
    operator: text('operator', 120),
    sampleType: text('sampleType', 120, 'Mẫu bệnh nhân') || 'Mẫu bệnh nhân',
    unit: text('unit', 40),
    biasTarget: input.biasTarget == null || input.biasTarget === '' || !Number.isFinite(biasTargetNum) ? (existing?.biasTarget ?? 6) : biasTargetNum,
    alpha: input.alpha == null || input.alpha === '' || !Number.isFinite(alphaNum) ? (existing?.alpha ?? 0.05) : alphaNum,
    coverageConfirmed: has('coverageConfirmed') ? !!input.coverageConfirmed : !!existing?.coverageConfirmed,
  };
}

/** Rào chắn ở domain, không chỉ dựa vào `<input type=number>`: API/import
 * vẫn có thể gửi 0, số âm hoặc alpha không dùng được cho t-test. Chuỗi rỗng
 * giữ nguyên cấu hình cũ để phù hợp cơ chế lưu từng ô khi blur. `tc1` được
 * suy ra từ p-value hai phía ở mức `2 × alpha`, do đó alpha phải nhỏ hơn .5.
 */
export function validateReagentMetadata(input: ReagentMetadataInput, existing?: Partial<PreparedReagentMetadata>): ReagentMetadataValidation {
  const has = (field: keyof ReagentMetadataInput) => Object.prototype.hasOwnProperty.call(input, field);
  const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0;
  if (has('biasTarget') && input.biasTarget !== '' && input.biasTarget != null && !positive(input.biasTarget)) {
    return { ok: false, error: { code: 'invalid-bias-target', message: 'Bias mong muốn phải là số lớn hơn 0.' } };
  }
  if (has('alpha') && input.alpha !== '' && input.alpha != null) {
    const alpha = Number(input.alpha);
    if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 0.5) {
      return { ok: false, error: { code: 'invalid-alpha', message: 'Mức ý nghĩa α phải lớn hơn 0 và nhỏ hơn 0,5.' } };
    }
  }
  return { ok: true, data: prepareReagentMetadata(input, existing) };
}

// "Chọn nhanh" người thực hiện/loại mẫu — port `reagent-comparison-service.ts`
// bản cũ (`ensureQuickList`/`addQuick`/`removeQuick`, state top-level
// `reagentOperators`/`reagentSampleTypes`, KHÔNG gắn theo từng phép so sánh
// — 1 danh sách CHUNG cho toàn app). Loại mẫu có 3 giá trị mặc định sẵn,
// người thực hiện bắt đầu rỗng, người dùng tự gõ thêm dần theo thời gian.
export type QuickValueType = 'operator' | 'sampleType';
export const DEFAULT_SAMPLE_TYPES: readonly string[] = ['Mẫu bệnh nhân', 'Mẫu nội kiểm (IQC)', 'Mẫu ngoại kiểm (EQA)'];

function searchKey(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function cleanQuickValueType(value: unknown): QuickValueType | null {
  return value === 'operator' || value === 'sampleType' ? value : null;
}

/** Thêm giá trị mới vào danh sách — không thêm trùng (so khớp không phân
 * biệt hoa/thường/dấu, khớp `searchKey()` app cũ), trả lại giá trị đã có
 * nếu trùng thay vì tạo thêm 1 dòng giống nhau. */
export function addQuickValue(list: readonly string[], value: unknown): { items: string[]; value: string; added: boolean } | { error: 'empty-value' } {
  const clean = cleanText(value, 120).trim();
  if (!clean) return { error: 'empty-value' };
  const existing = list.find(item => searchKey(item) === searchKey(clean));
  if (existing) return { items: [...list], value: existing, added: false };
  return { items: [...list, clean], value: clean, added: true };
}

export type ReagentRow = [string, string];

export function prepareReagentRows(rows: unknown): ReagentRow[] {
  if (!Array.isArray(rows) || !rows.length) return [['', ''], ['', ''], ['', ''], ['', ''], ['', '']];
  return rows.map(row => {
    const r = Array.isArray(row) ? row : ['', ''];
    return [String(r[0] ?? ''), String(r[1] ?? '')] as ReagentRow;
  });
}
