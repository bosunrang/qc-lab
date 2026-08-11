export type QcReportPoint = { id?: string; val?: number; date?: string; [key: string]: unknown };
export type QcReportTest = { id?: string; [key: string]: unknown };
export type QcReportLevel = { level: number; mean: number; sd: number; [key: string]: unknown };
export type QcReportLotSeries = { pts: QcReportPoint[]; mean: number; sd: number; [key: string]: unknown };
export type QcReportVerdict = { level?: string; rules?: string[]; z?: number; [key: string]: unknown };
export type QcReportWestgard = { F: QcReportVerdict[]; zs: number[] };
export type QcReportCurrentWestgard = { byPoint: Map<string | undefined, QcReportVerdict> };
export type QcReportRowItem = { p: QcReportPoint; f: QcReportVerdict; z: number | undefined };
export type QcReportAction = { testId?: string; [key: string]: unknown };

export type QcReportRowsDeps = {
  westgardByPoint: (points: QcReportPoint[], mean: number, sd: number, onRule: (rule: string) => boolean) => QcReportWestgard;
  ruleOnWithin: (test: QcReportTest, rule: string) => boolean;
  resultLevel: (test: QcReportTest, rules: string[]) => string;
  points: (test: QcReportTest, level: number) => QcReportPoint[];
  actions: () => QcReportAction[];
  eventDate: (action: QcReportAction) => string | undefined;
};

export function createQcReportRows(deps: QcReportRowsDeps) {
  const previousLot = (test: QcReportTest, series: QcReportLotSeries, inRange: (point: QcReportPoint) => boolean) => {
    const inPts = series.pts.filter(inRange);
    if (!inPts.length) return { inPts, items: [] as QcReportRowItem[] };
    const westgard = deps.westgardByPoint(series.pts, series.mean, series.sd, rule => deps.ruleOnWithin(test, rule));
    const index = new Map(series.pts.map((point, position) => [point.id, position]));
    return { inPts, items: inPts.map(point => {
      const position = index.get(point.id), raw = westgard.F[position ?? -1] || { rules: [] };
      return { p: point, f: { ...raw, level: deps.resultLevel(test, raw.rules || []) }, z: westgard.zs[position ?? -1] };
    }) };
  };
  const currentLot = (test: QcReportTest, level: QcReportLevel, westgard: QcReportCurrentWestgard, inRange: (point: QcReportPoint) => boolean) => {
    const pts = deps.points(test, level.level).filter(inRange);
    return { pts, items: pts.map(point => {
      const verdict = westgard.byPoint.get(point.id) || { level: 'ok', rules: [], z: (Number(point.val) - level.mean) / level.sd };
      return { p: point, f: verdict, z: verdict.z };
    }) };
  };
  const actions = (testId: string | undefined, inRange: (point: { date?: string }) => boolean) =>
    deps.actions().filter(action => action.testId === testId && inRange({ date: deps.eventDate(action) }));
  return Object.freeze({ previousLot, currentLot, actions });
}
