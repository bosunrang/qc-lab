export type ReagentMetadata = {
  reagent?: unknown; lotOld?: unknown; lotNew?: unknown; date?: unknown;
  operator?: unknown; sampleType?: unknown; unit?: unknown; biasTarget?: unknown;
  alpha?: unknown; coverageConfirmed?: unknown; [key: string]: unknown;
};
export type ReagentComparison = { id: unknown; test: ReagentMetadata; rows: unknown[][] };
export type ReagentState = {
  reagentTests?: ReagentComparison[]; reagentOperators?: string[];
  reagentSampleTypes?: string[]; [key: string]: unknown;
};
export type ReagentSanitizers = {
  cleanText: (value: unknown, maximumLength?: number) => string;
  cleanId: (value: unknown) => string;
};
type MetadataKey = 'reagent' | 'lotOld' | 'lotNew' | 'date' | 'operator'
  | 'sampleType' | 'unit' | 'biasTarget' | 'alpha' | 'coverageConfirmed';
type QuickType = 'sampleType' | 'operator';
type QuickKey = 'reagentSampleTypes' | 'reagentOperators';

const DEFAULT_SAMPLE_TYPES = Object.freeze(['Mẫu bệnh nhân', 'Mẫu nội kiểm (IQC)', 'Mẫu ngoại kiểm (EQA)']);
const META_KEYS: ReadonlySet<unknown> = new Set<MetadataKey>([
  'reagent', 'lotOld', 'lotNew', 'date', 'operator', 'sampleType', 'unit',
  'biasTarget', 'alpha', 'coverageConfirmed',
]);

