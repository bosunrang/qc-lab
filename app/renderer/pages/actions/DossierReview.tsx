// Bước cuối của hồ sơ: quyết định và lịch sử trong cùng một khung. Quyền,
// điều kiện còn thiếu và phiên bản ghi vẫn lấy từ phiên hồ sơ/main.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { NceMissingItem } from '../../../shared/qc-api';
import { useNceStore } from '../../store/nce-store';
import { FormErrorMessage } from '../../components/FormErrorMessage';
import { useFormError } from '../../lib/useFormError';
import { confirmDialog } from '../../state/dialog-store';
import type { SectionProps } from './DossierContent';
import { DossierHistorySection } from './DossierTimeline';
import { decisionPayload } from './decision-data';
import { Field, Section, timeText } from './shared';

interface ReviewProps extends SectionProps {
  onViewEvidence?: () => void;
  onMissing: (item: NceMissingItem) => void;
}

export function ReviewSection(props: ReviewProps) {
  const { record, decisions, can, approve_block: approveBlock, missing } = props.dossier;
  const { submit, approve, returnForRevision, cancel } = useNceStore(useShallow((s) => ({ submit: s.submit, approve: s.approve, returnForRevision: s.returnForRevision, cancel: s.cancel })));
  const [note, setNote] = useState('');
  const [noteVersion, setNoteVersion] = useState<number | null>(null);
  const reviewError = useFormError({ 'missing-note': 'revNote' });
  const cancelError = useFormError({ 'missing-reason': 'cancelReason' });
  const approval = decisions.find((d) => d.type === 'approve');
  const lastReturn = decisions.filter((d) => d.type === 'return').at(-1);
  const submitted = decisions.filter((d) => d.type === 'submit').at(-1);
  const cancelled = decisions.find((d) => d.type === 'cancel');
  const pending = record.status === 'pending_approval';
  const terminal = record.status === 'closed' || record.status === 'cancelled';
  const title = record.status === 'closed' ? 'Đã duyệt đóng hồ sơ'
    : record.status === 'cancelled' ? 'Hồ sơ đã huỷ'
      : pending ? 'Đang chờ phê duyệt'
        : record.status === 'released' ? missing.length ? 'Chưa đủ điều kiện nộp duyệt' : 'Sẵn sàng nộp duyệt'
          : 'Hoàn tất xử lý trước khi nộp duyệt';
  const actor = record.status === 'closed' ? approval : record.status === 'cancelled' ? cancelled : pending ? submitted : undefined;
  const savedNote = approval ? decisionPayload<{ note: string }>(approval).note : cancelled ? decisionPayload<{ reason: string }>(cancelled).reason : '';

  async function decide(write: Parameters<SectionProps['run']>[0], handleValidationError?: (error: { code: string; message: string }) => boolean) {
    // Mỗi vòng duyệt có bản nháp riêng. Lỗi giữ lại nội dung và phiên bản.
    if (await props.run(write, { handleValidationError })) { setNote(''); setNoteVersion(null); }
  }

  async function doCancel() {
    const expectedVersion = noteVersion ?? record.row_version;
    if (!(await confirmDialog('Huỷ hồ sơ này? Hồ sơ vẫn được lưu để truy xuất.', { title: 'Huỷ hồ sơ NCE', danger: true, confirmLabel: 'Huỷ hồ sơ', cancelLabel: 'Quay lại' }))) return;
    await decide((base) => cancel({ ...base, expectedVersion, reason: note }), cancelError.handle);
  }

  function editNote(value: string) {
    reviewError.clear();
    cancelError.clear();
    setNoteVersion((version) => version ?? record.row_version);
    setNote(value);
  }

  return <Section title="Phê duyệt & lịch sử" actions={props.onViewEvidence && <button type="button" className="btn ghost sm" onClick={props.onViewEvidence}>Xem toàn bộ bằng chứng</button>}>
    <section className="nce-review-decision" aria-label="Nộp duyệt và phê duyệt">
      <div className="nce-review-overview">
        <div className="nce-review-status">
          <h3>{title}</h3>
          <p>{actor ? `${actor.actor_name} · ${timeText(actor.decided_at)}` : `Người phụ trách: ${record.owner_name || 'Chưa phân công'}`}</p>
          {savedNote && <p className="nce-review-saved-note">{savedNote}</p>}
          {record.status === 'released' && !can.submit && <p>Người phụ trách hoặc người báo cáo thực hiện nộp duyệt.</p>}
        </div>
        {record.status === 'released' && can.submit && <button type="button" className="btn" disabled={props.busy || missing.length > 0} onClick={() => void props.run((base) => submit(base))}>Nộp duyệt</button>}
      </div>

      {!terminal && missing.length > 0 && <details className="nce-review-missing">
        <summary>Còn {missing.length} điều kiện cần hoàn thiện</summary>
        <ul>{missing.map((item) => <li key={item.code}><button type="button" onClick={() => props.onMissing(item)}><span>{item.message}</span><span aria-hidden="true">→</span></button></li>)}</ul>
      </details>}

      {lastReturn && record.status === 'released' && <div className="nce-review-return" role="note">
        <p><b>Yêu cầu bổ sung</b><span>{lastReturn.actor_name} · {timeText(lastReturn.decided_at)}</span></p>
        <p>{decisionPayload<{ note: string }>(lastReturn).note}</p>
      </div>}

      {pending && <>
        {approveBlock && <div className="alert info">{approveBlock}</div>}
        {(can.approve || can.return) ? <div className="nce-form-grid" ref={reviewError.rootRef}>
          <FormErrorMessage rootRef={reviewError.rootRef} error={reviewError.error} id={reviewError.errorId} />
          <Field label="Ghi chú duyệt / lý do trả lại" htmlFor="revNote" wide><textarea id="revNote" rows={2} value={note} onChange={(e) => editNote(e.target.value)} /></Field>
          {noteVersion !== null && noteVersion !== record.row_version && <p className="nce-editor-warning nce-field-wide">Hồ sơ đã được cập nhật ở nơi khác</p>}
          <div className="nce-form-actions nce-field-wide">
            {can.return && <button type="button" className="btn ghost" disabled={props.busy} onClick={() => void decide((base) => returnForRevision({ ...base, expectedVersion: noteVersion ?? record.row_version, note }), reviewError.handle)}>Trả lại</button>}
            {can.approve && <button type="button" className="btn" disabled={props.busy} onClick={() => void decide((base) => approve({ ...base, expectedVersion: noteVersion ?? record.row_version, note }))}>Duyệt đóng hồ sơ</button>}
          </div>
        </div> : !approveBlock && <p className="nce-note">Hồ sơ đang chờ người có quyền duyệt (nce.approve).</p>}
      </>}
    </section>

    <DossierHistorySection dossier={props.dossier} />

    {record.status === 'open' && can.cancel && <details className="nce-review-cancel">
      <summary>Huỷ hồ sơ lập nhầm</summary>
      <div className="nce-form-grid" ref={cancelError.rootRef}>
        <FormErrorMessage rootRef={cancelError.rootRef} error={cancelError.error} id={cancelError.errorId} />
        <Field label="Lý do huỷ (hồ sơ lập nhầm, trùng)" htmlFor="cancelReason" wide><input id="cancelReason" value={note} onChange={(e) => editNote(e.target.value)} /></Field>
        <div className="nce-form-actions nce-field-wide"><button type="button" className="btn danger sm" disabled={props.busy} onClick={() => void doCancel()}>Huỷ hồ sơ</button></div>
      </div>
    </details>}
  </Section>;
}
