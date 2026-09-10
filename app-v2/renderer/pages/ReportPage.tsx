// Báo cáo — Giai đoạn D3.2 (docs/APP-V2-PLAN.md): viết lại theo golden
// master `src/react/pages/ReportPage.tsx`. Khác bản B11/C1 trước đó ở 4 điểm
// CẤU TRÚC, không chỉ CSS:
//   1. Panel "Báo cáo nội kiểm theo ngày" là 1 lưới `.grid4` (tìm kiếm · ô
//      chọn xét nghiệm kèm bộ đếm khớp/tổng · từ ngày · đến ngày), tiếp theo
//      là tuỳ chọn "Kèm phụ lục NCE" rồi 3 nút teal (In · Excel · CSV).
//   2. Panel "Khóa kỳ báo cáo" dùng `.report-lock-controls` (2 ô chọn
//      Tháng/Năm + 1 nút), và danh sách kỳ đã khoá là `.period-lock-list`
//      gồm các `.period-lock-row` — KHÔNG phải `<table>`.
//   3. Mở khoá đi qua MODAL nhập lý do, không phải ô input nằm trong bảng.
//   4. BỎ panel "Xem lại điểm QC" — app cũ không có; đó là thứ bản thí điểm
//      app-v2 tự thêm. Xuất/in giờ tự truy vấn dữ liệu theo lựa chọn hiện
//      tại, đúng cách app cũ làm (chọn → xuất, không cần bấm "Xem" trước).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWestgardStore } from '../store/westgard-store';
import { useReportStore } from '../store/report-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { isAdmin } from '../lib/permissions';
import { DateField } from '../components/DateField';
import { PrintIcon } from '../components/PrintIcon';
import { Modal } from '../components/Modal';
import { reauthDialog, infoDialog, confirmDialog } from '../state/dialog-store';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { PageHeader } from '../components/PageHeader';
import type { NceRecord, ReportPointRow, TestSummary } from '../../shared/qc-api';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function isoToday(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function isoMonth(): string { return isoToday().slice(0, 7); }

/** `monthVN()` app cũ: `2026-09` → `09/2026`. */
function monthVN(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  return m ? `${m[2]}/${m[1]}` : ym || '';
}

/** `formatDateTimeVN()` app cũ. */
function dateTimeVN(value: string): string {
  const date = new Date(value);
  return isNaN(+date) ? '' : `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('vi-VN')}`;
}

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

/** Port `qcOperationalAccess.selectLabel()`: tên · LOT các lô đang gắn · tên
 * máy (chỉ thêm máy khi có ≥2 xét nghiệm TRÙNG TÊN, để phân biệt). */
function testSelectLabel(test: TestSummary, all: TestSummary[]): string {
  const lots = [...new Set(test.levels.map((l) => l.lot).filter(Boolean))];
  const sameName = all.filter((t) => normalize(t.testName) === normalize(test.testName)).length > 1;
  return `${test.testName}${lots.length ? ' · LOT ' + lots.join('/') : ''}${sameName && test.instrumentName ? ' · ' + test.instrumentName : ''}`;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const POINT_HEADERS = ['Ngày', 'Mức', 'Lần chạy', 'Giá trị', 'Người thực hiện', 'Trạng thái'];
const NCE_HEADERS = ['Mã NCE', 'Ngày', 'Mức', 'Luật', 'Loại sai số', 'Hạn xử lý', 'Duyệt', 'Hiệu lực'];

function pointRow(p: ReportPointRow): (string | number)[] {
  return [p.date, p.level, p.run_id, p.val, p.operator_name || '—', p.voided ? `Đã huỷ: ${p.void_reason}` : 'Hợp lệ'];
}
function nceRow(r: NceRecord): string[] {
  return [r.nce_id || '—', r.date, r.level == null ? '—' : `M${r.level}`, r.rule || '—', r.error_type || '—',
    r.due_date || '—', r.approval_status, r.effectiveness_status];
}

/** Trang in — tĩnh, tự đứng một mình (cửa sổ in ở main process nạp qua
 * `data:` URL, không dùng CSS/JS của renderer). Phụ lục NCE chỉ in khi
 * người dùng tick — đúng nhãn "(Áp dụng cho PDF và Excel)". */
function buildPrintHtml(label: string, from: string, to: string, points: ReportPointRow[], nce: NceRecord[] | null): string {
  const rows = points.map((p) => `<tr${p.voided ? ' class="voided"' : ''}>${pointRow(p).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const appendix = nce
    ? `<h2>Phụ lục NCE</h2>${nce.length
      ? `<table><thead><tr>${NCE_HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${nce.map((r) => `<tr>${nceRow(r).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<p class="meta">Không có hồ sơ khắc phục nào trong khoảng ngày này.</p>'}`
    : '';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo nội kiểm</title>
  <style>
    body{font-family:Arial,sans-serif;color:#14242e;padding:24px;}
    h1{font-size:20px;} h2{font-size:15px;margin-top:22px;}
    p.meta{color:#506674;margin-bottom:16px;}
    table{width:100%;border-collapse:collapse;} th,td{border:1px solid #dde4e8;padding:6px 8px;text-align:left;font-size:12px;}
    th{background:#eef2f4;} tr.voided td{color:#888;text-decoration:line-through;}
  </style></head><body>
  <h1>Báo cáo nội kiểm — ${esc(label)}</h1>
  <p class="meta">Khoảng thời gian: ${esc(from) || '(không giới hạn)'} — ${esc(to) || '(không giới hạn)'} · In lúc ${new Date().toLocaleString('vi-VN')}</p>
  <table><thead><tr>${POINT_HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
  ${appendix}</body></html>`;
}

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportPage() {
  const { summaries, loadSummaries } = useWestgardStore();
  const { locks, loadLocks, lock, unlock } = useReportStore();
  const admin = isAdmin(useAuthStore((s) => s.user)?.role);

  const [query, setQuery] = useState('');
  const [testId, setTestId] = useState('');
  const [start, setStart] = useState(`${isoMonth()}-01`);
  const [end, setEnd] = useState(isoToday());
  const [withNce, setWithNce] = useState(true);
  const [lockYm, setLockYm] = useState(isoMonth());
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadSummaries(); loadLocks(); }, [loadSummaries, loadLocks]);
  useStoreInvalidation(['period_locks', 'tests', 'qc_points'], undefined, () => { loadLocks(); loadSummaries(); });

  const matched = useMemo(() => {
    const q = normalize(query);
    return summaries.filter((t) => !q || normalize(testSelectLabel(t, summaries)).includes(q));
  }, [summaries, query]);

  // Giữ lựa chọn hợp lệ: mất khỏi danh sách khớp thì nhảy về phần tử đầu —
  // đúng `reportModel()` app cũ (nó tự sửa `reportTest` mỗi lần dựng model).
  const selectedId = matched.some((t) => t.testId === testId) ? testId : (matched[0]?.testId || '');
  useEffect(() => { if (selectedId !== testId) setTestId(selectedId); }, [selectedId, testId]);

  const selected = matched.find((t) => t.testId === selectedId) || null;
  const disabled = !matched.length || busy;
  const year = Number(lockYm.slice(0, 4)) || new Date().getFullYear();
  const month = Number(lockYm.slice(5, 7)) || 1;
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);
  const already = locks.some((l) => l.ym === lockYm);

  /** Lấy dữ liệu theo lựa chọn hiện tại — app cũ không có bước "Xem" riêng,
   * mỗi lần xuất/in là truy vấn lại đúng lúc đó. */
  async function collect() {
    // Truy vấn TỨC THỜI cho đúng lần xuất/in này (app cũ cũng không có bước
    // "Xem" riêng) — kết quả không được hiển thị lâu dài nên không vào
    // store; phần bảng hiển thị của trang dùng `report-store.loadPoints`.
    const points = await window.qcApi.queryReport({ testId: selectedId, from: start, to: end });
    if (!withNce) return { points, nce: null };
    const all = await window.qcApi.listNceRecords();
    const nce = all.filter((r) => r.test_id === selectedId && (!start || r.date >= start) && (!end || r.date <= end));
    return { points, nce };
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try { await work(); } finally { setBusy(false); }
  }

  const stamp = () => `${selectedId}-${isoToday()}`;

  function printReport() {
    return run(async () => {
      const { points, nce } = await collect();
      const error = await printHtmlToPdf(buildPrintHtml(selected ? testSelectLabel(selected, summaries) : selectedId, start, end, points, nce), `bao-cao-${stamp()}.pdf`);
      if (error) await infoDialog(error);
    });
  }

  function exportXlsx() {
    return run(async () => {
      const { points, nce } = await collect();
      const rows: (string | number)[][] = points.map(pointRow);
      if (nce) {
        // 1 sheet duy nhất: chèn 1 dòng trống + tiêu đề phụ lục rồi tới các
        // dòng NCE. `buildXlsxBase64` (Giai đoạn C1) chỉ nhận 1 sheet — đủ
        // dùng, không cần đổi hợp đồng IPC cho việc này.
        rows.push([], ['PHỤ LỤC NCE'], NCE_HEADERS, ...nce.map(nceRow));
      }
      const error = await exportTableXlsx(selected?.testName || 'Báo cáo', POINT_HEADERS, rows, `bao-cao-${stamp()}.xlsx`);
      if (error) await infoDialog(error);
    });
  }

  function exportCsv() {
    return run(async () => {
      const { points, nce } = await collect();
      const lines = [POINT_HEADERS.map(csvCell).join(','), ...points.map((p) => pointRow(p).map(csvCell).join(','))];
      if (nce) {
        lines.push('', 'PHỤ LỤC NCE', NCE_HEADERS.map(csvCell).join(','), ...nce.map((r) => nceRow(r).map(csvCell).join(',')));
      }
      download(lines.join('\n'), `bao-cao-${stamp()}.csv`, 'text/csv;charset=utf-8');
    });
  }

  async function submitLock() {
    const label = monthVN(lockYm);
    if (!(await confirmDialog(
      'Sau khi khóa, không ai (kể cả admin) sửa/hủy được điểm QC trong kỳ này ở bất kỳ xét nghiệm nào cho tới khi mở khóa. Chỉ nên khóa sau khi đã xuất xong báo cáo chính thức của kỳ.',
      { title: `Khóa kỳ ${label}?`, confirmLabel: 'Khóa kỳ', cancelLabel: 'Hủy' },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực khóa kỳ', message: `Nhập lại mật khẩu để khóa kỳ ${label}.` }))) return;
    const result = await lock(lockYm, '');
    if (!result.ok) { await infoDialog(result.error.message); return; }
    await infoDialog(`Đã khóa kỳ ${label}.`, { type: 'success' });
  }

  return (
    <>
      <PageHeader title="Báo cáo & Biểu mẫu" subtitle={summaries.length ? 'Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn' : ''} />

      {summaries.length ? (
        <div className="panel">
          <h2 className="panel-title">Báo cáo nội kiểm theo ngày</h2>
          <div className="grid4">
            <div>
              <label htmlFor="reportSearch">Tìm xét nghiệm</label>
              <input id="reportSearch" type="search" placeholder="Tìm tên xét nghiệm" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rTest">Xét nghiệm <span id="reportTestCount" className="hint">({matched.length}/{summaries.length})</span></label>
              <select id="rTest" aria-label="Xét nghiệm" disabled={!matched.length} value={selectedId} onChange={(e) => setTestId(e.target.value)}>
                {matched.length
                  ? matched.map((t) => <option value={t.testId} key={t.testId}>{testSelectLabel(t, summaries)}</option>)
                  : <option value="">Không tìm thấy xét nghiệm phù hợp</option>}
              </select>
            </div>
            <div><label htmlFor="rStartDate">Từ ngày</label><DateField id="rStartDate" value={start} onChange={setStart} /></div>
            <div><label htmlFor="rEndDate">Đến ngày</label><DateField id="rEndDate" value={end} onChange={setEnd} /></div>
          </div>
          <div className="report-export-options">
            <label className="report-nce-option">
              <input id="reportNceAppendix" type="checkbox" checked={withNce} onChange={(e) => setWithNce(e.target.checked)} />
              <span><b>Kèm phụ lục NCE</b><small>(Áp dụng cho PDF và Excel)</small></span>
            </label>
          </div>
          <div className="report-actions">
            <button className="btn teal" disabled={disabled} onClick={printReport}><PrintIcon />Tạo báo cáo &amp; In</button>
            <button className="btn teal" disabled={disabled} onClick={exportXlsx}>Xuất Excel</button>
            <button className="btn teal" disabled={disabled} onClick={exportCsv}>Xuất CSV</button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="empty">
            <div className="empty-title">Chưa có xét nghiệm đang vận hành</div>
            <div>Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.</div>
            {admin ? <div className="empty-actions"><Link className="btn teal" to="/manage">Cấu hình Mean/SD</Link></div> : null}
          </div>
        </div>
      )}

      <div className="panel">
        <h2 className="panel-title">Khóa kỳ báo cáo</h2>
        <div className="hint">Khóa 1 kỳ (theo tháng) sẽ chặn sửa/hủy điểm QC của kỳ đó ở <b>mọi xét nghiệm</b> — nên làm sau khi đã xuất xong báo cáo chính thức của kỳ.</div>
        <div className="report-lock-controls">
          <div>
            <label>Tháng</label>
            <select aria-label="Tháng" disabled={!admin} value={month} onChange={(e) => setLockYm(`${year}-${String(Number(e.target.value)).padStart(2, '0')}`)}>
              {MONTHS.map((m) => <option value={m} key={m}>Tháng {m}</option>)}
            </select>
          </div>
          <div>
            <label>Năm</label>
            <select aria-label="Năm" disabled={!admin} value={year} onChange={(e) => setLockYm(`${e.target.value}-${String(month).padStart(2, '0')}`)}>
              {years.map((y) => <option value={y} key={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'end' }}>
            {admin
              ? (already ? <button className="btn ghost" disabled>Kỳ này đã khóa</button> : <button className="btn teal" onClick={submitLock}>Khóa kỳ này</button>)
              : <span className="hint">Chỉ admin mới khóa/mở khóa được kỳ báo cáo.</span>}
          </div>
        </div>
        <div className="flow-panel">
          {locks.length ? (
            <div className="period-lock-list">
              {locks.map((l) => (
                <div className="period-lock-row" key={l.ym}>
                  <div><b>Kỳ {monthVN(l.ym)}</b><span className="hint"> · Khóa bởi {l.locked_by || '—'}{l.locked_at ? ` lúc ${dateTimeVN(l.locked_at)}` : ''}</span></div>
                  {admin ? <button className="btn ghost sm" onClick={() => setUnlocking(l.ym)}>Mở khóa</button> : null}
                </div>
              ))}
            </div>
          ) : <div className="hint">Chưa có kỳ nào được khóa.</div>}
        </div>
      </div>

      {unlocking && <UnlockModal ym={unlocking} onClose={() => setUnlocking(null)}
        onDone={async (note) => {
          if (!(await reauthDialog({ title: 'Xác thực mở khóa', message: `Nhập lại mật khẩu để mở khóa kỳ ${monthVN(unlocking)}.` }))) return false;
          const result = await unlock(unlocking, note);
          if (!result.ok) { await infoDialog(result.error.message); return false; }
          await infoDialog(`Đã mở khóa kỳ ${monthVN(unlocking)}.`, { type: 'success' });
          return true;
        }} />}
    </>
  );
}

/** Mở khóa đi qua modal nhập lý do — app cũ dùng `unlockModalHtml()` +
 * `unlockReason()` (bắt buộc có lý do); main của app-v2 cũng đòi ghi chú
 * ≥5 ký tự, nên đây là cùng một cổng ở 2 tầng. */
function UnlockModal({ ym, onClose, onDone }: { ym: string; onClose: () => void; onDone: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (note.trim().length < 5) { setErr('Nhập lý do mở khóa (ít nhất 5 ký tự) để lưu vào nhật ký.'); return; }
    if (await onDone(note.trim())) onClose();
  }

  return (
    <Modal title={`Mở khóa kỳ ${monthVN(ym)}`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><button className="btn danger" onClick={submit}>Xác nhận mở khóa</button></>}>
      {err && <p className="field-error">{err}</p>}
      <div className="hint">Mở khóa kỳ {monthVN(ym)} sẽ cho phép sửa/hủy lại điểm QC của kỳ này ở mọi xét nghiệm. Lý do được ghi vào nhật ký hoạt động.</div>
      <div className="field">
        <label htmlFor="unlockReasonInput">Lý do mở khóa</label>
        <textarea id="unlockReasonInput" autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