export function createReagentComparisonService({ cleanText, cleanId }: ReagentSanitizers) {
  if (typeof cleanText !== 'function' || typeof cleanId !== 'function') {
    throw new TypeError('ReagentComparisonService cần cleanText và cleanId');
  }
  function blank(id?: unknown, name: unknown = 'Hóa chất mới', unit: unknown = ''): ReagentComparison {
    return { id: id || '', test: {
      reagent: cleanText(name || 'Hóa chất mới').trim() || 'Hóa chất mới', lotOld: '', lotNew: '', date: '', operator: '',
      sampleType: DEFAULT_SAMPLE_TYPES[0], unit: cleanText(unit), biasTarget: 6, alpha: 0.05, coverageConfirmed: false,
    }, rows: [['', ''], ['', ''], ['', ''], ['', ''], ['', '']] };
  }
  function comparisons(state: ReagentState): ReagentComparison[] {
    if (!Array.isArray(state.reagentTests)) state.reagentTests = [];
    return state.reagentTests;
  }
  function find(state: ReagentState, id?: unknown): ReagentComparison | null {
    return comparisons(state).find(item => item && item.id === id) || null;
  }
  function ensureOne(state: ReagentState, { id }: { id?: unknown } = {}) {
    const items = comparisons(state);
    if (items.length) return { created: false, comparison: items[0] };
    const comparison = blank(id); items.push(comparison); return { created: true, comparison };
  }
  function create(state: ReagentState, { id, name, unit }: { id?: unknown; name?: unknown; unit?: unknown } = {}) {
    const cleanIdentifier = cleanId(id);
    if (!cleanIdentifier) return { error: 'missing-id' as const };
    if (find(state, cleanIdentifier)) return { error: 'duplicate-id' as const };
    const comparison = blank(cleanIdentifier, name, unit); comparisons(state).push(comparison); return { comparison };
  }
  function updateMetadata(state: ReagentState, { id, key, value }: { id?: unknown; key?: unknown; value?: unknown } = {}) {
    const comparison = find(state, id);
    if (!comparison) return { error: 'not-found' as const };
    if (!META_KEYS.has(key)) return { error: 'invalid-field' as const };
    const field = key as MetadataKey;
    comparison.test = comparison.test && typeof comparison.test === 'object' ? comparison.test : {};
    let clean: unknown;
    if (field === 'coverageConfirmed') clean = !!value;
    else if (field === 'biasTarget' || field === 'alpha') {
      const numeric = Number(value);
      clean = value === '' || value == null || !Number.isFinite(numeric) ? comparison.test[field] : numeric;
    } else clean = cleanText(value, field === 'date' ? 20 : undefined);
    comparison.test[field] = clean;
    return { comparison, key: field, value: clean };
  }
  function updateCell(state: ReagentState, { id, rowIndex, column, value }: { id?: unknown; rowIndex?: unknown; column?: unknown; value?: unknown } = {}) {
    const comparison = find(state, id), row = Number(rowIndex), col = Number(column);
    if (!comparison) return { error: 'not-found' as const };
    if (!Number.isInteger(row) || row < 0 || !Array.isArray(comparison.rows) || !comparison.rows[row]) return { error: 'invalid-row' as const };
    if (col !== 0 && col !== 1) return { error: 'invalid-column' as const };
    comparison.rows[row][col] = value; return { comparison, rowIndex: row, column: col };
  }
  function addRow(state: ReagentState, { id }: { id?: unknown } = {}) {
    const comparison = find(state, id); if (!comparison) return { error: 'not-found' as const };
    if (!Array.isArray(comparison.rows)) comparison.rows = [];
    comparison.rows.push(['', '']); return { comparison, rowIndex: comparison.rows.length - 1 };
  }
  function removeRow(state: ReagentState, { id, rowIndex }: { id?: unknown; rowIndex?: unknown } = {}) {
    const comparison = find(state, id), row = Number(rowIndex);
    if (!comparison) return { error: 'not-found' as const };
    if (!Number.isInteger(row) || row < 0 || !Array.isArray(comparison.rows) || row >= comparison.rows.length) return { error: 'invalid-row' as const };
    const removed = comparison.rows.splice(row, 1)[0]; if (!comparison.rows.length) comparison.rows.push(['', '']);
    return { comparison, removed, rowIndex: row };
  }
  function clearRows(state: ReagentState, { id }: { id?: unknown } = {}) {
    const comparison = find(state, id); if (!comparison) return { error: 'not-found' as const };
    comparison.rows = [['', ''], ['', ''], ['', ''], ['', ''], ['', '']]; return { comparison };
  }
  function remove(state: ReagentState, { id }: { id?: unknown } = {}) {
    const items = comparisons(state), index = items.findIndex(item => item && item.id === id);
    if (index < 0) return { error: 'not-found' as const };
    if (items.length <= 1) return { error: 'last-comparison' as const };
    const removed = items.splice(index, 1)[0], next = items[Math.min(index, items.length - 1)] || null;
    return { removed, nextId: next?.id || '' };
  }
  function quickKey(type?: unknown): QuickKey | '' {
    return type === 'sampleType' ? 'reagentSampleTypes' : type === 'operator' ? 'reagentOperators' : '';
  }
  function ensureQuickList(state: ReagentState, type?: unknown) {
    const key = quickKey(type); if (!key) return { error: 'invalid-type' as const };
    if (!Array.isArray(state[key])) state[key] = type === 'sampleType' ? [...DEFAULT_SAMPLE_TYPES] : [];
    if (type === 'sampleType' && !state[key].length) state[key] = [...DEFAULT_SAMPLE_TYPES];
    return { key, items: state[key] };
  }
  function searchKey(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  }
  function addQuick(state: ReagentState, { type, value }: { type?: QuickType; value?: unknown } = {}) {
    const list = ensureQuickList(state, type); if ('error' in list) return list;
    const clean = cleanText(value, 120).trim(); if (!clean) return { error: 'empty-value' as const };
    const existing = list.items.find(item => searchKey(item) === searchKey(clean));
    if (existing) return { items: list.items, value: existing, added: false };
    list.items.push(clean); return { items: list.items, value: clean, added: true };
  }
  function removeQuick(state: ReagentState, { type, index }: { type?: QuickType; index?: unknown } = {}) {
    const list = ensureQuickList(state, type), itemIndex = Number(index); if ('error' in list) return list;
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= list.items.length) return { error: 'invalid-index' as const };
    return { items: list.items, removed: list.items.splice(itemIndex, 1)[0] };
  }
  function pickQuick(state: ReagentState, { id, type, index }: { id?: unknown; type?: QuickType; index?: unknown } = {}) {
    const list = ensureQuickList(state, type), itemIndex = Number(index); if ('error' in list) return list;
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= list.items.length) return { error: 'invalid-index' as const };
    return updateMetadata(state, { id, key: type === 'sampleType' ? 'sampleType' : 'operator', value: list.items[itemIndex] });
  }
  return Object.freeze({ blank, comparisons, find, ensureOne, create, updateMetadata, updateCell, addRow, removeRow,
    clearRows, remove, quickKey, ensureQuickList, addQuick, removeQuick, pickQuick });
}
export type ReagentComparisonServiceApi = ReturnType<typeof createReagentComparisonService>;
