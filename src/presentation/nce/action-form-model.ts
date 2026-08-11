export type ActionFormField = readonly [elementId: string, key: string, kind: 'text' | 'date' | 'num'];

export const ACTION_FORM_FIELDS: readonly ActionFormField[] = Object.freeze([
  ['aNceId', 'nceId', 'text'], ['aTest', 'testId', 'text'], ['aLevel', 'level', 'text'], ['aPointId', 'pointId', 'text'],
  ['aDate', 'date', 'date'], ['aRule', 'rule', 'text'], ['aEventSource', 'eventSource', 'text'], ['aProcessPhase', 'processPhase', 'text'],
  ['aErr', 'errorType', 'text'], ['aBy', 'by', 'text'], ['aDueDate', 'dueDate', 'date'],
  ['aContainment', 'containmentStatus', 'text'], ['aContainmentNote', 'containmentNote', 'text'], ['aCorrection', 'correction', 'text'],
  ['aRiskSeverity', 'riskSeverity', 'num'], ['aRiskOccurrence', 'riskOccurrence', 'num'], ['aRiskDetectability', 'riskDetectability', 'num'], ['aRiskLevel', 'riskLevel', 'text'], ['aRiskBasis', 'riskBasis', 'text'],
  ['aQcMaterial', 'qcMaterialStatus', 'text'], ['aQcMaterialNote', 'qcMaterialNote', 'text'], ['aInstrument', 'instrumentStatus', 'text'], ['aInstrumentNote', 'instrumentNote', 'text'], ['aReagent', 'reagentStatus', 'text'], ['aReagentNote', 'reagentNote', 'text'], ['aCalibration', 'calibrationStatus', 'text'], ['aCalibrationNote', 'calibrationNote', 'text'], ['aLotToLot', 'lotToLotStatus', 'text'], ['aLotToLotNote', 'lotToLotNote', 'text'],
  ['aCauseCategory', 'causeCategory', 'text'], ['aCause', 'cause', 'text'], ['aAct', 'action', 'text'], ['aActionCompletedDate', 'actionCompletedDate', 'date'], ['aBiasBefore', 'biasBefore', 'text'], ['aBiasAfter', 'biasAfter', 'text'],
  ['aReleaseStatus', 'releaseStatus', 'text'], ['aReleaseDate', 'releaseDate', 'date'], ['aReleaseBy', 'releaseBy', 'text'], ['aReleaseNote', 'releaseNote', 'text'], ['aPatientImpact', 'patientImpact', 'text'], ['aPatientAction', 'patientAction', 'text'],
  ['aEffectivenessStatus', 'effectivenessStatus', 'text'], ['aEffectivenessDate', 'effectivenessDate', 'date'], ['aEffectivenessNote', 'effectivenessNote', 'text'], ['aResidualSeverity', 'residualSeverity', 'num'], ['aResidualOccurrence', 'residualOccurrence', 'num'], ['aResidualDetectability', 'residualDetectability', 'num'], ['aResidualRiskLevel', 'residualRiskLevel', 'text'], ['aResidualRiskBasis', 'residualRiskBasis', 'text'],
]);

type RecordValue = Record<string, any>;
type SourceOption = readonly [string, string];

export type ActionFormModelApi = ReturnType<typeof createActionFormModel>;

export function createActionFormModel(deps: {
  fields?: readonly ActionFormField[];
  todayIso: () => string;
  dueDate: (days: number) => string;
  operationalLevels: (test: RecordValue) => RecordValue[];
  effectivenessComplete: (action: RecordValue) => boolean;
}) {
  const fields = deps.fields || ACTION_FORM_FIELDS;
  const sourceOptions = (options: readonly SourceOption[], qcBound: boolean, current: unknown): SourceOption[] =>
    (qcBound || current === 'iqc') ? [...options] : options.filter(([value]) => value !== 'iqc');

  const defaultOpenSections = (editing: RecordValue | null | undefined, protocol: RecordValue | null | undefined) => {
    if (!editing) return new Set(['immediate']);
    const missing = protocol?.missingBySection || {};
    const open = new Set(['immediate', 'risk', 'check', 'cause', 'patient'].filter(key => (missing[key] || []).length));
    if (!open.size && !deps.effectivenessComplete({ ...editing, protocolVersion: editing.protocolVersion || 2 })) open.add('eff');
    return open;
  };

  const defaults = (tests: RecordValue[], seed: RecordValue | null | undefined, currentUser: RecordValue | null | undefined) => {
    const initial = seed || {}, manual = !!initial.manual, firstTest = tests[0];
    const testId = manual ? '' : (initial.testId || firstTest?.id || '');
    const test = tests.find(candidate => candidate.id === testId);
    const levels = test ? deps.operationalLevels(test) : [];
    const level = manual ? '' : (levels.some(item => String(item.level) === String(initial.level)) ? initial.level : levels[0]?.level || '');
    return { protocolVersion: 3, testId, level, lot: '', date: initial.date || deps.todayIso(), rule: initial.rule || '', errorType: initial.errorType || '', pointId: initial.pointId || '', by: currentUser ? (currentUser.name || currentUser.username) : '', dueDate: deps.dueDate(7), eventSource: manual ? '' : 'iqc', processPhase: 'exam', effectivenessStatus: 'pending' };
  };

  const mergeDraft = (base: RecordValue, draft: RecordValue | null | undefined) => {
    if (!draft) return base;
    const output = { ...base };
    fields.forEach(([id, key, kind]) => {
      if (id in draft) output[key] = kind === 'num' ? (+draft[id] || 0) : draft[id];
    });
    return output;
  };

  const build = (editing: RecordValue | null | undefined, tests: RecordValue[], seed: RecordValue | null | undefined, currentUser: RecordValue | null | undefined, draft: RecordValue | null | undefined) =>
    mergeDraft(editing ? { ...editing, effectivenessStatus: editing.effectivenessStatus || 'pending' } : defaults(tests, seed, currentUser), draft);

  return Object.freeze({ fields, sourceOptions, defaultOpenSections, defaults, mergeDraft, build });
}
