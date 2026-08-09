export type WestgardPoint = {
  id?: unknown;
  date?: unknown;
  val?: unknown;
  [key: string]: unknown;
};

export type WestgardVerdict = {
  level?: unknown;
  rules?: unknown;
  supportRules?: unknown;
  z?: unknown;
  [key: string]: unknown;
};

type VerdictMap = { get: (key: unknown) => WestgardVerdict | undefined };
type Status = 'none' | 'ok' | 'warn' | 'rej';

export type WestgardLevelView = {
  l?: { level?: unknown; [key: string]: unknown };
  levelConfig?: { level?: unknown; [key: string]: unknown };
  pts?: WestgardPoint[];
  [key: string]: unknown;
};

export type MultiViewLevel = {
  level: string | number;
  lot?: unknown;
  mean?: unknown;
  sd?: unknown;
  pts?: WestgardPoint[];
};

export type PreviousLevel = {
  lot?: unknown;
  mean?: unknown;
  sd?: unknown;
  pts?: WestgardPoint[];
};

function isVerdictMap(value: unknown): value is VerdictMap {
  return !!value && typeof (value as VerdictMap).get === 'function';
}

function getVerdict(verdicts: unknown, point: WestgardPoint): WestgardVerdict {
  if (isVerdictMap(verdicts)) return verdicts.get(point?.id) || {};
  return {};
}

export function summarizeTestStatus({
  views = [],
  verdicts,
  today = '',
}: { views?: WestgardLevelView[]; verdicts?: unknown; today?: string } = {}) {
  const order: Record<Status, number> = { none: -1, ok: 0, warn: 1, rej: 2 };
  let status: Status = 'none';
  let todayCount = 0;
  let totalPoints = 0;
  const lastPoints: Array<WestgardPoint & { _level?: unknown }> = [];
  const alerts: Array<{
    level: string;
    point: WestgardPoint;
    rules: unknown[];
    levelConfig: { level?: unknown; [key: string]: unknown };
  }> = [];

  (Array.isArray(views) ? views : []).forEach(view => {
    const levelConfig = view?.l || view?.levelConfig || {};
    const points = Array.isArray(view?.pts) ? view.pts : [];
    if (points.some(point => point.date === today)) todayCount++;
    totalPoints += points.length;
    points.forEach(point => lastPoints.push({ ...point, _level: levelConfig.level }));
    if (!points.length) return;
    const point = points[points.length - 1];
    const verdict = getVerdict(verdicts, point);
    const level = String(verdict.level || 'ok');
    if (order[level as Status] > order[status]) status = level as Status;
    if (level !== 'ok') {
      alerts.push({
        level,
        point,
        rules: Array.isArray(verdict.rules) ? verdict.rules : [],
        levelConfig,
      });
    }
  });
  return { status, todayCount, totalPoints, lastPoints, alerts };
}

export function buildMultiViews({
  levels = [],
  previousByLevel = {},
  openLevels = [],
}: {
  levels?: MultiViewLevel[];
  previousByLevel?: Record<string, PreviousLevel[]> | Map<string | number, PreviousLevel[]>;
  openLevels?: Array<string | number>;
} = {}) {
  const open = new Set(openLevels);
  const getPrevious = (level: string | number): PreviousLevel[] => {
    if (previousByLevel instanceof Map) return previousByLevel.get(level) || [];
    return previousByLevel?.[String(level)] || [];
  };
  const views: Array<{
    level: string | number;
    lot?: unknown;
    mean?: unknown;
    sd?: unknown;
    pts: WestgardPoint[] | undefined;
    label: string;
  }> = [];
  (Array.isArray(levels) ? levels : []).forEach(level => {
    views.push({
      level: level.level,
      lot: level.lot,
      mean: level.mean,
      sd: level.sd,
      pts: Array.isArray(level.pts) ? level.pts : [],
      label: `M${level.level}·${level.lot || '?'}`,
    });
    if (open.has(level.level)) {
      getPrevious(level.level).forEach(previous => views.push({
        level: level.level,
        lot: previous.lot,
        mean: previous.mean,
        sd: previous.sd,
        pts: previous.pts,
        label: `M${level.level}·cũ ${previous.lot}`,
      }));
    }
  });
  return views;
}

export function buildPointRows({
  points = [],
  verdicts,
  zs = [],
  mean,
  sd,
}: {
  points?: WestgardPoint[];
  verdicts?: WestgardVerdict[] | VerdictMap;
  zs?: unknown[];
  mean?: unknown;
  sd?: unknown;
} = {}) {
  const source = Array.isArray(points) ? points : [];
  const verdictFor = (point: WestgardPoint, index: number): WestgardVerdict => {
    if (isVerdictMap(verdicts)) return verdicts.get(point.id) || {};
    return Array.isArray(verdicts) ? verdicts[index] || {} : {};
  };
  return source.map((point, index) => {
    const verdict = verdictFor(point, index);
    const value = Number(point?.val);
    const targetMean = Number(mean);
    const targetSd = Number(sd);
    const verdictZ = Number(verdict.z);
    const seriesZ = Number(zs[index]);
    const z = Number.isFinite(verdictZ)
      ? verdictZ
      : Number.isFinite(seriesZ)
        ? seriesZ
        : Number.isFinite(value) && Number.isFinite(targetMean)
          && Number.isFinite(targetSd) && targetSd !== 0
          ? (value - targetMean) / targetSd
          : NaN;
    const rules = [...new Set(Array.isArray(verdict.rules) ? verdict.rules : [])];
    return {
      index: index + 1,
      id: point?.id,
      date: point?.date,
      value: point?.val,
      z,
      level: verdict.level || 'ok',
      rules,
      supportRules: [...new Set(Array.isArray(verdict.supportRules) ? verdict.supportRules : [])]
        .filter(rule => !rules.includes(rule)),
    };
  });
}

export const westgardViewModel = Object.freeze({
  buildPointRows,
  summarizeTestStatus,
  buildMultiViews,
});

export type WestgardViewModelApi = typeof westgardViewModel;
