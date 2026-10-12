// Mô hình hiển thị của trang Khắc phục sự cố (NCE protocol 4). Chỉ dựng dữ
// liệu để vẽ; mọi cổng nghiệp vụ (còn thiếu gì, ai được làm gì) do main tính và
// trả trong `NceDossierView`. Đặt ở `main/domain` (thay vì view-models của
// renderer) vì cần hàm thuần của domain và để test chạy trên bản đã build.
import type { NceDecisionRow, NceDossierView, NceRecordRow, NceRevisionRow, NceRunKeyView, QcPointView } from '../../../shared/qc-api';
import { compareQcRunKey, qcRunKey } from '../sort-order';
import { NCE_DECISION_LABEL, NCE_EFFECTIVENESS_RESULT_LABEL, NCE_PATIENT_OUTCOME_LABEL } from './labels';

export type NceListFilter = 'active' | 'mine' | 'approve' | 'overdue' | 'closed' | 'all';

export const NCE_LIST_FILTERS: readonly [NceListFilter, string][] = [
  ['active', 'Đang xử lý'], ['mine', 'Của tôi'], ['approve', 'Chờ duyệt'], ['overdue', 'Quá hạn'], ['closed', 'Đã đóng'], ['all', 'Tất cả'],
];

const ACTIVE: ReadonlySet<NceRecordRow['status']> = new Set(['open', 'released', 'pending_approval']);

/** Lọc danh sách hồ sơ theo thẻ lọc; `userId` là người đang đăng nhập. */
export function filterNceRecords(records: readonly NceRecordRow[], filter: NceListFilter, userId: string): NceRecordRow[] {
  switch (filter) {
    case 'active': return records.filter((r) => ACTIVE.has(r.status));
    case 'mine': return records.filter((r) => ACTIVE.has(r.status) && (r.owner_user_id === userId || r.reported_by_user_id === userId));
    case 'approve': return records.filter((r) => r.status === 'pending_approval');
    case 'overdue': return records.filter((r) => r.overdue_days > 0 || r.overdue_actions > 0);
    case 'closed': return records.filter((r) => r.status === 'closed' || r.status === 'cancelled');
    default: return [...records];
  }
}

export function nceFilterCounts(records: readonly NceRecordRow[], userId: string): Record<NceListFilter, number> {
  return Object.fromEntries(NCE_LIST_FILTERS.map(([key]) => [key, filterNceRecords(records, key, userId).length])) as Record<NceListFilter, number>;
}

export interface NceRunOption extends NceRunKeyView {
  key: string;
  label: string;
  /** Mức có điểm (chưa hủy) trong lần chạy. */
  levels: number[];
}

/** "12/10/2026 · lần 3". */
export function nceRunLabel(run: { date: string; runId: string }): string {
  const [y, m, d] = run.date.split('-');
  const day = y && m && d ? `${d}/${m}/${y}` : run.date;
  return run.runId ? `${day} · lần ${run.runId}` : day;
}

/** Lần chạy có thể làm rerun/xác minh: sau lần hỏng muộn nhất của hồ sơ (hoặc
 * từ ngày phát hiện với hồ sơ không có lần hỏng), mới nhất lên trước. Main vẫn
 * kiểm đầy đủ khi đánh giá thử và khi cho chạy lại. */
export function nceRerunOptions(points: readonly Pick<QcPointView, 'date' | 'run_id' | 'level' | 'voided'>[], failures: readonly NceRunKeyView[], notBeforeDate: string): NceRunOption[] {
  const latest = failures.map((run) => qcRunKey(run)).sort(compareQcRunKey).at(-1);
  const byRun = new Map<string, NceRunOption>();
  for (const point of points) {
    if (point.voided) continue;
    const run = { date: point.date, runId: point.run_id };
    const key = qcRunKey(run);
    if (latest ? compareQcRunKey(key, latest) <= 0 : point.date < notBeforeDate) continue;
    const option = byRun.get(key) ?? { ...run, key, label: nceRunLabel(run), levels: [] };
    if (!option.levels.includes(point.level)) option.levels.push(point.level);
    byRun.set(key, option);
  }
  return [...byRun.values()].map((o) => ({ ...o, levels: o.levels.sort((a, b) => a - b) })).sort((a, b) => compareQcRunKey(b.key, a.key));
}

export type NceStepState = 'done' | 'current' | 'todo';
export interface NceStepView { key: string; label: string; state: NceStepState }

const STEP_ORDER = ['open', 'released', 'pending_approval', 'closed'] as const;
const STEP_LABEL: Record<(typeof STEP_ORDER)[number], string> = {
  open: 'Ghi nhận và kiểm soát', released: 'Cho phép hoạt động trở lại', pending_approval: 'Điều tra, CAPA và nộp duyệt', closed: 'Duyệt đóng hồ sơ',
};

