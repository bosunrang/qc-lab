export type ChartPoint = {
  date?: unknown;
  lot?: unknown;
  val?: unknown;
  [key: string]: unknown;
};

export type CusumSeries = {
  cPos?: unknown[];
  cNeg?: unknown[];
  ma?: unknown[];
  flags?: unknown[];
  [key: string]: unknown;
};

export type MultiLevelView = {
  pts?: unknown[] | null;
  [key: string]: unknown;
};

export function filterPoints(
  points: ChartPoint[] | unknown,
  { start = '', end = '', lot }: { start?: string; end?: string; lot?: unknown } = {},
): ChartPoint[] {
  return (Array.isArray(points) ? points : []).filter((point: ChartPoint) => {
    const date = String(point?.date || '');
    return (!start || date >= start)
      && (!end || date <= end)
      && (lot === undefined || (point?.lot || '') === lot);
  });
}

export function buildLeveyJennings({
  points = [], mean, sd, start = '', end = '', lot,
}: {
  points?: ChartPoint[];
  mean?: unknown;
  sd?: unknown;
  start?: string;
  end?: string;
  lot?: unknown;
} = {}) {
  return { points: filterPoints(points, { start, end, lot }), mean: Number(mean), sd: Number(sd) };
}

export function buildCusum({
  points = [], series,
}: { points?: ChartPoint[]; series?: CusumSeries } = {}) {
  return {
    points: Array.isArray(points) ? points : [],
    series: series || { cPos: [], cNeg: [], ma: [], flags: [] },
  };
}

export function buildMultiLevel({ views = [] }: { views?: MultiLevelView[] } = {}) {
  return (Array.isArray(views) ? views : []).map(view => ({
    ...view,
    pts: Array.isArray(view.pts) ? view.pts : [],
  }));
}

/* Chỉ giảm số pixel/marker được vẽ. Mọi phép tính nghiệp vụ vẫn dùng toàn bộ
   điểm. Mỗi bucket giữ cực tiểu và cực đại để không làm mất spike ngắn. */
export function sampleIndices({
  length = 0,
  maxPoints = 600,
  valueAt,
  preserve = [],
}: {
  length?: number;
  maxPoints?: number;
  valueAt?: (index: number) => unknown;
  preserve?: unknown[];
} = {}): number[] {
  const n = Math.max(0, Math.floor(Number(length) || 0));
  const limit = Math.max(2, Math.floor(Number(maxPoints) || 600));
  if (!n) return [];
  if (n <= limit) return Array.from({ length: n }, (_, index) => index);

  const kept = new Set<number>([0, n - 1]);
  for (const raw of preserve || []) {
    const index = Math.floor(Number(raw));
    if (index >= 0 && index < n) kept.add(index);
  }
  const budget = Math.max(2, limit - kept.size);
  const bucketCount = Math.max(1, Math.floor(budget / 2));
  const bucketSize = n / bucketCount;
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor(bucket * bucketSize);
    const end = Math.min(n, Math.floor((bucket + 1) * bucketSize));
    let minIndex = -1;
    let maxIndex = -1;
    let min = Infinity;
    let max = -Infinity;
    for (let index = start; index < end; index++) {
      const value = Number(typeof valueAt === 'function' ? valueAt(index) : index);
      if (!Number.isFinite(value)) continue;
      if (value < min) { min = value; minIndex = index; }
      if (value > max) { max = value; maxIndex = index; }
    }
    if (minIndex >= 0) kept.add(minIndex);
    if (maxIndex >= 0) kept.add(maxIndex);
  }
  return [...kept].sort((a, b) => a - b);
}

export const chartViewModel = Object.freeze({
  filterPoints,
  buildLeveyJennings,
  buildCusum,
  buildMultiLevel,
  sampleIndices,
});

export type ChartViewModelApi = typeof chartViewModel;
