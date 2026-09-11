// IPC handler cho trang Phan tich Westgard: tong quan tat ca xet nghiem/muc
// theo verdict te nhat hien tai, xem chi tiet 1 muc kem CUSUM, bat/tat tung
// luat rieng cho 1 xet nghiem.
import type { Db } from '../db/sqlite-like';
import { listOperationalLevels, isTestInActivePanel } from '../db/operational-levels';
import { westgard, combinedWestgardByPoint, cusumScan, acceptedPoints, type QcPointLike, type RuleVerdict, type CusumResult } from '../domain/westgard-engine';
import { parseRuleActions, serializeRuleActions, makeIsOnLayered, makeRuleActionLayered, isRuleAction, globalRuleList, parseRuleScopes, makeScopeOf, type RuleAction, type RuleActionsMap } from '../domain/rule-config';
import { WG_RULE_REGISTRY, defaultRuleAction, errorTypeDetail } from '../domain/westgard-rules';
import { compareQcPointOrder } from '../domain/sort-order';
import { isoLocalDate } from '../domain/local-date';
import { type Actor, type IpcResult, writeAudit, notifyChanged, requireWrite } from './shared';

const VERDICT_RANK: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };
/** CUSUM vượt h là tín hiệu drift/shift cần theo dõi, KHÔNG phải luật
 * Westgard loại bỏ một điểm. Nhãn này đi tới bảng và luồng NCE như cảnh báo
 * sai số hệ thống; chuỗi accepted vẫn chỉ do Westgard quyết định. */
function cusumSignalAt(cs: CusumResult, index: number): 'CUSUM +h' | 'CUSUM −h' | 'CUSUM ±h' | null {
  if (cs.flags[index] !== 'rej') return null;
  if (cs.cPos[index] >= cs.h) return 'CUSUM +h';
  if (cs.cNeg[index] <= -cs.h) return 'CUSUM −h';
  return 'CUSUM ±h';
}
/** Cấu hình luật CHUNG toàn phòng xét nghiệm — app cũ để ở `state.westgardRules`
 * (một object DUY NHẤT cho cả app, sửa từ panel "Cấu hình chung của luật" của
 * trang Phân tích Westgard). app-v2 chưa có khái niệm state toàn cục nên dùng
 * `app_meta` key/value, cùng cơ chế đã dùng cho `activityAnchor`/LIS/"Chọn
 * nhanh" hoá chất — không cần bảng riêng cho một map nhỏ luôn đọc/ghi nguyên
 * khối. */
const RULES_META_KEY = 'westgardRules';

// Nguồn duy nhất: hợp đồng dùng chung.
import type { TestSummary } from '../../shared/qc-api';

export type { TestSummary };

export interface LevelAnalysis {
  points: {
    id: string; date: string; runId: string; val: number; z: number;
    /** 'none' khi mức CHƯA có Mean/SD hợp lệ — port đúng app cũ
     * (`levelTargetOk()` → gán `level:'none'`): điểm CHƯA ĐƯỢC ĐÁNH GIÁ,
     * không phải "Đạt". Trước đây app-v2 gán cứng 'ok', hiện sai kết luận
     * ngay dưới banner cảnh báo "chưa có Mean/SD". */
    verdict: RuleVerdict | 'none'; rules: string[]; accepted: boolean;
    /** CUSUM vượt ±h: cảnh báo xu hướng (không đổi verdict/accepted Westgard). */
    cusumSignal: 'CUSUM +h' | 'CUSUM −h' | 'CUSUM ±h' | null;
    /** Luật mà điểm này là BẰNG CHỨNG LỊCH SỬ (điểm trước đó cấu thành 1 luật
     * nhiều điểm như 2-2s/4-1s/6x cho lần vi phạm SAU), không phải chính điểm
     * bị gắn luật — port `supportRules` app cũ (`PointsTable`'s cột "Luật /
     * bằng chứng"). Trước đây app-v2 tính ra rồi bỏ luôn ở tầng engine. */
    supportRules: string[];
    /** Loại sai số + mô tả luật CHÍNH của điểm — port `errorTypeDetailParts()`
     * app cũ (tính ở main, không phải renderer tự đoán theo `rules[0]`). */
    errorType: string; errorDesc: string;
  }[];
  /** `h` phải đi cùng chuỗi CUSUM tới renderer: nếu bỏ nó ở IPC, canvas sẽ
   * rơi về ±4 dù xét nghiệm đã cấu hình một ngưỡng khác. */
  cusum: { cPos: number[]; cNeg: number[]; flags: RuleVerdict[]; k: number; h: number; ma: number[] };
  /** Xét nghiệm có bật CUSUM không (`tests.cusum_on`) — trang chỉ vẽ/tính
   * CUSUM khi true, đúng `CusumPage` app cũ (`if(!cusum.on) return <Chưa bật...>`). */
  cusumOn: boolean;
}

