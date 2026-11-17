import { useRef } from 'react';
import type { EqaCarDecision, EqaReportView, EqaReviewAssessment, EqaReviewDraft, EqaReviewKind } from '../../../shared/qc-api';
import { EQA_ASSESSMENT_LABELS, EQA_CAR_LABELS, EQA_PAPER_LIMITS } from '../../../main/domain/eqa/report-form';
import { useFormError } from '../../lib/useFormError';
import { FormErrorMessage } from '../../components/FormErrorMessage';
import { DateField } from '../../components/DateField';
import { errorDialog } from '../../state/dialog-store';
import { showToast } from '../../state/toast-store';

export function EqaReviewEditor({ report, draft, dirty, stale, canSign, busy, readOnly = false, onChange, onKind, onBusy, onSaved, onReset, onRefresh }: {
  report: EqaReportView; draft: EqaReviewDraft; dirty: boolean; stale: boolean; canSign: boolean; busy: boolean;
  readOnly?: boolean;
  onChange: (patch: Partial<EqaReviewDraft>) => void; onKind: (kind: EqaReviewKind) => void;
  onBusy: (busy: boolean) => void; onSaved: () => void; onReset: () => void; onRefresh: () => void;
}) {
  const signing = useRef(false);
  const map: Record<string, string | string[]> = { conclusion: 'conclusion', communication: 'communication', warningNote: 'warningNote', receivedDate: 'receivedDate', nextReviewDate: 'nextReviewDate', assessment: 'assessment', carDecision: 'carDecision', carReference: 'carReference', communicationDate: 'communicationDate' };
  for (const r of report.coverage.missing) map[`alternative-${r.test_id}`] = ['method', 'reason', 'result'].map((field) => `${field}-${r.test_id}`);
  const { rootRef, error, errorId, handle, clear } = useFormError(map);
  const needsPreliminary = draft.kind === 'analysis_review' && !report.reviews.some((r) => r.kind === 'preliminary_review' && r.current);
  const fieldsDisabled = readOnly || busy || !canSign;
  const update = (patch: Partial<EqaReviewDraft>) => { if (!readOnly) { onChange(patch); clear(); } };

  async function sign() {
    if (readOnly || busy || signing.current || stale || !canSign || needsPreliminary) return;
    signing.current = true; onBusy(true); clear();
    try {
      const result = await window.qcApi.reviewEqaReport({ data: draft });
      if (!result.ok) {
        if (result.error.code === 'stale') onRefresh();
        if (!handle(result.error)) await errorDialog(result.error.message);
        return;
      }
      showToast('Đã ghi xem xét báo cáo ngoại kiểm.'); onSaved();
    } catch (e) { await errorDialog(e instanceof Error ? e.message : 'Không ghi được xem xét.'); }
    finally { signing.current = false; onBusy(false); }
  }

  return <section className="panel eqa-report-editor" role="complementary" aria-label={readOnly ? 'Thông tin phiếu xem xét đã lưu' : 'Chỉnh sửa nội dung xem xét'}>
    <div className="panel-head"><h2>{readOnly ? 'Thông tin phiếu đã lưu' : 'Chỉnh sửa thông tin'}</h2>{readOnly ? <span className="tag none">Chỉ xem</span> : dirty && <span className="tag warn">Chưa ký</span>}</div>
    <div className="eqa-report-editor-body">
      {report.scope.roundId ? <div className="dayseg eqa-review-phases" role="group" aria-label="Phần xem xét">
        <button type="button" className={draft.kind === 'preliminary_review' ? 'on' : ''} aria-pressed={draft.kind === 'preliminary_review'} disabled={busy || readOnly} onClick={() => onKind('preliminary_review')}>Sơ khởi</button>
        <button type="button" className={draft.kind === 'analysis_review' ? 'on' : ''} aria-pressed={draft.kind === 'analysis_review'} disabled={busy || readOnly} onClick={() => onKind('analysis_review')}>Phân tích</button>
      </div> : <p className="eqa-note">Xem xét hệ thống cả năm</p>}
      {readOnly && <p className="eqa-note">Đang xem thông tin phiếu đã lưu. Trở về bản đang sửa để tiếp tục nhập.</p>}
      {!readOnly && !canSign && <p className="eqa-note">Bạn có thể xem phiếu. Cần quyền duyệt hồ sơ để sửa và ký xem xét.</p>}
      {!readOnly && needsPreliminary && <p className="eqa-note">Ký xem xét sơ khởi trước khi ký phân tích. Nội dung đang nhập vẫn được giữ.</p>}
      <div ref={rootRef} className="eqa-review-form">
        <fieldset className="eqa-review-fields" disabled={fieldsDisabled}>
          {report.scope.roundId && <DateField name="receivedDate" label="Ngày nhận báo cáo" disabled={fieldsDisabled} value={draft.receivedDate} onChange={(receivedDate) => update({ receivedDate })} />}
          <div className="field"><label htmlFor="eqa-review-assessment">Đánh giá sau xem xét</label><select id="eqa-review-assessment" name="assessment" value={draft.assessment} onChange={(e) => update({ assessment: e.target.value as EqaReviewAssessment })}>{Object.entries(EQA_ASSESSMENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="field"><label htmlFor="eqa-review-conclusion">{draft.kind === 'preliminary_review' ? 'Nhận xét sơ khởi' : 'Nhận định và hướng xử lý'}</label><textarea id="eqa-review-conclusion" name="conclusion" rows={4} maxLength={EQA_PAPER_LIMITS.conclusion} value={draft.conclusion} onChange={(e) => update({ conclusion: e.target.value })} /><span className="eqa-note">{draft.conclusion.length}/{EQA_PAPER_LIMITS.conclusion} ký tự</span></div>
          {report.totals.warn > 0 && <div className="field"><label htmlFor="eqa-review-warning">Xử lý cảnh báo / lý do không điều tra</label><textarea id="eqa-review-warning" name="warningNote" rows={3} maxLength={EQA_PAPER_LIMITS.warningNote} value={draft.warningNote} onChange={(e) => update({ warningNote: e.target.value })} /></div>}
          <div className="field"><label htmlFor="eqa-review-communication">Truyền đạt cho nhân viên</label><textarea id="eqa-review-communication" name="communication" rows={3} maxLength={EQA_PAPER_LIMITS.communication} value={draft.communication} onChange={(e) => update({ communication: e.target.value })} /></div>
          <DateField name="communicationDate" label="Ngày truyền đạt (nếu đã thực hiện)" disabled={fieldsDisabled} value={draft.communicationDate || ''} onChange={(communicationDate) => update({ communicationDate })} />
          <div className="field"><label htmlFor="eqa-review-car">Đề xuất CAR</label><select id="eqa-review-car" name="carDecision" value={draft.carDecision} onChange={(e) => update({ carDecision: e.target.value as EqaCarDecision })}>{Object.entries(EQA_CAR_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          {(draft.carDecision === 'recorded' || draft.carDecision === 'proposed') && <div className="field"><label htmlFor="eqa-review-car-reference">Mã hồ sơ CAR / NCE{draft.carDecision === 'proposed' ? ' (nếu có)' : ''}</label><input id="eqa-review-car-reference" name="carReference" maxLength={EQA_PAPER_LIMITS.carReference} value={draft.carReference || ''} onChange={(e) => update({ carReference: e.target.value })} /></div>}
          <DateField name="nextReviewDate" label={draft.kind === 'system_review' ? 'Ngày hẹn xem xét tiếp theo' : 'Ngày hẹn xem xét tiếp theo (nếu có)'} disabled={fieldsDisabled} value={draft.nextReviewDate} onChange={(nextReviewDate) => update({ nextReviewDate })} />
          {draft.kind === 'system_review' && report.coverage.missing.map((r) => <fieldset key={r.test_id} className="eqa-coverage-fields"><legend>{r.test_name} · {r.instrument_name}</legend>{(['method', 'reason', 'result'] as const).map((field, index) => <div className="field" key={field}><label htmlFor={`${field}-${r.test_id}`}>{['Phương pháp thay thế', 'Lý do', 'Kết quả'][index]}</label><input id={`${field}-${r.test_id}`} name={`${field}-${r.test_id}`} maxLength={2000} value={draft.alternatives.find((a) => a.testId === r.test_id)?.[field] || ''} onChange={(e) => {
            const entry = draft.alternatives.find((a) => a.testId === r.test_id) || { testId: r.test_id, method: '', reason: '', result: '' };
            update({ alternatives: [...draft.alternatives.filter((a) => a.testId !== r.test_id), { ...entry, [field]: e.target.value }] });
          }} /></div>)}</fieldset>)}
        </fieldset>
        <FormErrorMessage rootRef={rootRef} error={error} id={errorId} />
      </div>
    </div>
    {!readOnly && <div className="eqa-editor-footer"><button type="button" className="btn ghost" disabled={busy || !dirty} onClick={onReset}>Bỏ thay đổi</button><button type="button" className="btn teal" disabled={busy || !canSign || stale || needsPreliminary} onClick={() => void sign()}>{signing.current ? 'Đang ký…' : 'Ký xem xét'}</button></div>}
  </section>;
}
