type AnyRecord = Record<string, any>;
export type EntryState = {
  data?: Record<string, AnyRecord[]>;
  tests?: AnyRecord[];
  actions?: AnyRecord[];
  periodLocks?: AnyRecord[];
  [key: string]: any;
};
export type EntryDependencies = {
  cleanText: (value: unknown, maximumLength?: number) => string;
  cleanId: (value: unknown) => string;
  valueDecimals: (value: unknown) => number;
  isPeriodLocked: (state: EntryState, date: unknown) => boolean;
};

export function createEntryService({ cleanText, cleanId, valueDecimals, isPeriodLocked }: EntryDependencies) {
  function nextRunIdFor(state: EntryState, testId: string, date: string) {
    const prefix = date + '-';
    const nums = ((state.data && state.data[testId]) || []).filter(point => !point.voided)
      .map(point => String(point.runId || '')).filter(value => value.startsWith(prefix))
      .map(value => parseInt(value.slice(prefix.length))).filter(Number.isFinite);
    return prefix + (nums.length ? Math.max(...nums) + 1 : 1);
  }
  function cleanRunId(value: unknown) { return cleanText(value, 120).trim(); }
  function pointRunNoFor(point: AnyRecord) {
    const match = /(?:^|-)(\d+)$/.exec(String(point && point.runId || ''));
    return match ? Number(match[1]) : 1;
  }
  function buildEntryWindow({ points = [], days = 30, start = '', end = '', today = '' }: AnyRecord = {}) {
    const all = Array.isArray(points) ? points.slice() : [];
    const ordered = all.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || pointRunNoFor(a) - pointRunNoFor(b));
    const safeEnd = end || today || ((ordered.length && ordered[ordered.length - 1].date) || '');
    let safeStart = start;
    if (!safeStart && safeEnd) {
      const date = new Date(safeEnd + 'T00:00:00Z'), span = Math.max(1, Number(days) || 30) - 1;
      date.setUTCDate(date.getUTCDate() - span); safeStart = date.toISOString().slice(0, 10);
    }
    return { all, pts: ordered.filter(point => point.date >= safeStart && point.date <= safeEnd), start: safeStart, end: safeEnd };
  }
  function groupByMachine(tests: AnyRecord[], fallback = '(Chưa gán máy)') {
    const groups = new Map<string, AnyRecord[]>();
    (Array.isArray(tests) ? tests : []).forEach(test => {
      const machine = String(test && test.machine || '').trim() || fallback;
      if (!groups.has(machine)) groups.set(machine, []); groups.get(machine)?.push(test);
    });
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')));
  }
  function buildSheetCalendar(month: unknown, today: unknown) {
    const todayMonth = /^\d{4}-\d{2}-\d{2}$/.test(String(today || '')) ? String(today).slice(0, 7) : '';
    const activeMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || '')) ? String(month) : todayMonth;
    const match = /^(\d{4})-(\d{2})$/.exec(activeMonth);
    if (!match) return { activeMonth: '', year: 0, month: 0, start: '', end: '', days: [], yearMin: 0, yearMax: 0 };
    const year = Number(match[1]), monthNo = Number(match[2]);
    const end = new Date(Date.UTC(year, monthNo, 0)).toISOString().slice(0, 10);
    const sheetDays = Array.from({ length: Number(end.slice(-2)) }, (_, index) => `${activeMonth}-${String(index + 1).padStart(2, '0')}`);
    const currentYear = /^\d{4}-\d{2}-\d{2}$/.test(String(today || '')) ? Number(String(today).slice(0, 4)) : year;
    return { activeMonth, year, month: monthNo, start: `${activeMonth}-01`, end, days: sheetDays,
      yearMin: Math.min(year, currentYear - 5), yearMax: Math.max(year, currentYear + 5) };
  }
  function summarizeRunStatus(levelPoints: AnyRecord[][], verdictById: any) {
    let worst = 'ok', rulesAll: any[] = [], warnRules: any[] = [], rejRules: any[] = [], hasPoint = false;
    const verdict = (point: AnyRecord) => {
      const value = verdictById && typeof verdictById.get === 'function' ? verdictById.get(point.id)
        : typeof verdictById === 'function' ? verdictById(point) : null;
      return value || { level: 'ok', rules: [] };
    };
    (Array.isArray(levelPoints) ? levelPoints : []).forEach(points => {
      const rows = Array.isArray(points) ? points.filter(Boolean) : []; if (!rows.length) return;
      hasPoint = true;
      const accepted = [...rows].reverse().find(point => verdict(point).level !== 'rej') || rows[rows.length - 1];
      const result = verdict(accepted), rules = Array.isArray(result.rules) ? result.rules : [];
      if (result.level === 'rej') worst = 'rej'; else if (result.level === 'warn' && worst !== 'rej') worst = 'warn';
      rulesAll = rulesAll.concat(rules);
      rules.forEach((rule: any) => { if (rule === '1-2s' || result.level === 'warn') warnRules.push(rule); else rejRules.push(rule); });
    });
    return { hasPoint, worst, rulesAll, warnRules, rejRules };
  }
  function buildPointView({ point, verdict = {}, mean, sd, previousLot }: AnyRecord = {}) {
    const level = verdict && verdict.level || 'ok', rules = Array.isArray(verdict && verdict.rules) ? verdict.rules : [];
    const verdictZ = Number(verdict && verdict.z), value = Number(point && point.val), targetMean = Number(mean), targetSd = Number(sd);
    const z = Number.isFinite(verdictZ) ? verdictZ : Number.isFinite(value) && Number.isFinite(targetMean)
      && Number.isFinite(targetSd) && targetSd !== 0 ? (value - targetMean) / targetSd : NaN;
    const isPrevious = previousLot !== undefined;
    return { level, rules, z, isPrevious, valueClass: isPrevious ? 'prev' : level === 'warn' ? 'warn' : level === 'rej' ? 'rej' : 'ok' };
  }
  function preparePointInput({ tid, level, date, value, valueDecimals: savedValueDecimals, runId, cfg, staff, id }: AnyRecord = {}) {
    const errors: string[] = [], cleanTid = cleanId(tid), cleanDate = cleanText(date, 20).trim(), numericLevel = Number(level);
    const val = typeof value === 'number' ? value : parseFloat(String(value == null ? '' : value).trim());
    const savedDecimals = Number(savedValueDecimals);
    const decimals = Number.isInteger(savedDecimals) && savedDecimals >= 0 ? Math.min(6, savedDecimals) : valueDecimals(value);
    if (!cleanTid) errors.push('missing-test'); if (!Number.isFinite(numericLevel)) errors.push('invalid-level');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) errors.push('invalid-date'); if (!Number.isFinite(val)) errors.push('invalid-value');
    if (!cfg || typeof cfg !== 'object') errors.push('missing-config'); if (errors.length) return { ok: false, errors };
    return { ok: true, point: { tid: cleanTid, level: numericLevel, date: cleanDate, val, valueDecimals: decimals,
      runId: cleanRunId(runId) || `${cleanDate}-1`, cfg, staff: staff || {}, id: id || '' } };
  }
  function saveDateNote(state: EntryState, tid: string, date: string, value: unknown) {
    if (isPeriodLocked(state, date)) return { error: 'period-locked' as const };
    const rows = ((state.data && state.data[tid]) || []).filter(point => !point.voided && point.date === date);
    if (!rows.length) return null;
    const note = cleanText(value, 1000).trim(); rows.forEach(point => { point.note = note; }); return { note, rows };
  }
  function updateDateNoteCommand(state: EntryState, { testId, date, value, formatDate }: AnyRecord = {}) {
    const tid = cleanId(testId), cleanDate = cleanText(date, 20).trim();
    if (!tid) return { ok: false, error: 'invalid-test' as const };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return { ok: false, error: 'invalid-date' as const };
    const test = ((state && state.tests) || []).find(item => item && item.id === tid);
    if (!test) return { ok: false, error: 'test-not-found' as const };
    const result = saveDateNote(state, tid, cleanDate, value); if (result && 'error' in result) return { ok: false, error: result.error };
    if (!result) return { ok: false, error: 'no-points' as const };
    const shownDate = typeof formatDate === 'function' ? formatDate(cleanDate) : cleanDate, note = result.note;
    return { ok: true, note, rows: result.rows, messageCode: note ? 'note-saved' : 'note-removed', effects: {
      audit: { action: 'Ghi chú QC', detail: `Ngày ${shownDate}${note ? ' · ' + note : ' · xóa ghi chú'}`, target: test.name || '' },
      save: { clearDerived: false, testId: tid },
    } };
  }
  function addPoint(state: EntryState, { tid, level, date, val, valueDecimals: decimals, runId, cfg, staff, id }: AnyRecord) {
    if (isPeriodLocked(state, date)) return { error: 'period-locked' as const };
    state.data = state.data || {}; state.data[tid] = state.data[tid] || [];
    const dayNote = ((state.data[tid] || []).find(point => !point.voided && point.date === date && String(point.note || '').trim()) || {}).note || '';
    const point = { id, date, runId, level, val, valueDecimals: decimals, lot: cfg.lot || '', qcMean: cfg.mean, qcSd: cfg.sd, note: dayNote, ...staff };
    state.data[tid].push(point); return point;
  }
  function recordPoint(state: EntryState, input: AnyRecord) {
    const prepared = preparePointInput(input || {}); if (!prepared.ok) return prepared;
    const point = prepared.point as AnyRecord;
    const saved = addPoint(state, point); if (saved && 'error' in saved) return { ok: false, error: saved.error, point };
    if (!saved) return { ok: false, error: 'save-failed' as const, point }; return { ok: true, point: saved };
  }
  function voidPoint(state: EntryState, { tid, pointId, reason, kind = 'analytical', openNce = true,
    rule = 'Không có luật Westgard', errorType = '—', qcVerdict = 'invalid', staff = {}, nowIso, today,
    id, nceId, dueDate, formatDate, formatNumber }: AnyRecord) {
    const point = ((state.data && state.data[tid]) || []).find(item => item.id === pointId);
    if (!point || point.voided) return null; if (isPeriodLocked(state, point.date)) return { error: 'period-locked' as const };
    const normalizedKind = ['data-entry', 'analytical', 'other'].includes(kind) ? kind : 'other';
    const kindLabel = normalizedKind === 'analytical' ? 'Kết quả QC thực tế không hợp lệ' : normalizedKind === 'data-entry' ? 'Nhập sai dữ liệu' : '';
    const note = cleanText(reason, 1000).trim(); if (!kindLabel && note.length < 5) return { error: 'reason-too-short' as const };
    const clean = kindLabel ? (note ? `${kindLabel} — ${note}` : kindLabel) : note;
    point.voided = true; point.voidReason = clean; point.voidKind = normalizedKind; point.voidRequiresRerun = !!openNce;
    point.voidedAt = nowIso; point.voidedBy = staff.operatorName || staff.operatorUsername || '';
    state.actions = state.actions || [];
    const existing = [...state.actions].reverse().find(action => action.pointId === point.id && +action.protocolVersion >= 2
      && action.recordStatus !== 'cancelled' && (action.approvalStatus || 'pending') !== 'approved');
    let action = existing || null;
    if (openNce && !action) action = { id, protocolVersion: 3, nceId, date: point.date || today, createdAt: nowIso,
      updatedAt: nowIso, openedFromVoid: true, createdByUserId: staff.operatorId || '', createdByUsername: staff.operatorUsername || '',
      contentEditorUserIds: [staff.operatorId || ''].filter(Boolean),
      contentEditorUsernames: [String(staff.operatorUsername || '').trim().toLowerCase()].filter(Boolean),
      testId: tid, level: point.level, lot: point.lot || '', pointId: point.id,
      rule: cleanText(rule, 200).trim() || 'Không có luật Westgard', errorType: cleanText(errorType, 120).trim() || '—',
      qcVerdict: ['warn', 'rej', 'invalid'].includes(qcVerdict) ? qcVerdict : 'invalid', eventSource: 'iqc', processPhase: 'exam',
      correction: `Hủy điểm ngày ${formatDate(point.date)}, lần ${point.runId || '—'}, giá trị ${formatNumber(point.val)}. Lý do: ${clean}`,
      by: point.voidedBy, dueDate: dueDate || '', containmentStatus: '', effectivenessStatus: 'pending', approvalStatus: 'pending',
      recordStatus: 'active', approvedAt: '', approvedBy: '', approvalNote: '' };
    if (openNce && !existing) state.actions.push(action as AnyRecord);
    return { point, action, reason: clean, openNce: !!openNce, reusedAction: !!existing };
  }
  function buildSheetRowsData({ levels, sheetStart, sheetEnd, sheetDays, pointsByLevel, previousPointsByLevel }: AnyRecord) {
    const groupsByDate = new Map<string, Map<string, AnyRecord>>();
    (levels || []).forEach((config: AnyRecord) => {
      const level = config && config.key != null ? config.key : config && config.level;
      const previous = previousPointsByLevel && previousPointsByLevel[level] || [], current = pointsByLevel && pointsByLevel[level] || [];
      previous.concat(current).filter((point: AnyRecord) => point && point.date >= sheetStart && point.date <= sheetEnd).forEach((point: AnyRecord) => {
        const runId = point.runId || `${point.date}-1`, key = point.date + '|' + runId;
        let byRun = groupsByDate.get(point.date); if (!byRun) { byRun = new Map(); groupsByDate.set(point.date, byRun); }
        if (!byRun.has(key)) byRun.set(key, { date: point.date, runId, levels: {} }); byRun.get(key)!.levels[level] = point;
      });
    });
    return (sheetDays || []).map((day: string) => {
      const byRun = groupsByDate.get(day); if (!byRun) return { date: day, runs: [{ date: day, runId: '', runNo: 1, levels: {} }] };
      const runs = [...byRun.values()].sort((a, b) => String(a.runId || '').localeCompare(String(b.runId || ''), 'vi', { numeric: true }));
      const nums = runs.map(group => String(group.runId || '')).filter(value => value.startsWith(day + '-'))
        .map(value => parseInt(value.slice(day.length + 1))).filter(Number.isFinite);
      const maxRun = nums.length ? Math.max(...nums) : runs.length;
      runs.forEach((group, index) => { const parsed = String(group.runId || '').startsWith(day + '-') ? parseInt(String(group.runId).slice(day.length + 1)) : index + 1;
        group.runNo = Number.isFinite(parsed) ? parsed : index + 1; });
      runs.push({ date: day, runId: day + '-' + (maxRun + 1), runNo: maxRun + 1, levels: {}, nextRun: true });
      return { date: day, runs };
    });
  }
  function sheetFirstRunNo(dayGroup: AnyRecord) {
    const nums = (dayGroup && dayGroup.runs || []).map((run: AnyRecord) => run.runNo).filter(Number.isFinite);
    return nums.length ? Math.min(...nums) : 1;
  }
  function sheetLevelRuns(dayGroup: AnyRecord, level: string | number) {
    return (dayGroup && dayGroup.runs || []).filter((run: AnyRecord) => run.levels && run.levels[level]).sort((a: AnyRecord, b: AnyRecord) => a.runNo - b.runNo);
  }
  return Object.freeze({ nextRunIdFor, cleanRunId, preparePointInput, saveDateNote, updateDateNoteCommand, addPoint,
    recordPoint, voidPoint, buildEntryWindow, groupByMachine, buildSheetCalendar, summarizeRunStatus, buildPointView,
    buildSheetRowsData, sheetFirstRunNo, sheetLevelRuns });
}
export type EntryServiceApi = ReturnType<typeof createEntryService>;
