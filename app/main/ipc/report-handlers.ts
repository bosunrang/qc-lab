// IPC handler cho trang Báo cáo: khoá/mở khoá kỳ báo cáo + đọc lại điểm QC
// theo khoảng ngày. Việc dựng tệp (CSV/Excel/PDF) nằm ở renderer qua
// `export:tableXlsx`/`print:htmlToPdf` — xem `docs/APP-PLAN.md` mục 3.8.
import type { Db } from '../db/sqlite-like';
import { uid } from '../domain/text-utils';
import { validateLockPeriod, validateUnlockPeriod, type LockPeriodInput, type UnlockPeriodInput } from '../domain/period-lock-validation';
import { isPeriodLocked as isLocked } from '../db/period-locks';
import { nceQueueRows } from '../db/nce-evaluation';
import { hasPeriodOpenItems, periodOpenItems, periodOpenItemsText } from '../domain/period-review';
import { REPORT_FORM_LABELS, parseReportTemplates, validateReportTemplate, type ReportTemplateInput } from '../domain/report-template-validation';
import { type IpcResult, nowIso } from './shared';
import { writeCommand } from './write-command';
// Kiểu hàng báo cáo lấy từ HỢP ĐỒNG dùng chung thay vì khai lại ở đây — bản
// trước có hai khai báo song song cùng tên và bản ở đây thiếu cột `lot`.
import type { ReportPointRow, ReportTemplateSettings } from '../../shared/qc-api';

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

  const lockPeriod = writeCommand(db, 'lockPeriod', 'admin', (w, input: { data: LockPeriodInput }): IpcResult<PeriodLockRow> => {
    const actor = w.actor;
    const result = validateLockPeriod(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { ym, note, acknowledge } = result.data;
    if (isPeriodLocked(ym)) return { ok: false, error: { code: 'already-locked', message: `Kỳ ${ym} đã được khoá trước đó.` } };
    // GV4 mục 3: kỳ còn lần chạy bị loại chưa có hồ sơ NCE hoặc hồ sơ chưa
    // đóng thì phải xác nhận mới khoá, và danh sách đó vào nhật ký.
    const openRecords = (db.prepare(`SELECT n.nce_id, n.detected_at, GROUP_CONCAT(r.date) AS run_dates FROM nce_records n
      LEFT JOIN nce_runs r ON r.nce_record_id=n.id AND r.role<>'rerun'
      WHERE n.status NOT IN ('closed','cancelled') GROUP BY n.id`).all() as { nce_id: string; detected_at: string; run_dates: string | null }[])
      .map((row) => ({ nceId: row.nce_id, detectedAt: row.detected_at || '', runDates: row.run_dates ? row.run_dates.split(',') : [] }));
    const open = periodOpenItems(ym, nceQueueRows(db), openRecords);
    const names = new Map((db.prepare('SELECT id, name FROM tests').all() as { id: string; name: string }[]).map((t) => [t.id, t.name]));
    const openText = hasPeriodOpenItems(open) ? periodOpenItemsText(open, (testId) => names.get(testId) || testId) : '';
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

  return { getReportTemplateSettings, saveReportTemplateSettings, listPeriodLocks, isPeriodLocked, lockPeriod, unlockPeriod, queryReport };
}

export type ReportHandlers = ReturnType<typeof createReportHandlers>;


