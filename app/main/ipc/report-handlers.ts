// IPC handler cho trang Báo cáo: khoá/mở khoá kỳ báo cáo + đọc lại điểm QC
// theo khoảng ngày. Việc dựng tệp (CSV/Excel/PDF) nằm ở renderer qua
// `export:tableXlsx`/`print:htmlToPdf` — xem `docs/APP-PLAN.md` mục 3.8.
import type { Db } from '../db/sqlite-like';
import { uid } from '../domain/text-utils';
import { validateLockPeriod, validateUnlockPeriod, type LockPeriodInput, type UnlockPeriodInput } from '../domain/period-lock-validation';
import { isPeriodLocked as isLocked } from '../db/period-locks';
import { nceQueueRows } from '../db/nce-evaluation';
import { hasPeriodOpenItems, periodOpenItems, periodOpenItemsText } from '../domain/period-review';
import { isValidYm } from '../domain/period-lock-validation';
import { REVIEW_CONCLUSION_LABELS, summarizeReviewGroup, validateReviewSignature, type ReviewPoint, type ReviewPointStatus } from '../domain/monthly-review';
import { isoLocalDate } from '../domain/local-date';
import { acceptedRunPoints } from '../domain/westgard-engine';
import { activeEvaluationOf } from './active-evaluation';
import { previousLotsOf } from './previous-lot-cache';
import { listParallelColumns } from './parallel-columns';
import { REPORT_FORM_LABELS, parseReportTemplates, validateReportTemplate, type ReportTemplateInput } from '../domain/report-template-validation';
import { type IpcResult, nowIso, requireQcConfig } from './shared';
import { writeCommand } from './write-command';
// Kiểu hàng báo cáo lấy từ HỢP ĐỒNG dùng chung thay vì khai lại ở đây — bản
// trước có hai khai báo song song cùng tên và bản ở đây thiếu cột `lot`.
import type { QcMonthlyReview, QcMonthlyReviewRow, QcMonthlyReviewSignature, ReportPointRow, ReportTemplateSettings } from '../../shared/qc-api';

export type { ReportPointRow, ReportTemplateSettings };

export interface PeriodLockRow { id: string; ym: string; locked_at: string; locked_by: string; note: string }

const REPORT_TEMPLATE_META_KEY = 'reportTemplateSettings';



