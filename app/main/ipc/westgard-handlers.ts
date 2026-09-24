import type { Db } from '../db/sqlite-like';
import { listOperationalLevels, isTestInActivePanel } from '../db/operational-levels';
import { readGlobalRules, writeGlobalRules } from '../db/rule-settings';
import { createHistoricalWestgard } from '../db/historical-westgard';
import { evaluateQcSets, effectiveQcFixDates } from '../db/westgard-evaluation';
import { cusumScan, acceptedRunPoints, rejectedLevelsByRun, pointTarget, type CombinedPointFlag, type QcPointLike, type RuleVerdict, type CusumResult } from '../domain/westgard-engine';
import { parseRuleActions, serializeRuleActions, isRuleAction, globalRuleList, type RuleAction, type RuleActionsMap } from '../domain/rule-config';
import { WG_RULE_REGISTRY, errorTypeDetail, ERROR_CLASS_LABEL } from '../domain/westgard-rules';
import { compareQcPointOrder, qcRunKey } from '../domain/sort-order';
import { isoLocalDate } from '../domain/local-date';
import { type Actor, type IpcResult, writeAudit, notifyChanged, requireWrite } from './shared';

const VERDICT_RANK: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };

/** Chọn từ cùng kết luận của bảng, loại toàn bộ run mất kiểm soát. */
function acceptedIdsOf<T extends QcPointLike & { id: string }>(
  points: readonly T[], byPoint: ReadonlyMap<T, CombinedPointFlag>,
): Set<string> {
  const accepted = acceptedRunPoints(byPoint);
  return new Set(points.filter(point => accepted.has(point)).map(point => point.id));
}
/** CUSUM vượt h là tín hiệu drift/shift cần theo dõi, KHÔNG phải luật
 * Westgard loại bỏ một điểm. Nhãn này đi tới bảng và luồng NCE như cảnh báo
 * sai số hệ thống; chuỗi accepted vẫn chỉ do Westgard quyết định. */
function cusumSignalAt(cs: CusumResult, index: number): 'CUSUM +h' | 'CUSUM −h' | 'CUSUM ±h' | null {
  if (cs.flags[index] !== 'rej') return null;
  if (cs.cPos[index] >= cs.h) return 'CUSUM +h';
  if (cs.cNeg[index] <= -cs.h) return 'CUSUM −h';
  return 'CUSUM ±h';
}

// Nguồn duy nhất: hợp đồng dùng chung.
import type { TestSummary, LevelAnalysis } from '../../shared/qc-api';

export type { TestSummary };

export type { LevelAnalysis } from '../../shared/qc-api';

