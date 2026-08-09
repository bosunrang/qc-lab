export type SigmaPoint = {
  date?: unknown;
  runId?: unknown;
  level?: unknown;
  lot?: unknown;
  val?: unknown;
  voided?: unknown;
  qcMean?: unknown;
  qcSd?: unknown;
  [key: string]: unknown;
};

export type SigmaState = {
  data?: Record<string, SigmaPoint[]>;
};

export type CohortStats = {
  n?: number;
  cv?: number;
  [key: string]: unknown;
};

export type StatsCalculator = (values: number[]) => CohortStats;

type CohortRow = { point: SigmaPoint; index: number; value?: number };
type CohortIssue = 'missing-lot' | 'mixed-target-mean' | 'mixed-target-sd';

export type SigmaCohort = {
  testId: string | number;
  level: number;
  period: string;
  lot: string;
  points: SigmaPoint[];
  values: number[];
  stats: CohortStats;
  n: number;
  start: string;
  end: string;
  targetMean: number | null;
  targetSd: number | null;
  targetMeans: number[];
  targetSds: number[];
  excluded: { voided: number; invalidValue: number };
  issues: CohortIssue[];
};

export function normalizePeriod(value: unknown): string {
  const match = /^(\d{4})-(\d{1,2})$/.exec(String(value || '').trim());
  if (!match) return '';
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${String(month).padStart(2, '0')}` : '';
}

export function normalizeDate(value: unknown): string {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return '';
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.getUTCFullYear() === +match[1]
    && date.getUTCMonth() === +match[2] - 1
    && date.getUTCDate() === +match[3] ? text : '';
}

function pointRunNo(point: SigmaPoint): number {
  const match = /(?:^|-)(\d+)$/.exec(String(point?.runId || ''));
  return match ? Number(match[1]) : 1;
}

function pointOrder(a: CohortRow, b: CohortRow): number {
  return String(a.point.date || '').localeCompare(String(b.point.date || ''))
    || pointRunNo(a.point) - pointRunNo(b.point)
    || a.index - b.index;
}

function uniqueFinite(points: SigmaPoint[], key: 'qcMean' | 'qcSd', positive = false): number[] {
  const values: number[] = [];
  points.forEach(point => {
    const raw = point?.[key];
    if (raw == null || String(raw).trim() === '') return;
    const value = Number(raw);
    if (Number.isFinite(value) && (!positive || value > 0) && !values.some(item => Object.is(item, value))) {
      values.push(value);
    }
  });
  return values;
}

export function assess(
  cohort: Pick<SigmaCohort, 'n' | 'issues'> | null | undefined,
  { minimum = 20, recommended = 30 }: { minimum?: number; recommended?: number } = {},
) {
  minimum = Math.max(2, Math.floor(Number(minimum) || 20));
  recommended = Math.max(minimum, Math.floor(Number(recommended) || 30));
  const n = Number(cohort?.n) || 0;
  const issues: string[] = Array.isArray(cohort?.issues) ? cohort.issues : [];
  if (issues.includes('missing-lot') || issues.includes('mixed-target-mean') || issues.includes('mixed-target-sd')) {
    return { status: 'unstable', classifiable: false, qcpEligible: false, minimum, recommended } as const;
  }
  if (n < minimum) return { status: 'insufficient', classifiable: false, qcpEligible: false, minimum, recommended } as const;
  if (n < recommended) return { status: 'provisional', classifiable: true, qcpEligible: false, minimum, recommended } as const;
  return { status: 'eligible', classifiable: true, qcpEligible: true, minimum, recommended } as const;
}

export function createSigmaCohortService({ stats }: { stats: StatsCalculator }) {
  if (typeof stats !== 'function') throw new TypeError('SigmaCohortService cần một hàm stats');

  function buildGroup(
    testId: string | number,
    level: number,
    period: string,
    lot: string,
    rows: CohortRow[],
  ): SigmaCohort {
    const excluded = { voided: 0, invalidValue: 0 };
    const eligible: CohortRow[] = [];
    rows.forEach(row => {
      const point = row.point || {};
      if (point.voided) { excluded.voided++; return; }
      const raw = point.val;
      if (raw == null || String(raw).trim() === '') { excluded.invalidValue++; return; }
      const value = Number(raw);
      if (!Number.isFinite(value)) { excluded.invalidValue++; return; }
      eligible.push({ ...row, value });
    });
    eligible.sort(pointOrder);
    const points = eligible.map(row => row.point);
    const values = eligible.map(row => row.value as number);
    const targetMeans = uniqueFinite(points, 'qcMean');
    const targetSds = uniqueFinite(points, 'qcSd', true);
    const issues: CohortIssue[] = [];
    if (!lot) issues.push('missing-lot');
    if (targetMeans.length > 1) issues.push('mixed-target-mean');
    if (targetSds.length > 1) issues.push('mixed-target-sd');
    return {
      testId,
      level,
      period,
      lot,
      points,
      values,
      stats: stats(values),
      n: values.length,
      start: String(points[0]?.date || ''),
      end: String(points[points.length - 1]?.date || ''),
      targetMean: targetMeans.length === 1 ? targetMeans[0] : null,
      targetSd: targetSds.length === 1 ? targetSds[0] : null,
      targetMeans,
      targetSds,
      excluded,
      issues,
    };
  }

  /* Cohort Sigma đi theo vòng đời lô QC và không bị cắt ở ranh giới tháng.
     startDate/endDate chỉ là ảnh chụp dữ liệu của lần đánh giá. */
  function cohortsForLevelByLot(
    state: SigmaState | null | undefined,
    {
      testId,
      level,
      startDate = '',
      endDate = '',
    }: { testId?: string | number; level?: unknown; startDate?: string; endDate?: string } = {},
  ): SigmaCohort[] {
    const numericLevel = Number(level);
    const start = startDate ? normalizeDate(startDate) : '';
    const end = endDate ? normalizeDate(endDate) : '';
    if (!state || !testId || !Number.isFinite(numericLevel)
      || (startDate && !start) || (endDate && !end) || (start && end && start > end)) return [];

    const groups = new Map<string, CohortRow[]>();
    ((state.data?.[String(testId)]) || []).forEach((point, index) => {
      const date = String(point?.date || '');
      if (Number(point?.level) !== numericLevel || !normalizeDate(date)
        || (start && date < start) || (end && date > end)) return;
      const lot = String(point?.lot || '').trim();
      if (!groups.has(lot)) groups.set(lot, []);
      groups.get(lot)?.push({ point, index });
    });
    return [...groups.entries()]
      .map(([lot, rows]) => buildGroup(testId, numericLevel, '', lot, rows))
      .sort((a, b) => String(a.start).localeCompare(String(b.start))
        || String(a.lot).localeCompare(String(b.lot), 'vi', { numeric: true }));
  }

  return Object.freeze({ normalizePeriod, normalizeDate, cohortsForLevelByLot, assess });
}

export type SigmaCohortServiceApi = ReturnType<typeof createSigmaCohortService>;
