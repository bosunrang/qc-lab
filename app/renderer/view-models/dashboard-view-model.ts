import type { NceDetail, NceRecord, QcLot, QcPanel, Test, TestSummary } from '../../shared/qc-api';

const RANK = { ok: 0, warn: 1, rej: 2 } as const;

export type DashboardStatus = keyof typeof RANK;
type LevelSummary = TestSummary['levels'][number];

export interface DashboardTestItem extends TestSummary {
  status: DashboardStatus;
  totalPoints: number;
  todayCount: number;
  missingToday: boolean;
  latest: { date: string; runId: string; val: number; level: number } | null;
  search: string;
}

/** 1 dòng trong panel "Cần xử lý / Theo dõi" — theo MỨC, không theo xét
 * nghiệm (xem ghi chú 2 đầu file). */
export interface DashboardAlertItem {
  key: string;
  test: DashboardTestItem;
  level: LevelSummary;
  point: { date: string; runId: string; val: number };
  rules: string[];
}

export interface DashboardMissingTargetItem { key: string; test: DashboardTestItem; level: LevelSummary }

export interface DashboardExpiringLot { key: string; lot: string; level: number; days: number; count: number }

export interface DashboardOverdueInfo { overdue: boolean; days: number; label: string; owner: string }

export function normalizeDashboardSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}


export function operationalDashboardSummaries(summaries: TestSummary[], tests: Test[], panels: QcPanel[]): TestSummary[] {
  const activeTests = new Set(tests.filter(test => test.active !== 0).map(test => test.id));
  const order = new Map<string, number>();
  for (const panel of panels) {
    if (panel.active === 0) continue;
    for (const testId of panel.testIds) if (!order.has(testId)) order.set(testId, order.size);
  }
  return summaries
    .filter(summary => activeTests.has(summary.testId) && order.has(summary.testId) && summary.levels.length > 0)
    .sort((a, b) => order.get(a.testId)! - order.get(b.testId)!);
}


/** Thông tin hiển thị cho hồ sơ quá hạn. Số ngày do main tính
 * (`NceRecord.overdue_days`); ở đây chỉ dựng nhãn và người phụ trách. */
export function dashboardNceOverdue(record: NceRecord | null | undefined): DashboardOverdueInfo {
  const days = Number(record?.overdue_days) || 0;
  let owner = '';
  try { owner = String((JSON.parse(record?.detail_json || '{}') as NceDetail).owner || '').trim(); } catch { /* JSON hỏng: chưa ghi người phụ trách */ }
  return days > 0 ? { overdue: true, days, label: `Quá hạn ${days} ngày`, owner } : { overdue: false, days: 0, label: '', owner };
}

/** Thứ tự bảng xét nghiệm hệ thống: loại bỏ → cảnh báo → chưa đủ QC hôm nay
 * → đạt → trạng thái khác. */
export function dashboardTestRank(test: Pick<DashboardTestItem, 'status' | 'todayCount' | 'levels'>): number {
  if (test.status === 'rej') return 0;
  if (test.status === 'warn') return 1;
  if (test.todayCount < test.levels.length) return 2;
  if (test.status === 'ok') return 3;
  return 4;
}


export function daysToExpiry(value: string, now: Date = new Date()): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const target = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value);
  const time = target.getTime();
  return Number.isFinite(time) ? Math.round((time - now.getTime()) / 86400000) : null;
}


export function dashboardShiftStatus(input: { rejected: number; overdueActions: number; warnings: number; missingToday: number }): { mood: string; text: string } {
  if (input.rejected) return { mood: 'Cần xử lý ngay', text: 'Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục.' };
  if (input.overdueActions) return { mood: 'Có hồ sơ NCE quá hạn', text: `${input.overdueActions} hồ sơ khắc phục đã qua hạn xử lý mà chưa khép vòng.` };
  if (input.warnings) return { mood: 'Có cảnh báo cần theo dõi', text: 'Có tín hiệu cảnh báo, nên xem lại biểu đồ và xu hướng trước khi trả kết quả.' };
  if (input.missingToday) return { mood: 'Còn QC cần nhập', text: 'Một số xét nghiệm chưa đủ QC hôm nay, nên hoàn tất trước giờ chạy mẫu.' };
  return { mood: 'Đang trong kiểm soát', text: 'Không có cảnh báo trọng yếu trong dữ liệu hiện tại.' };
}

export function levelTargetOk(level: LevelSummary): boolean {
  return Number.isFinite(Number(level.mean)) && Number.isFinite(Number(level.sd)) && Number(level.sd) > 0;
}

