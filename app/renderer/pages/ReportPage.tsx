// Báo cáo & Biểu mẫu — bố cục Clinical Precision.
// Bộ lọc, tuỳ chọn xuất và thao tác được gom thành các vùng rõ ràng; khoá kỳ
// giữ dạng điều khiển theo tháng/năm và danh sách kỳ, không dùng bảng dữ liệu.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCatalog } from '../lib/useCatalog';
import { Link } from 'react-router-dom';
import { useWestgardStore } from '../store/westgard-store';
import { useReportStore } from '../store/report-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { isAdmin } from '../lib/permissions';
import { DateField } from '../components/DateField';
import { TestPicker } from '../components/TestPicker';
import { normalizeSearch, useTestSelection } from '../lib/useTestSelection';
import { PrintIcon } from '../components/PrintIcon';
import { Modal } from '../components/Modal';
import { confirmDialog, errorDialog, reauthDialog } from '../state/dialog-store';
import { showToast } from '../state/toast-store';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { loadPrintIdentity } from '../lib/print-document';
import { renderQcMultiChartPng } from '../components/QcChart';
import { buildIqcPrintHtml, iqcChartSeries, POINT_HEADERS, NCE_HEADERS, pointRow, nceRow } from '../lib/iqc-report';
import { vnDate } from '../lib/format';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadNotice } from '../components/LoadNotice';
import type { ReportForm, ReportFormKind, ReportTemplateSettings, TestSummary } from '../../shared/qc-api';
import { REPORT_FORM_KINDS, REPORT_FORM_LABELS } from '../../main/domain/report-template-validation';
import { AsyncButton } from '../components/AsyncButton';
import { MonthlyReviewPanel } from './report/MonthlyReviewPanel';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function isoToday(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function isoMonth(): string { return isoToday().slice(0, 7); }

/** Tháng dạng Việt Nam: `2026-09` → `09/2026`. */
function monthVN(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym || '');
  return m ? `${m[2]}/${m[1]}` : ym || '';
}

/** Giờ:phút + ngày dạng Việt Nam; giá trị không hợp lệ thì trả rỗng. */
function dateTimeVN(value: string): string {
  const date = new Date(value);
  return isNaN(+date) ? '' : `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('vi-VN')}`;
}



function testSelectLabel(test: TestSummary, all: TestSummary[]): string {
  const lots = [...new Set(test.levels.map((l) => l.lot).filter(Boolean))];
  const sameName = all.filter((t) => normalizeSearch(t.testName) === normalizeSearch(test.testName)).length > 1;
  return `${test.testName}${lots.length ? ' · LOT ' + lots.join('/') : ''}${sameName && test.instrumentName ? ' · ' + test.instrumentName : ''}`;
}