/** Thanh bước theo trạng thái. Bước "hiện tại" là việc phải làm tiếp; hồ sơ đã
 * hủy không có bước hiện tại. */
export function nceSteps(status: NceRecordRow['status']): NceStepView[] {
  // Trạng thái → chỉ số bước đang phải làm: đang xử lý thì làm bước cho chạy
  // lại; đã cho chạy lại thì làm điều tra/CAPA rồi nộp; chờ duyệt thì duyệt.
  const currentIndex = status === 'open' ? 1 : status === 'released' ? 2 : status === 'pending_approval' ? 3 : status === 'closed' ? 4 : -1;
  return STEP_ORDER.map((key, index) => ({
    key, label: STEP_LABEL[key],
    state: status === 'cancelled' ? 'todo' : index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo',
  }));
}

function parse(json: string): Record<string, unknown> {
  try { const value = JSON.parse(json || '{}'); return value && typeof value === 'object' ? value as Record<string, unknown> : {}; } catch { return {}; }
}

export interface NceHistoryItem { at: string; actor: string; title: string; detail: string; kind: 'decision' | 'revision' }

const FIELD_LABEL: Readonly<Record<string, string>> = {
  description: 'mô tả', correction: 'xử lý tức thời', holdResults: 'giữ kết quả', phase: 'giai đoạn', ownerUserId: 'người phụ trách', dueDate: 'hạn',
  tier: 'tầng xử lý', tierReason: 'lý do tầng', riskSeverity: 'mức độ nghiêm trọng', riskProbability: 'khả năng xảy ra', riskLevel: 'mức nguy cơ', riskBasis: 'căn cứ nguy cơ',
  checklist: 'checklist', causeStatus: 'kết luận nguyên nhân', causeCategory: 'nhóm nguyên nhân', causeText: 'nguyên nhân', causeCheckPlan: 'kế hoạch kiểm tra nguyên nhân',
  effectivenessCriteria: 'tiêu chí hiệu lực', effectivenessReviewDue: 'ngày dự kiến đánh giá hiệu lực',
};

function decisionDetail(row: NceDecisionRow): string {
  const p = parse(row.payload_json);
  switch (row.type) {
    case 'patient_impact': return NCE_PATIENT_OUTCOME_LABEL[String(p.outcome)] ?? String(p.outcome ?? '');
    case 'effectiveness': return `${NCE_EFFECTIVENESS_RESULT_LABEL[String(p.result)] ?? p.result} · ${String(p.evidence ?? '')}`;
    case 'release': {
      const rerun = p.rerun as { date?: string; runId?: string } | null;
      return [rerun?.date ? `rerun ${nceRunLabel({ date: rerun.date, runId: rerun.runId ?? '' })}` : p.notApplicable ? 'không phải dừng dịch vụ' : '', String(p.reason ?? '')].filter(Boolean).join(' · ');
    }
    case 'return': return String(p.note ?? '');
    case 'cancel': return String(p.reason ?? '');
    case 'approve': return [p.usedException ? `ngoại lệ phân tách theo ${p.sopRef}` : '', String(p.note ?? '')].filter(Boolean).join(' · ');
    default: return '';
  }
}

function revisionDetail(row: NceRevisionRow): string {
  const changes = parse(row.changes_json);
  return Object.keys(changes).map((key) => {
    if (key === 'legacy') return 'chuyển từ hồ sơ phiên bản cũ';
    if (key.startsWith('action:')) return key.endsWith(':done') ? 'hoàn thành hành động' : key.endsWith(':cancel') ? 'hủy hành động' : Array.isArray(changes[key]) && (changes[key] as unknown[])[0] === null ? 'thêm hành động' : 'sửa hành động';
    return `sửa ${FIELD_LABEL[key] ?? key}`;
  }).join(', ');
}

/** Lịch sử hồ sơ: quyết định và lần sửa nội dung, mới nhất lên trước. */
export function nceHistory(dossier: Pick<NceDossierView, 'decisions' | 'revisions'>): NceHistoryItem[] {
  return [
    ...dossier.decisions.map((row): NceHistoryItem => ({ at: row.decided_at, actor: row.actor_name, title: NCE_DECISION_LABEL[row.type] ?? row.type, detail: decisionDetail(row), kind: 'decision' })),
    ...dossier.revisions.map((row): NceHistoryItem => ({ at: row.at, actor: row.actor_name, title: 'Cập nhật hồ sơ', detail: revisionDetail(row), kind: 'revision' })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

/** Điểm nguy cơ hiển thị: `—` khi chưa chấm đủ hai trục. */
export function nceRiskText(severity: number, probability: number): string {
  return severity >= 1 && probability >= 1 ? String(severity * probability) : '—';
}
