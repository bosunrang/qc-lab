// Bảng nhập QC theo tháng: mỗi hàng một ngày, mỗi cột một mức (và lô song
// song nếu có). Khối nặng nhất trang (31 hàng × mọi mức), nên bọc `memo` và
// chỉ nhận props ổn định: gõ vào hộp thoại huỷ điểm hay dải QC không làm vẽ
// lại bảng này.
import { memo, useState } from 'react';
import { initialsFromName } from '../../../main/domain/name-initials';
import { handleSheetKeyDown } from '../../lib/entry-sheet-navigation';
import { nextSharedRunId } from '../../lib/entry-run-id';
import { VERDICT_LABEL, formatQcValue, pad2, runExcludedNote, zText, type EntryColumn } from './shared';
import type { PreviousLotSeries, QcPointView, TestLevel } from '../../../shared/qc-api';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysInMonth(year: number, month: number): number { return new Date(year, month, 0).getDate(); }

/** Lớp CSS của một hàng ngày trong bảng nhập: `today` cho hôm nay; `missing`
 * khi ngày đã qua (hoặc chính hôm nay)
 * mà CHƯA nhập đủ mọi mức đang vận hành (vệt cam bên trái ô Ngày, CSS loại
 * trừ `.today`); `has-data` khi ngày có ít nhất một điểm. */
function rowClass(date: string, today: string, doneLevels: number, liveLevels: number, hasPoint: boolean): string {
  return [date === today ? 'today' : '', date <= today && doneLevels < liveLevels ? 'missing' : '', hasPoint ? 'has-data' : '']
    .filter(Boolean).join(' ');
}

function pointsForColumnDay(column: EntryColumn, date: string): QcPointView[] {
  return column.points.filter((point) => point.date === date && !point.voided);
}

export interface SheetMessages {
  noteErr: string | null;
  pointErr: string | null;
  pointFeedback: { kind: 'ok' | 'warn' | 'rej'; message: string } | null;
  voidMsg: string | null;
}

