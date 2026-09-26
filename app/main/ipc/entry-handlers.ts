// IPC handler cho module Entry (nhập/hủy điểm QC). Lô đang vận hành được đánh
// giá đa mức; lô mới trong chuyển tiếp được đánh giá riêng từng mức và không
// làm thay đổi verdict chính cho tới khi hồ sơ được chấp nhận.
import type { Db } from '../db/sqlite-like';
import { listOperationalLevels, isTestInActivePanel, countOperationalLevels, OPERATIONAL_LOT_GROUP_SQL } from '../db/operational-levels';
import { evaluateQcSets } from '../db/westgard-evaluation';
import { createHistoricalWestgard } from '../db/historical-westgard';
import { listPreviousLotSeriesData } from '../db/lot-lineage';
// 3 kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung thay vì khai lại: bản khai
// cũ ở đây dùng `voided: number` trong khi hợp đồng khai `0 | 1`, và renderer
// tin theo hợp đồng — hai khai báo song song cùng tên là đúng loại drift mà
// đợt 2026-09-10 đi gỡ.
import type { QcPointView, HistoryQcPointView, ParallelEntryColumn, PreviousLotSeries } from '../../shared/qc-api';

export type { QcPointView, HistoryQcPointView, ParallelEntryColumn, PreviousLotSeries };
import { uid } from '../domain/text-utils';
import { validateQcPointInput, validateVoidInput, type QcPointInput, type VoidPointInput } from '../domain/entry-validation';
import { westgardByPoint, acceptedRunPoints, rejectingRules, rejectedLevelsByRun, type RuleVerdict } from '../domain/westgard-engine';
import { readGlobalRules } from '../db/rule-settings';
import { parseRuleActions, makeIsOnLayered, makeRuleActionLayered, parseRuleScopes, makeScopeOf } from '../domain/rule-config';
import { errorClass, WG_RULE_REGISTRY } from '../domain/westgard-rules';
import { evaluateRangeCandidate, validateRangeReason } from '../domain/range-workflow';
import { appendMeanSdHistory } from '../domain/manage-validation';
import { ymOfDate } from '../domain/period-lock-validation';
import { isDateInLockedPeriod } from '../db/period-locks';
import { compareQcPointOrder, qcRunKey } from '../domain/sort-order';
import { isoLocalDateAfter } from '../domain/local-date';
import { initialsFromName } from '../domain/name-initials';
import { nextNceId } from '../db/nce-ids';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireWrite, withTransaction } from './shared';

