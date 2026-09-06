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

export function prepareReagentMetadata(input: ReagentMetadataInput, existing?: Partial<PreparedReagentMetadata>): PreparedReagentMetadata {
  const biasTargetNum = Number(input.biasTarget);
  const alphaNum = Number(input.alpha);
  return {
    reagent: cleanText(input.reagent, 120).trim() || existing?.reagent || 'Hóa chất mới',
    lotOld: cleanText(input.lotOld, 80).trim(),
    lotNew: cleanText(input.lotNew, 80).trim(),
    date: cleanText(input.date, 20).trim(),
    operator: cleanText(input.operator, 120).trim(),
    sampleType: cleanText(input.sampleType, 120).trim() || 'Mẫu bệnh nhân',
    unit: cleanText(input.unit, 40).trim(),
    biasTarget: input.biasTarget == null || input.biasTarget === '' || !Number.isFinite(biasTargetNum) ? (existing?.biasTarget ?? 6) : biasTargetNum,
    alpha: input.alpha == null || input.alpha === '' || !Number.isFinite(alphaNum) ? (existing?.alpha ?? 0.05) : alphaNum,
    coverageConfirmed: !!input.coverageConfirmed,
  };
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