// Generic theo hồ sơ NCE: store bơm vào `OverdueAction` (NceRecord + tên
// xét nghiệm đã join sẵn) — giữ nguyên kiểu đó ở đầu ra để trang đọc được
// `testName` mà không cần cast.
export function buildDashboardViewModel<TOverdue extends NceRecord>(
  testSummaries: TestSummary[], lots: QcLot[], overdueActions: TOverdue[], today: string, now: Date = new Date(),
) {
  const tests: DashboardTestItem[] = testSummaries.map(test => {
    const status = test.levels.reduce<DashboardStatus>((worst, level) => RANK[level.latestVerdict] > RANK[worst] ? level.latestVerdict : worst, 'ok');
    const latestCandidates = test.levels.flatMap(level => level.latest ? [{ ...level.latest, level: level.level }] : []);
    latestCandidates.sort((a, b) => a.date.localeCompare(b.date) || a.runId.localeCompare(b.runId));
    const todayCount = test.levels.filter(level => level.todayPointCount > 0).length;
    return {
      ...test, status, totalPoints: test.levels.reduce((sum, level) => sum + level.pointCount, 0), todayCount,
      missingToday: todayCount < test.levels.length, latest: latestCandidates.at(-1) || null,
      search: normalizeDashboardSearch([test.testName, test.instrumentName, ...test.levels.map(level => level.lot)].join(' ')),
    };
  });

  const totalPoints = tests.reduce((sum, test) => sum + test.totalPoints, 0);
  const todayPoints = tests.reduce((sum, test) => sum + test.todayCount, 0);
  const rejected = tests.filter(test => test.status === 'rej').length;
  const warnings = tests.filter(test => test.status === 'warn').length;
  const missingToday = tests.filter(test => test.missingToday).length;
  const completeTests = Math.max(0, tests.length - missingToday);
  const completionPercent = tests.length ? Math.round(completeTests / tests.length * 100) : 0;

  // Báo động theo mức, mỗi mức 1 dòng, kèm đúng điểm cuối + luật của nó.
  const urgent: DashboardAlertItem[] = [];
  const watch: DashboardAlertItem[] = [];
  const noTarget: DashboardMissingTargetItem[] = [];
  for (const test of tests) {
    for (const level of test.levels) {
      if (!levelTargetOk(level)) noTarget.push({ key: `${test.testId}:${level.level}`, test, level });
      if (level.latestVerdict === 'ok' || !level.latest) continue;
      const item: DashboardAlertItem = { key: `${test.testId}:${level.level}`, test, level, point: level.latest, rules: level.latestRules };
      (level.latestVerdict === 'rej' ? urgent : watch).push(item);
    }
  }

  // Gom lô sắp hết hạn theo `qcLotId` (hoặc `lot|level` nếu chưa gán lô) —
  // giữ bản có `days` NHỎ NHẤT và đếm số mức/xét nghiệm dùng chung lô đó,
  // đúng `dashboardExpiringLots()`. Nguồn là lô đang gắn vào MỨC QC, không
  // phải toàn bộ bảng `qc_lots` — một lô chưa xét nghiệm nào dùng thì không
  // hiện ở Tổng quan.
  const grouped = new Map<string, DashboardExpiringLot>();
  for (const test of tests) {
    for (const level of test.levels) {
      const days = daysToExpiry(level.exp, now);
      if (days == null || days > 30) continue;
      const key = level.qcLotId || `${level.lot}|${level.level}`;
      const current = grouped.get(key);
      if (!current) grouped.set(key, { key, lot: level.lot, level: level.level, days, count: 1 });
      else if (days < current.days) grouped.set(key, { ...current, lot: level.lot, level: level.level, days, count: current.count + 1 });
      else current.count++;
    }
  }
  const expiringLots = [...grouped.values()].sort((a, b) => a.days - b.days);

  const shift = dashboardShiftStatus({ rejected, overdueActions: overdueActions.length, warnings, missingToday });

  return {
    tests,
    kpi: { totalPoints, todayPoints, rejected, warnings, missingToday, completeTests, completionPercent },
    urgent, watch, noTarget, overdueActions, expiringLots,
    mood: shift.mood, moodText: shift.text,
    // `lots` không còn dùng để dựng danh sách hết hạn (đọc từ mức QC) nhưng
    // vẫn nhận vào để không đổi chữ ký khi trang cần tra thêm thông tin lô.
    lotCount: lots.length,
  };
}