interface QcPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; operator_code: string;
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
  const inTransaction = <T>(work: () => T): T => withTransaction(db, work);


  /** Kỳ báo cáo (YYYY-MM) đã khoá chặn thêm/huỷ điểm QC có ngày rơi vào kỳ
   * đó — trên tất cả xét nghiệm, không phải theo từng xét nghiệm riêng. */
  const isPeriodLocked = (date: string): boolean => isDateInLockedPeriod(db, date);

  /** Cổng nhập QC: xét nghiệm còn hoạt động, thuộc một Panel QC đang hoạt động,
   * và chính mức đang nhập phải gắn với lô thuộc
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

  /** Một nguồn dữ liệu duy nhất cho Nhập QC: chỉ điểm chưa hủy thuộc đúng lô
   * đang gán của từng mức, sắp lần chạy theo số tự nhiên, rồi ghép luật
   *
   * Tập mức lấy từ `db/operational-levels.ts` — cùng tập mà trang Phân tích
   * Westgard dùng, để hai màn hình luôn đánh giá trên cùng một tập dữ liệu. */
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
    // Cấu hình luật CHUNG đọc qua `db/rule-settings.ts` — module dùng chung
    // được tách ra chính để không nơi nào tự dựng lại phép đọc khoá
    // `app_meta` này (bản trước có một `globalRules()` riêng ở đây).
    const overrides = parseRuleActions(test?.rule_actions_json);
    const global = readGlobalRules(db);
    const on = makeIsOnLayered(global, overrides);
    const actionOf = makeRuleActionLayered(global, overrides);
    const scope = makeScopeOf(parseRuleScopes(test?.rule_scopes_json), levels.length);
    // Chỉ kênh TỪNG MỨC cần lộ ra ngoài (nhánh dựng lại verdict của điểm lô đã
    // chuyển tiếp trong `voidPoint()`); kênh liên mức nằm trọn trong
    const within = (rule: string) => on(rule) && ['within', 'both'].includes(scope(rule));
    const byPoint = evaluateQcSets(db, testId, levels);
    return { levels, byPoint, within, actionOf };
  }

  function pointsForLot(testId: string, level: number, lot: string): ActivePoint[] {
    const rows = db.prepare('SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 AND lot=? ORDER BY date,run_id')
      .all(testId, level, lot) as unknown as Omit<ActivePoint, 'runId' | 'qcMean' | 'qcSd'>[];
    return rows.map((point) => ({ ...point, runId: point.run_id, qcMean: point.qc_mean, qcSd: point.qc_sd })).sort(compareQcPointOrder);
  }

  /** Cột lô song song chỉ nhận hồ sơ active, đúng Panel chứa xét nghiệm, lô
   * cũ vẫn đang gán và criteria có Mean/SD hợp lệ. Mỗi mức lấy hồ sơ khớp đầu tiên. */
  function listParallelColumns(testId: string): ParallelEntryColumn[] {
    const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
    if (!test) return [];
    // Phạm vi within/across phải giống MỌI endpoint khác của xét nghiệm này,
    // nên đếm mức ĐANG VẬN HÀNH chứ không phải mọi dòng `test_levels`.
    const levelCount = countOperationalLevels(db, testId);
    const rows = db.prepare(`SELECT tr.id transition_id,tr.start_date,tr.criteria_json,tl.level,
        ql.id lot_id,ql.lot_no,ql.exp
      FROM lot_transitions tr
      JOIN qc_panel_tests pt ON pt.panel_id=tr.panel_id AND pt.test_id=?
      JOIN test_levels tl ON tl.test_id=pt.test_id AND tl.qc_lot_id=tr.from_lot_id
      JOIN qc_lots ql ON ql.id=tr.to_lot_id AND ql.level=tl.level
      WHERE tr.status='active' ORDER BY tr.rowid`)
      .all(testId) as { transition_id: string; start_date: string; criteria_json: string; level: number; lot_id: string; lot_no: string; exp: string }[];
    const seen = new Set<number>();
    const columns: { row: typeof rows[number]; target: { mean: number; sd: number; low?: number | null; high?: number | null }; pts: ActivePoint[] }[] = [];
    for (const row of rows) {
      if (seen.has(row.level)) continue;
      let criteria: { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[] = [];
      try { const parsed = JSON.parse(row.criteria_json || '[]'); if (Array.isArray(parsed)) criteria = parsed; } catch { /* hồ sơ hỏng không tạo cột nhập */ }
      const target = criteria.find((item) => item.testId === testId && Number(item.level) === row.level && Number.isFinite(Number(item.mean)) && Number(item.sd) > 0);
      if (!target) continue;
      columns.push({ row, target: { ...target, mean: Number(target.mean), sd: Number(target.sd) }, pts: pointsForLot(testId, row.level, row.lot_no) });
      seen.add(row.level);
    }
    if (!columns.length) return [];
    // Đánh giá CẢ BỘ cột song song qua cùng một đường với chuỗi đang vận hành
    // và tab lô lịch sử. Bản trước gọi `westgardByPoint()` cho TỪNG cột, tức
    // chỉ kênh trong-mức: hai mức của lô mới đo cùng một lần chạy mà một mức
    // +2,5SD còn mức kia −2,5SD thì R4s/2-2s liên mức không bao giờ nổ, và
    // mốc "đã khắc phục xong" cũng không được áp. Lô đang chạy thẩm định là
    // lúc CẦN bắt sai số ngẫu nhiên lớn nhất, không phải lúc nới cổng.
    //
    // Chỉ gộp các cột song song với NHAU: chúng là các mức của cùng một lô
    // mới trong cùng lần chạy. Không trộn với lô đang vận hành — đó là hai
    // dòng dữ liệu khác nhau, kết luận thẩm định lô mới không được lẫn với
    // kết luận thường quy.
    const parallelSets = columns.map((column) => ({ level: column.row.level, key: `${column.row.level}:${column.row.lot_no}`, pts: column.pts, mean: column.target.mean, sd: column.target.sd }));
    const byPoint = evaluateQcSets(db, testId, parallelSets, levelCount);
    const accepted = acceptedRunPoints(byPoint);
    const rejectedBy = rejectedLevelsByRun(parallelSets, byPoint);
    return columns.map(({ row, target, pts }) => ({
      transitionId: row.transition_id, level: row.level, lotId: row.lot_id, lot: row.lot_no, startDate: row.start_date,
      mean: target.mean, sd: target.sd, low: target.low ?? null, high: target.high ?? null, exp: row.exp || '',
      points: pts.map((point) => {
        const flag = byPoint.get(point);
        return { ...point, verdict: flag?.level || 'ok', rules: flag?.rules || [], accepted: accepted.has(point), runRejectedBy: rejectedBy.get(qcRunKey(point)) || [] };
      }),
    }));
  }

  /** Các lô cũ nằm trên đúng chuỗi chuyển tiếp đã CHẤP NHẬN dẫn tới lô đang
   * vận hành. Không liệt kê mọi lô cùng nhóm vì chúng có thể chưa từng được
   * dùng cho xét nghiệm này. Mean/SD lấy từ lịch sử cấu hình; snapshot trên
   * điểm là fallback cho dữ liệu đã nhập trước khi lịch sử được hoàn thiện. */
  function listPreviousLotSeries(testId: string): PreviousLotSeries[] {
    const blocks = createHistoricalWestgard(db).listPreviousLotBlocks(testId);
    return listPreviousLotSeriesData(db, testId).map((series) => {
      const block = blocks.find(item => item.lotId === series.lotId && item.level === series.level);
      const flags = new Map(block?.analysis.points.map(point => [point.id, point]));
      return {
        level: series.level, lotId: series.lotId, lot: series.lot, mean: series.mean, sd: series.sd,
        points: series.points.map(point => ({
          ...point,
          verdict: flags.get(point.id)?.verdict || 'none',
          rules: flags.get(point.id)?.rules || [],
          accepted: flags.get(point.id)?.accepted ?? false,
          // Lý do bị loại theo lần chạy đi kèm luôn, để cột "Xem lô cũ" nói
          // được y hệt chuỗi đang vận hành thay vì chỉ bớt điểm khỏi thống kê.
          runRejectedBy: flags.get(point.id)?.runRejectedBy || [],
        })) as unknown as PreviousLotSeries['points'],
      };
    });
  }

  /** Tôn trọng cả hai tầng cấu hình bật/tắt luật: chung toàn phòng xét nghiệm và
   * ghi đè riêng xét nghiệm, xem `makeIsOnLayered()`) — CÙNG một hàm isOn mà
   * trang Westgard dùng, để verdict không lệch nhau giữa hai trang. */
  function queryPoints(testId: string, level: number): QcPointView[] {
    const active = activeEvaluation(testId), selected = active.levels.find((item) => item.level === level);
    if (!selected) return [];
    // `accepted`/`runRejectedBy` đi kèm verdict NGAY TỪ ĐÂY. Trước đó chỉ
    // `analyzeLevel()` biết một điểm có vào thống kê hay không, nên thẻ Nhập
    // QC chỉ đọc được verdict riêng của điểm: một mức "Đạt" nằm trong lần
    // chạy đã bị mức khác làm hỏng vẫn hiện xanh và vẫn bị lặng lẽ trừ khỏi
    // n — người dùng thấy 11 chấm mà thống kê nói 9.
    const accepted = acceptedRunPoints(active.byPoint);
    const rejectedBy = rejectedLevelsByRun(active.levels, active.byPoint);
    return selected.pts.map((point) => {
      const flag = active.byPoint.get(point) || { level: 'ok' as RuleVerdict, rules: [] };
      // `rejectRules` tính Ở ĐÂY vì chỉ main mới có bảng hành động đã phân
      // giải 3 lớp (ghi đè theo xét nghiệm → cấu hình chung → registry).
      // Renderer dùng nó để không in một luật cảnh báo vào cột "Vi phạm loại
      // bỏ" chỉ vì nó đứng cùng điểm với một luật loại bỏ khác.
      return {
        ...point, verdict: flag.level, rules: flag.rules,
        rejectRules: rejectingRules(flag.rules, active.actionOf),
        accepted: accepted.has(point),
        runRejectedBy: rejectedBy.get(qcRunKey(point)) || [],
      };
    });
  }

  /** Toàn bộ điểm chưa hủy của một xét nghiệm, không giới hạn ở lô đang
   * vận hành. Trang Lịch sử dữ liệu cần nguồn này để điểm của lô cũ vẫn
   * còn nhìn thấy sau khi chấp nhận chuyển tiếp lô.
   *
   * KHÔNG kèm kết luận Westgard, và đó là chủ đích — xem `HistoryQcPointView`.
   * Bản trước trả một trường `verdict` tính bằng ngưỡng z thuần (|z|<=2 →
   * 'ok', <=3 → 'warn', còn lại 'rej'), trùng tên và trùng kiểu với verdict
   * THẬT của `queryPoints()` nhưng mang nghĩa khác hẳn. Không nơi nào đọc nó
   * — `HistoryTab` tự tính lại từ `qc_mean`/`qc_sd` và dán nhãn rõ "Phân loại
   * theo Z-score, không phải kết luận Westgard" — nên nó chỉ nằm chờ người
   * sửa sau nhặt nhầm. Đánh giá Westgard thật đòi cả tập mức cùng lần chạy,
   * không thể suy từ một điểm lẻ, nên endpoint này không dựng nó. */
  function listHistoryPoints(testId: string): HistoryQcPointView[] {
    return db.prepare(`SELECT id,test_id,level,date,run_id,lot,val,qc_mean,qc_sd,note,
        operator_name,operator_username,operator_code,voided,void_reason
      FROM qc_points WHERE test_id=? AND voided=0 ORDER BY level,date,run_id`).all(testId) as unknown as HistoryQcPointView[];
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
    // Cổng dải PXN đếm theo LẦN CHẠY bị loại, không theo verdict riêng của
    // mức: một điểm đạt nằm trong lần chạy đã hỏng vì mức khác vi phạm không
    // phải dữ liệu in-control. Dùng `rejectedLevelsByRun()` thay vì
    // `acceptedRunPoints()` để mức CHƯA có Mean/SD (z không hữu hạn nên không
    // điểm nào "được chấp nhận") vẫn lập được dải lần đầu.
    const rejectedRuns = rejectedLevelsByRun(active.levels, active.byPoint);
    const candidate = evaluateRangeCandidate(rows.map((point) => ({
      date: point.date, val: point.val,
      verdict: active.byPoint.get(point)?.level || 'ok',
      runRejected: (rejectedRuns.get(qcRunKey(point))?.length ?? 0) > 0,
    })));
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

  function createRangeAction(testId: string, level: number, lot: string, rule: string, reason: string, actor: Actor, detail: Record<string, unknown>): void {
    const id = uid(), now = nowIso();
    const nceId = nextNceId(db, now.slice(0, 10));
    db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,rule,error_type,nce_id,protocol_version,approval_status,effectiveness_status,record_status,detail_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,3,'pending','pending','active',?)`)
      // `error_type` chỉ chứa mã SE/RE — hồ sơ quản lý dải KHÔNG phân loại sai số
      // (loại việc đã nằm ở cột `rule` và cờ `rangeWorkflow` trong `detail_json`).
      .run(id, now.slice(0, 10), now, now, actor.userId, actor.username, testId, level, lot, rule, '', nceId, JSON.stringify({ correction: reason, rangeWorkflow: true, ...detail }));
  }

  function applyLabRange(input: { data: { testId: string; level: number; reason: string; causeConfirmed?: boolean; bias?: number; mean?: number; sd?: number } }, actor: Actor): IpcResult<RangeCandidateView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const reason = validateRangeReason(input.data?.reason, 10);
    if (!reason) return { ok: false, error: { code: 'reason-too-short', message: 'Cần ghi lý do thiết lập dải tối thiểu 10 ký tự.' } };
    const fresh = rangeCandidate(String(input.data?.testId || ''), Number(input.data?.level));
    if (!fresh.ok) return fresh;
    if (!fresh.data.eligible || !fresh.data.proposed) return { ok: false, error: { code: 'not-eligible', message: 'Dữ liệu chưa đủ điều kiện lập dải kiểm soát mới.' } };
    // Hai giá trị phải đi cùng nhau: không cho client đổi lẻ Mean hoặc SD.
    // Cổng này ở main để mọi caller IPC, không chỉ modal, chịu cùng ràng buộc.
    const hasMean = input.data?.mean != null, hasSd = input.data?.sd != null;
    if (hasMean !== hasSd) return { ok: false, error: { code: 'incomplete-manual-range', message: 'Khi chỉnh thủ công phải nhập đủ Mean và SD.' } };
    const manual = hasMean && hasSd;
    const chosenMean = manual ? Number(input.data.mean) : fresh.data.proposed.mean;
    const chosenSd = manual ? Number(input.data.sd) : fresh.data.proposed.sd;
    if (!Number.isFinite(chosenMean) || !Number.isFinite(chosenSd) || chosenSd <= 0) {
      return { ok: false, error: { code: 'invalid-manual-range', message: 'Mean phải là số hợp lệ và SD phải lớn hơn 0.' } };
    }
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
    const p = { mean: chosenMean, sd: chosenSd }, history = appendMeanSdHistory(row.mean_sd_history_json, {
      mean: row.mean, sd: row.sd, low: row.low, high: row.high, qcLotId: row.qc_lot_id || '', lot: lotRow?.lot_no || '',
      effectiveFrom: row.mean_sd_effective_from || lotRow?.opened || '', effectiveTo: changedAt.slice(0, 10), source: row.applied,
    }, changedAt);
    const mfgMean = row.mfg_mean ?? row.mean, mfgSd = row.mfg_sd ?? row.sd;
    inTransaction(() => {
      db.prepare(`UPDATE test_levels SET mean=?,sd=?,low=?,high=?,range_k=2,mfg_mean=?,mfg_sd=?,applied='lab',mean_sd_history_json=?,mean_sd_effective_from=? WHERE id=?`)
        .run(p.mean, p.sd, p.mean - 2 * p.sd, p.mean + 2 * p.sd, mfgMean, mfgSd, history, nowIso().slice(0, 10), row.id);
      const selection = manual ? 'chỉnh thủ công' : 'dải đề xuất';
      createRangeAction(fresh.data.testId, fresh.data.level, fresh.data.lot, 'Thiết lập dải QC mới', reason, actor, {
        selection, proposed: fresh.data.proposed, applied: p,
      });
      writeAudit(db, actor, 'Thiết lập dải QC mới', `Mức ${fresh.data.level}: Mean ${row.mean ?? '—'} → ${p.mean}; SD ${row.sd ?? '—'} → ${p.sd}. Nguồn: ${selection}. Lý do: ${reason}`, fresh.data.testId);
    });
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
    inTransaction(() => {
      db.prepare(`UPDATE test_levels SET mean=?,sd=?,low=?,high=?,range_k=2,applied='mfg',mean_sd_history_json=?,mean_sd_effective_from=? WHERE id=?`)
        .run(m, sd, m - 2 * sd, m + 2 * sd, history, nowIso().slice(0, 10), row.id);
      createRangeAction(fresh.data.testId, fresh.data.level, fresh.data.lot, 'Hoàn dải QC', reason, actor, { selection: 'nhà sản xuất', applied: { mean: m, sd } });
      writeAudit(db, actor, 'Hoàn dải QC', `Mức ${fresh.data.level}: hoàn về Mean=${m}; SD=${sd}. Lý do: ${reason}`, fresh.data.testId);
    });
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
    // Một mức/lô chỉ có MỘT kết quả trong một lần chạy. UI luôn sinh run ID
    // chung đúng quy tắc này, nhưng LIS và mọi lời gọi IPC cũng phải bị chặn
    // tại cổng ghi; nếu không engine liên mức chỉ giữ điểm cuối cùng của mức
    // đó khi nhóm theo run ID.
    const duplicateRun = db.prepare(`SELECT id FROM qc_points
      WHERE test_id=? AND level=? AND lot=? AND date=? AND run_id=? AND voided=0 LIMIT 1`)
      .get(testId, level, targetLot, date, runId) as { id: string } | undefined;
    if (duplicateRun) {
      return { ok: false, error: { code: 'duplicate-run', message: `Mức ${level}, lô ${targetLot || 'đang dùng'} đã có kết quả ở lần chạy ${runId}. Hãy tạo lần chạy bổ sung.` } };
    }
    // Ghi chú theo ngày kế thừa từ điểm khác cùng ngày/cùng xét nghiệm đã có
    // ghi chú — ghi chú theo
    // ngày không có cột riêng, nằm ở `note` của MỌI điểm còn hiệu lực trong
    // ngày, nên điểm MỚI thêm phải mang đúng ghi chú đó thay vì để trống.
    const dayNoteRow = db.prepare('SELECT note FROM qc_points WHERE test_id=? AND date=? AND voided=0 AND note<>\'\' LIMIT 1').get(testId, date) as { note: string } | undefined;
    const id = uid();
    let view: QcPointView | undefined;
    try {
      view = inTransaction(() => {
        const savedInitials = (db.prepare('SELECT initials FROM users WHERE id=?').get(actor.userId) as { initials: string } | undefined)?.initials || '';
        const operatorCode = operatorName || savedInitials || initialsFromName(actor.name);
        db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,lot,val,value_decimals,qc_mean,qc_sd,note,operator_id,operator_username,operator_name,operator_code)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id, testId, level, date, runId, targetLot, val, test.decimal_places ?? 2, targetMean, targetSd, note || dayNoteRow?.note || '', actor.userId, actor.username, operatorName || actor.name, operatorCode);
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

  /** Hủy điểm QC. "kind" (nguyên nhân hủy) quyết định có tự mở/dùng lại hồ
   * sơ NCE hay không (`voidNceChoice()`). */
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
          nceId = nextNceId(db, nowIso().slice(0, 10));
          const dueDate = isoLocalDateAfter(7);
          const correction = `Hủy điểm QC mức ${point.level}, ngày ${point.date}, giá trị ${point.val.toFixed(test?.decimal_places ?? 2)}, lần chạy ${point.run_id}. Lý do: ${composedReason}`;
          const now = nowIso();
          db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,qc_verdict,nce_id,protocol_version,approval_status,effectiveness_status,record_status,due_date,detail_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?)`)
      .run(id, point.date, now, now, actor.userId, actor.username, point.test_id, point.level, point.lot, pointId, rule, errorClass(rules), qcVerdict, nceId, dueDate,
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

  /** Ghi chú theo ngày (cột "Ghi chú" của bảng nhập QC). Không có bảng riêng;
   * ghi chú nằm ở trường `note` của mọi điểm QC còn hiệu lực trong ngày, nên
   * ngày chưa có điểm nào thì không lưu được (`no-points`). */
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