export function ReportPage() {
  const { summaries } = useWestgardStore(useShallow((s) => ({ summaries: s.summaries })));
  const { locks, template, loadLocks, loadTemplate, saveTemplate, lock, unlock } = useReportStore(useShallow((s) => ({ locks: s.locks, template: s.template, loadLocks: s.loadLocks, loadTemplate: s.loadTemplate, saveTemplate: s.saveTemplate, lock: s.lock, unlock: s.unlock })));
  const admin = isAdmin(useAuthStore((s) => s.user)?.role);

  const [start, setStart] = useState(`${isoMonth()}-01`);
  const [end, setEnd] = useState(isoToday());
  const [withNce, setWithNce] = useState(true);
  const [lockYm, setLockYm] = useState(isoMonth());
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forms, setForms] = useState<ReportTemplateSettings | null>(null);

  useEffect(() => { loadLocks(); loadTemplate(); }, [loadLocks, loadTemplate]);
  const catalogStatus = useCatalog(['summaries']);
  useEffect(() => { if (template) setForms(template); }, [template]);
  useStoreInvalidation(['period_locks', 'report_templates'], undefined, () => { loadLocks(); loadTemplate(); });

  const selection = useTestSelection({ items: summaries, idOf: (t) => t.testId });
  const { selectedId } = selection;

  const selected = summaries.find((t) => t.testId === selectedId) || null;
  // Đảo ngược Từ/Đến thì mọi truy vấn trả rỗng và báo cáo in ra một bảng
  // trắng — trông y như "kỳ này không có dữ liệu". Chặn ở nút xuất và nói rõ
  // lý do, thay vì để người dùng tự đoán.
  const rangeInvalid = !!start && !!end && start > end;
  const disabled = !summaries.length || busy || rangeInvalid;
  const year = Number(lockYm.slice(0, 4)) || new Date().getFullYear();
  const month = Number(lockYm.slice(5, 7)) || 1;
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);
  const already = locks.some((l) => l.ym === lockYm);

  /** Lấy dữ liệu theo lựa chọn hiện tại — không có bước "Xem" riêng, mỗi
   * lần xuất/in là truy vấn lại đúng lúc đó. */
  async function collect() {
    // Truy vấn TỨC THỜI cho đúng lần xuất/in này — trang không có bảng xem
    // trước, dữ liệu chỉ tồn tại đủ
    // lâu để dựng tệp nên không vào store.
    const points = await window.qcApi.queryReport({ testId: selectedId, from: start, to: end });
    if (!withNce) return { points, nce: null };
    const all = await window.qcApi.listNce();
    const nce = all.filter((r) => r.test_id === selectedId && (!start || r.detected_at >= start) && (!end || r.detected_at <= end));
    return { points, nce };
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try { await work(); } finally { setBusy(false); }
  }

  /** Tên tệp theo TÊN xét nghiệm, không phải `testId` (một uid ngẫu nhiên):
   * đây là hồ sơ đem lưu, `bao-cao-9f3a12c4…-2026-09-23.pdf` thì không tra
   * lại được. Bỏ ký tự không hợp lệ trong tên tệp trên Windows. */
  const stamp = () => {
    const name = (selected?.testName || 'xet-nghiem').replace(/[\/:*?"<>|]+/g, '-').trim() || 'xet-nghiem';
    return `${name}-${isoToday()}`;
  };

  function printReport() {
    return run(async () => {
      const [{ points, nce }, identity] = await Promise.all([collect(), loadPrintIdentity('iqc')]);
      // Cùng hàm vẽ với Westgard; mỗi khung tối đa bốn chuỗi để chú giải rõ
      // khi khoảng báo cáo bắc qua nhiều lần đổi lô.
      const series = iqcChartSeries(points, start, end);
      const charts: string[] = [];
      await document.fonts.ready;
      for (let i = 0; i < series.length; i += 4) {
        const png = renderQcMultiChartPng(series.slice(i, i + 4));
        if (!png) throw new Error('Không dựng được biểu đồ Levey-Jennings cho báo cáo.');
        charts.push(png);
      }
      // Số lô lấy từ từng dòng/đường biểu đồ của kỳ báo cáo, không gắn nhãn
      // lô đang vận hành lên dữ liệu lịch sử của lô khác.
      const label = selected ? [selected.testName, selected.instrumentName].filter(Boolean).join(' · ') : selectedId;
      const html = buildIqcPrintHtml({ identity, label, from: start, to: end, points, nce, charts });
      const error = await printHtmlToPdf(html, `bao-cao-${stamp()}.pdf`, { pageNumbers: true });
      if (error) await errorDialog(error);
    });
  }

  function exportXlsx() {
    return run(async () => {
      const { points, nce } = await collect();
      const rows: (string | number)[][] = points.map(pointRow);
      if (nce) {
        // 1 sheet duy nhất: chèn 1 dòng trống + tiêu đề phụ lục rồi tới các
        // dòng NCE. `buildXlsxBase64` chỉ nhận 1 sheet — đủ
        // dùng, không cần đổi hợp đồng IPC cho việc này.
        rows.push([], ['PHỤ LỤC NCE'], NCE_HEADERS, ...nce.map(nceRow));
      }
      const error = await exportTableXlsx(selected?.testName || 'Báo cáo', POINT_HEADERS, rows, `bao-cao-${stamp()}.xlsx`);
      if (error) await errorDialog(error);
    });
  }

  async function submitLock() {
    const label = monthVN(lockYm);
    if (!(await confirmDialog(
      'Sau khi khoá, không ai (kể cả admin) sửa/huỷ được điểm QC trong kỳ này ở bất kỳ xét nghiệm nào cho tới khi mở khoá. Chỉ nên khoá sau khi đã xuất xong báo cáo chính thức của kỳ.',
      { title: `Khoá kỳ ${label}?`, confirmLabel: 'Khoá kỳ', cancelLabel: 'Huỷ', danger: false },
    ))) return;
    if (!(await reauthDialog({ title: 'Xác thực khoá kỳ', message: `Nhập lại mật khẩu để khoá kỳ ${label}.` }))) return;
    let result = await lock(lockYm, '');
    // Kỳ còn lần chạy bị loại chưa có NCE hoặc NCE chưa đóng (GV4): main trả
    // danh sách; người khoá xem rồi mới quyết định, và danh sách vào nhật ký.
    if (!result.ok && result.error.code === 'period-open-items') {
      if (!(await confirmDialog(result.error.message, { title: `Kỳ ${label} còn việc chưa xem xét`, confirmLabel: 'Vẫn khoá kỳ', cancelLabel: 'Để xem xét trước', danger: true }))) return;
      result = await lock(lockYm, '', true);
    }
    if (!result.ok) { await errorDialog(result.error.message); return; }
    showToast(`Đã khoá kỳ ${label}.`);
  }

  const editForm = (kind: ReportFormKind, patch: Partial<ReportForm>) =>
    setForms((current) => (current ? { ...current, [kind]: { ...current[kind], ...patch } } : current));
  async function saveTemplateSettings(kind: ReportFormKind) {
    if (!forms) return;
    const result = await saveTemplate({ kind, ...forms[kind] });
    if (!result.ok) { await errorDialog(result.error.message); return; }
    showToast(`Đã lưu biểu mẫu ${REPORT_FORM_LABELS[kind]}.`);
  }

  return (
    <>
      <PageHeader title="Báo cáo & Biểu mẫu" subtitle={summaries.length ? 'Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn' : ''} />

      {catalogStatus.state !== 'ready' ? (
        <LoadNotice state={catalogStatus.state} error={catalogStatus.error} what="danh sách xét nghiệm" onRetry={catalogStatus.retry} />
      ) : summaries.length ? (
        <div className="panel has-popover">
          <h2 className="panel-title">Báo cáo nội kiểm theo ngày</h2>
          <div className="report-panel-body">
            <div className="grid4 report-filter-grid">
              <TestPicker items={summaries} selectedId={selectedId} onSelect={selection.select} idOf={(t) => t.testId} labelOf={(t) => testSelectLabel(t, summaries)}
                id="rTest" label="Xét nghiệm" countId="reportTestCount" />
              <div className="field"><label htmlFor="rStartDate">Từ ngày</label><DateField id="rStartDate" value={start} onChange={setStart} /></div>
              <div className="field"><label htmlFor="rEndDate">Đến ngày</label><DateField id="rEndDate" value={end} onChange={setEnd} invalid={rangeInvalid} describedBy={rangeInvalid ? 'report-range-error' : undefined} />
                {rangeInvalid && <p id="report-range-error" className="field-error" role="alert">Từ ngày ({vnDate(start)}) đang sau Đến ngày ({vnDate(end)}). Hãy đổi lại khoảng ngày.</p>}
              </div>
            </div>
            <div className="report-export-bar">
              <div className="report-export-options">
                <label className="report-nce-option">
                  <input id="reportNceAppendix" type="checkbox" checked={withNce} onChange={(e) => setWithNce(e.target.checked)} />
                  <span><b>Kèm phụ lục NCE</b><small>Áp dụng cho PDF và Excel</small></span>
                </label>
              </div>
              <div className="report-actions">
                <button className="btn teal" disabled={disabled} onClick={printReport}><PrintIcon />In PDF</button>
                <button className="btn ghost" disabled={disabled} onClick={exportXlsx}>Xuất Excel</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel"><EmptyState
          title="Chưa có xét nghiệm đang vận hành"
          action={admin && <Link className="btn teal" to="/manage" state={{ tab: 'targets' }}>Cấu hình Mean/SD</Link>}
        >Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.</EmptyState></div>
      )}

      <MonthlyReviewPanel />

      <div className="panel">
        <h2 className="panel-title">Khoá kỳ báo cáo</h2>
        <div className="report-panel-body">
          <div className="report-lock-description">Khoá một kỳ theo tháng sẽ chặn sửa hoặc huỷ điểm QC của kỳ đó ở <b>mọi xét nghiệm</b>. Chỉ nên khoá sau khi đã xuất xong báo cáo chính thức.</div>
          <div className="report-lock-controls">
            <div className="field">
              <label htmlFor="report-lock-month">Tháng</label>
              <select id="report-lock-month" aria-label="Tháng" disabled={!admin} value={month} onChange={(e) => setLockYm(`${year}-${String(Number(e.target.value)).padStart(2, '0')}`)}>
                {MONTHS.map((m) => <option value={m} key={m}>Tháng {m}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="report-lock-year">Năm</label>
              <select id="report-lock-year" aria-label="Năm" disabled={!admin} value={year} onChange={(e) => setLockYm(`${e.target.value}-${String(month).padStart(2, '0')}`)}>
                {years.map((y) => <option value={y} key={y}>{y}</option>)}
              </select>
            </div>
            <div className="report-lock-action">
              {admin
                ? (already ? <button className="btn ghost" disabled>Kỳ này đã khoá</button> : <button className="btn teal" onClick={submitLock}>Khoá kỳ này</button>)
                : <span className="hint">Chỉ admin mới khoá/mở khoá được kỳ báo cáo.</span>}
            </div>
          </div>
          <div className="report-lock-list-wrap">
            {locks.length ? (
              <div className="period-lock-list">
                {locks.map((l) => (
                  <div className="period-lock-row" key={l.ym}>
                    <div><b>Kỳ {monthVN(l.ym)}</b><span className="hint"> · Khoá bởi {l.locked_by || '—'}{l.locked_at ? ` lúc ${dateTimeVN(l.locked_at)}` : ''}</span></div>
                    {admin ? <button className="btn ghost sm" onClick={() => setUnlocking(l.ym)}>Mở khoá</button> : null}
                  </div>
                ))}
              </div>
            ) : <div className="report-empty-note" role="status">Chưa khoá kỳ nào</div>}
          </div>
        </div>
      </div>

      {/* Cài đặt dùng một lần (mã biểu mẫu, phiên bản, ngày hiệu lực in ở đầu PDF):
          để cuối trang và thu gọn mặc định, nhường màn hình đầu cho việc lập báo
          cáo hằng ngày (đánh giá giao diện 09/11/2026). */}
      {admin && <details className="panel report-template-panel">
        <summary className="report-template-summary"><span className="report-template-summary-text"><span role="heading" aria-level={2}>Biểu mẫu báo cáo PDF</span><small>Mã biểu mẫu, phiên bản và ngày hiệu lực in ở đầu mỗi PDF</small></span></summary>
        <div className="report-template-body">
          {REPORT_FORM_KINDS.map((kind) => {
            const form = forms?.[kind];
            const saved = template?.[kind];
            const dirty = !!form && !!saved && (form.formCode !== saved.formCode || form.version !== saved.version || form.effectiveDate !== saved.effectiveDate);
            return (
              <div className="report-template-fields" key={kind}>
                <div className="report-template-name">{REPORT_FORM_LABELS[kind]}</div>
                <div className="field"><label htmlFor={`reportFormCode-${kind}`}>Mã biểu mẫu</label><input id={`reportFormCode-${kind}`} value={form?.formCode ?? ''} maxLength={40} onChange={(event) => editForm(kind, { formCode: event.target.value })} /></div>
                <div className="field"><label htmlFor={`reportFormVersion-${kind}`}>Phiên bản</label><input id={`reportFormVersion-${kind}`} value={form?.version ?? ''} maxLength={20} onChange={(event) => editForm(kind, { version: event.target.value })} /></div>
                <div className="field"><label htmlFor={`reportFormDate-${kind}`}>Ngày hiệu lực</label><DateField id={`reportFormDate-${kind}`} value={form?.effectiveDate ?? ''} onChange={(value) => editForm(kind, { effectiveDate: value })} /></div>
                <div className="report-template-action"><button className="btn teal" onClick={() => saveTemplateSettings(kind)} disabled={busy || !dirty}>Lưu</button></div>
              </div>
            );
          })}
        </div>
      </details>}

      {unlocking && <UnlockModal ym={unlocking} onClose={() => setUnlocking(null)}
        onDone={async (note) => {
          if (!(await reauthDialog({ title: 'Xác thực mở khoá', message: `Nhập lại mật khẩu để mở khoá kỳ ${monthVN(unlocking)}.` }))) return false;
          const result = await unlock(unlocking, note);
          if (!result.ok) { await errorDialog(result.error.message); return false; }
          showToast(`Đã mở khoá kỳ ${monthVN(unlocking)}.`);
          return true;
        }} />}
    </>
  );
}

/** Mở khoá đi qua modal nhập lý do (bắt buộc có lý do); main cũng đòi ghi
 * chú ≥5 ký tự, nên đây là cùng một cổng ở 2 tầng. */
function UnlockModal({ ym, onClose, onDone }: { ym: string; onClose: () => void; onDone: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (note.trim().length < 5) { setErr('Nhập lý do mở khoá (ít nhất 5 ký tự) để lưu vào nhật ký.'); return; }
    if (await onDone(note.trim())) onClose();
  }

  return (
    <Modal title={`Mở khoá kỳ ${monthVN(ym)}`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><AsyncButton className="btn danger" onClick={submit}>Xác nhận mở khoá</AsyncButton></>}>
      <div className="hint">Mở khoá kỳ {monthVN(ym)} sẽ cho phép sửa/huỷ lại điểm QC của kỳ này ở mọi xét nghiệm. Lý do được ghi vào nhật ký hoạt động.</div>
      <div className="field">
        <label htmlFor="unlockReasonInput">Lý do mở khoá</label>
        <textarea id="unlockReasonInput" autoFocus rows={3} value={note} aria-invalid={!!err || undefined} aria-describedby={err ? 'unlock-reason-error' : undefined} onChange={(e) => { setNote(e.target.value); setErr(null); }} />
        {err && <p id="unlock-reason-error" className="field-error" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}


