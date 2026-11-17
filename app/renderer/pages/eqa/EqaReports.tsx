import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EqaReviewDraft, EqaReviewKind } from '../../../shared/qc-api';
import { hasUserCapability } from '../../../main/domain/capabilities';
import { eqaPaperModel } from '../../../main/domain/eqa/report-form';
import { useAuthStore } from '../../store/auth-store';
import { useEqaStore } from '../../store/eqa-store';
import { useEqaReportDraftStore } from '../../store/eqa-report-draft-store';
import { eqaReportDraftKey, initialEqaReportDraft, sameEqaReportDraft } from '../../lib/eqa-report-draft';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { EmptyState } from '../../components/EmptyState';
import { PrintIcon } from '../../components/PrintIcon';
import { confirmDialog, errorDialog } from '../../state/dialog-store';
import { downloadBlob, printHtmlToPdf } from '../../lib/export';
import { loadPrintIdentity } from '../../lib/print-document';
import { buildEqaPaperBody, buildEqaReportDocx, buildEqaReportHtml, EQA_REVIEW_LABELS } from '../../lib/eqa-report-document';
import { useEqaRead, useEqaRevision } from './useEqaRead';
import { useEqaScope } from './useEqaScope';
import { EqaReviewEditor } from './EqaReviewEditor';
import { EqaReviewHistory } from './EqaReviewHistory';

