type AnyRecord = Record<string, any>;

export type ManageConfigState = {
  instruments: AnyRecord[];
  machines: string[];
  tests: AnyRecord[];
  qcPanels?: AnyRecord[];
  assayGroups?: AnyRecord[];
  qcLots?: AnyRecord[];
  lotGroups?: AnyRecord[];
  lotTransitions?: AnyRecord[];
  data?: Record<string, AnyRecord[]>;
  sigmaData?: Record<string, unknown>;
};

export type ManageConfigDependencies = {
  cleanText: (value: unknown, maximumLength?: number) => string;
  cleanId: (value: unknown) => string;
  targetFromLimits: (low: number, high: number) => AnyRecord | null;
  limitsFromTarget: (mean: number, sd: number) => AnyRecord | null;
};

export function createManageConfigService({ cleanText, cleanId, targetFromLimits, limitsFromTarget }: ManageConfigDependencies) {
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

  function preparePanel(input: AnyRecord = {}) {
    return { name: clean(input.name), instrumentId: clean(input.instrumentId), testIds: Array.isArray(input.testIds) ? [...new Set(input.testIds)] : [],
      note: cleanText(input.note, 5000), active: input.active !== false };
  }
  function validatePanel(state: ManageConfigState, { id = '', data = {} }: AnyRecord = {}) {
    const panels = state.qcPanels || [], cleaned = preparePanel(data);
    if (id && !panels.some(panel => panel.id === id)) return { error: 'not-found', message: 'Không tìm thấy Panel QC cần cập nhật.' };
    if (!cleaned.name) return { error: 'missing-name', message: 'Nhập tên Panel QC.' };
    if (!cleaned.instrumentId) return { error: 'missing-instrument', message: 'Chọn máy xét nghiệm.' };
    if (!cleaned.testIds.length) return { error: 'missing-tests', message: 'Chọn ít nhất một xét nghiệm.' };
    if (cleaned.testIds.some(testId => (state.tests || []).find(test => test.id === testId)?.instrumentId !== cleaned.instrumentId)) {
      return { error: 'wrong-instrument', message: 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.' };
    }
    if (panels.some(panel => panel.id !== id && panel.instrumentId === cleaned.instrumentId && sameText(panel.name, cleaned.name))) {
      return { error: 'duplicate-panel', message: 'Panel QC này đã tồn tại trên máy đã chọn.' };
    }
    return { data: cleaned };
  }
  function savePanel(state: ManageConfigState, { id = '', newId = '', data = {} }: AnyRecord = {}) {
    const checked = validatePanel(state, { id, data }); if (checked.error) return checked;
    const existing = (state.qcPanels || []).find(panel => panel.id === id) || null;
    const record = existing || { id: cleanId(newId) };
    if (!existing && !record.id) return { error: 'missing-id', message: 'Không thể tạo mã Panel QC.' };
    Object.assign(record, checked.data); if (!existing) { state.qcPanels = state.qcPanels || []; state.qcPanels.push(record); }
    return { record, created: !existing };
  }
  function panelRemoval(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const record = (state.qcPanels || []).find(panel => panel.id === id); if (!record) return { error: 'not-found' };
    if ((state.lotTransitions || []).some(transition => transition.panelId === id)) {
      return { error: 'used-by-transition', message: 'Panel này đang có lịch sử chuyển tiếp lô. Hãy xóa/chuyển các dòng chuyển tiếp trước.' };
    }
    return { record };
  }
  function removePanel(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const checked = panelRemoval(state, { id }); if (checked.error) return checked;
    state.qcPanels = (state.qcPanels || []).filter(panel => panel.id !== id);
    return { record: checked.record };
  }

  function sameIdSet(first: unknown, second: unknown) {
    const left = [...new Set(Array.isArray(first) ? first : [])].sort(), right = [...new Set(Array.isArray(second) ? second : [])].sort();
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }
  function prepareLotGroup(state: ManageConfigState, input: AnyRecord = {}) {
    const lotIds = [...new Set(Array.isArray(input.lotIds) ? input.lotIds : [])];
    const fallbackName = lotIds.map(id => (state.qcLots || []).find(lot => lot.id === id)?.lotNo).filter(Boolean).join('/');
    return { name: clean(input.name) || fallbackName, lotIds, note: cleanText(input.note, 5000), active: true };
  }
  function validateLotGroup(state: ManageConfigState, { id = '', data = {} }: AnyRecord = {}) {
    const groups = state.lotGroups || [], cleaned = prepareLotGroup(state, data);
    if (id && !groups.some(group => group.id === id)) return { error: 'not-found', message: 'Không tìm thấy nhóm lô cần cập nhật.' };
    if (cleaned.lotIds.length < 2) return { error: 'too-few-lots', message: 'Một nhóm lô cần chọn ít nhất 2 lô QC.' };
    if (!cleaned.name) return { error: 'missing-name', message: 'Nhập tên nhóm lô.' };
    if (groups.some(group => group.id !== id && (sameText(group.name, cleaned.name) || sameIdSet(group.lotIds, cleaned.lotIds)))) {
      return { error: 'duplicate-group', message: 'Nhóm lô này đã tồn tại hoặc trùng danh sách lô.' };
    }
    return { data: cleaned };
  }
  function saveLotGroup(state: ManageConfigState, { id = '', newId = '', data = {} }: AnyRecord = {}) {
    const checked = validateLotGroup(state, { id, data }); if (checked.error) return checked;
    const existing = (state.lotGroups || []).find(group => group.id === id) || null;
    const record = existing || { id: cleanId(newId) };
    if (!existing && !record.id) return { error: 'missing-id', message: 'Không thể tạo mã nhóm lô.' };
    Object.assign(record, checked.data); if (!existing) { state.lotGroups = state.lotGroups || []; state.lotGroups.push(record); }
    return { record, created: !existing };
  }
  function lotGroupRemoval(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const record = (state.lotGroups || []).find(group => group.id === id); if (!record) return { error: 'not-found' };
    if ((state.tests || []).some(test => (test.levels || []).some((level: AnyRecord) => level.qcLotId && (record.lotIds || []).includes(level.qcLotId)))) {
      return { error: 'used-by-assay', message: 'Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xóa nhóm.' };
    }
    return { record };
  }
  function removeLotGroup(state: ManageConfigState, { id = '' }: AnyRecord = {}) {
    const checked = lotGroupRemoval(state, { id }); if (checked.error) return checked;
    state.lotGroups = (state.lotGroups || []).filter(group => group.id !== id);
    return { record: checked.record };
  }
  function stopLotGroup(state: ManageConfigState, { id = '', stoppedAt = '' }: AnyRecord = {}) {
    const record = (state.lotGroups || []).find(group => group.id === id); if (!record) return { error: 'not-found' };
    if (record.active === false || record.status === 'stopped' || record.status === 'planned') return { error: 'not-stoppable', record };
    record.status = 'stopped'; record.stoppedAt = stoppedAt;
    return { record };
  }
  function validateLotTransition(state: ManageConfigState, options: AnyRecord = {}) {
    const { id = '', panelId = '', fromLotId = '', toLotId = '', status = '', switchesLot = () => false } = options;
    const old = (state.lotTransitions || []).find(transition => transition.id === id) || null;
    if (!panelId) return { error: 'missing-panel', message: 'Chọn Panel QC.' };
    if (!fromLotId || !toLotId || fromLotId === toLotId) return { error: 'invalid-lots', message: 'Chọn lô cũ và lô mới khác nhau từ danh sách.' };
    const fromLot = (state.qcLots || []).find(lot => lot.id === fromLotId), toLot = (state.qcLots || []).find(lot => lot.id === toLotId);
    if (!fromLot || !toLot) return { error: 'missing-lot', message: 'Không tìm thấy lô QC đã chọn.' };
    if (+fromLot.level !== +toLot.level) return { error: 'different-levels', message: 'Lô cũ và lô mới phải cùng mức QC để chuyển tiếp.' };
    if ((state.lotTransitions || []).some(transition => transition.id !== id && transition.panelId === panelId && transition.fromLotId === fromLotId && transition.toLotId === toLotId)) {
      return { error: 'duplicate-transition', message: 'Chuyển tiếp lô này đã tồn tại.' };
    }
    if (old && switchesLot(old) && status !== 'accepted') {
      return { error: 'accepted-immutable', message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không thể đổi ngược trạng thái.' };
    }
    return { old, fromLot, toLot, finalChanged: ['accepted', 'rejected'].includes(status) && (!old || old.status !== status) };
  }
  function saveLotTransition(state: ManageConfigState, { id = '', newId = '', data = {} }: AnyRecord = {}) {
    const existing = (state.lotTransitions || []).find(transition => transition.id === id) || null;
    const record = existing || { id: cleanId(newId) };
    if (!existing && !record.id) return { error: 'missing-id', message: 'Không thể tạo mã hồ sơ chuyển tiếp lô.' };
    Object.assign(record, data); if (!existing) { state.lotTransitions = state.lotTransitions || []; state.lotTransitions.push(record); }
    return { record, created: !existing };
  }
  function prepareLotTransitionData(options: AnyRecord = {}) {
    const { old = null, panelId = '', fromLotId = '', toLotId = '', startDate = '', status = '', finalChanged = false,
      today = '', approvedBy = '', approvedAt = '' } = options;
    return { panelId, fromLotId, toLotId, startDate: startDate || today, status, criteria: old?.criteria || '', conclusion: old?.conclusion || '',
      approvedBy: finalChanged ? approvedBy : old?.approvedBy || '', approvedAt: finalChanged ? approvedAt : old?.approvedAt || '', note: old?.note || '' };
  }
  function inspectAcceptedLotTransition(state: ManageConfigState, transition: AnyRecord = {}) {
    const from = (state.qcLots || []).find(lot => lot.id === transition.fromLotId);
    const to = (state.qcLots || []).find(lot => lot.id === transition.toLotId);
    const panel = (state.qcPanels || []).find(item => item.id === transition.panelId);
    if (!transition.fromLotId || !transition.toLotId || transition.status !== 'accepted' || !from || !to || !panel || +from.level !== +to.level) {
      return { from, to, panel, rows: [], missing: [], valid: false };
    }
    const rows = (panel.testIds || []).map((id: string) => (state.tests || []).find(test => test.id === id)).filter(Boolean)
      .map((test: AnyRecord) => ({ test, config: (test.levels || []).find((level: AnyRecord) => level.qcLotId === from.id) }))
      .filter((row: AnyRecord) => row.config)
      .map((row: AnyRecord) => ({ ...row, nextHistory: (row.config.meanSdHistory || []).slice().reverse().find((entry: AnyRecord) =>
        (entry.qcLotId === to.id || (!entry.qcLotId && (entry.lot || '') === to.lotNo)) && Number.isFinite(+entry.mean) && Number.isFinite(+entry.sd) && +entry.sd > 0) }));
    return { from, to, panel, rows, missing: rows.filter((row: AnyRecord) => !row.nextHistory), valid: true };
  }
  function transitionSwitchesLot(transition: AnyRecord = {}) {
    return !!(transition.fromLotId && transition.toLotId && transition.status === 'accepted');
  }
  function syncLotDepletion(state: ManageConfigState) {
    const retired = new Set((state.lotTransitions || []).filter(transitionSwitchesLot).map(transition => transition.fromLotId));
    (state.qcLots || []).forEach(lot => { lot.depleted = retired.has(lot.id); });
    return retired;
  }
  function normalizeLotGroups(state: ManageConfigState, onMergeGroup: (removedGroup: AnyRecord, keptGroupId: string) => void = () => {}) {
    const seen = new Map<string, string>(), drop = new Set<string>(); state.lotGroups = state.lotGroups || [];
    state.lotGroups.forEach(group => {
      group.lotIds = [...new Set(group.lotIds || [])].filter(id => (state.qcLots || []).some(lot => lot.id === id));
      if (!group.lotIds.length) return;
      const name = group.lotIds.map((id: string) => (state.qcLots || []).find(lot => lot.id === id)?.lotNo).filter(Boolean).join('/');
      if (name && group.active !== false && !group.name) group.name = name;
      const key = (group.active === false ? 'stopped' : 'active') + '|' + [...group.lotIds].sort().join('|');
      const keptGroupId = seen.get(key);
      if (keptGroupId) { onMergeGroup(group, keptGroupId); drop.add(group.id); } else seen.set(key, group.id);
    });
    if (drop.size) state.lotGroups = state.lotGroups.filter(group => !drop.has(group.id));
    return drop;
  }
  function applyAcceptedLotTransition(options: {
    state: ManageConfigState; transition: AnyRecord; uid: () => string; today: () => string;
    normalizeLotGroups: () => void; upsertHistory: (target: AnyRecord, lot: AnyRecord, values: AnyRecord) => AnyRecord;
    onMergeGroup?: (removedGroup: AnyRecord, existingGroup: AnyRecord) => void;
  }) {
    const { state, transition, uid, today, normalizeLotGroups, upsertHistory, onMergeGroup = () => {} } = options;
    const check = inspectAcceptedLotTransition(state, transition), { rows, missing } = check;
    const from = check.from, to = check.to;
    if (!check.valid || !from || !to || !rows.length || missing.length) return 0;
    state.lotGroups = state.lotGroups || [];
    const groupKey = (ids: unknown[]) => [...new Set(ids || [])].filter((id: any) => (state.qcLots || []).some(lot => lot.id === id)).sort().join('|');
    const groupName = (ids: unknown[]) => (ids || []).map((id: any) => (state.qcLots || []).find(lot => lot.id === id)?.lotNo).filter(Boolean).join('/');
    const removeGroups = new Set<string>();
    state.lotGroups.forEach(group => {
      if (group.active === false || !(group.lotIds || []).includes(from.id)) return;
      const oldIds: any[] = [...new Set(group.lotIds || [])], nextIds: any[] = [...new Set((group.lotIds || []).map((id: string) => id === from.id ? to.id : id))];
      const oldKey = groupKey(oldIds), autoNamed = !group.name || group.name === groupName(oldIds);
      const archived = state.lotGroups!.find(item => item.id !== group.id && item.active === false && item.stoppedByTransitionId === transition.id)
        || state.lotGroups!.find(item => item.active === false && groupKey(item.lotIds) === oldKey);
      if (!archived) state.lotGroups!.push({ id: uid(), name: group.name || groupName(oldIds), lotIds: oldIds,
        note: `Đã dừng khi chuyển tiếp lô ${from.lotNo} sang ${to.lotNo}`, active: false, status: 'stopped',
        stoppedAt: transition.startDate || today(), stoppedByTransitionId: transition.id });
      const nextKey = groupKey(nextIds), existing = state.lotGroups!.find(item => item.id !== group.id && item.active !== false && groupKey(item.lotIds) === nextKey);
      if (existing) { removeGroups.add(group.id); onMergeGroup(group, existing); }
      else { group.lotIds = nextIds; if (autoNamed) group.name = groupName(nextIds) || group.name; }
    });
    if (removeGroups.size) state.lotGroups = state.lotGroups.filter(group => !removeGroups.has(group.id));
    normalizeLotGroups();
    (state.qcLots || []).forEach(lot => { const group = (state.lotGroups || []).find(item => (item.lotIds || []).includes(lot.id)); lot.groupId = group ? group.id : ''; });
    let count = 0;
    rows.forEach((row: AnyRecord) => {
      const { config, nextHistory } = row;
      if (Number.isFinite(+config.mean) && Number.isFinite(+config.sd) && +config.sd > 0) {
        upsertHistory(config, from, { mean: +config.mean, sd: +config.sd, low: config.low == null ? null : +config.low, high: config.high == null ? null : +config.high,
          effectiveFrom: (config.meanSdHistory || []).find((entry: AnyRecord) => entry.qcLotId === from.id)?.effectiveFrom || '', effectiveTo: transition.startDate || from.exp || '', source: config.applied || 'mfg', planned: false, note: 'Trước chuyển tiếp lô' });
      }
      const next = upsertHistory(config, to, { mean: +nextHistory.mean, sd: +nextHistory.sd, low: nextHistory.low == null ? null : +nextHistory.low, high: nextHistory.high == null ? null : +nextHistory.high,
        effectiveFrom: transition.startDate || today(), effectiveTo: to.exp || '', source: nextHistory.source || 'mfg', planned: false, note: nextHistory.note || `Chuyển tiếp từ lô ${from.lotNo}` });
      Object.assign(config, { level: to.level, qcLotId: to.id, lot: to.lotNo, exp: to.exp, mean: +next.mean, sd: +next.sd, low: next.low == null ? null : +next.low,
        high: next.high == null ? null : +next.high, rangeK: 2, mfgMean: +next.mean, mfgSd: +next.sd, applied: next.source || 'mfg' });
      count++;
    });
    return count;
  }
  function lotTransitionRemoval(state: ManageConfigState, { id = '', switchesLot = () => false }: AnyRecord = {}) {
    const record = (state.lotTransitions || []).find(transition => transition.id === id); if (!record) return { error: 'not-found' };
    if (switchesLot(record)) return { error: 'accepted-applied', record,
      message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công.' };
    return { record };
  }
  function removeLotTransition(state: ManageConfigState, options: AnyRecord = {}) {
    const checked = lotTransitionRemoval(state, options); if (checked.error) return checked;
    state.lotTransitions = (state.lotTransitions || []).filter(transition => transition.id !== options.id);
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
  function lotGroupActivationCandidates(tests: AnyRecord[], lots: AnyRecord[], targetSnapshot: (test: AnyRecord, level: number, lotId: string, lotNo: string) => AnyRecord | null) {
    const candidates: AnyRecord[] = [];
    (tests || []).forEach(test => {
      (lots || []).forEach(lot => {
        const target = (test.levels || []).find((level: AnyRecord) => +level.level === +lot.level); if (!target || target.qcLotId === lot.id) return;
        const snapshot = targetSnapshot(test, lot.level, lot.id, lot.lotNo);
        if (!snapshot || !Number.isFinite(+snapshot.mean) || !Number.isFinite(+snapshot.sd) || +snapshot.sd <= 0) return;
        candidates.push({ t: test, lot, pick: { use: true, mean: snapshot.mean, low: snapshot.low, high: snapshot.high, sd: snapshot.sd } });
      });
    });
    return candidates;
  }
  function activationReplacedGroupId(test: AnyRecord, lot: AnyRecord, targetGroupId: string, groupsForLot: (lotId: string) => AnyRecord[]) {
    const target = (test.levels || []).find((level: AnyRecord) => +level.level === +lot.level);
    if (!target?.qcLotId) return '';
    const group = groupsForLot(target.qcLotId)[0];
    return group && group.id !== targetGroupId ? group.id : '';
  }
  function applyLotGroupActivation(options: {
    group: AnyRecord; candidates: AnyRecord[]; groups: AnyRecord[]; effectiveFrom: string; note: string;
    applyTarget: (test: AnyRecord, lot: AnyRecord, pick: AnyRecord, effectiveFrom: string, note: string) => boolean;
    groupsForLot: (lotId: string) => AnyRecord[]; groupInUse: (group: AnyRecord) => boolean;
  }) {
    const stoppedGroupIds = new Set<string>(); let count = 0;
    (options.candidates || []).forEach(({ t, lot, pick }) => {
      const oldGroupId = activationReplacedGroupId(t, lot, options.group.id, options.groupsForLot); if (oldGroupId) stoppedGroupIds.add(oldGroupId);
      if (options.applyTarget(t, lot, pick, options.effectiveFrom, options.note)) count++;
    });
    if (!count) {
      if (options.groupInUse(options.group)) { delete options.group.status; delete options.group.stoppedAt; return { status: 'already-active', count: 0, stoppedGroupIds: [] }; }
      return { status: 'unready', count: 0, stoppedGroupIds: [] };
    }
    stoppedGroupIds.forEach(id => { const group = (options.groups || []).find(item => item.id === id); if (group) { group.status = 'stopped'; group.stoppedAt = options.effectiveFrom; } });
    delete options.group.status; delete options.group.stoppedAt;
    return { status: 'applied', count, stoppedGroupIds: [...stoppedGroupIds] };
  }
  function validateLot(state: ManageConfigState, { id = '', data = {} }: AnyRecord = {}) {
    const lots = state.qcLots || [], record = lots.find(lot => lot.id === id) || null, level = Number(data.level) || 1;
    if (!clean(data.lotNo)) return { error: 'missing-lot-no', message: 'Nhập số lot.' };
    if (record && +record.level !== level && (state.tests || []).some(test => (test.levels || []).some((item: AnyRecord) => item.qcLotId === id))) {
      return { error: 'level-in-use', message: 'Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô trong Mean/SD trước.' };
    }
    if (lots.some(lot => lot.id !== id && +lot.level === level && sameText(lot.lotNo, data.lotNo))) {
      return { error: 'duplicate-lot', message: 'Số lô QC này đã tồn tại ở cùng mức QC.' };
    }
    return { record, level };
  }
  function saveLot(state: ManageConfigState, { id = '', newId = '', data = {}, renamePoints = () => 0 }: AnyRecord = {}) {
    const checked = validateLot(state, { id, data }); if (checked.error) return checked;
    const old = checked.record, oldLotNo = old?.lotNo || '', oldLevel = old ? +old.level : checked.level;
    const record = old || { id: cleanId(newId) };
    if (!old && !record.id) return { error: 'missing-id', message: 'Không thể tạo mã lô QC.' };
    Object.assign(record, data); if (!old) { state.qcLots = state.qcLots || []; state.qcLots.push(record); }
    (state.tests || []).forEach(test => (test.levels || []).filter((level: AnyRecord) => level.qcLotId === record.id).forEach((level: AnyRecord) => {
      level.level = data.level; level.lot = data.lotNo; level.exp = data.exp;
      (level.meanSdHistory || []).filter((entry: AnyRecord) => entry.qcLotId === record.id).forEach((entry: AnyRecord) => { entry.lot = data.lotNo; });
    }));
    const renamedPoints = old ? renamePoints(oldLevel, oldLotNo, data.lotNo) : 0;
    return { record, created: !old, oldLotNo, oldLevel, renamedPoints };
  }
  function lotPointsToRename(state: ManageConfigState, oldLevel: number, oldLotNo: string) {
    if (!oldLotNo) return [];
    const rows: AnyRecord[] = [];
    Object.keys(state.data || {}).forEach(testId => {
      (state.data![testId] || []).forEach(point => { if (+point.level === +oldLevel && (point.lot || '') === oldLotNo) rows.push(point); });
    });
    return rows;
  }
  function renameLotPoints(state: ManageConfigState, oldLevel: number, oldLotNo: string, newLotNo: string) {
    if (!oldLotNo || oldLotNo === newLotNo) return 0;
    const rows = lotPointsToRename(state, oldLevel, oldLotNo); rows.forEach(point => { point.lot = newLotNo; });
    return rows.length;
  }
  function lotRemoval(state: ManageConfigState, { id = '', switchesLot }: AnyRecord = {}) {
    const record = (state.qcLots || []).find(lot => lot.id === id); if (!record) return { error: 'not-found' };
    if ((state.tests || []).some(test => (test.levels || []).some((level: AnyRecord) => level.qcLotId === id))) {
      return { error: 'used-by-assay', message: 'Lô QC này đang được gắn với xét nghiệm. Hãy đổi lô trong xét nghiệm trước.' };
    }
    if ((state.lotTransitions || []).some(transition => (transition.fromLotId === id || transition.toLotId === id) && switchesLot(transition))) {
      return { error: 'used-by-accepted-transition', message: 'Lô QC này có hồ sơ chuyển tiếp đã CHẤP NHẬN (đã áp dụng vào cấu hình/Mean-SD). Không thể xóa lô trực tiếp — nếu thực sự cần, hãy xử lý hồ sơ chuyển tiếp đó trước.' };
    }
    return { record };
  }
  function removeLot(state: ManageConfigState, options: AnyRecord = {}) {
    const checked = lotRemoval(state, options); if (checked.error) return checked;
    const id = options.id;
    state.qcLots = (state.qcLots || []).filter(lot => lot.id !== id);
    (state.lotGroups || []).forEach(group => { group.lotIds = (group.lotIds || []).filter((lotId: string) => lotId !== id); });
    state.lotTransitions = (state.lotTransitions || []).filter(transition => transition.fromLotId !== id && transition.toLotId !== id);
    return { record: checked.record };
  }
  function targetPickBackfillPoints(points: AnyRecord[], test: AnyRecord, lot: AnyRecord, pick: AnyRecord) {
    if (!pick?.use) return [];
    const target = (test.levels || []).find((level: AnyRecord) => level.qcLotId === lot.id) || (test.levels || []).find((level: AnyRecord) => +level.level === +lot.level);
    if (!target || !target.lot || target.lot === lot.lotNo) return [];
    return (points || []).filter(point => point.level === target.level && (point.lot == null || point.lot === target.lot));
  }
  function normalizeTargetPick(input: AnyRecord = {}) {
    const meanRaw = String(input.meanRaw || '').trim(), lowRaw = String(input.lowRaw || '').trim(), highRaw = String(input.highRaw || '').trim(), sdRaw = String(input.sdRaw || '').trim();
    let mean = meanRaw === '' ? null : parseFloat(meanRaw), low = lowRaw === '' ? null : parseFloat(lowRaw), high = highRaw === '' ? null : parseFloat(highRaw), sd = sdRaw === '' ? null : parseFloat(sdRaw);
    const fromLimits = targetFromLimits(low as number, high as number);
    if (fromLimits) { if (!Number.isFinite(mean)) mean = fromLimits.mean; if (!Number.isFinite(sd) || (sd as number) <= 0) sd = fromLimits.sd; }
    const fromTarget = input.deriveLimits === false ? null : limitsFromTarget(mean as number, sd as number);
    if (fromTarget && lowRaw === '' && highRaw === '') { low = fromTarget.low; high = fromTarget.high; }
    if (!Number.isFinite(mean)) return { error: 'invalid-mean', message: 'Các xét nghiệm được chọn phải có trung bình mục tiêu hợp lệ.' };
    if (lowRaw !== '' && !Number.isFinite(low) || highRaw !== '' && !Number.isFinite(high)) return { error: 'invalid-limits', message: 'Giới hạn dưới/trên phải là số hợp lệ.' };
    if ((lowRaw !== '' || highRaw !== '') && (!Number.isFinite(low) || !Number.isFinite(high) || (high as number) <= (low as number))) {
      return { error: 'invalid-range', message: 'Nếu nhập giới hạn, cần nhập đủ giới hạn dưới và trên; giới hạn trên phải lớn hơn giới hạn dưới.' };
    }
    if (sdRaw !== '' && (!Number.isFinite(sd) || (sd as number) <= 0)) return { error: 'invalid-sd', message: 'Độ lệch chuẩn phải là số lớn hơn 0.' };
    if ((sd == null || !Number.isFinite(sd)) && Number.isFinite(low) && Number.isFinite(high)) sd = ((high as number) - (low as number)) / 4;
    if (!Number.isFinite(sd) || (sd as number) <= 0) return { error: 'missing-sd', message: 'Các xét nghiệm được chọn cần có SD, hoặc có đủ giới hạn dưới/trên để app ước tính SD theo ±2SD.' };
    return { use: true, mean, low, high, sd };
  }
  function applyTargetPick(options: {
    test: AnyRecord; lot: AnyRecord; pick: AnyRecord; effectiveFrom: string; note: string; lots: AnyRecord[]; points: AnyRecord[];
    upsertHistory: (target: AnyRecord, lot: AnyRecord, entry: AnyRecord) => void;
  }) {
    const { test, lot, pick, effectiveFrom, note, lots, points, upsertHistory } = options;
    const linked = (test.levels || []).find((level: AnyRecord) => level.qcLotId === lot.id);
    if (!pick.use) { if (linked) { linked.qcLotId = ''; linked.lot = ''; linked.exp = ''; return true; } return false; }
    const effectiveTo = lot.exp || '';
    let target = linked || (test.levels || []).find((level: AnyRecord) => +level.level === +lot.level);
    if (!target) {
      target = { level: lot.level, mean: pick.mean, sd: pick.sd, low: pick.low, high: pick.high, rangeK: 2,
        mfgMean: pick.mean, mfgSd: pick.sd, applied: 'mfg' };
      test.levels = test.levels || []; test.levels.push(target); test.levels.sort((first: AnyRecord, second: AnyRecord) => first.level - second.level);
    }
    target.meanSdHistory = Array.isArray(target.meanSdHistory) ? target.meanSdHistory : [];
    if (target.qcLotId && target.qcLotId !== lot.id) {
      const oldLot = (lots || []).find(item => item.id === target.qcLotId) || { id: target.qcLotId, lotNo: target.lot || '' };
      if (Number.isFinite(+target.mean) && Number.isFinite(+target.sd) && +target.sd > 0) {
        upsertHistory(target, oldLot, { mean: +target.mean, sd: +target.sd, low: target.low == null ? null : +target.low,
          high: target.high == null ? null : +target.high,
          effectiveFrom: (target.meanSdHistory || []).find((entry: AnyRecord) => entry.qcLotId === oldLot.id)?.effectiveFrom || '',
          effectiveTo: effectiveFrom, source: target.applied || 'mfg', planned: false, note: 'Trước khi đổi sang lô khác qua Mean/SD theo nhóm' });
      }
    }
    targetPickBackfillPoints(points, test, lot, pick).forEach(point => {
      point.lot = target.lot; point.qcMean = point.qcMean == null ? target.mean : point.qcMean; point.qcSd = point.qcSd == null ? target.sd : point.qcSd;
    });
    upsertHistory(target, lot, { mean: pick.mean, sd: pick.sd, low: pick.low, high: pick.high, effectiveFrom, effectiveTo,
      source: 'mfg', planned: false, note });
    Object.assign(target, { level: lot.level, qcLotId: lot.id, lot: lot.lotNo, exp: lot.exp, mean: pick.mean, sd: pick.sd,
      low: pick.low, high: pick.high, rangeK: 2, mfgMean: pick.mean, mfgSd: pick.sd, applied: 'mfg' });
    return true;
  }
  function applyPlannedTarget(options: {
    test: AnyRecord; lot: AnyRecord; pick: AnyRecord; note: string;
    upsertHistory: (target: AnyRecord, lot: AnyRecord, entry: AnyRecord) => void;
  }) {
    const { test, lot, pick, note, upsertHistory } = options;
    if (!pick.use) return false;
    const target = (test.levels || []).find((level: AnyRecord) => +level.level === +lot.level); if (!target) return false;
    target.meanSdHistory = Array.isArray(target.meanSdHistory) ? target.meanSdHistory : [];
    upsertHistory(target, lot, { mean: pick.mean, sd: pick.sd, low: pick.low, high: pick.high, effectiveFrom: '', effectiveTo: '',
      source: 'mfg', planned: true, note });
    return true;
  }
  function applyTargetMatrix(options: {
    picked: AnyRecord[]; group: AnyRecord; mode: string; overwrites: AnyRecord[]; effectiveFrom: string; note: string;
    tests: AnyRecord[]; lots: AnyRecord[]; groups: AnyRecord[]; pointsForTest: (test: AnyRecord) => AnyRecord[];
    groupsForLot: (lotId: string) => AnyRecord[]; upsertHistory: (target: AnyRecord, lot: AnyRecord, entry: AnyRecord) => void;
  }) {
    const overwriteKeys = new Set((options.overwrites || []).map(item => item.testId + '|' + item.lot.level));
    const stoppedGroupIds = new Set<string>(); let count = 0;
    (options.picked || []).forEach(pick => {
      const test = (options.tests || []).find(item => item.id === pick.testId); if (!test) return;
      const overwrite = overwriteKeys.has(pick.testId + '|' + pick.lot.level);
      if (overwrite && options.mode === 'planned') {
        if (applyPlannedTarget({ test, lot: pick.lot, pick, note: options.note + ' (dự kiến)', upsertHistory: options.upsertHistory })) count++;
        return;
      }
      if (overwrite && options.mode === 'switch') {
        const current = (test.levels || []).find((level: AnyRecord) => +level.level === +pick.lot.level);
        const oldGroup = current?.qcLotId ? options.groupsForLot(current.qcLotId)[0] : null;
        if (oldGroup && oldGroup.id !== options.group.id) stoppedGroupIds.add(oldGroup.id);
      }
      if (applyTargetPick({ test, lot: pick.lot, pick, effectiveFrom: options.effectiveFrom, note: options.note, lots: options.lots,
        points: options.pointsForTest(test), upsertHistory: options.upsertHistory })) count++;
    });
    if (options.mode === 'switch' && count) {
      stoppedGroupIds.forEach(id => { const group = (options.groups || []).find(item => item.id === id); if (group) { group.status = 'stopped'; group.stoppedAt = options.effectiveFrom; } });
      delete options.group.status; delete options.group.stoppedAt;
    } else if (options.mode === 'planned' && overwriteKeys.size && count) options.group.status = 'planned';
    return { count, stoppedGroupIds: [...stoppedGroupIds] };
  }

  return Object.freeze({ defaultAssayLevels, prepareInstrument, validateInstrument, saveInstrument,
    instrumentRemoval, removeInstrument, preparePanel, validatePanel, savePanel, panelRemoval, removePanel, prepareLotGroup, validateLotGroup, saveLotGroup, lotGroupRemoval, removeLotGroup, stopLotGroup, validateLotTransition, saveLotTransition, prepareLotTransitionData, inspectAcceptedLotTransition, transitionSwitchesLot, syncLotDepletion, normalizeLotGroups, applyAcceptedLotTransition, lotTransitionRemoval, removeLotTransition, validateAssay, saveAssay, assayRemoval, removeAssay, lotGroupActivationCandidates, activationReplacedGroupId, applyLotGroupActivation, validateLot, saveLot, lotPointsToRename, renameLotPoints, lotRemoval, removeLot, targetPickBackfillPoints, normalizeTargetPick, applyTargetPick, applyPlannedTarget, applyTargetMatrix });
}

export type ManageConfigServiceApi = ReturnType<typeof createManageConfigService>;