export function createWestgardHandlers(db: Db) {
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

  function activeEvaluation(testId: string) {
    const levels = activeLevels(testId), test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
    const overrides = parseRuleActions(test?.rule_actions_json);
    const on = makeIsOnLayered(globalRules(), overrides);
    const actionOf = makeRuleActionLayered(globalRules(), overrides);
    const scope = makeScopeOf(parseRuleScopes(test?.rule_scopes_json), levels.length);
    return { levels, actionOf, within: (rule: string) => on(rule) && ['within', 'both'].includes(scope(rule)), across: (rule: string) => on(rule) && ['across', 'both'].includes(scope(rule)) };
  }
  function ruleActionsFor(testId: string): RuleActionsMap {
    const row = db.prepare('SELECT rule_actions_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string } | undefined;
    return parseRuleActions(row ? row.rule_actions_json : null);
  }

  function globalRules(): RuleActionsMap {
    const row = db.prepare('SELECT value FROM app_meta WHERE key=?').get(RULES_META_KEY) as { value: string } | undefined;
    return parseRuleActions(row ? row.value : null);
  }

  function writeGlobalRules(map: RuleActionsMap): void {
    db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(RULES_META_KEY, serializeRuleActions(map));
  }

  /** Cấu hình luật CHUNG (panel "Cấu hình chung của luật"): trạng thái bật/tắt
   * + mô tả + gợi ý xử lý của từng luật, KHÔNG phụ thuộc xét nghiệm nào. */
  function listRuleSettings(): { id: string; desc: string; on: boolean; fix: string; alert: boolean }[] {
    return globalRuleList(globalRules()).map(r => {
      const rule = WG_RULE_REGISTRY.find(x => x.id === r.id);
      return { id: r.id, on: r.on, desc: rule?.desc || '', fix: rule?.fix || '', alert: !!rule?.alert };
    });
  }

  /** Bật/tắt 1 luật ở tầng CHUNG — app cũ's `wgSet()`: đổi mặc định cho MỌI
   * xét nghiệm, không riêng xét nghiệm đang xem. Giữ `requireWrite` như app cũ
   * (`createWestgardRuleSettings` có `if(!deps.requireWrite())return`). */
  function saveRuleSetting(ruleId: string, on: boolean, actor: Actor): IpcResult<{ ruleId: string; on: boolean }> {
    const denied = requireWrite(actor); if (denied) return denied;
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    const map = globalRules();
    map[ruleId] = on;
    writeGlobalRules(map);
    writeAudit(db, actor, 'Sửa cấu hình luật Westgard', `Luật ${ruleId} chuyển thành ${on ? 'bật' : 'tắt'} (cấu hình chung)`, ruleId);
    notifyChanged(['app_meta']);
    return { ok: true, data: { ruleId, on } };
  }

  /** "Khôi phục mặc định" — app cũ's `wgReset()`: ghi lại NGUYÊN bộ mặc định
   * của `WG_RULE_REGISTRY`, không phải bật hết. */
  function resetRuleSettings(actor: Actor): IpcResult<{ id: string; on: boolean; desc: string; fix: string; alert: boolean }[]> {
    const denied = requireWrite(actor); if (denied) return denied;
    const defaults: RuleActionsMap = {};
    for (const rule of WG_RULE_REGISTRY) defaults[rule.id] = rule.defaultOn;
    writeGlobalRules(defaults);
    writeAudit(db, actor, 'Sửa cấu hình luật Westgard', 'Khôi phục cấu hình chung của luật về mặc định', 'Westgard');
    notifyChanged(['app_meta']);
    const data = globalRuleList(defaults).map(r => {
      const rule = WG_RULE_REGISTRY.find(x => x.id === r.id);
      return { id: r.id, on: r.on, desc: rule?.desc || '', fix: rule?.fix || '', alert: !!rule?.alert };
    });
    return { ok: true, data };
  }

  /** Danh sach tat ca xet nghiem + tung muc, kem verdict TE NHAT trong so
   * cac diem CHUA huy hien co - dung cho man hinh tong quan. */
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
      const active = activeEvaluation(t.test_id);
      const byPoint = combinedWestgardByPoint(active.levels.map((lv) => ({ level: lv.level, pts: lv.pts, mean: lv.mean, sd: lv.sd })), active.within, active.across, active.actionOf);
      const levels = active.levels.map(lv => {
        const points = lv.pts;
        let worstVerdict: RuleVerdict = 'ok';
        // `latestVerdict`/`latestRules` là kết luận của ĐIỂM CUỐI CÙNG, KHÁC
        // `worstVerdict` (xấu nhất trong MỌI điểm) — không phải trùng lặp:
        // trang Tổng quan của app cũ chỉ báo động theo điểm cuối
        // (`summarizeTestStatus()` chỉ đọc `points[points.length-1]`), nên
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
            const cs = cusumScan(points, lv.mean, lv.sd, t.cusum_k, t.cusum_h);
            for (let i = 0; i < points.length; i++) if (cusumSignalAt(cs, i) && worstVerdict === 'ok') worstVerdict = 'warn';
            const signal = cusumSignalAt(cs, points.length - 1);
            if (signal) {
              if (latestVerdict === 'ok') latestVerdict = 'warn';
              latestRules = [...new Set([...latestRules, signal])];
            }
          }
        }
        const last = points.at(-1);
        // CV QUAN SÁT ĐƯỢC của chính các điểm QC (không phải CV từ Mean/SD
        // đích) — khớp `stats()` của app cũ: SD mẫu (n-1), cv = sd/|mean|*100,
        // và bằng 0 khi chỉ có 1 điểm. Trang Tổng quan hiện CV này trong pill
        // mức QC.
        const vals = points.map(p => p.val);
        const n = vals.length;
        const obsMean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
        const obsSd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - obsMean) ** 2, 0) / (n - 1)) : 0;
        return {
          level: lv.level, mean: lv.mean, sd: lv.sd, qcLotId: lv.qc_lot_id, lot: lv.lot_no, exp: lv.exp,
          worstVerdict, latestVerdict, latestRules,
          pointCount: n, todayPointCount: points.filter(p => p.date === today).length,
          cv: n ? (obsMean ? obsSd / Math.abs(obsMean) * 100 : 0) : null,
          latest: last ? { id: last.id, date: last.date, runId: last.run_id, val: last.val } : null,
        };
      });
      return { testId: t.test_id, testName: t.test_name, instrumentName: t.instrument_name || '', unit: t.unit || '', decimalPlaces: t.decimal_places ?? 2, levels };
    });
  }

  /** Chi tiet 1 muc: tung diem kem z-score/verdict/luat, chuoi CUSUM, va
   * trang thai bat/tat cua tung luat cho xet nghiem nay. */
  function analyzeLevel(testId: string, level: number): LevelAnalysis {
    const test = db.prepare('SELECT cusum_on, cusum_k, cusum_h FROM tests WHERE id=?').get(testId) as { cusum_on: number; cusum_k: number; cusum_h: number } | undefined;
    const active = activeEvaluation(testId), levelRow = active.levels.find((item) => item.level === level), rows = levelRow?.pts || [];
    const byPoint = combinedWestgardByPoint(active.levels.map((lv) => ({ level: lv.level, pts: lv.pts, mean: lv.mean, sd: lv.sd })), active.within, active.across, active.actionOf);
    const asWestgard: QcPointLike[] = rows;
    const hasTarget = !!(levelRow && levelRow.mean != null && levelRow.sd != null);
    // CUSUM chỉ tính khi xét nghiệm ĐÃ BẬT (`tests.cusum_on`) và mức có Mean/SD
    // hợp lệ — trước đây luôn tính với k=0.5/h=4 mặc định bất kể cấu hình thật
    // của xét nghiệm, và trang luôn cho vẽ dù người dùng chưa bật CUSUM.
    const cusumOn = !!test?.cusum_on;
    const configuredH = Number(test?.cusum_h);
    const fallbackH = Number.isFinite(configuredH) && configuredH > 0 ? configuredH : 4;
    const configuredK = Number(test?.cusum_k);
    const fallbackK = Number.isFinite(configuredK) && configuredK > 0 ? configuredK : 0.5;
    // MA(5) chỉ để quan sát xu hướng, không tham gia kết luận Westgard/CUSUM.
    const cs = hasTarget && cusumOn
      ? cusumScan(asWestgard, levelRow!.mean, levelRow!.sd, test!.cusum_k, test!.cusum_h, 5)
      : { cPos: rows.map(() => 0), cNeg: rows.map(() => 0), flags: rows.map(() => 'ok' as RuleVerdict), k: fallbackK, h: fallbackH, ma: rows.map(() => 0) };
    // Cờ `accepted`: điểm có nằm trong CHUỖI ĐƯỢC CHẤP NHẬN hay không (xem
    // acceptedPoints() trong domain). Trang Nhập QC dùng cờ này cho biểu đồ/
    // thống kê, đúng như app cũ, thay vì tự chạy lại luật ở renderer.
    //
    // `acceptedPoints()` chỉ quét luật TỪNG MỨC (`active.within`), nên một
    // điểm bị loại CHỈ bởi luật LIÊN MỨC (R4s, hoặc 2-2s/2of3-2s/3-1s ở phạm
    // vi across) vẫn lọt vào chuỗi: object trả về tự mâu thuẫn
    // (`verdict: 'rej'` kèm `accepted: true`) và điểm đó vào cả biểu đồ
    // Levey-Jennings lẫn thống kê Mean/SD/CV thực. App cũ có cùng lỗ hổng
    // (`acceptedLotPoints()` cũng chỉ nhận tập luật `within`) — sửa ở đây là
    // lệch golden master CÓ CHỦ ĐÍCH.
    const rejectsAcross = (point: (typeof rows)[number]) => {
      const flag = byPoint.get(point);
      return !!flag && flag.crossRules.some((rule) => active.actionOf(rule) === 'reject');
    };
    const acceptedIds = new Set(
      (hasTarget ? acceptedPoints(rows, levelRow!.mean, levelRow!.sd, active.within, active.actionOf, rejectsAcross) : rows)
        .map(r => r.id),
    );
    const points = rows.map((r, i) => {
      // Mức CHƯA có Mean/SD hợp lệ — port `levelTargetOk()` app cũ: điểm
      // CHƯA ĐƯỢC ĐÁNH GIÁ ('none'), không phải 'ok'; Z không có nghĩa (giữ
      // NaN, renderer tự hiện '—' thay vì "NaNs").
      if (!hasTarget) return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: NaN, verdict: 'none' as const, rules: [], cusumSignal: null, supportRules: [], accepted: false, errorType: '—', errorDesc: '' };
      const flag = byPoint.get(r)!; const rules = flag.rules;
      const detail = errorTypeDetail(rules);
      const cusumSignal = cusumSignalAt(cs, i);
      return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: flag.z, verdict: flag.level, rules, cusumSignal, supportRules: flag.supportRules, accepted: acceptedIds.has(r.id), errorType: cusumSignal ? 'SE' : detail.type, errorDesc: cusumSignal ? 'Xu hướng CUSUM vượt ngưỡng quyết định; cần rà soát nguyên nhân hệ thống.' : detail.desc };
    });
    return { points, cusum: { cPos: cs.cPos, cNeg: cs.cNeg, flags: cs.flags, k: cs.k, h: cs.h, ma: cs.ma || [] }, cusumOn };
  }

  /** Mean/SD của 1 LÔ CỤ THỂ cho 1 mức — dùng cho tab "Nhóm lô đã dừng/lưu
   * trữ": lô hiện ĐANG gán (`test_levels.qc_lot_id`) thì đọc cột hiện hành;
   * lô đã bị THAY (không còn là lô đang gán) thì tra lại đúng mốc lịch sử
   * của NÓ trong `mean_sd_history_json` (mỗi lần đổi lô đều chốt 1 mốc kèm
   * `qcLotId`, xem `saveTestLevel()`/2 cascade chuyển lô). Không tìm được ở
   * cả hai nơi thì trả `null` — lô đó chưa từng có Mean/SD hợp lệ cho mức
   * này (vd lô được tạo nhưng chưa từng gán cho xét nghiệm nào). */
  function lotMeanSd(testId: string, level: number, lotId: string): { mean: number; sd: number } | null {
    const levelRow = db.prepare('SELECT qc_lot_id, mean, sd, mean_sd_history_json FROM test_levels WHERE test_id=? AND level=?').get(testId, level) as
      { qc_lot_id: string | null; mean: number | null; sd: number | null; mean_sd_history_json: string } | undefined;
    if (!levelRow) return null;
    if (levelRow.qc_lot_id === lotId && levelRow.mean != null && levelRow.sd != null) return { mean: levelRow.mean, sd: levelRow.sd };
    try {
      const history = JSON.parse(levelRow.mean_sd_history_json || '[]') as { qcLotId: string; mean: number | null; sd: number | null }[];
      const entry = [...history].reverse().find(h => h.qcLotId === lotId && h.mean != null && h.sd != null);
      if (entry) return { mean: entry.mean as number, sd: entry.sd as number };
    } catch { /* ignore */ }
    return null;
  }

  /** Toàn bộ lô của 1 nhóm lô đã dừng/lưu trữ — nhóm "Đã lưu trữ" (do CHẤP
   * NHẬN chuyển tiếp lô tạo ra) giữ ẢNH CHỤP thành viên CŨ ở
   * `archived_lot_ids_json` (xem config-handlers.ts), KHÁC `qc_lots.group_id`
   * SỐNG — phải gộp cả hai nguồn, không chỉ đọc `group_id`. */
  function lotsOfArchivedGroup(groupId: string): { id: string; lot_no: string; level: number }[] {
    const group = db.prepare('SELECT archived_lot_ids_json FROM lot_groups WHERE id=?').get(groupId) as { archived_lot_ids_json: string } | undefined;
    if (!group) return [];
    const byId = new Map<string, { id: string; lot_no: string; level: number }>();
    for (const lot of db.prepare('SELECT id, lot_no, level FROM qc_lots WHERE group_id=?').all(groupId) as { id: string; lot_no: string; level: number }[]) byId.set(lot.id, lot);
    if (group.archived_lot_ids_json) {
      try {
        for (const id of JSON.parse(group.archived_lot_ids_json) as string[]) {
          if (byId.has(id)) continue;
          const lot = db.prepare('SELECT id, lot_no, level FROM qc_lots WHERE id=?').get(id) as { id: string; lot_no: string; level: number } | undefined;
          if (lot) byId.set(id, lot);
        }
      } catch { /* ignore */ }
    }
    return [...byId.values()];
  }

  /** Xét nghiệm nào từng dùng ÍT NHẤT 1 lô của nhóm này — port điều kiện chọn
   * xét nghiệm trong tab "Nhóm lô đã dừng" app cũ (chỉ hiện xét nghiệm có dữ
   * liệu thật để phân tích, không phải mọi xét nghiệm trong hệ thống). */
  function listArchivedGroupTests(groupId: string): { id: string; label: string }[] {
    const lotIds = new Set(lotsOfArchivedGroup(groupId).map(l => l.id));
    if (!lotIds.size) return [];
    const rows = db.prepare(`
      SELECT tl.test_id as test_id, tl.qc_lot_id as qc_lot_id, tl.mean_sd_history_json as history, t.name as name
      FROM test_levels tl JOIN tests t ON t.id = tl.test_id
    `).all() as { test_id: string; qc_lot_id: string | null; history: string; name: string }[];
    const matched = new Map<string, string>();
    for (const row of rows) {
      let hit = !!(row.qc_lot_id && lotIds.has(row.qc_lot_id));
      if (!hit) {
        try { hit = (JSON.parse(row.history || '[]') as { qcLotId: string }[]).some(h => lotIds.has(h.qcLotId)); } catch { /* ignore */ }
      }
      if (hit) matched.set(row.test_id, row.name);
    }
    return [...matched.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }

  /** Phân tích Westgard THẬT cho 1 xét nghiệm trong 1 nhóm lô đã dừng/lưu
   * trữ — port `wgLotBlockModel()` app cũ: TÍNH LẠI theo bộ luật đang bật
   * HIỆN NAY (không phải cấu hình luật tại thời điểm nhóm lô còn hoạt động —
   * đúng hint app cũ hiện ngay trên trang), dùng Mean/SD ĐÃ CHỐT của đúng lô
   * đó (không phải Mean/SD hiện hành của mức, vốn có thể đã đổi sang lô
   * khác). Trước đây tab này chỉ liệt kê Số lô/Mức/Hạn dùng — không có
   * verdict/luật/biểu đồ nào, tức "phân tích Westgard" chưa từng tồn tại ở
   * đây dù đúng là tên trang. */
  function listArchivedBlocks(testId: string, groupId: string): { level: number; lotId: string; lotNo: string; mean: number; sd: number; analysis: LevelAnalysis }[] {
    const overrides = ruleActionsFor(testId);
    const isOn = makeIsOnLayered(globalRules(), overrides);
    const actionOf = makeRuleActionLayered(globalRules(), overrides);
    const blocks: { level: number; lotId: string; lotNo: string; mean: number; sd: number; analysis: LevelAnalysis }[] = [];
    for (const lot of lotsOfArchivedGroup(groupId)) {
      const target = lotMeanSd(testId, lot.level, lot.id);
      if (!target) continue;
      const rows = db.prepare('SELECT id, date, run_id, val FROM qc_points WHERE test_id=? AND level=? AND lot=? AND voided=0 ORDER BY date, run_id')
        .all(testId, lot.level, lot.lot_no) as { id: string; date: string; run_id: string; val: number }[];
      const asWestgard: QcPointLike[] = rows.map(r => ({ val: r.val, runId: r.run_id, date: r.date }));
      const wg = westgard(asWestgard, target.mean, target.sd, isOn, actionOf);
      const points = rows.map((r, i) => {
        const rules = wg.F[i].rules;
        const detail = errorTypeDetail(rules);
        return { id: r.id, date: r.date, runId: r.run_id, val: r.val, z: wg.zs[i], verdict: wg.F[i].level, rules, cusumSignal: null, supportRules: wg.F[i].supportRules, accepted: false, errorType: detail.type, errorDesc: detail.desc };
      });
      blocks.push({ level: lot.level, lotId: lot.id, lotNo: lot.lot_no, mean: target.mean, sd: target.sd, analysis: { points, cusum: { cPos: [], cNeg: [], flags: [], k: 0.5, h: 4, ma: [] }, cusumOn: false } });
    }
    blocks.sort((a, b) => a.level - b.level);
    return blocks;
  }

  /** Ghi đè RIÊNG cho 1 xét nghiệm. Chuỗi rỗng xoá ghi đè để quay về cấu
   * hình chung; boolean vẫn nhận cho client/dữ liệu V2 cũ và được đổi sang
   * hành động mặc định của luật. */
  function saveRuleAction(testId: string, ruleId: string, value: boolean | RuleAction | '', actor: Actor): IpcResult<{ ruleId: string; action: RuleAction | '' }> {
    const denied = requireWrite(actor); if (denied) return denied;
    const test = db.prepare('SELECT id, name, rule_actions_json FROM tests WHERE id=?').get(testId) as { id: string; name: string; rule_actions_json: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    if (typeof value !== 'boolean' && value !== '' && !isRuleAction(value)) return { ok: false, error: { code: 'invalid-action', message: 'Hành động luật không hợp lệ.' } };
    const overrides = parseRuleActions(test.rule_actions_json);
    const action: RuleAction | '' = value === '' ? '' : typeof value === 'boolean' ? defaultRuleAction(ruleId, value) : value;
    if (action) overrides[ruleId] = action; else delete overrides[ruleId];
    db.prepare('UPDATE tests SET rule_actions_json=? WHERE id=?').run(serializeRuleActions(overrides), testId);
    const label = action === '' ? 'theo cấu hình chung' : action === 'inactive' ? 'không dùng' : action === 'alert' ? 'cảnh báo' : 'loại bỏ';
    writeAudit(db, actor, 'Sửa cấu hình luật Westgard', `Luật ${ruleId} chuyển thành ${label}`, test.name);
    notifyChanged(['tests'], [testId]);
    return { ok: true, data: { ruleId, action } };
  }

  return { listTestSummaries, analyzeLevel, saveRuleAction, listRuleSettings, saveRuleSetting, resetRuleSettings, listArchivedBlocks, listArchivedGroupTests };
}

export type WestgardHandlers = ReturnType<typeof createWestgardHandlers>;
