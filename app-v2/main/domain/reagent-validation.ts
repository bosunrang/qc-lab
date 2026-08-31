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

export type ReagentRow = [string, string];

export function prepareReagentRows(rows: unknown): ReagentRow[] {
  if (!Array.isArray(rows) || !rows.length) return [['', ''], ['', ''], ['', ''], ['', ''], ['', '']];
  return rows.map(row => {
    const r = Array.isArray(row) ? row : ['', ''];
    return [String(r[0] ?? ''), String(r[1] ?? '')] as ReagentRow;
  });
}
