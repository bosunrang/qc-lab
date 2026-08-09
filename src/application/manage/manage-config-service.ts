type AnyRecord = Record<string, any>;

export type ManageConfigState = {
  instruments: AnyRecord[];
  machines: string[];
  tests: AnyRecord[];
  qcPanels?: AnyRecord[];
  assayGroups?: AnyRecord[];
  data?: Record<string, AnyRecord[]>;
  sigmaData?: Record<string, unknown>;
};

export type ManageConfigDependencies = {
  cleanText: (value: unknown, maximumLength?: number) => string;
  cleanId: (value: unknown) => string;
};

export function createManageConfigService({ cleanText, cleanId }: ManageConfigDependencies) {
  function textKey(value: unknown) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  }
  function sameText(first: unknown, second: unknown) { return textKey(first) === textKey(second); }
  function clean(value: unknown, maximumLength?: number) { return cleanText(value, maximumLength).trim(); }
  function defaultAssayLevels() {
    return [{ level: 1, mean: null, sd: null, low: null, high: null, rangeK: 2,
      mfgMean: null, mfgSd: null, applied: 'mfg', meanSdHistory: [] }];
  }

  function prepareInstrument(input: AnyRecord = {}) {
    return { name: clean(input.name), section: clean(input.section), manufacturer: clean(input.manufacturer),
      serial: clean(input.serial), active: input.active !== false };
  }
  function validateInstrument(state: ManageConfigState, { id = '', data = {} }: AnyRecord = {}) {
    const instruments = Array.isArray(state.instruments) ? state.instruments : [], cleaned = prepareInstrument(data);
    if (id && !instruments.some(item => item.id === id)) return { error: 'not-found', message: 'Không tìm thấy máy xét nghiệm cần cập nhật.' };
    if (!cleaned.name) return { error: 'missing-name', message: 'Nhập tên máy.' };
    if (instruments.some(item => item.id !== id && sameText(item.name, cleaned.name))) {
      return { error: 'duplicate-name', message: 'Tên máy xét nghiệm này đã tồn tại.' };
    }
    return { data: cleaned };
  }
  function saveInstrument(state: ManageConfigState, { id = '', newId = '', data = {} }: AnyRecord = {}) {
    const checked = validateInstrument(state, { id, data }); if (checked.error) return checked;
    const old = state.instruments.find(item => item.id === id) || null;
    const record = old || { id: cleanId(newId) };
    if (!old && !record.id) return { error: 'missing-id', message: 'Không thể tạo mã máy xét nghiệm.' };
    Object.assign(record, checked.data); if (!old) state.instruments.push(record);
    if (old) (state.tests || []).filter(test => test.instrumentId === id).forEach(test => { test.machine = record.name; });
    state.machines = [...new Set(state.instruments.map(item => item.name))];
    return { record, created: !old };
  }
  function instrumentRemoval(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const record = (state.instruments || []).find(item => item.id === id);
    if (!record) return { error: 'not-found', message: 'Không tìm thấy máy xét nghiệm.' };
    if ((state.tests || []).some(test => test.instrumentId === id)) {
      return { error: 'used-by-assay', record, message: 'Máy này đang được gắn với xét nghiệm. Hãy chuyển xét nghiệm sang máy khác trước.' };
    }
    if ((state.qcPanels || []).some(panel => panel.instrumentId === id)) {
      return { error: 'used-by-panel', record, message: 'Máy này đang được gắn với Panel QC. Hãy chuyển hoặc xóa Panel QC trước.' };
    }
    return { record };
  }
  function removeInstrument(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const checked = instrumentRemoval(state, { id }); if (checked.error) return checked;
    state.instruments = state.instruments.filter(item => item.id !== id);
    state.machines = [...new Set(state.instruments.map(item => item.name))];
    return { record: checked.record };
  }

  function validateAssay(state: ManageConfigState, options: AnyRecord = {}) {
    const { id = '', data = {} } = options;
    const existing = (state.tests || []).find(item => item.id === id) || null;
    const instrument = (state.instruments || []).find(item => item.id === data.instrumentId) || null;
    if (id && !existing) return { error: 'not-found', message: 'Không tìm thấy xét nghiệm cần cập nhật.' };
    if (!clean(data.name) || !instrument) return { error: 'missing-required', message: 'Chọn hoặc nhập tên xét nghiệm và chọn máy.' };
    if ((state.tests || []).some(item => item.id !== id && item.instrumentId === data.instrumentId
      && (item.analyteId && data.analyteId && item.analyteId === data.analyteId || sameText(item.name, data.name)))) {
      return { error: 'duplicate-assay', message: 'Xét nghiệm này đã tồn tại trên máy đã chọn.' };
    }
    if (!Number.isFinite(Number(data.tea)) || Number(data.tea) < 0) return { error: 'invalid-tea', message: 'TEa không được âm.' };
    if (!Number.isInteger(Number(data.decimalPlaces)) || Number(data.decimalPlaces) < 0 || Number(data.decimalPlaces) > 6) {
      return { error: 'invalid-decimals', message: 'Số chữ số thập phân phải từ 0 đến 6.' };
    }
    return { existing, inst: instrument };
  }
  function saveAssay(state: ManageConfigState, { id = '', newId = '', data = {} }: AnyRecord = {}) {
    const checked = validateAssay(state, { id, data }); if (checked.error) return checked;
    const existing = checked.existing;
    const oldInstrumentId = existing && existing.instrumentId;
    const record = existing || { id: cleanId(newId) };
    if (!existing && !record.id) return { error: 'missing-id', message: 'Không thể tạo mã xét nghiệm.' };
    Object.assign(record, data);
    if (!existing) { state.tests.push(record); state.data = state.data || {}; state.data[record.id] = []; }
    if (existing && oldInstrumentId && oldInstrumentId !== record.instrumentId) {
      (state.qcPanels || []).forEach(panel => {
        if (panel.instrumentId !== record.instrumentId) panel.testIds = (panel.testIds || []).filter((testId: string) => testId !== id);
      });
    }
    return { record, created: !existing, inst: checked.inst, oldInstrumentId };
  }
  function assayRemoval(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const record = (state.tests || []).find(item => item.id === id);
    if (!record) return { error: 'not-found', message: 'Không tìm thấy xét nghiệm.' };
    return { record, points: state.data && state.data[id] || [] };
  }
  function removeAssay(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const checked = assayRemoval(state, { id }); if (checked.error) return checked;
    const points = checked.points || [];
    state.tests = state.tests.filter(item => item.id !== id);
    (state.qcPanels || []).forEach(panel => { panel.testIds = (panel.testIds || []).filter((testId: string) => testId !== id); });
    (state.assayGroups || []).forEach(group => { group.testIds = (group.testIds || []).filter((testId: string) => testId !== id); });
    if (state.data) delete state.data[id]; if (state.sigmaData) delete state.sigmaData[id];
    return { record: checked.record, points, pointsCount: points.length };
  }

  return Object.freeze({ defaultAssayLevels, prepareInstrument, validateInstrument, saveInstrument,
    instrumentRemoval, removeInstrument, validateAssay, saveAssay, assayRemoval, removeAssay });
}

export type ManageConfigServiceApi = ReturnType<typeof createManageConfigService>;
