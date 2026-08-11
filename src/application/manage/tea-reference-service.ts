export type TeaReference = Record<string, any>;
export type TeaReferenceState = { teaRefs?: TeaReference[] };
export type TeaReferenceSource = Record<string, any>;
export type TeaReferenceServiceApi = ReturnType<typeof createTeaReferenceService>;

type TeaReferenceRow = readonly any[];

export function createTeaReferenceService(deps: {
  key: (value: unknown) => string;
  analyteMeta: (name: unknown, record?: TeaReference) => Record<string, any>;
  effectiveReferences: () => TeaReferenceRow[];
  defaultReferences: () => TeaReferenceRow[];
  sourceRegistry: () => Record<string, TeaReferenceSource>;
  createId: () => string;
  todayIso: () => string;
  userName: () => string;
}) {
  const find = (state: TeaReferenceState, refKey: unknown) => {
    const key = deps.key(refKey);
    return (state.teaRefs || []).find(row => row.analyteId === refKey) || (state.teaRefs || []).find(row => deps.key(row.name) === key);
  };
  const numberOrNull = (value: unknown) => {
    const number = Number(value);
    return String(value == null ? '' : value).trim() !== '' && Number.isFinite(number) && number > 0 ? number : null;
  };
  const sourceMeta = (state: TeaReferenceState, name: unknown, source: string) => {
    const base = deps.sourceRegistry()[source] || {};
    const row = find(state, name);
    const custom = row?.sources?.[source] || {};
    return { ...base, ...Object.fromEntries(Object.entries(custom).filter(([, value]) => String(value ?? '').trim() !== '')) };
  };
  const stampSource = (state: TeaReferenceState, row: TeaReference, source: string) => {
    const base = sourceMeta(state, row.name, source);
    row.sources = row.sources || {};
    row.sources[source] = { ...base, status: 'reviewed', reviewedDate: deps.todayIso(), reviewedBy: deps.userName() };
    return row.sources[source];
  };
  const ensure = (state: TeaReferenceState, refKey: unknown) => {
    let record = find(state, refKey);
    let created = false;
    if (!record) {
      const source = deps.effectiveReferences().find(row => row[6] === refKey || deps.key(row[0]) === deps.key(refKey));
      const id = deps.createId();
      const naming = deps.analyteMeta(source ? source[0] : refKey);
      record = { id, analyteId: (source && source[6]) || naming.analyteId || ('custom-' + id), name: source ? source[0] : refKey, displayName: naming.displayName, standardName: naming.standardName, abbreviation: naming.abbreviation, aliases: naming.aliases, matrix: naming.matrix, unit: source ? source[1] : '', clia: source ? source[2] : null, ricos: source ? source[3] : null, lab: source ? source[7] : null, section: source ? source[4] : '', sources: {} };
      state.teaRefs = state.teaRefs || [];
      state.teaRefs.push(record);
      created = true;
    }
    return { record, created };
  };
  const edit = (state: TeaReferenceState, refKey: unknown, field: string, value: unknown) => {
    const result = ensure(state, refKey);
    const before = result.record[field];
    result.record[field] = numberOrNull(value);
    const source = stampSource(state, result.record, field);
    return { ...result, before, source };
  };
  const addCustomReference = (state: TeaReferenceState, input: { name: string; abbreviation: string; matrix: string; unit: string; section: string; clia: unknown; ricos: unknown }) => {
    const result = ensure(state, input.name);
    const record = result.record;
    record.name = input.name;
    record.abbreviation = input.abbreviation;
    record.standardName = input.name;
    record.displayName = input.abbreviation && deps.key(input.abbreviation) !== deps.key(input.name) ? `${input.name} (${input.abbreviation})` : input.name;
    record.aliases = input.abbreviation ? [input.abbreviation] : [];
    record.matrix = input.matrix;
    record.unit = input.unit;
    record.section = input.section;
    record.clia = numberOrNull(input.clia);
    record.ricos = numberOrNull(input.ricos);
    if (record.clia != null) stampSource(state, record, 'clia');
    if (record.ricos != null) stampSource(state, record, 'ricos');
    return result;
  };
  const saveLabProfile = (state: TeaReferenceState, refKey: unknown, profile: { value: number; source: string; reference: string; reason: string; effective: string; nextReview: string; prepared: string; approved: string; approvedDate: string; sourceLabel: string }) => {
    const result = ensure(state, refKey);
    const before = result.record.lab;
    result.record.lab = profile.value;
    result.record.labSource = profile.source;
    result.record.labPreparedBy = profile.prepared;
    result.record.labNextReviewDate = profile.nextReview;
    result.record.sources = result.record.sources || {};
    result.record.sources.lab = { ...(deps.sourceRegistry().lab || {}), id: 'lab-' + result.record.analyteId, version: profile.sourceLabel, document: profile.reference, effectiveDate: profile.effective, reviewedDate: profile.approvedDate, reviewedBy: profile.approved, status: 'reviewed', note: profile.reason };
    return { ...result, before };
  };
  const externalChanged = (record: TeaReference | undefined, refKey: unknown) => {
    const base = deps.defaultReferences().find(row => deps.analyteMeta(row[0]).analyteId === refKey);
    return !!(record && base && (record.unit !== base[1] || record.clia !== base[2] || record.ricos !== base[3] || record.section !== base[4] || ['cliaRule', 'cliaAbsolute', 'cliaAbsoluteUnit'].some(key => record[key] != null && record[key] !== '')));
  };
  const removeLabProfile = (state: TeaReferenceState, refKey: unknown, isDefault: boolean) => {
    const record = find(state, refKey);
    if (!record || record.lab == null) return { record, before: null, removedRecord: false };
    const before = record.lab;
    ['lab', 'labSource', 'labPreparedBy', 'labNextReviewDate'].forEach(key => delete record[key]);
    if (record.sources) delete record.sources.lab;
    const removedRecord = isDefault && !externalChanged(record, refKey);
    if (removedRecord) state.teaRefs = (state.teaRefs || []).filter(row => row !== record);
    return { record, before, removedRecord };
  };
  const restoreOrRemove = (state: TeaReferenceState, refKey: unknown, isDefault: boolean) => {
    const record = find(state, refKey);
    let restored = false;
    if (isDefault && record && record.lab != null) {
      const base = deps.defaultReferences().find(row => deps.analyteMeta(row[0]).analyteId === refKey);
      if (base) {
        record.name = base[0]; record.unit = base[1]; record.clia = base[2]; record.ricos = base[3]; record.section = base[4];
        record.sources = { lab: record.sources?.lab || {} };
        ['cliaRule', 'cliaAbsolute', 'cliaAbsoluteUnit'].forEach(key => delete record![key]);
        restored = true;
      }
    }
    if (!restored) state.teaRefs = (state.teaRefs || []).filter(row => row.analyteId !== refKey && deps.key(row.name) !== deps.key(refKey));
    return { record, restored };
  };
  return Object.freeze({ find, numberOrNull, sourceMeta, stampSource, ensure, edit, addCustomReference, saveLabProfile, externalChanged, removeLabProfile, restoreOrRemove });
}