export function createReportHandlers(db: Db) {
  function getReportTemplateSettings(): ReportTemplateSettings {
    const row = db.prepare('SELECT value FROM app_meta WHERE key=?').get(REPORT_TEMPLATE_META_KEY) as { value?: unknown } | undefined;
    try {
      return parseReportTemplates(JSON.parse(String(row?.value || '')));
    } catch {
      return parseReportTemplates(null);
    }
  }

  const saveReportTemplateSettings = writeCommand(db, 'saveReportTemplateSettings', 'admin', (w, input: { data: ReportTemplateInput }): IpcResult<ReportTemplateSettings> => {
    const result = validateReportTemplate(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { kind, form } = result.data;
    const current = getReportTemplateSettings();
    const before = current[kind];
    if (before.formCode === form.formCode && before.version === form.version && before.effectiveDate === form.effectiveDate) return w.noChange(current);
    const next = { ...current, [kind]: form };
    try {
      w.commit((tx) => {
        db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
          .run(REPORT_TEMPLATE_META_KEY, JSON.stringify(next));
        const effective = form.effectiveDate ? ` · hiệu lực ${form.effectiveDate}` : '';
        tx.audit(`Sửa biểu mẫu ${REPORT_FORM_LABELS[kind]}`, `Mã ${form.formCode} · phiên bản ${form.version}${effective}`, form.formCode);
        tx.changed(['report_templates']);
      });
    } catch (error) {
      return { ok: false, error: { code: 'save-report-template-failed', message: error instanceof Error ? error.message : 'Không lưu được biểu mẫu báo cáo.' } };
    }
    return { ok: true, data: next };
  });

  function listPeriodLocks(): PeriodLockRow[] {
    return db.prepare('SELECT * FROM period_locks ORDER BY ym DESC').all() as unknown as PeriodLockRow[];
  }

  const isPeriodLocked = (ym: string): boolean => isLocked(db, ym);

  const hasReview = (ym: string) => !!db.prepare('SELECT 1 FROM qc_month_reviews WHERE ym=? LIMIT 1').get(ym);

  /** Việc còn tồn của kỳ (`domain/period-review.ts`); rỗng nếu không còn.
   * `withReview`: tính cả việc chưa có biên bản xem xét tháng. */
  function openItemsText(ym: string, withReview: boolean): string {
    const openRecords = (db.prepare(`SELECT n.nce_id, n.detected_at, GROUP_CONCAT(r.date) AS run_dates FROM nce_records n
      LEFT JOIN nce_runs r ON r.nce_record_id=n.id AND r.role<>'rerun'
      WHERE n.status NOT IN ('closed','cancelled') GROUP BY n.id`).all() as { nce_id: string; detected_at: string; run_dates: string | null }[])
      .map((row) => ({ nceId: row.nce_id, detectedAt: row.detected_at || '', runDates: row.run_dates ? row.run_dates.split(',') : [] }));
    const open = periodOpenItems(ym, nceQueueRows(db), openRecords, !withReview || hasReview(ym));
    const names = new Map((db.prepare('SELECT id, name FROM tests').all() as { id: string; name: string }[]).map((t) => [t.id, t.name]));
    return hasPeriodOpenItems(open) ? periodOpenItemsText(open, (testId) => names.get(testId) || testId) : '';
  }

  /** Kết luận Westgard của các điểm `needed` của một xét nghiệm, theo đúng
   * các nguồn trang Nhập QC/Westgard dùng: lô đang vận hành, lô đang chạy song
   * song, lô cũ đã chuyển tiếp. Điểm không thuộc nguồn nào là chưa đánh giá.
   * Chỉ tính nguồn sau khi nguồn trước chưa phủ hết: dựng lô cũ của 60 xét
   * nghiệm 5 năm mất khoảng 15 giây, mà điểm trong tháng hầu như thuộc lô đang
   * vận hành. */
  function pointStatuses(testId: string, needed: ReadonlySet<string>): Map<string, ReviewPointStatus> {
    const out = new Map<string, ReviewPointStatus>();
    const covered = () => [...needed].every((id) => out.has(id));
    const active = activeEvaluationOf(db, testId);
    const accepted = acceptedRunPoints(active.byPoint);
    for (const level of active.levels) {
      const hasTarget = level.mean != null && level.sd != null;
      for (const point of level.pts) out.set(point.id, !hasTarget ? 'unevaluated' : accepted.has(point) ? 'accepted' : 'rejected');
    }
    const fromView = (point: { id: string; verdict: string; accepted?: boolean }) => {
      if (!out.has(point.id)) out.set(point.id, point.verdict === 'none' ? 'unevaluated' : point.accepted ? 'accepted' : 'rejected');
    };
    if (!covered()) for (const column of listParallelColumns(db, testId)) column.points.forEach(fromView);
    if (!covered()) for (const block of previousLotsOf(db, testId).blocks) block.analysis.points.forEach(fromView);
    return out;
  }

  /** Số liệu biên bản xem xét QC của tháng `ym` (GV4 mục 2). */
  function monthlyReviewData(ym: string): Omit<QcMonthlyReview, 'signatures'> {
    const [year, month] = ym.split('-').map(Number);
    const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    const from = `${ym}-01`, to = `${next}-01`;
    const tests = new Map((db.prepare(`SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS name, t.unit, t.decimal_places, COALESCE(i.name,'') AS instrument_name
      FROM tests t LEFT JOIN instruments i ON i.id=t.instrument_id`).all() as { id: string; name: string; unit: string; decimal_places: number; instrument_name: string }[]).map((t) => [t.id, t]));
    const points = db.prepare(`SELECT id, test_id, level, date, run_id, lot, val, qc_mean, qc_sd FROM qc_points
      WHERE voided=0 AND date>=? AND date<? ORDER BY date, run_id`).all(from, to) as
      { id: string; test_id: string; level: number; date: string; run_id: string; lot: string; val: number; qc_mean: number | null; qc_sd: number | null }[];
    const statuses = new Map<string, Map<string, ReviewPointStatus>>();
    const groups = new Map<string, { testId: string; level: number; lot: string; points: ReviewPoint[]; voided: number; voidedRejected: number }>();
    const groupOf = (testId: string, level: number, lot: string) => {
      const key = `${testId}\u0000${level}\u0000${lot}`;
      let group = groups.get(key);
      if (!group) { group = { testId, level, lot, points: [], voided: 0, voidedRejected: 0 }; groups.set(key, group); }
      return group;
    };
    const rejectedRuns = new Set<string>();
    const idsByTest = new Map<string, Set<string>>();
    for (const point of points) idsByTest.set(point.test_id, (idsByTest.get(point.test_id) ?? new Set()).add(point.id));
    for (const point of points) {
      if (!statuses.has(point.test_id)) statuses.set(point.test_id, pointStatuses(point.test_id, idsByTest.get(point.test_id)!));
      const status = statuses.get(point.test_id)!.get(point.id) ?? 'unevaluated';
      if (status === 'rejected') rejectedRuns.add(`${point.test_id}|${point.date}|${point.run_id}`);
      groupOf(point.test_id, point.level, point.lot).points.push({ date: point.date, val: point.val, qcMean: point.qc_mean, qcSd: point.qc_sd, status });
    }
    const voided = db.prepare(`SELECT test_id, level, lot, COUNT(*) AS n, SUM(CASE WHEN void_rejection_json<>'' THEN 1 ELSE 0 END) AS rejected
      FROM qc_points WHERE voided=1 AND date>=? AND date<? GROUP BY test_id, level, lot`).all(from, to) as { test_id: string; level: number; lot: string; n: number; rejected: number }[];
    for (const row of voided) {
      const group = groupOf(row.test_id, row.level, row.lot);
      group.voided = Number(row.n); group.voidedRejected = Number(row.rejected) || 0;
    }
    const rows: QcMonthlyReviewRow[] = [...groups.values()].map((group) => {
      const test = tests.get(group.testId);
      const stats = summarizeReviewGroup(group.points);
      return {
        test_id: group.testId, test_name: test?.name || group.testId, instrument_name: test?.instrument_name || '', unit: test?.unit || '',
        decimal_places: Number(test?.decimal_places ?? 2), level: group.level, lot: group.lot,
        n: stats.n, accepted: stats.accepted, rejected: stats.rejected, unevaluated: stats.unevaluated,
        mean: stats.mean, sd: stats.sd, cv: stats.cv, target_mean: stats.targetMean, target_sd: stats.targetSd, target_cv: stats.targetCv,
        target_changed: stats.targetChanged, shift_sd: stats.shiftSd, bias_pct: stats.biasPct,
        voided: group.voided, voided_rejected: group.voidedRejected,
      };
    }).sort((a, b) => a.instrument_name.localeCompare(b.instrument_name, 'vi') || a.test_name.localeCompare(b.test_name, 'vi') || a.level - b.level || a.lot.localeCompare(b.lot));
    const inMonth = (date: string) => date.slice(0, 7) === ym;
    const nce = (db.prepare(`SELECT n.nce_id, n.status, n.error_class, n.detected_at, COALESCE(NULLIF(t.display_name,''), t.name, '') AS test_name,
        GROUP_CONCAT(r.date) AS run_dates
      FROM nce_records n LEFT JOIN tests t ON t.id=n.test_id LEFT JOIN nce_runs r ON r.nce_record_id=n.id AND r.role<>'rerun'
      GROUP BY n.id ORDER BY n.detected_at, n.nce_id`).all() as { nce_id: string; status: string; error_class: string; detected_at: string; test_name: string; run_dates: string | null }[])
      .filter((row) => (row.run_dates ? row.run_dates.split(',').some(inMonth) : inMonth(row.detected_at || '')))
      .map(({ run_dates: _runDates, ...row }) => row);
    return {
      ym, rows, nce,
      totals: {
        points: points.length, accepted: rows.reduce((sum, row) => sum + row.accepted, 0), rejected: rows.reduce((sum, row) => sum + row.rejected, 0),
        rejected_runs: rejectedRuns.size, voided: rows.reduce((sum, row) => sum + row.voided, 0), voided_rejected: rows.reduce((sum, row) => sum + row.voided_rejected, 0),
        nce: nce.length, nce_open: nce.filter((row) => row.status !== 'closed' && row.status !== 'cancelled').length,
      },
      open_items: openItemsText(ym, false),
    };
  }

  const signaturesOf = (ym: string) => db.prepare(`SELECT id, ym, conclusion, note, reviewer_name, reviewer_username, reviewed_at
    FROM qc_month_reviews WHERE ym=? ORDER BY reviewed_at, rowid`).all(ym) as unknown as QcMonthlyReviewSignature[];

  function getQcMonthlyReview(rawYm: unknown): QcMonthlyReview {
    const ym = isValidYm(rawYm) ? rawYm : isoLocalDate().slice(0, 7);
    return { ...monthlyReviewData(ym), signatures: signaturesOf(ym) };
  }

  /** Ký xem xét tháng: người có `qc.config` (ISO 15189:2022 6.2.3, 7.3.7.2).
   * Lưu kèm ảnh chụp số liệu lúc ký; ký lại thì thêm một lần ký mới. */
  const signQcMonthlyReview = writeCommand(db, 'signQcMonthlyReview', requireQcConfig(db), (w, input: { data: { ym?: unknown; conclusion?: unknown; note?: unknown } }): IpcResult<QcMonthlyReviewSignature> => {
    const result = validateReviewSignature(input.data ?? {}, isoLocalDate());
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { ym, conclusion, note } = result.data;
    const summary = monthlyReviewData(ym);
    const id = uid(), at = nowIso();
    const reviewer = (db.prepare('SELECT name FROM users WHERE id=?').get(w.actor.userId) as { name: string } | undefined)?.name || w.actor.name || w.actor.username;
    w.commit((tx) => {
      db.prepare(`INSERT INTO qc_month_reviews(id,ym,conclusion,note,reviewer_user_id,reviewer_username,reviewer_name,reviewed_at,summary_json)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(id, ym, conclusion, note, w.actor.userId, w.actor.username, reviewer, at, JSON.stringify(summary));
      const t = summary.totals;
      tx.audit('Ký biên bản xem xét QC', `Kỳ ${ym}: ${REVIEW_CONCLUSION_LABELS[conclusion]}${note ? ` — ${note}` : ''} · ${t.points} kết quả, ${t.rejected_runs} lần chạy bị loại, ${t.voided} điểm huỷ, ${t.nce_open}/${t.nce} hồ sơ NCE chưa đóng${summary.open_items ? ` · Còn tồn: ${summary.open_items}` : ''}`, ym);
      tx.changed(['qc_month_reviews']);
    });
    return { ok: true, data: signaturesOf(ym).find((row) => row.id === id)! };
  });

  const lockPeriod = writeCommand(db, 'lockPeriod', 'admin', (w, input: { data: LockPeriodInput }): IpcResult<PeriodLockRow> => {
    const actor = w.actor;
    const result = validateLockPeriod(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { ym, note, acknowledge } = result.data;
    if (isPeriodLocked(ym)) return { ok: false, error: { code: 'already-locked', message: `Kỳ ${ym} đã được khoá trước đó.` } };
    // GV4 mục 3: kỳ còn lần chạy bị loại chưa có hồ sơ NCE, hồ sơ chưa đóng
    // hoặc chưa có biên bản xem xét tháng thì phải xác nhận mới khoá, và danh
    // sách đó vào nhật ký.
    const openText = openItemsText(ym, true);
    if (openText && !acknowledge) {
      return { ok: false, error: { code: 'period-open-items', message: `Kỳ ${ym} còn việc chưa xem xét: ${openText}. Vẫn khoá thì danh sách này được ghi vào nhật ký.` } };
    }
    const id = uid();
    w.commit((tx) => {
      db.prepare('INSERT INTO period_locks(id,ym,locked_at,locked_by,note) VALUES (?,?,?,?,?)').run(id, ym, nowIso(), actor.username, note);
      tx.audit('Khoá kỳ báo cáo', `Khoá kỳ ${ym}${note ? ': ' + note : ''}${openText ? ` · Khoá khi còn: ${openText}` : ''}`, ym);
      tx.changed(['period_locks']);
    });
    return { ok: true, data: db.prepare('SELECT * FROM period_locks WHERE id=?').get(id) as unknown as PeriodLockRow };
  });

  const unlockPeriod = writeCommand(db, 'unlockPeriod', 'admin', (w, input: { data: UnlockPeriodInput }): IpcResult<{ ym: string }> => {
    const result = validateUnlockPeriod(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { ym, note } = result.data;
    if (!isPeriodLocked(ym)) return { ok: false, error: { code: 'not-locked', message: `Kỳ ${ym} chưa bị khoá.` } };
    w.commit((tx) => {
      db.prepare('DELETE FROM period_locks WHERE ym=?').run(ym);
      tx.audit('Mở khoá kỳ báo cáo', `Mở khoá kỳ ${ym}: ${note}`, ym);
      tx.changed(['period_locks']);
    });
    return { ok: true, data: { ym } };
  });

  /** Điểm QC của 1 xét nghiệm (mọi mức, MỌI lô) trong khoảng ngày.
   *
   * Trả cả điểm ĐÃ HUỶ kèm `void_reason` — báo cáo là hồ sơ, dấu vết huỷ phải
   * còn trong đó, không lọc đi.
   *
   * KHÔNG tính verdict Westgard: đánh giá luật cần cả tập mức cùng lần chạy
   * và thuộc trang Phân tích Westgard (trang đó có bản xuất riêng, kèm cột
   * "Lần chạy bị loại"/"Dùng thống kê"). Quyết định này ghi ở `docs/APP-PLAN.md`
   * mục 3.8. */
  function queryReport(input: { testId?: unknown; from?: unknown; to?: unknown }): ReportPointRow[] {
    const testId = String(input.testId || '');
    const from = String(input.from || '');
    const to = String(input.to || '');
    if (!testId) return [];
    // Liệt kê ĐÚNG các cột hợp đồng khai, không `SELECT *`: hàng báo cáo đi
    // thẳng ra tệp xuất nên không được mang theo cột không ai kiểm.
    let sql = `SELECT id,test_id,level,date,run_id,lot,val,note,operator_name,voided,void_reason
      FROM qc_points WHERE test_id=?`;
    const params: (string | number)[] = [testId];
    if (from) { sql += ' AND date>=?'; params.push(from); }
    if (to) { sql += ' AND date<=?'; params.push(to); }
    sql += ' ORDER BY date, level, run_id';
    return db.prepare(sql).all(...params) as unknown as ReportPointRow[];
  }

  return { getReportTemplateSettings, saveReportTemplateSettings, listPeriodLocks, isPeriodLocked, lockPeriod, unlockPeriod, queryReport, getQcMonthlyReview, signQcMonthlyReview };
}

export type ReportHandlers = ReturnType<typeof createReportHandlers>;


