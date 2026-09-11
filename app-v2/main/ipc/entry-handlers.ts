// IPC handler cho module Entry (nhập/hủy điểm QC). Lô đang vận hành được đánh
// giá đa mức; lô mới trong chuyển tiếp được đánh giá riêng từng mức và không
// làm thay đổi verdict chính cho tới khi hồ sơ được chấp nhận.
import type { Db } from '../db/sqlite-like';
import { listOperationalLevels, isTestInActivePanel, countOperationalLevels, OPERATIONAL_LOT_GROUP_SQL } from '../db/operational-levels';
// 3 kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung thay vì khai lại: bản khai
// cũ ở đây dùng `voided: number` trong khi hợp đồng khai `0 | 1`, và renderer
// tin theo hợp đồng — hai khai báo song song cùng tên là đúng loại drift mà
// đợt 2026-09-10 đi gỡ.
import type { QcPointView, ParallelEntryColumn, PreviousLotSeries } from '../../shared/qc-api';

export type { QcPointView, ParallelEntryColumn, PreviousLotSeries };
import { uid } from '../domain/text-utils';
import { validateQcPointInput, validateVoidInput, type QcPointInput, type VoidPointInput } from '../domain/entry-validation';
import { combinedWestgardByPoint, westgardByPoint, type RuleVerdict } from '../domain/westgard-engine';
import { parseRuleActions, makeIsOnLayered, makeRuleActionLayered, parseRuleScopes, makeScopeOf } from '../domain/rule-config';
import { errorType, WG_RULE_REGISTRY } from '../domain/westgard-rules';
import { evaluateRangeCandidate, validateRangeReason } from '../domain/range-workflow';
import { appendMeanSdHistory } from '../domain/manage-validation';
import { ymOfDate } from '../domain/period-lock-validation';
import { compareQcPointOrder } from '../domain/sort-order';
import { isoLocalDateAfter } from '../domain/local-date';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireWrite } from './shared';

interface QcPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string;
  /** Cột INTEGER trong SQLite nhưng chỉ nhận 0/1 — khai hẹp cho khớp hợp
   * đồng `shared/qc-api.d.ts`, nơi renderer đọc nó như cờ nhị phân. */
  voided: 0 | 1;
  void_reason: string;
}
type ActivePoint = QcPointRow & { lot: string; qc_mean: number | null; qc_sd: number | null; runId: string; qcMean: number | null; qcSd: number | null };
type ActiveLevel = { level: number; mean: number | null; sd: number | null; lot: string; pts: ActivePoint[] };

export interface RangeCandidateView {
  testId: string; level: number; lot: string; source: 'mfg' | 'lab';
  current: { mean: number | null; sd: number | null; cv: number | null };
  manufacturer: { mean: number | null; sd: number | null };
  proposed: { n: number; days: number; mean: number; sd: number; cv: number; rejected: number; warnings: number } | null;
  safety: { needed: boolean; nceId: string | null; tea: number | null; biasThreshold: number | null };
  eligible: boolean; canRevert: boolean;
}


