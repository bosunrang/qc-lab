type Action = Record<string, any>;
type Point = Record<string, any>;

export type ActionRerunServiceDeps = {
  pointsFor: (testId: string) => Point[] | null | undefined;
  testFor: (testId: string) => Action | undefined;
  runNumber: (point: Point) => number;
  lotPoints: (points: Point[] | null | undefined, level: unknown, lot: unknown, runNumber: (point: Point) => number) => Point[];
  pointIndex: (points: Point[] | null | undefined) => Map<string, Point>;
  needsRerun: (action: Action) => boolean;
  gateDate: (action: Action, point: Point) => string;
  evaluate: (input: any) => Record<string, any>;
  verdictFor: (test: Action | undefined, pointId: string) => Record<string, any>;
  formatValue: (point: Point, test: Action | undefined) => string;
  formatDate: (value: string) => string;
};

export type ActionRerunService = ReturnType<typeof createActionRerunService>;

export function createActionRerunService(deps: ActionRerunServiceDeps) {
  const rerunMemo = new Map<string, Record<string, any>>(), pointIndexMemo = new Map<string, Record<string, any>>(), lotIndexMemo = new Map<string, Record<string, any>>();
  const invalidate = (testId?: string) => {
    if (testId == null) { rerunMemo.clear(); pointIndexMemo.clear(); lotIndexMemo.clear(); return; }
    pointIndexMemo.delete(testId);
    [...lotIndexMemo.keys()].forEach(key => { if (key.startsWith(testId + '|')) lotIndexMemo.delete(key); });
    [...rerunMemo.keys()].forEach(key => { const hit = rerunMemo.get(key); if (hit?.testId === testId) rerunMemo.delete(key); });
  };
  const pointIndex = (testId: string) => {
    const points = deps.pointsFor(testId) || null, hit = pointIndexMemo.get(testId);
    if (hit && hit.points === points && hit.len === (points ? points.length : -1)) return hit.index;
    const index = deps.pointIndex(points); pointIndexMemo.set(testId, { points, len: points ? points.length : -1, index }); return index;
  };
  const point = (action: Action | null | undefined) => action?.pointId ? pointIndex(String(action.testId || '')).get(action.pointId) || null : null;
  const lotPoints = (testId: string, level: unknown, lot: unknown) => {
    const points = deps.pointsFor(testId) || null, key = `${testId}|${level}|${lot || ''}`, hit = lotIndexMemo.get(key);
    if (hit && hit.points === points && hit.len === (points ? points.length : -1)) return hit.list;
    const list = deps.lotPoints(points, level, lot, deps.runNumber); lotIndexMemo.set(key, { points, len: points ? points.length : -1, list }); return list;
  };
  const signature = (action: Action, test: Action | undefined) => [action.id, action.testId, action.pointId, Number(action.protocolVersion) || 0, action.actionCompletedDate || '', action.parentNceId || '', action.date || '', action.openedFromVoid ? 1 : 0, test?.decimalPlaces ?? 'auto'].join('|');
  const compute = (action: Action) => {
    const test = deps.testFor(action.testId), incident = point(action), needed = deps.needsRerun(action), gateDate = incident ? deps.gateDate(action, incident) : '';
    return deps.evaluate({ action, needed, point: incident, gateDate, incidentRunNumber: incident ? deps.runNumber(incident) : 0,
      candidates: incident ? lotPoints(action.testId, incident.level, incident.lot || '') : [], runNumber: deps.runNumber,
      verdictFor: (id: string) => deps.verdictFor(test, id), formatValue: (value: Point) => deps.formatValue(value, test), formatDate: deps.formatDate });
  };
  const status = (action: Action | null | undefined) => {
    if (!action || !action.id) return compute(action || {});
    const points = deps.pointsFor(action.testId) || null, sig = signature(action, deps.testFor(action.testId)), hit = rerunMemo.get(action.id);
    if (hit && hit.sig === sig && hit.points === points && hit.len === (points ? points.length : -1)) return hit.result;
    const result = compute(action); rerunMemo.set(action.id, { sig, testId: action.testId, points, len: points ? points.length : -1, result }); return result;
  };
  return Object.freeze({ invalidate, pointIndex, point, lotPoints, status });
}