export const EntrySheet = memo(function EntrySheet({
  testId, testName, entryColumns, levels, pointsByLevel, previousLotSeries, decimals, writable,
  viewYear, viewMonth, onViewYear, onViewMonth, messages, onCommitRun, onSaveNote,
}: {
  testId: string;
  testName: string;
  entryColumns: EntryColumn[];
  levels: TestLevel[];
  pointsByLevel: Record<number, QcPointView[]>;
  previousLotSeries: PreviousLotSeries[];
  decimals: number;
  writable: boolean;
  viewYear: number;
  viewMonth: number;
  onViewYear: (year: number) => void;
  onViewMonth: (month: number) => void;
  messages: SheetMessages;
  onCommitRun: (column: EntryColumn, date: string, runId: string, val: number) => Promise<boolean>;
  onSaveNote: (date: string, note: string) => void;
}) {
  // Ngày đã có điểm chỉ mở lần chạy bổ sung khi người dùng bấm "＋ Thêm".
  // Trạng thái mở này thuần UI,
  // khoá theo `mức|ngày`, không lưu xuống DB.
  const [extraRuns, setExtraRuns] = useState<Set<string>>(new Set());
  const valText = (val: number) => formatQcValue(val, decimals);
  const today = new Date();
  // Hiển thị 11 năm, từ năm hiện tại trừ 5 năm.
  const YEARS = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i);
  const days = Array.from({ length: daysInMonth(viewYear, viewMonth) }, (_, i) => i + 1)
    .map((d) => `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`);
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  /** "Tới hôm nay": về tháng hiện tại rồi cuộn tới đúng hàng hôm nay. */
  function goToday() {
    onViewYear(today.getFullYear()); onViewMonth(today.getMonth() + 1);
    requestAnimationFrame(() => document.querySelector('.qc-sheet tr.today')?.scrollIntoView({ block: 'center' }));
  }

  function pointsForDay(level: number, date: string): QcPointView[] {
    return (pointsByLevel[level] || []).filter((p) => p.date === date && !p.voided);
  }

  /** Lấp vào lần chạy đang thiếu của mức này trước, để cùng đợt chạy có cùng
   * runId giữa các mức và engine ghép được các luật Westgard liên mức. Lô
   * song song là chuỗi độc lập, không được trộn với lô đang vận hành. */
  function sharedRunIdFor(column: EntryColumn, date: string): string {
    const cohort = entryColumns.filter((item) => item.parallel === column.parallel);
    return nextSharedRunId(
      date,
      pointsForColumnDay(column, date).map((point) => point.run_id),
      cohort.flatMap((item) => pointsForColumnDay(item, date).map((point) => point.run_id)),
    );
  }

  const { noteErr, pointErr, pointFeedback, voidMsg } = messages;
  return (
    <div className="panel qc-sheet-panel">
      <div className="qc-sheet-heading">
        <div className="qc-sheet-title"><span>Bảng nhập QC</span><strong>{testName}</strong><small>Lô {entryColumns.map((column) => `${column.lot}${column.parallel ? ' (song song)' : ''}`).join(' / ') || '—'}</small></div>
        <div className="qc-month-area">
          <div className="qc-month-picker">
            <select value={viewMonth} onChange={(e) => onViewMonth(Number(e.target.value))}>{MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}</select>
            <select value={viewYear} onChange={(e) => onViewYear(Number(e.target.value))}>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select>
            <button className="btn ghost sm qc-current-month" onClick={() => { onViewYear(today.getFullYear()); onViewMonth(today.getMonth() + 1); }}>Tháng hiện tại</button>
            <button className="btn teal sm qc-today-jump" onClick={goToday}>Tới hôm nay</button>
          </div>
        </div>
      </div>
      <div className="qc-sheet-wrap">
        <table className="qc-sheet">
          <thead>
            <tr>
              <th>Ngày</th>
              {entryColumns.map((column) => {
                const limits = column.mean != null && column.sd != null ? `${valText(column.mean - 2 * column.sd)} – ${valText(column.mean + 2 * column.sd)}` : '—';
                const tooltip = `Mean ${column.mean != null ? valText(column.mean) : '—'} · SD ${column.sd != null ? column.sd.toFixed(4) : '—'} · ±2SD ${limits}`;
                return (
                  <th key={column.key} className={`qc-level-head${column.parallel ? ' qc-parallel-cell' : ''}`} tabIndex={0} data-qc-tooltip={tooltip} aria-label={`Mức ${column.level} · Lô ${column.lot}${column.parallel ? ' · Song song' : ''} · ${tooltip}`}>
                    Mức {column.level} · Lô {column.lot}{column.parallel && <span className="qc-parallel-label">Song song</span>}
                  </th>
                );
              })}
              <th>NV thực hiện</th><th>Vi phạm cảnh báo</th><th>Vi phạm loại bỏ</th><th>Chấp nhận</th><th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const oldDayPoints = previousLotSeries.flatMap((series) => series.points.filter((point) => point.date === date && !point.voided));
              const dayPoints = [...oldDayPoints, ...entryColumns.flatMap((column) => pointsForColumnDay(column, date))];
              const staff = Array.from(new Set(dayPoints.map((p) => p.operator_code || initialsFromName(p.operator_name)).filter(Boolean)));
              // Kết luận NGÀY tính theo lần chạy CUỐI CÙNG ĐƯỢC
              // CHẤP NHẬN của MỖI mức — không phải "tệ nhất trong
              // mọi lần chạy". Sau khi chạy lại đạt, ngày đó không
              // còn coi là vi phạm dù lần chạy đầu từng bị loại.
              //
              // Mốc là `accepted` (lần chạy), KHÔNG phải verdict
              // riêng của điểm. Westgard/CLSI: lần chạy bị loại thì
              // MỌI mức trong lần chạy đó phải chạy lại, vì hệ
              // thống không ổn định trong suốt lần chạy. Lấy theo
              // verdict riêng thì chạy lại MỘT mức là đủ để ngày
              // đóng dấu "Chấp nhận", trong khi mức còn lại vẫn
              // chưa có kết quả hợp lệ nào.
              //
              // Mức CHƯA nhập gì thì bỏ qua: "chưa nhập" đã có vệt
              // cam của `rowClass()` lo, không được biến thành
              // "vi phạm".
              const dayReps = levels.flatMap((l) => {
                const runs = pointsForDay(l.level, date);
                if (!runs.length) return [];
                const settled = [...runs].reverse().find((p) => p.accepted !== false);
                // Chưa có lần chạy nào đạt thì vẫn lấy lần chạy
                // cuối làm đại diện để còn hiện luật đã vi phạm.
                return [{ level: l.level, point: settled || runs[runs.length - 1], settled: !!settled }];
              });
              const levelReps = dayReps.map((item) => item.point);
              const pendingLevels = dayReps.filter((item) => !item.settled).map((item) => `Mức ${item.level}`);
              // Một điểm bị loại thường mang KÈM luật cảnh báo:
              // z=2,5 nổ `2-2s` thì `rules` là `['1-2s','2-2s']`.
              // Chia theo `rejectRules` (main phân giải qua bảng
              // hành động 3 lớp) để `1-2s` không bị in vào cột "Vi
              // phạm loại bỏ" chỉ vì đứng cùng điểm với `2-2s`.
              const rejRules = Array.from(new Set(levelReps.flatMap((p) => (p.verdict === 'rej' ? p.rejectRules ?? p.rules : []))));
              const rejRuleSet = new Set(rejRules);
              const warnRules = Array.from(new Set(levelReps.flatMap((p) => p.rules.filter((rule) => !rejRuleSet.has(rule)))));
              const worst = !dayReps.length ? null
                : pendingLevels.length ? 'rej'
                : levelReps.some((p) => p.verdict === 'warn') ? 'warn' : 'ok';
              const dayNote = dayPoints.find((p) => p.note)?.note || '';
              const isToday = date === todayStr;
              return (
                <tr key={date} className={rowClass(date, todayStr, levels.filter((l) => pointsForDay(l.level, date).length).length, levels.length, dayPoints.length > 0)}>
                  <td><div>{Number(date.slice(8, 10))}</div>{isToday && <div><b>Hôm nay</b></div>}</td>
                  {entryColumns.map((column, columnIndex) => {
                    const runs = pointsForColumnDay(column, date);
                    const previousRuns = column.parallel ? [] : previousLotSeries
                      .filter((series) => series.level === column.level)
                      .flatMap((series) => series.points.filter((point) => point.date === date && !point.voided).map((point) => ({ point, lot: series.lot, mean: series.mean, sd: series.sd })))
                      .sort((a, b) => a.point.run_id.localeCompare(b.point.run_id, 'vi', { numeric: true }));
                    const slotKey = `${column.key}|${date}`;
                    // Tự mở sẵn ô nhập lần chạy kế tiếp khi lần chạy
                    // gần nhất bị loại bỏ để nhắc chạy lại ngay.
                    const lastRun = runs[runs.length - 1];
                    // Mở sẵn ô chạy lại khi lần chạy cuối của mức
                    // này THUỘC một lần chạy đã bị loại — kể cả khi
                    // chính điểm này đạt và mức khác mới là mức vi
                    // phạm. `runRejectedBy` rỗng khi mức chưa có
                    // Mean/SD, nên không mở ô vô hạn cho mức đó.
                    const autoOpen = !!lastRun && (lastRun.runRejectedBy?.length ?? 0) > 0;
                    const extraOpen = extraRuns.has(slotKey) || autoOpen;
                    const showInput = writable && (!runs.length || extraOpen);
                    const showAddBtn = writable && runs.length > 0 && !extraOpen;
                    return (
                      <td key={column.key} className={`num qc-run-cell${runs.length ? ' has-data' : ''}${column.parallel ? ' qc-parallel-cell' : ''}`}>
                        <div className={`qc-run-grid${showAddBtn ? ' has-add-btn' : ''}`}>
                          {previousRuns.map(({ point, lot, mean, sd }) => (
                            <div className="qc-run-slot prev-lot-slot" key={`previous:${lot}:${point.id}`} title={`Lô cũ ${lot} · đã chuyển tiếp · chỉ đọc`}>
                              <b className="qc-value-cell prev">{valText(point.val)}</b>
                              <small>{zText(point, { mean, sd })} · Lô {lot}</small>
                            </div>
                          ))}
                          {runs.map((p) => {
                            // Ô này quá hẹp để thêm chữ, nên trạng
                            // thái "không vào thống kê" hiện bằng
                            // NÉT ĐỨT — cùng ngữ nghĩa với vòng
                            // rỗng trên biểu đồ: màu vẫn nói kết
                            // luận thật của điểm, phần đứt/rỗng nói
                            // nó không vào Mean/SD/CV. Lý do đầy đủ
                            // nằm ở tooltip.
                            const excluded = runExcludedNote(p);
                            return (
                              <div className="qc-run-slot" key={p.id} title={excluded || undefined}>
                                <b className={`qc-value-cell${p.verdict !== 'ok' ? ' ' + p.verdict : ''}${excluded ? ' run-excluded' : ''}`}>{valText(p.val)}</b>
                                <small>{zText(p, column)} · {VERDICT_LABEL[p.verdict]}</small>
                              </div>
                            );
                          })}
                          {showInput && <RunSlot date={date} level={column.level} columnKey={column.key} columnOrder={columnIndex} onCommit={async (val) => {
                            const saved = await onCommitRun(column, date, sharedRunIdFor(column, date), val);
                            if (saved) setExtraRuns((s) => { const next = new Set(s); next.delete(slotKey); return next; });
                            return saved;
                          }} />}
                        </div>
                        {showAddBtn && (
                          <button type="button" className="qc-add-run-btn" title="Thêm lần chạy bổ sung"
                            onClick={() => setExtraRuns((s) => new Set(s).add(slotKey))}>
                            <span className="qc-add-run-icon" aria-hidden="true">+</span><span className="qc-add-run-label">Thêm</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="qc-staff-cell">{staff.length
                    ? staff.map((s, i) => <span key={s}>{i > 0 ? <span className="qc-staff-sep">/</span> : null}<span className="pill qc-staff" title={s}>{s}</span></span>)
                    : '—'}</td>
                  <td>{warnRules.join(', ') || '—'}</td>
                  <td>{rejRules.join(', ') || '—'}</td>
                  <td>{worst == null ? '—' : worst === 'rej'
                    ? <span className="tag rej" title={pendingLevels.length ? `${pendingLevels.join(', ')} chưa có lần chạy nào được chấp nhận trong ngày. Lần chạy bị loại thì mọi mức trong lần chạy đó phải chạy lại.` : undefined}>R</span>
                    : worst === 'warn' ? <span className="tag warn">W(A)</span> : <span className="tag ok">A</span>}</td>
                  <td>{!dayPoints.length ? '—' : writable
                    ? <textarea key={`note:${testId}:${date}:${dayNote}`} className="qc-note-input" rows={1} placeholder="Ghi chú" defaultValue={dayNote}
                        onBlur={(e) => onSaveNote(date, e.target.value)} />
                    : (dayNote || '—')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(noteErr || pointErr || pointFeedback || voidMsg) && (
        <div className="entry-sheet-message" role="status" aria-live="polite">
          {noteErr && <div className="alert warn">{noteErr}</div>}
          {pointErr && <div className="alert warn">{pointErr}</div>}
          {pointFeedback && <div className={`alert ${pointFeedback.kind}`}>{pointFeedback.message}</div>}
          {voidMsg && <div className="alert warn">{voidMsg}</div>}
        </div>
      )}
    </div>
  );
});

/** Ô nhập một lần chạy trong worksheet — không kiểm soát (uncontrolled),
 * commit khi mất focus. Chỉ xoá ô khi lưu thành công để giá trị vừa gõ không
 * bị mất nếu kỳ đã khoá hoặc mức không còn vận hành.
 * `data-focus-date`/`data-focus-column` cùng `handleSheetKeyDown` điều hướng
 * ArrowLeft/Right/Tab giữa các mức cùng ngày, ArrowUp/Down/Enter giữa các
 * ngày cùng mức; Enter xuống hàng dưới và quay vòng về đầu cột. */
function RunSlot({ date, level, columnKey, columnOrder, onCommit }: {
  date: string; level: number; columnKey: string; columnOrder: number;
  onCommit: (val: number) => Promise<boolean>;
}) {
  const [val, setVal] = useState('');
  return (
    <div className="qc-run-slot">
      <input className="qc-inline-input is-empty" type="text" inputMode="decimal" placeholder="--" value={val}
        data-focus-date={date} data-focus-level={level} data-focus-column={columnKey} data-focus-column-order={columnOrder}
        onChange={(e) => setVal(e.target.value)}
        onBlur={async () => { const n = Number(val); if (val.trim() !== '' && !Number.isNaN(n) && await onCommit(n)) setVal(''); }}
        onKeyDown={handleSheetKeyDown} />
    </div>
  );
}