export function createEntryHandlers(db: Db) {
  function inTransaction<T>(work: () => T): T {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Sinh mã kế tiếp theo hậu tố lớn nhất. COUNT(*) có thể trùng mã khi dữ
   * liệu nhập từ backup có khoảng trống (ví dụ còn 01 và 03 nhưng đã mất 02). */
  function nextDailyNceId(date: string): string {
    const prefix = `NCE-${date.replace(/-/g, '')}-`;
    const rows = db.prepare('SELECT nce_id FROM actions WHERE nce_id LIKE ?').all(`${prefix}%`) as { nce_id: string }[];
    const maxSuffix = rows.reduce((max, row) => {
      const suffix = row.nce_id.startsWith(prefix) ? Number(row.nce_id.slice(prefix.length)) : NaN;
      return Number.isInteger(suffix) && suffix > max ? suffix : max;
    }, 0);
    return `${prefix}${String(maxSuffix + 1).padStart(2, '0')}`;
  }

  /** Kỳ báo cáo (YYYY-MM) đã khoá chặn thêm/huỷ điểm QC có ngày rơi vào kỳ
   * đó — trên TẤT CẢ xét nghiệm, không phải theo từng xét nghiệm riêng, khớp
   * chính sách PeriodService/entry-service.js của bản cũ (xem CLAUDE.md,
   * report-handlers.ts's lockPeriod/unlockPeriod là nơi ghi/xoá bảng này).
   * Đọc trực tiếp `period_locks` ở đây thay vì gọi qua report-handlers.ts để
   * 2 module không phụ thuộc lẫn nhau — mỗi handler tự SQL, khớp quy ước
   * chung của toàn bộ main/ipc/*. */
  function isPeriodLocked(date: string): boolean {
    return !!db.prepare('SELECT id FROM period_locks WHERE ym=?').get(ymOfDate(date));
  }

  /** Cổng `canEnterQcForLevel()` của app cũ: xét nghiệm còn hoạt động, thuộc
   * một Panel QC đang hoạt động, và CHÍNH mức đang nhập phải gắn với lô thuộc
   * nhóm còn vận hành (`active!==false`, không `stopped`/`planned`). Giữ cổng
   * này trong main để mọi nguồn ghi, kể cả LIS hay lời gọi IPC trực tiếp,
   * không thể lách điều kiện mà renderer dùng để dựng cây Nhập QC. */
  function canEnterQcForLevel(testId: string, qcLotId: string | null): boolean {
    if (!qcLotId) return false;
    const testReady = db.prepare(`SELECT 1
      FROM tests t
      WHERE t.id=? AND t.active<>0
        AND EXISTS (
          SELECT 1 FROM qc_panel_tests qpt
          JOIN qc_panels qp ON qp.id=qpt.panel_id
          WHERE qpt.test_id=t.id AND qp.active<>0
        )`).get(testId);
    if (!testReady) return false;
    return !!db.prepare(`SELECT 1
      FROM qc_lots ql
      JOIN lot_groups lg ON lg.id=ql.group_id
      WHERE ql.id=? AND ${OPERATIONAL_LOT_GROUP_SQL}`).get(qcLotId);
  }

  /** Cấu hình luật CHUNG toàn phòng xét nghiệm — cùng khoá `app_meta` mà
   * `westgard-handlers.ts` dùng (xem chú thích ở đó). Đọc lại bằng SQL riêng
   * ở đây thay vì import chéo handler, khớp quy ước "mỗi handler tự SQL". */
  function globalRules(): ReturnType<typeof parseRuleActions> {
    const row = db.prepare("SELECT value FROM app_meta WHERE key='westgardRules'").get() as { value: string } | undefined;
    return parseRuleActions(row ? row.value : null);
  }

  /** Một nguồn dữ liệu duy nhất cho Nhập QC: chỉ điểm chưa hủy thuộc đúng lô
   * đang gán của từng mức, sắp lần chạy theo số tự nhiên, rồi ghép luật
   * within/across.
   *
   * Tập mức lấy từ `db/operational-levels.ts` — CÙNG tập mà trang Phân tích
   * Westgard dùng. Trước đây hàm này đọc MỌI dòng `test_levels` (không cổng
   * nào), nên hai trang cho hai kết luận khác nhau trên cùng một điểm QC và
   * ngay trong trang này cây điều hướng cũng lệch với bảng worksheet — xem
   * ghi chú đầu `db/operational-levels.ts` và
   * `tests/entry-westgard-symmetry.test.mjs`. */
  function activeEvaluation(testId: string) {
    const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
    const inActivePanel = isTestInActivePanel(db, testId);
    const levels: ActiveLevel[] = listOperationalLevels(db, testId).map((config) => {
      const rows = inActivePanel
        ? db.prepare('SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 AND lot=?').all(testId, config.level, config.lot_no) as unknown as Omit<ActivePoint, 'runId' | 'qcMean' | 'qcSd'>[]
        : [];
      const pts = rows.map((p) => ({ ...p, runId: p.run_id, qcMean: p.qc_mean, qcSd: p.qc_sd })).sort(compareQcPointOrder);
      return { level: config.level, mean: config.mean, sd: config.sd, lot: config.lot_no, pts };
    });
    const overrides = parseRuleActions(test?.rule_actions_json);
    const on = makeIsOnLayered(globalRules(), overrides);
    const actionOf = makeRuleActionLayered(globalRules(), overrides);
    const scope = makeScopeOf(parseRuleScopes(test?.rule_scopes_json), levels.length);
    const within = (rule: string) => on(rule) && ['within', 'both'].includes(scope(rule));
    const across = (rule: string) => on(rule) && ['across', 'both'].includes(scope(rule));
    const byPoint = combinedWestgardByPoint(levels.map((item) => ({ level: item.level, pts: item.pts, mean: item.mean, sd: item.sd })), within, across, actionOf);
    return { levels, byPoint, within, actionOf };
  }

  function pointsForLot(testId: string, level: number, lot: string): ActivePoint[] {
    const rows = db.prepare('SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 AND lot=? ORDER BY date,run_id')
      .all(testId, level, lot) as unknown as Omit<ActivePoint, 'runId' | 'qcMean' | 'qcSd'>[];
    return rows.map((point) => ({ ...point, runId: point.run_id, qcMean: point.qc_mean, qcSd: point.qc_sd })).sort(compareQcPointOrder);
  }

  /** Cột lô song song đúng `parallelLotForLevel()` app cũ: chỉ hồ sơ active,
   * đúng Panel chứa xét nghiệm, lô cũ vẫn là lô đang gán và criteria có
   * Mean/SD hợp lệ. Mỗi mức lấy hồ sơ khớp đầu tiên như bản cũ. */
  function listParallelColumns(testId: string): ParallelEntryColumn[] {
    const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
    if (!test) return [];
    // Phạm vi within/across phải giống MỌI endpoint khác của xét nghiệm này,
    // nên đếm mức ĐANG VẬN HÀNH chứ không phải mọi dòng `test_levels`.
    const levelCount = countOperationalLevels(db, testId);
    const overrides = parseRuleActions(test.rule_actions_json);
    const on = makeIsOnLayered(globalRules(), overrides);
    const actionOf = makeRuleActionLayered(globalRules(), overrides);
    const scope = makeScopeOf(parseRuleScopes(test.rule_scopes_json), levelCount);
    const within = (rule: string) => on(rule) && ['within', 'both'].includes(scope(rule));
    const rows = db.prepare(`SELECT tr.id transition_id,tr.start_date,tr.criteria_json,tl.level,
        ql.id lot_id,ql.lot_no,ql.exp
      FROM lot_transitions tr
      JOIN qc_panel_tests pt ON pt.panel_id=tr.panel_id AND pt.test_id=?
      JOIN test_levels tl ON tl.test_id=pt.test_id AND tl.qc_lot_id=tr.from_lot_id
      JOIN qc_lots ql ON ql.id=tr.to_lot_id AND ql.level=tl.level
      WHERE tr.status='active' ORDER BY tr.rowid`)
      .all(testId) as { transition_id: string; start_date: string; criteria_json: string; level: number; lot_id: string; lot_no: string; exp: string }[];
    const seen = new Set<number>(), out: ParallelEntryColumn[] = [];
    for (const row of rows) {
      if (seen.has(row.level)) continue;
      let criteria: { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[] = [];
      try { const parsed = JSON.parse(row.criteria_json || '[]'); if (Array.isArray(parsed)) criteria = parsed; } catch { /* hồ sơ hỏng không tạo cột nhập */ }
      const target = criteria.find((item) => item.testId === testId && Number(item.level) === row.level && Number.isFinite(Number(item.mean)) && Number(item.sd) > 0);
      if (!target) continue;
      const pts = pointsForLot(testId, row.level, row.lot_no);
      const result = westgardByPoint(pts, Number(target.mean), Number(target.sd), within, actionOf);
      const points = pts.map((point, index) => ({ ...point, verdict: result.F[index]?.level || 'ok', rules: result.F[index]?.rules || [] }));
      out.push({ transitionId: row.transition_id, level: row.level, lotId: row.lot_id, lot: row.lot_no, startDate: row.start_date,
        mean: Number(target.mean), sd: Number(target.sd), low: target.low ?? null, high: target.high ?? null, exp: row.exp || '', points });
      seen.add(row.level);
    }
    return out;
  }

  /** Các lô cũ nằm trên đúng chuỗi chuyển tiếp đã CHẤP NHẬN dẫn tới lô đang
   * vận hành. Không liệt kê mọi lô cùng nhóm vì chúng có thể chưa từng được
   * dùng cho xét nghiệm này. Mean/SD lấy từ lịch sử cấu hình; snapshot trên
   * điểm là fallback cho dữ liệu đã nhập trước khi lịch sử được hoàn thiện. */
  function listPreviousLotSeries(testId: string): PreviousLotSeries[] {
    const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
    if (!test) return [];
    const configs = db.prepare(`SELECT level,qc_lot_id,mean_sd_history_json FROM test_levels WHERE test_id=? ORDER BY level`).all(testId) as
      { level: number; qc_lot_id: string | null; mean_sd_history_json: string }[];
    const overrides = parseRuleActions(test.rule_actions_json);
    const on = makeIsOnLayered(globalRules(), overrides);
    const actionOf = makeRuleActionLayered(globalRules(), overrides);
    // Như trên: `configs` quyết định CHUỖI nào được hiển thị, còn phạm vi luật
    // phải theo số mức đang vận hành để không lệch với chuỗi chính.
    const scope = makeScopeOf(parseRuleScopes(test.rule_scopes_json), countOperationalLevels(db, testId));
    const within = (rule: string) => on(rule) && ['within', 'both'].includes(scope(rule));
    const out: PreviousLotSeries[] = [];

    for (const config of configs) {
      if (!config.qc_lot_id) continue;
      let history: { qcLotId?: string; mean?: number | null; sd?: number | null }[] = [];
      try { const parsed = JSON.parse(config.mean_sd_history_json || '[]'); if (Array.isArray(parsed)) history = parsed; } catch { /* bỏ mốc hỏng */ }
      let currentLotId: string | null = config.qc_lot_id;
      const seen = new Set<string>();
      while (currentLotId && !seen.has(currentLotId)) {
        seen.add(currentLotId);
        const transition = db.prepare(`SELECT tr.from_lot_id
          FROM lot_transitions tr JOIN qc_panel_tests pt ON pt.panel_id=tr.panel_id AND pt.test_id=?
          WHERE tr.to_lot_id=? AND tr.status='accepted'
          ORDER BY tr.approved_at DESC,tr.rowid DESC LIMIT 1`).get(testId, currentLotId) as { from_lot_id: string } | undefined;
        if (!transition) break;
        const previous = db.prepare('SELECT id,lot_no,level FROM qc_lots WHERE id=?').get(transition.from_lot_id) as { id: string; lot_no: string; level: number } | undefined;
        if (!previous || previous.level !== config.level) break;
        const points = pointsForLot(testId, config.level, previous.lot_no);
        const saved = [...history].reverse().find((item) => item.qcLotId === previous.id && item.mean != null && item.sd != null && Number(item.sd) > 0);
        const snap = [...points].reverse().find((point) => point.qc_mean != null && point.qc_sd != null && Number(point.qc_sd) > 0);
        const mean = saved?.mean != null ? Number(saved.mean) : snap?.qc_mean != null ? Number(snap.qc_mean) : NaN;
        const sd = saved?.sd != null ? Number(saved.sd) : snap?.qc_sd != null ? Number(snap.qc_sd) : NaN;
        if (points.length && Number.isFinite(mean) && Number.isFinite(sd) && sd > 0) {
          const result = westgardByPoint(points, mean, sd, within, actionOf);
          out.push({ level: config.level, lotId: previous.id, lot: previous.lot_no, mean, sd,
            points: points.map((point, index) => ({ ...point, verdict: result.F[index]?.level || 'ok', rules: result.F[index]?.rules || [] })) });
        }
        currentLotId = previous.id;
      }
    }
    return out;
  }

  /** Danh sach diem QC cua 1 muc, kem verdict Westgard tinh theo Mean/SD hien
   * hanh cua muc do (khong bao gom diem da huy trong phep tinh z-score).
   * Tôn trọng CẢ 2 tầng cấu hình bật/tắt luật (chung toàn phòng xét nghiệm +
   * ghi đè riêng xét nghiệm, xem `makeIsOnLayered()`) — CÙNG một hàm isOn mà
   * trang Westgard dùng, để verdict không lệch nhau giữa hai trang. */
  function queryPoints(testId: string, level: number): QcPointView[] {
    const active = activeEvaluation(testId), selected = active.levels.find((item) => item.level === level);
    if (!selected) return [];
    return selected.pts.map((point) => {
      const flag = active.byPoint.get(point) || { level: 'ok' as RuleVerdict, rules: [] };
      return { ...point, verdict: flag.level, rules: flag.rules };
    });
  }

  /** Toàn bộ điểm chưa hủy của một xét nghiệm, không giới hạn ở lô đang
   * vận hành. Trang Lịch sử dữ liệu cần nguồn này để điểm của lô cũ vẫn
   * còn nhìn thấy sau khi chấp nhận chuyển tiếp lô. */
  function listHistoryPoints(testId: string): QcPointView[] {
    const rows = db.prepare('SELECT * FROM qc_points WHERE test_id=? AND voided=0 ORDER BY level,date,run_id').all(testId) as unknown as
      (QcPointRow & { lot: string; qc_mean: number | null; qc_sd: number | null })[];
    return rows.map((point) => {
      const z = point.qc_mean != null && point.qc_sd != null && point.qc_sd > 0
        ? (point.val - point.qc_mean) / point.qc_sd : NaN;
      const verdict: RuleVerdict = !Number.isFinite(z) || Math.abs(z) <= 2 ? 'ok' : Math.abs(z) <= 3 ? 'warn' : 'rej';
      return { ...point, verdict, rules: [] };
    });
  }

  /** Danh sách audit điểm đã hủy dùng riêng cho khối tra cứu. Tách endpoint
   * khỏi `queryPoints()` để điểm voided tuyệt đối không lọt lại vào chuỗi
   * Westgard, biểu đồ, thống kê hay quyết định ngày. */
  function listVoidedPoints(testId: string) {
    return db.prepare(`SELECT id,test_id,level,date,run_id,lot,val,operator_name,
        void_reason,void_kind,void_requires_rerun,voided_at,voided_by
      FROM qc_points WHERE test_id=? AND voided=1 ORDER BY date,run_id`).all(testId);
  }

  function rangeCandidate(testId: string, level: number): IpcResult<RangeCandidateView> {
    const test = db.prepare('SELECT id,tea FROM tests WHERE id=?').get(testId) as { id: string; tea: number | null } | undefined;
    const config = db.prepare(`SELECT mean,sd,mfg_mean,mfg_sd,applied,qc_lot_id FROM test_levels WHERE test_id=? AND level=?`).get(testId, level) as
      { mean: number | null; sd: number | null; mfg_mean: number | null; mfg_sd: number | null; applied: 'mfg' | 'lab'; qc_lot_id: string | null } | undefined;
    if (!test || !config) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy mức QC.' } };
    const lotRow = config.qc_lot_id ? db.prepare('SELECT lot_no FROM qc_lots WHERE id=?').get(config.qc_lot_id) as { lot_no: string } | undefined : undefined;
    const lot = lotRow?.lot_no || '';
    const active = activeEvaluation(testId), rows = active.levels.find((item) => item.level === level)?.pts || [];
    const candidate = evaluateRangeCandidate(rows.map((point) => ({ date: point.date, val: point.val, verdict: active.byPoint.get(point)?.level || 'ok' })));
    const systematic = new Set(WG_RULE_REGISTRY.filter((rule) => rule.err === 'SE').map((rule) => rule.id));
    const nce = (db.prepare("SELECT nce_id,rule FROM actions WHERE test_id=? AND level=? AND record_status<>'cancelled' ORDER BY date DESC,created_at DESC").all(testId, level) as { nce_id: string; rule: string }[])
      .find((action) => action.rule.split(',').map((rule) => rule.trim()).some((rule) => systematic.has(rule)));
    const tea = test.tea != null && test.tea > 0 ? test.tea : null;
    return { ok: true, data: {
      testId, level, lot, source: config.applied,
      current: { mean: config.mean, sd: config.sd, cv: config.mean && config.sd != null ? config.sd / Math.abs(config.mean) * 100 : null },
      manufacturer: { mean: config.mfg_mean, sd: config.mfg_sd },
      proposed: candidate ? { n: candidate.n, days: candidate.days, mean: candidate.m, sd: candidate.sd, cv: candidate.cv, rejected: candidate.rejected, warnings: candidate.warnings } : null,
      safety: { needed: !!nce, nceId: nce?.nce_id || null, tea, biasThreshold: tea != null ? tea / 4 : null },
      eligible: !!candidate?.eligible,
      canRevert: config.applied === 'lab' && config.mfg_mean != null && config.mfg_sd != null && config.mfg_sd > 0,
    } };
  }

  function createRangeAction(testId: string, level: number, lot: string, rule: string, reason: string, actor: Actor): void {
    const id = uid(), now = nowIso();
    const nceId = nextDailyNceId(now.slice(0, 10));
    db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,rule,error_type,nce_id,protocol_version,approval_status,effectiveness_status,record_status,detail_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,3,'pending','pending','active',?)`)
      .run(id, now.slice(0, 10), now, now, actor.userId, actor.username, testId, level, lot, rule, 'Quản lý dải kiểm soát', nceId, JSON.stringify({ correction: reason, rangeWorkflow: true }));
  }

  function applyLabRange(input: { data: { testId: string; level: number; reason: string; causeConfirmed?: boolean; bias?: number } }, actor: Actor): IpcResult<RangeCandidateView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const reason = validateRangeReason(input.data?.reason, 10);
    if (!reason) return { ok: false, error: { code: 'reason-too-short', message: 'Cần ghi lý do thiết lập dải tối thiểu 10 ký tự.' } };
    const fresh = rangeCandidate(String(input.data?.testId || ''), Number(input.data?.level));
    if (!fresh.ok) return fresh;
    if (!fresh.data.eligible || !fresh.data.proposed) return { ok: false, error: { code: 'not-eligible', message: 'Dữ liệu chưa đủ điều kiện lập dải kiểm soát mới.' } };
    if (fresh.data.safety.needed) {
      const bias = Number(input.data.bias), threshold = fresh.data.safety.biasThreshold;
      if (!input.data.causeConfirmed) return { ok: false, error: { code: 'cause-not-confirmed', message: 'Cần xác nhận đã xử lý nguyên nhân sai số hệ thống trước khi đổi dải.' } };
      if (threshold == null) return { ok: false, error: { code: 'missing-tea', message: 'Xét nghiệm chưa có TEa để kiểm tra Bias trước khi đổi dải.' } };
      if (!Number.isFinite(bias) || Math.abs(bias) > threshold) return { ok: false, error: { code: 'bias-out-of-range', message: `Bias phải nằm trong ±${threshold.toFixed(2)}% (TEa/4).` } };
    }
    const row = db.prepare('SELECT id,mean,sd,low,high,mfg_mean,mfg_sd,applied,qc_lot_id,mean_sd_history_json,mean_sd_effective_from FROM test_levels WHERE test_id=? AND level=?').get(fresh.data.testId, fresh.data.level) as
      { id: string; mean: number | null; sd: number | null; low: number | null; high: number | null; mfg_mean: number | null; mfg_sd: number | null; applied: 'mfg' | 'lab'; qc_lot_id: string | null; mean_sd_history_json: string; mean_sd_effective_from: string };
    const lotRow = row.qc_lot_id ? db.prepare('SELECT lot_no,opened FROM qc_lots WHERE id=?').get(row.qc_lot_id) as { lot_no: string; opened: string } | undefined : undefined;
    const changedAt = nowIso();
    const p = fresh.data.proposed, history = appendMeanSdHistory(row.mean_sd_history_json, {
      mean: row.mean, sd: row.sd, low: row.low, high: row.high, qcLotId: row.qc_lot_id || '', lot: lotRow?.lot_no || '',
      effectiveFrom: row.mean_sd_effective_from || lotRow?.opened || '', effectiveTo: changedAt.slice(0, 10), source: row.applied,
    }, changedAt);
    const mfgMean = row.mfg_mean ?? row.mean, mfgSd = row.mfg_sd ?? row.sd;
    db.exec('BEGIN');
    try {
      db.prepare(`UPDATE test_levels SET mean=?,sd=?,low=?,high=?,range_k=2,mfg_mean=?,mfg_sd=?,applied='lab',mean_sd_history_json=?,mean_sd_effective_from=? WHERE id=?`)
        .run(p.mean, p.sd, p.mean - 2 * p.sd, p.mean + 2 * p.sd, mfgMean, mfgSd, history, nowIso().slice(0, 10), row.id);
      createRangeAction(fresh.data.testId, fresh.data.level, fresh.data.lot, 'Thiết lập dải QC mới', reason, actor);
      writeAudit(db, actor, 'Thiết lập dải QC mới', `Mức ${fresh.data.level}: Mean ${row.mean ?? '—'} → ${p.mean}; SD ${row.sd ?? '—'} → ${p.sd}. Lý do: ${reason}`, fresh.data.testId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    notifyChanged(['test_levels', 'actions'], [fresh.data.testId]);
    return rangeCandidate(fresh.data.testId, fresh.data.level);
  }

  function revertManufacturerRange(input: { data: { testId: string; level: number; reason: string } }, actor: Actor): IpcResult<RangeCandidateView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const reason = validateRangeReason(input.data?.reason, 5);
    if (!reason) return { ok: false, error: { code: 'reason-too-short', message: 'Cần ghi lý do hoàn dải tối thiểu 5 ký tự.' } };
    const fresh = rangeCandidate(String(input.data?.testId || ''), Number(input.data?.level));
    if (!fresh.ok) return fresh;
    const m = fresh.data.manufacturer.mean, sd = fresh.data.manufacturer.sd;
    if (!fresh.data.canRevert || m == null || sd == null) return { ok: false, error: { code: 'cannot-revert', message: 'Mức QC chưa có dải nhà sản xuất hợp lệ để hoàn lại.' } };
    const row = db.prepare('SELECT id,mean,sd,low,high,applied,qc_lot_id,mean_sd_history_json,mean_sd_effective_from FROM test_levels WHERE test_id=? AND level=?').get(fresh.data.testId, fresh.data.level) as
      { id: string; mean: number | null; sd: number | null; low: number | null; high: number | null; applied: 'mfg' | 'lab'; qc_lot_id: string | null; mean_sd_history_json: string; mean_sd_effective_from: string };
    const lotRow = row.qc_lot_id ? db.prepare('SELECT lot_no,opened FROM qc_lots WHERE id=?').get(row.qc_lot_id) as { lot_no: string; opened: string } | undefined : undefined;
    const changedAt = nowIso();
    const history = appendMeanSdHistory(row.mean_sd_history_json, {
      mean: row.mean, sd: row.sd, low: row.low, high: row.high, qcLotId: row.qc_lot_id || '', lot: lotRow?.lot_no || '',
      effectiveFrom: row.mean_sd_effective_from || lotRow?.opened || '', effectiveTo: changedAt.slice(0, 10), source: row.applied,
    }, changedAt);
    db.exec('BEGIN');
    try {
      db.prepare(`UPDATE test_levels SET mean=?,sd=?,low=?,high=?,range_k=2,applied='mfg',mean_sd_history_json=?,mean_sd_effective_from=? WHERE id=?`)
        .run(m, sd, m - 2 * sd, m + 2 * sd, history, nowIso().slice(0, 10), row.id);
      createRangeAction(fresh.data.testId, fresh.data.level, fresh.data.lot, 'Hoàn dải QC', reason, actor);
      writeAudit(db, actor, 'Hoàn dải QC', `Mức ${fresh.data.level}: hoàn về Mean=${m}; SD=${sd}. Lý do: ${reason}`, fresh.data.testId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    notifyChanged(['test_levels', 'actions'], [fresh.data.testId]);
    return rangeCandidate(fresh.data.testId, fresh.data.level);
  }

  function addPoint(input: { data: QcPointInput }, actor: Actor): IpcResult<QcPointView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const knownLevels = (db.prepare('SELECT level FROM test_levels WHERE test_id=?').all(String(input.data.testId || '')) as { level: number }[]).map(r => r.level);
    const result = validateQcPointInput(input.data, knownLevels);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { testId, level, date, val, runId, lotNo, note, operatorName } = result.data;
    const test = db.prepare('SELECT name, decimal_places FROM tests WHERE id=?').get(testId) as { name: string; decimal_places: number } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (isPeriodLocked(date)) return { ok: false, error: { code: 'period-locked', message: `Kỳ ${ymOfDate(date)} đã bị khoá, không thể nhập thêm điểm QC.` } };
    // Chốt Mean/SD + số lô ĐANG dùng của mức này ngay lúc nhập, lưu kèm điểm
    // (qc_mean/qc_sd/lot) — westgard-engine.ts's pointTarget() đã sẵn đọc lại
    // 2 cột này làm ưu tiên trước fallbackMean/fallbackSd, nên điểm cũ không
    // bị đổi verdict âm thầm nếu sau này ai sửa lại Mean/SD của mức.
    const levelRow = db.prepare('SELECT mean, sd, qc_lot_id FROM test_levels WHERE test_id=? AND level=?').get(testId, level) as
      { mean: number | null; sd: number | null; qc_lot_id: string | null } | undefined;
    if (!canEnterQcForLevel(testId, levelRow?.qc_lot_id ?? null)) {
      return { ok: false, error: { code: 'level-not-operational', message: 'Mức QC chưa thuộc Panel và nhóm lô đang vận hành, không thể nhập QC.' } };
    }
    const lotRow = levelRow?.qc_lot_id ? db.prepare('SELECT lot_no FROM qc_lots WHERE id=?').get(levelRow.qc_lot_id) as { lot_no: string } | undefined : undefined;
    const currentLot = lotRow?.lot_no || '';
    const parallel = lotNo && lotNo !== currentLot ? listParallelColumns(testId).find((column) => column.level === level && column.lot === lotNo) : undefined;
    if (lotNo && lotNo !== currentLot && !parallel) {
      return { ok: false, error: { code: 'invalid-parallel-lot', message: 'Lô song song không còn ở trạng thái đang chạy hoặc chưa có Mean/SD ứng viên hợp lệ.' } };
    }
    const targetLot = parallel?.lot || currentLot;
    const targetMean = parallel?.mean ?? levelRow?.mean ?? null;
    const targetSd = parallel?.sd ?? levelRow?.sd ?? null;
    // Ghi chú theo ngày KẾ THỪA từ điểm khác cùng ngày/cùng xét nghiệm đã có
    // ghi chú (port `addPoint()` bản cũ, dòng dựng `dayNote`) — ghi chú theo
    // ngày không có cột riêng, nằm ở `note` của MỌI điểm còn hiệu lực trong
    // ngày, nên điểm MỚI thêm phải mang đúng ghi chú đó thay vì để trống.
    const dayNoteRow = db.prepare('SELECT note FROM qc_points WHERE test_id=? AND date=? AND voided=0 AND note<>\'\' LIMIT 1').get(testId, date) as { note: string } | undefined;
    const id = uid();
    let view: QcPointView | undefined;
    try {
      view = inTransaction(() => {
        db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,lot,val,value_decimals,qc_mean,qc_sd,note,operator_id,operator_username,operator_name)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id, testId, level, date, runId, targetLot, val, test.decimal_places ?? 2, targetMean, targetSd, note || dayNoteRow?.note || '', actor.userId, actor.username, operatorName || actor.name);
        writeAudit(db, actor, 'Nhập QC', `Điểm QC mức ${level}${parallel ? ` · lô song song ${targetLot}` : ''}, ngày ${date}, giá trị ${val}`, test.name);
        const pointView = parallel
          ? listParallelColumns(testId).find((column) => column.level === level && column.lot === targetLot)?.points.find((point) => point.id === id)
          : queryPoints(testId, level).find((point) => point.id === id);
        if (!pointView) throw new Error('point-view-missing');
        return pointView;
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'point-view-missing') {
        return { ok: false, error: { code: 'point-view-missing', message: 'Không thể dựng kết quả đánh giá nên điểm chưa được lưu.' } };
      }
      throw error;
    }
    notifyChanged(['qc_points'], [testId]);
    return { ok: true, data: view };
  }

  /** Hủy điểm QC — port đúng `EntryService.voidPoint()` bản cũ, bao gồm cả
   * phần trước đây CHƯA từng wiring ở app-v2: "kind" (nguyên nhân hủy) quyết
   * định có tự mở/dùng lại hồ sơ NCE hay không (`voidNceChoice()`). Cột
   * `void_kind`/`void_requires_rerun` đã có sẵn trong schema từ đầu nhưng
   * chưa handler nào ghi — đây là lần đầu được dùng thật. */
  function voidPoint(input: { data: VoidPointInput }, actor: Actor): IpcResult<{ id: string; nceId: string | null; reusedAction: boolean }> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateVoidInput(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { pointId, reason, kind, openNce } = result.data;
    const point = db.prepare('SELECT id, test_id, level, date, run_id, lot, val, qc_mean, qc_sd, voided FROM qc_points WHERE id=?').get(pointId) as
      { id: string; test_id: string; level: number; date: string; run_id: string; lot: string; val: number; qc_mean: number | null; qc_sd: number | null; voided: number } | undefined;
    if (!point) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy điểm QC.' } };
    if (point.voided) return { ok: false, error: { code: 'already-voided', message: 'Điểm QC này đã bị huỷ trước đó.' } };
    if (isPeriodLocked(point.date)) return { ok: false, error: { code: 'period-locked', message: `Kỳ ${ymOfDate(point.date)} đã bị khoá, không thể huỷ điểm QC.` } };
    const test = db.prepare('SELECT name, decimal_places FROM tests WHERE id=?').get(point.test_id) as { name: string; decimal_places: number } | undefined;
    // Luật/loại sai số của CHÍNH điểm này — đọc TRƯỚC khi đánh dấu huỷ, vì
    // queryPoints() chỉ tính verdict cho điểm CHƯA huỷ (voided=0).
    const currentView = queryPoints(point.test_id, point.level).find(p => p.id === pointId);
    const parallelView = listParallelColumns(point.test_id).flatMap((column) => column.points).find((p) => p.id === pointId);
    let view = currentView || parallelView;
    if (!view) {
      // Hồ sơ chuyển lô có thể vừa kết thúc nhưng người dùng vẫn huỷ điểm lịch
      // sử. Khi đó đánh giá riêng đúng lô bằng snapshot đã chốt trên điểm.
      const history = pointsForLot(point.test_id, point.level, point.lot);
      const active = activeEvaluation(point.test_id);
      const result = westgardByPoint(history, point.qc_mean, point.qc_sd, active.within, active.actionOf);
      const index = history.findIndex((item) => item.id === pointId);
      if (index >= 0) view = { ...history[index], verdict: result.F[index]?.level || 'ok', rules: result.F[index]?.rules || [] };
    }
    const rules = view ? Array.from(new Set(view.rules)) : [];
    const rule = rules.length ? rules.join(', ') : 'Không có luật Westgard';
    const qcVerdict = view && (view.verdict === 'warn' || view.verdict === 'rej') ? view.verdict : 'invalid';
    const kindLabel = kind === 'analytical' ? 'Kết quả QC thực tế không hợp lệ' : kind === 'data-entry' ? 'Nhập sai dữ liệu' : '';
    const composedReason = kindLabel ? (reason ? `${kindLabel} — ${reason}` : kindLabel) : reason;
    const mutation = inTransaction(() => {
      db.prepare('UPDATE qc_points SET voided=1, void_reason=?, void_kind=?, void_requires_rerun=?, voided_at=?, voided_by=? WHERE id=?')
        .run(composedReason, kind, openNce ? 1 : 0, nowIso(), actor.username, pointId);
      writeAudit(db, actor, 'Hủy điểm QC', `Điểm QC mức ${point.level}, ngày ${point.date}, giá trị ${point.val} · Lý do: ${composedReason}`, test ? test.name : '');
      let nceId: string | null = null, reusedAction = false, createdAction = false;
      if (openNce) {
        // Dùng lại hồ sơ NCE ĐANG MỞ của CHÍNH điểm này nếu có (chưa huỷ,
        // chưa duyệt), tránh mở trùng cho cùng một lần vi phạm.
        const existing = db.prepare("SELECT nce_id FROM actions WHERE point_id=? AND record_status<>'cancelled' AND approval_status<>'approved' ORDER BY created_at DESC LIMIT 1")
          .get(pointId) as { nce_id: string } | undefined;
        if (existing) { nceId = existing.nce_id; reusedAction = true; }
        else {
          const id = uid();
          nceId = nextDailyNceId(nowIso().slice(0, 10));
          const dueDate = isoLocalDateAfter(7);
          const correction = `Hủy điểm QC mức ${point.level}, ngày ${point.date}, giá trị ${point.val.toFixed(test?.decimal_places ?? 2)}, lần chạy ${point.run_id}. Lý do: ${composedReason}`;
          const now = nowIso();
          db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,qc_verdict,nce_id,protocol_version,approval_status,effectiveness_status,record_status,due_date,detail_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?)`)
            .run(id, point.date, now, now, actor.userId, actor.username, point.test_id, point.level, point.lot, pointId, rule, errorType(rules), qcVerdict, nceId, dueDate,
              JSON.stringify({ correction, openedFromVoid: true }));
          writeAudit(db, actor, 'Tạo hồ sơ NCE', `Mở hồ sơ ${nceId} từ hủy điểm QC`, test ? test.name : '');
          createdAction = true;
        }
      }
      return { nceId, reusedAction, createdAction };
    });
    notifyChanged(mutation.createdAction ? ['qc_points', 'actions'] : ['qc_points'], [point.test_id]);
    return { ok: true, data: { id: pointId, nceId: mutation.nceId, reusedAction: mutation.reusedAction } };
  }

  /** Ghi chú theo NGÀY (cột "Ghi chú" của bảng nhập QC). Port đúng
   * `EntryService.saveDateNote()` bản cũ: không có bảng riêng, ghi chú nằm ở
   * trường `note` của MỌI điểm QC còn hiệu lực trong ngày — nên ngày chưa có
   * điểm nào thì không lưu được (`no-points`), đúng như bản cũ. */
  function setDayNote(input: { data: { testId: string; date: string; note: string } }, actor: Actor): IpcResult<{ note: string; updated: number }> {
    const denied = requireWrite(actor); if (denied) return denied;
    const testId = String(input.data?.testId || '').trim();
    const date = String(input.data?.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: { code: 'invalid-date', message: 'Ngày không hợp lệ (định dạng YYYY-MM-DD).' } };
    const test = db.prepare('SELECT name FROM tests WHERE id=?').get(testId) as { name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (isPeriodLocked(date)) return { ok: false, error: { code: 'period-locked', message: `Kỳ ${ymOfDate(date)} đã bị khoá, không thể sửa ghi chú.` } };
    const note = String(input.data?.note ?? '').slice(0, 1000).trim();
    const rows = db.prepare('SELECT id FROM qc_points WHERE test_id=? AND date=? AND voided=0').all(testId, date) as { id: string }[];
    if (!rows.length) return { ok: false, error: { code: 'no-points', message: 'Ngày này chưa có điểm QC nào để gắn ghi chú.' } };
    inTransaction(() => {
      db.prepare('UPDATE qc_points SET note=? WHERE test_id=? AND date=? AND voided=0').run(note, testId, date);
      writeAudit(db, actor, 'Ghi chú QC', `Ngày ${date}${note ? ' · ' + note : ' · xoá ghi chú'}`, test.name);
    });
    notifyChanged(['qc_points'], [testId]);
    return { ok: true, data: { note, updated: rows.length } };
  }

  return { queryPoints, listHistoryPoints, listVoidedPoints, listParallelColumns, listPreviousLotSeries, rangeCandidate, applyLabRange, revertManufacturerRange, addPoint, voidPoint, setDayNote };
}

export type EntryHandlers = ReturnType<typeof createEntryHandlers>;