export function createWestgardHandlers(db: Db) {
  function inTransaction<T>(work: () => T): T {
    db.exec('BEGIN');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  type ActivePoint = QcPointLike & { id: string; date: string; run_id: string; val: number; qcMean: number | null; qcSd: number | null };
  type ActiveLevel = { level: number; mean: number | null; sd: number | null; qc_lot_id: string | null; lot_no: string; exp: string; pts: ActivePoint[] };
  const pointOrder = compareQcPointOrder;

  /** Mức QC ĐANG VẬN HÀNH của một xét nghiệm — hai cổng nằm ở
   * `db/operational-levels.ts` (nguồn DUY NHẤT, dùng chung với Nhập QC; lý do
   * và ca lệch đã đo được ghi ở đầu file đó). Ở đây chỉ còn phần riêng của
   * trang này: nạp điểm chưa hủy của đúng lô đang gán từng mức.
   * Nhóm lô đã dừng/lưu trữ có tab riêng (`listArchivedGroupTests`), đây
   * không phải chỗ hiển thị chúng. */
  function activeLevels(testId: string): ActiveLevel[] {
    const levels = listOperationalLevels(db, testId);
    const inActivePanel = isTestInActivePanel(db, testId);
    return levels.map((level) => {
      const rows = inActivePanel ? db.prepare(`SELECT id,date,run_id,val,qc_mean,qc_sd FROM qc_points
        WHERE test_id=? AND level=? AND voided=0 AND lot=?`).all(testId, level.level, level.lot_no) as
        { id: string; date: string; run_id: string; val: number; qc_mean: number | null; qc_sd: number | null }[] : [];
      const pts = rows.map((row) => ({ ...row, runId: row.run_id, qcMean: row.qc_mean, qcSd: row.qc_sd })).sort(pointOrder);
      return { ...level, pts };
    });
  }

  const globalRules = (): RuleActionsMap => readGlobalRules(db);

  /** Cấu hình luật CHUNG (panel "Cấu hình chung của luật"): trạng thái bật/tắt
   * + mô tả + gợi ý xử lý của từng luật, KHÔNG phụ thuộc xét nghiệm nào. */
  function listRuleSettings(): { id: string; desc: string; on: boolean; fix: string; alert: boolean }[] {
    return globalRuleList(globalRules()).map(r => {
      const rule = WG_RULE_REGISTRY.find(x => x.id === r.id);
      return { id: r.id, on: r.on, desc: rule?.desc || '', fix: rule?.fix || '', alert: !!rule?.alert };
    });
  }

  /** Bật/tắt một luật ở tầng chung: đổi mặc định cho mọi xét nghiệm, không
   * chỉ xét nghiệm đang xem. */
  function saveRuleSetting(ruleId: string, on: boolean, actor: Actor): IpcResult<{ ruleId: string; on: boolean }> {
    const denied = requireWrite(actor); if (denied) return denied;
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    if (typeof on !== 'boolean') return { ok: false, error: { code: 'invalid-value', message: 'Trạng thái luật không hợp lệ.' } };
    inTransaction(() => {
      const map = globalRules(); map[ruleId] = on;
      writeGlobalRules(db, map);
      writeAudit(db, actor, 'Sửa cấu hình luật Westgard', `Luật ${ruleId} chuyển thành ${on ? 'bật' : 'tắt'} (cấu hình chung)`, ruleId);
    });
    notifyChanged(['app_meta']);
    return { ok: true, data: { ruleId, on } };
  }

  /** Khôi phục toàn bộ cấu hình mặc định của `WG_RULE_REGISTRY`, không phải
   * bật tất cả luật. */
  function resetRuleSettings(actor: Actor): IpcResult<{ id: string; on: boolean; desc: string; fix: string; alert: boolean }[]> {
    const denied = requireWrite(actor); if (denied) return denied;
    const defaults: RuleActionsMap = {};
    for (const rule of WG_RULE_REGISTRY) defaults[rule.id] = rule.defaultOn;
    inTransaction(() => {
      writeGlobalRules(db, defaults);
      writeAudit(db, actor, 'Sửa cấu hình luật Westgard', 'Khôi phục cấu hình chung của luật về mặc định', 'Westgard');
    });
    notifyChanged(['app_meta']);
    const data = globalRuleList(defaults).map(r => {
      const rule = WG_RULE_REGISTRY.find(x => x.id === r.id);
      return { id: r.id, on: r.on, desc: rule?.desc || '', fix: rule?.fix || '', alert: !!rule?.alert };
    });
    return { ok: true, data };
  }

  function listTestSummaries(): TestSummary[] {
    // ORDER BY t.rowid (không phải t.name) — cùng quy ước "xét nghiệm thêm
    // trước nằm đầu" đã chốt cho `listTests()` (config-handlers.ts). Trước
    // đây hàm này tự sắp lại theo TÊN, làm cây điều hướng trang Nhập QC (đọc
    // trực tiếp mảng `summaries` này, không tự sắp lại) hiện SAI thứ tự so
    // với "Danh mục xét nghiệm" ở Cấu hình chung.
    const tests = db.prepare(`
      SELECT t.id as test_id, t.name as test_name, t.unit, t.decimal_places, t.cusum_on, t.cusum_k, t.cusum_h, i.name as instrument_name
      FROM tests t LEFT JOIN instruments i ON i.id = t.instrument_id
      ORDER BY t.rowid
    `).all() as { test_id: string; test_name: string; unit: string; decimal_places: number; cusum_on: number; cusum_k: number; cusum_h: number; instrument_name: string }[];

    // Một mốc `hôm nay` cho cả lượt: theo GIỜ ĐỊA PHƯƠNG (xem local-date.ts)
    // và tính MỘT lần, không dựng lại Date cho từng xét nghiệm.
    const today = isoLocalDate();
    return tests.map(t => {
      const active = { levels: activeLevels(t.test_id) };
      const byPoint = evaluateQcSets(db, t.test_id, active.levels);
      const levels = active.levels.map(lv => {
        const points = lv.pts;
        let worstVerdict: RuleVerdict = 'ok';
        // `latestVerdict`/`latestRules` là kết luận của ĐIỂM CUỐI CÙNG, KHÁC
        // `worstVerdict` (xấu nhất trong MỌI điểm) — không phải trùng lặp:
        // Trang Tổng quan chỉ báo động theo điểm cuối, nên
        // một mức từng vi phạm hôm trước mà điểm mới nhất đã đạt thì KHÔNG
        // còn nằm trong "Cần xử lý". Cây điều hướng trang Nhập QC và trang
        // Phân tích Westgard vẫn dùng `worstVerdict` như trước.
        let latestVerdict: RuleVerdict = 'ok';
        let latestRules: string[] = [];
        if (lv.mean != null && lv.sd != null && points.length) {
          const result = points.map((point) => byPoint.get(point)!);
          for (const flag of result) if (VERDICT_RANK[flag.level] > VERDICT_RANK[worstVerdict]) worstVerdict = flag.level;
          const lastFlag = result.at(-1);
          if (lastFlag) { latestVerdict = lastFlag.level; latestRules = lastFlag.rules.slice(); }
          // CUSUM là cảnh báo xu hướng: vào danh sách cần xử lý/NCE, nhưng
          // không tự biến điểm QC thành reject và không làm bẩn accepted set.
          if (t.cusum_on) {
            // CUSUM dùng cùng tập run được chấp nhận và cùng mốc khắc phục.
            const acceptedIds = acceptedIdsOf(points, byPoint);
            const cs = cusumForLevel(t.test_id, points, acceptedIds, lv.mean, lv.sd, t.cusum_k, t.cusum_h, 0);
            for (let i = 0; i < points.length; i++) if (cusumSignalAt(cs, i) && worstVerdict === 'ok') worstVerdict = 'warn';
            const signal = cusumSignalAt(cs, points.length - 1);
            if (signal) {
              if (latestVerdict === 'ok') latestVerdict = 'warn';
              latestRules = [...new Set([...latestRules, signal])];
            }
          }
        }
        const last = points.at(-1);
        // CV mẫu của các run được chấp nhận; n < 2 chưa đủ tính SD mẫu.
        const accepted = acceptedIdsOf(points, byPoint);
        const vals = points.filter(p => accepted.has(p.id)).map(p => p.val);
        const n = vals.length;
        const obsMean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
        const obsSd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - obsMean) ** 2, 0) / (n - 1)) : 0;
        return {
          level: lv.level, mean: lv.mean, sd: lv.sd, qcLotId: lv.qc_lot_id, lot: lv.lot_no, exp: lv.exp,
          worstVerdict, latestVerdict, latestRules,
          pointCount: points.length, todayPointCount: points.filter(p => p.date === today).length,
          cv: n >= 2 && obsMean !== 0 ? obsSd / Math.abs(obsMean) * 100 : null,
          latest: last ? { id: last.id, date: last.date, runId: last.run_id, val: last.val } : null,
        };
      });
      return { testId: t.test_id, testName: t.test_name, instrumentName: t.instrument_name || '', unit: t.unit || '', decimalPlaces: t.decimal_places ?? 2, levels };
    });
  }

  /** CUSUM dùng các run được chấp nhận; bắt đầu lại sau khắc phục hiệu quả.
   * Điểm bị loại chỉ giữ giá trị cộng dồn trước đó, không mang tín hiệu mới. */
  function cusumForLevel(
    testId: string, rows: readonly { id: string; date: string }[], acceptedIds: ReadonlySet<string>,
    mean: unknown, sd: unknown, k: unknown, h: unknown, maWindow: number,
  ): CusumResult {
    const accepted = rows.filter(r => acceptedIds.has(r.id));
    const fixDates = effectiveQcFixDates(db, testId);
    let fixCursor = 0;
    const scan = cusumScan(accepted as unknown as QcPointLike[], mean, sd, Number(k), Number(h), maWindow, (point) => {
      const date = String((point as { date?: unknown }).date || '');
      let reset = false;
      while (fixCursor < fixDates.length && fixDates[fixCursor] < date) { reset = true; fixCursor++; }
      return reset;
    });
    // Ánh xạ về đúng độ dài `rows`: điểm ngoài chuỗi giữ nguyên trạng thái
    // cộng dồn của điểm trước nó, cờ để 'ok'.
    const cPos: number[] = []; const cNeg: number[] = []; const flags: RuleVerdict[] = []; const ma: number[] = [];
    let cursor = 0; let lastPos = 0; let lastNeg = 0; let lastMa = NaN;
    for (const row of rows) {
      if (acceptedIds.has(row.id)) {
        lastPos = scan.cPos[cursor]; lastNeg = scan.cNeg[cursor];
        if (scan.ma) lastMa = scan.ma[cursor];
        cPos.push(lastPos); cNeg.push(lastNeg); flags.push(scan.flags[cursor]); ma.push(lastMa);
        cursor++;
      } else {
        cPos.push(lastPos); cNeg.push(lastNeg); flags.push('ok'); ma.push(lastMa);
      }
    }
    return maWindow ? { cPos, cNeg, flags, k: scan.k, h: scan.h, ma } : { cPos, cNeg, flags, k: scan.k, h: scan.h };
  }

  function analyzeLevel(testId: string, level: number): LevelAnalysis {
    const test = db.prepare('SELECT cusum_on, cusum_k, cusum_h FROM tests WHERE id=?').get(testId) as { cusum_on: number; cusum_k: number; cusum_h: number } | undefined;
    const active = { levels: activeLevels(testId) }, levelRow = active.levels.find((item) => item.level === level), rows = levelRow?.pts || [];
    const byPoint = evaluateQcSets(db, testId, active.levels);
    const hasTarget = !!(levelRow && levelRow.mean != null && levelRow.sd != null);
    // CUSUM chỉ tính khi xét nghiệm đã bật và mức có Mean/SD hợp lệ; dùng đúng
    // ngưỡng cấu hình của xét nghiệm.
    const cusumOn = !!test?.cusum_on;
    const configuredH = Number(test?.cusum_h);
    const fallbackH = Number.isFinite(configuredH) && configuredH > 0 ? configuredH : 4;
    const configuredK = Number(test?.cusum_k);
    const fallbackK = Number.isFinite(configuredK) && configuredK > 0 ? configuredK : 0.5;
    // Thống kê và CUSUM dùng đúng kết luận của bảng, loại toàn bộ run bị loại.
    const acceptedIds = hasTarget
      ? acceptedIdsOf(rows, byPoint)
      : new Set(rows.map(r => r.id));
    // MA(5) chỉ để quan sát xu hướng, không tham gia kết luận Westgard/CUSUM.
    // Phải tính SAU `acceptedIds`: CUSUM chạy trên chuỗi được chấp nhận.
    const cs = hasTarget && cusumOn
      ? cusumForLevel(testId, rows, acceptedIds, levelRow!.mean, levelRow!.sd, test!.cusum_k, test!.cusum_h, 5)
      : { cPos: rows.map(() => 0), cNeg: rows.map(() => 0), flags: rows.map(() => 'ok' as RuleVerdict), k: fallbackK, h: fallbackH, ma: rows.map(() => 0) };
    // Lý do loại theo LẦN CHẠY — cùng trường mà `entry:queryPoints` và tab
    // lô lịch sử trả, để ba đường đọc không mô tả cùng một điểm bằng ba hình
    // dạng khác nhau.
    const rejectedBy = rejectedLevelsByRun(active.levels, byPoint);
    const points = rows.map((r, i) => {
      // Mức chưa có Mean/SD hợp lệ: điểm chưa được đánh giá ('none'), không
      // phải 'ok'; Z không có nghĩa (giữ
      // NaN, renderer tự hiện '—' thay vì "NaNs").
      if (!hasTarget) return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: NaN, verdict: 'none' as const, rules: [], cusumSignal: null, supportRules: [], accepted: false, runRejected: false, targetMean: null, targetSd: null, errorType: '—', errorDesc: '' };
      const flag = byPoint.get(r)!; const rules = flag.rules;
      const detail = errorTypeDetail(rules);
      const cusumSignal = cusumSignalAt(cs, i);
      return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: flag.z, verdict: flag.level, rules, cusumSignal, supportRules: flag.supportRules, accepted: acceptedIds.has(r.id), runRejected: !acceptedIds.has(r.id), runRejectedBy: rejectedBy.get(qcRunKey(r)) || [], targetMean: pointTarget(r, levelRow!.mean, levelRow!.sd).mean, targetSd: pointTarget(r, levelRow!.mean, levelRow!.sd).sd, errorType: cusumSignal ? ERROR_CLASS_LABEL.SE : detail.type, errorDesc: cusumSignal ? 'Xu hướng CUSUM vượt ngưỡng quyết định; cần rà soát nguyên nhân hệ thống.' : detail.desc };
    });
    return { points, cusum: { cPos: cs.cPos, cNeg: cs.cNeg, flags: cs.flags, k: cs.k, h: cs.h, ma: cs.ma || [] }, cusumOn };
  }

  const { listArchivedBlocks, listArchivedGroupTests, listPreviousLotBlocks } = createHistoricalWestgard(db);

  /** Ghi đè riêng cho một xét nghiệm. Chuỗi rỗng xoá ghi đè để quay về cấu
   * hình chung. */
  function saveRuleAction(testId: string, ruleId: string, value: RuleAction | '', actor: Actor): IpcResult<{ ruleId: string; action: RuleAction | '' }> {
    const denied = requireWrite(actor); if (denied) return denied;
    const test = db.prepare('SELECT id, name, rule_actions_json FROM tests WHERE id=?').get(testId) as { id: string; name: string; rule_actions_json: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    if (value !== '' && !isRuleAction(value)) return { ok: false, error: { code: 'invalid-action', message: 'Hành động luật không hợp lệ.' } };
    const overrides = parseRuleActions(test.rule_actions_json);
    const action: RuleAction | '' = value;
    if (action) overrides[ruleId] = action; else delete overrides[ruleId];
    const label = action === '' ? 'theo cấu hình chung' : action === 'inactive' ? 'không dùng' : action === 'alert' ? 'cảnh báo' : 'loại bỏ';
    inTransaction(() => {
      db.prepare('UPDATE tests SET rule_actions_json=? WHERE id=?').run(serializeRuleActions(overrides), testId);
      writeAudit(db, actor, 'Sửa cấu hình luật Westgard', `Luật ${ruleId} chuyển thành ${label}`, test.name);
    });
    notifyChanged(['tests'], [testId]);
    return { ok: true, data: { ruleId, action } };
  }

  return { listTestSummaries, analyzeLevel, saveRuleAction, listRuleSettings, saveRuleSetting, resetRuleSettings, listArchivedBlocks, listArchivedGroupTests, listPreviousLotBlocks };
}

export type WestgardHandlers = ReturnType<typeof createWestgardHandlers>;