export function EqaReports() {
  const scope = useEqaScope();
  const revision = useEqaRevision();
  const storeError = useEqaStore((s) => s.error);
  const loaded = useEqaStore((s) => s.loaded);
  const load = useEqaStore((s) => s.load);
  const [params, setParams] = useSearchParams();
  const requested = params.get('reportRound');
  const roundId = requested === '' ? '' : scope.rounds.find((r) => r.id === requested)?.id || scope.rounds.at(-1)?.id || '';
  const instrumentId = params.get('reportMachine') || '';
  const read = useCallback(() => scope.programId ? window.qcApi.getEqaReport({ programId: scope.programId, year: scope.year, ...(roundId ? { roundId } : {}), ...(instrumentId ? { instrumentId } : {}) }) : Promise.resolve(null), [scope.programId, scope.year, roundId, instrumentId]);
  const view = useEqaRead(`${scope.programId}:${scope.year}:${roundId}:${instrumentId}:${revision}`, read);
  const identity = useEqaRead('eqa-paper-identity', useCallback(() => loadPrintIdentity('eqa'), []));
  useStoreInvalidation(['eqa_decisions', 'tests', 'instruments'], undefined, view.retry);
  useStoreInvalidation(['lab', 'report_templates'], undefined, identity.retry);
  const report = view.data;
  const scopeKey = JSON.stringify([scope.programId, scope.year, roundId, instrumentId]);
  const [selection, setSelection] = useState<{ scopeKey: string; id: string } | null>(null);
  const selectedId = selection?.scopeKey === scopeKey ? selection.id : '';
  const readSelected = useCallback(() => selectedId ? window.qcApi.getEqaReport({ programId: scope.programId, year: scope.year,
    ...(roundId ? { roundId } : {}), ...(instrumentId ? { instrumentId } : {}) }, selectedId) : Promise.resolve(null), [scope.programId, scope.year, roundId, instrumentId, selectedId]);
  const saved = useEqaRead(`${scopeKey}:${selectedId}`, readSelected);
  const selectedReview = report?.reviews.find((r) => r.id === selectedId);
  const user = useAuthStore((s) => s.user);
  const canSign = hasUserCapability(user, 'nce.approve');
  const [phase, setPhase] = useState<'preliminary_review' | 'analysis_review'>('preliminary_review');
  const kind: EqaReviewKind = roundId ? phase : 'system_review';
  const drafts = useEqaReportDraftStore((s) => s.drafts);
  const put = useEqaReportDraftStore((s) => s.put);
  const remove = useEqaReportDraftStore((s) => s.remove);
  const draftKey = report ? eqaReportDraftKey(user?.id || '', report.scope, kind) : '';
  const base = report ? initialEqaReportDraft(report, kind) : null;
  const draft = drafts[draftKey] || base;
  const kinds: EqaReviewKind[] = roundId ? ['preliminary_review', 'analysis_review'] : ['system_review'];
  // Giữ cả hai bản nháp trên phiếu; thông tin chung phản ánh bước đang sửa.
  const previewDrafts = report ? kinds.map((k) => drafts[eqaReportDraftKey(user?.id || '', report.scope, k)])
    .filter((d): d is EqaReviewDraft => !!d && !sameEqaReportDraft(d, initialEqaReportDraft(report, d.kind)))
    .sort((a, b) => Number(a.kind === kind) - Number(b.kind === kind)) : [];
  const dirty = previewDrafts.some((d) => d.kind === kind);
  const stale = !!report && previewDrafts.some((d) => d.expectedFingerprint !== report.fingerprint);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const busy = saving || exporting;
  const exportLock = useRef(false);

  function change(key: string, value: string) {
    setSelection(null);
    const query = new URLSearchParams(params);
    query.set('view', 'baocao'); query.set(key, value);
    if (key === 'year' || key === 'program') { query.delete('reportRound'); query.delete('reportMachine'); }
    setParams(query);
  }
  function update(patch: Partial<EqaReviewDraft>) {
    if (!base || !canSign || selectedId) return;
    const current = useEqaReportDraftStore.getState().drafts[draftKey] || base;
    const next = { ...current, ...patch };
    if (sameEqaReportDraft(next, base)) remove(draftKey); else put(draftKey, next);
  }
  async function resetDraft() {
    if (await confirmDialog('Bỏ các thay đổi chưa ký của phần xem xét đang mở?', { title: 'Bỏ bản nháp', confirmLabel: 'Bỏ thay đổi' })) remove(draftKey);
  }
  function useFreshData() {
    if (!report) return;
    for (const d of previewDrafts) put(eqaReportDraftKey(user?.id || '', report.scope, d.kind), { ...d, expectedFingerprint: report.fingerprint });
  }
  async function exportReport(format: 'pdf' | 'word') {
    if (!report || exportLock.current || (!selectedId && stale)) return;
    exportLock.current = true; setExporting(true);
    const outputDrafts = selectedId ? [] : structuredClone(previewDrafts);
    try {
      const [current, printIdentity] = await Promise.all([selectedId ? readSelected() : read(), loadPrintIdentity('eqa')]);
      if (!current?.totals.total) throw new Error('Không còn kết quả trong phạm vi báo cáo.');
      if (outputDrafts.some((d) => d.expectedFingerprint !== current.fingerprint)) {
        view.retry(); throw new Error('Dữ liệu nguồn đã thay đổi. Đối chiếu số liệu mới trước khi xuất bản nháp.');
      }
      const filename = `bao-cao-ngoai-kiem-${current.scope.year}${current.scope.roundId ? `-${current.rounds[0].round.round_no}` : '-tong-hop'}${current.scope.instrumentId ? `-may-${current.scope.instrumentId}` : '-tat-ca-may'}${selectedId ? `-lich-su-${selectedId}` : ''}${outputDrafts.length ? '-ban-nhap' : ''}`;
      if (format === 'pdf') {
        const error = await printHtmlToPdf(buildEqaReportHtml(printIdentity, current, outputDrafts), `${filename}.pdf`);
        if (error) throw new Error(error);
      } else downloadBlob(await buildEqaReportDocx(printIdentity, current, outputDrafts), `${filename}.docx`);
    } catch (e) { await errorDialog(e instanceof Error ? e.message : 'Không xuất được báo cáo ngoại kiểm.'); }
    finally { exportLock.current = false; setExporting(false); }
  }
  const previewReport = selectedId ? saved.data : report;
  const savedReview = saved.data?.reviews.find((r) => r.id === selectedId);
  // Chỉ đưa thông tin của lần ký đang chọn vào khung chỉ xem, không lấy
  // thông tin chung của lần ký khác hoặc ghi đè kho bản nháp đang sửa.
  const editorDraft = selectedId ? saved.data && savedReview
    ? initialEqaReportDraft({ ...saved.data, reviews: [savedReview] }, savedReview.kind) : null : draft;
  const previewEdits = selectedId ? [] : previewDrafts;
  const model = previewReport ? eqaPaperModel(previewReport, previewEdits) : null;
  const ready = loaded && !storeError && !!report && !!previewReport && !!identity.data && !view.error && !identity.error && (!selectedId || !saved.error);
  const latest = report?.reviews[0];

  return <div className="eqa-reports">
    <div className="eqa-scope-controls" aria-label="Phạm vi báo cáo ngoại kiểm">
      <div className="field"><label htmlFor="eqa-report-year">Năm</label><select id="eqa-report-year" value={scope.year} disabled={busy} onChange={(e) => change('year', e.target.value)}>{(scope.years.length ? scope.years : [scope.year]).map((y) => <option key={y}>{y}</option>)}</select></div>
      <div className="field eqa-scope-program"><label htmlFor="eqa-report-program">Chương trình</label><select id="eqa-report-program" value={scope.programId} disabled={busy} onChange={(e) => change('program', e.target.value)}>{!scope.programs.length && <option value="">Chưa có chương trình</option>}{scope.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field eqa-scope-machine"><label htmlFor="eqa-report-round">Đợt báo cáo</label><select id="eqa-report-round" value={roundId} disabled={busy} onChange={(e) => change('reportRound', e.target.value)}><option value="">Xem xét hệ thống cả năm</option>{scope.rounds.map((r) => <option key={r.id} value={r.id}>{r.round} / {r.year}</option>)}</select></div>
      <div className="field eqa-scope-machine"><label htmlFor="eqa-report-machine">Máy xét nghiệm</label><select id="eqa-report-machine" value={instrumentId} disabled={busy} onChange={(e) => change('reportMachine', e.target.value)}><option value="">Tất cả máy</option>{scope.machines.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}{instrumentId && !scope.machines.some((i) => i.id === instrumentId) && <option value={instrumentId}>Máy không còn trong phạm vi</option>}</select></div>
    </div>
    {storeError || (scope.programId && (view.error || identity.error)) ? <div className="alert rej" role="alert">{storeError || view.error || identity.error}<button type="button" className="btn ghost sm" onClick={() => { void load(); view.retry(); identity.retry(); }}>Thử lại</button></div>
      : !loaded || (scope.programId && (!report || !identity.data)) ? <EmptyState size="compact" title="Đang tổng hợp báo cáo…" />
      : !scope.programId || !report?.totals.total || !identity.data || !draft ? <EmptyState title="Chưa có kết quả để lập báo cáo">{instrumentId ? 'Máy đã chọn chưa có kết quả trong phạm vi này. Chọn máy khác hoặc Tất cả máy để xem báo cáo.' : 'Nhập báo cáo PDF ở tab Tổng quan để bắt đầu xem xét.'}</EmptyState>
      : <>
        {stale && !selectedId && <div className="alert warn" role="alert">Dữ liệu nguồn đã thay đổi. Nội dung đang nhập được giữ nguyên; đối chiếu phiếu với số liệu mới trước khi ký hoặc xuất.<button type="button" className="btn ghost sm" disabled={busy} onClick={useFreshData}>Giữ nội dung, dùng số liệu mới</button></div>}
        <div className="eqa-report-workspace">
          {previewReport && editorDraft ? <EqaReviewEditor key={selectedId || draftKey} report={previewReport} draft={editorDraft} readOnly={!!selectedId} dirty={!selectedId && dirty} stale={!selectedId && stale} canSign={canSign} busy={busy} onChange={update}
            onKind={(k) => { if (!selectedId && k !== 'system_review') setPhase(k); }} onBusy={setSaving} onSaved={() => { remove(draftKey); view.retry(); }} onReset={() => void resetDraft()} onRefresh={view.retry} />
            : <section className="panel eqa-report-editor" role="complementary" aria-label="Thông tin phiếu xem xét đã lưu"><div className="panel-head"><h2>Thông tin phiếu đã lưu</h2><span className="tag none">Chỉ xem</span></div><div className="eqa-report-editor-body"><EmptyState size="compact" title={saved.error ? 'Không tải được thông tin phiếu đã lưu' : 'Đang tải thông tin phiếu…'} /></div></section>}
          <section className="panel eqa-report-preview" aria-label="Xem trước báo cáo">
            <div className="panel-head eqa-preview-heading"><div className="eqa-preview-title"><h2>Xem trước biểu mẫu</h2><p className="eqa-paper-status" role="status">{selectedId ? <span className="tag none">Phiếu đã lưu</span> : previewDrafts.length ? <span className="tag warn">Bản nháp · chưa ký</span> : latest ? <span className={`tag ${latest.current ? 'ok' : 'warn'}`} title={EQA_REVIEW_LABELS[latest.kind]}>{latest.current ? 'Đã xem xét' : 'Cần xem xét lại'}</span> : <span className="tag none">Chưa ký xem xét</span>}</p></div><div className="eqa-report-actions"><button type="button" className="btn ghost sm" disabled={busy || !ready || !previewReport?.totals.total || !model?.canExport || (!selectedId && stale)} onClick={() => void exportReport('pdf')}><PrintIcon />In / PDF</button><button type="button" className="btn ghost sm" disabled={busy || !ready || !previewReport?.totals.total || !model?.canExport || (!selectedId && stale)} onClick={() => void exportReport('word')}>Xuất Word</button></div></div>
            {selectedId && <div className="eqa-preview-context"><p className="eqa-paper-status" role="status">{selectedReview && <span>{EQA_REVIEW_LABELS[selectedReview.kind]} · {selectedReview.actor_name} · {new Date(selectedReview.decided_at).toLocaleString('vi-VN')}{!selectedReview.current && ' · Căn cứ cũ'}</span>}</p><button type="button" className="btn ghost sm" disabled={busy} onClick={() => setSelection(null)}>Trở về bản đang sửa</button></div>}
            {previewReport && !model?.canExport && <div className="alert warn">Nội dung đang dài hơn giới hạn một trang. Rút gọn phần nhận xét trước khi xuất; hồ sơ cũ vẫn được giữ đầy đủ trong Lịch sử.</div>}
            {selectedId && saved.error ? <div className="alert rej" role="alert">{saved.error}<button type="button" className="btn ghost sm" onClick={saved.retry}>Thử lại</button></div>
              : !previewReport ? <EmptyState size="compact" title="Đang tải phiếu đã lưu…" />
              : <div key={selectedId || 'draft'} className="eqa-paper-viewport"><article className="eqa-paper" aria-label="Phiếu xem xét ngoại kiểm một trang" dangerouslySetInnerHTML={{ __html: buildEqaPaperBody(identity.data, previewReport, previewEdits) }} /></div>}
          </section>
          <EqaReviewHistory reviews={report.reviews} selectedId={selectedId} disabled={busy} onSelect={(id) => setSelection({ scopeKey, id })} />
        </div>
      </>}
  </div>;
}
