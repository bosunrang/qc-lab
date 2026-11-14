// Hộp thoại lập hồ sơ NCE. Từ hàng chờ: nguồn là nội kiểm và chỉ gửi khoá lần
// chạy — main tự đọc xét nghiệm, mức, lô, luật và chụp snapshot. Từ nguồn
// khác: chọn nguồn, giai đoạn và (nếu có) xét nghiệm.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from '../../components/Modal';
import { useAsyncAction } from '../../components/AsyncButton';
import { DateField } from '../../components/DateField';
import { FormErrorMessage } from '../../components/FormErrorMessage';
import { useNceStore } from '../../store/nce-store';
import { useManageStore } from '../../store/manage-store';
import { useAuthStore } from '../../store/auth-store';
import { todayIso } from '../../lib/format';
import { withDeadline } from '../../lib/async-deadline';
import { sendClientError } from '../../lib/unhandled-errors';
import { useFormError } from '../../lib/useFormError';
import { errorDialog } from '../../state/dialog-store';
import { NCE_PHASE_LABEL, NCE_SOURCE_LABEL } from '../../../main/domain/nce/labels';
import type { NceDossierView, NceSource } from '../../../shared/qc-api';
import { nceRunLabel } from '../../../main/domain/nce/presentation';
import { Field, OptionSelect, UserSelect } from './shared';
import { assertDossier } from './dossier-data';

export interface NceCreatePrefill { testId: string; testName: string; date: string; runId: string; summary: string }

const OTHER_SOURCES = Object.fromEntries(Object.entries(NCE_SOURCE_LABEL).filter(([key]) => key !== 'iqc'));
const CREATE_FIELDS = {
  'invalid-source': 'nceSource', 'missing-description': 'nceDescription', 'missing-correction': 'nceCorrection',
  'missing-hold': 'nceHold', 'invalid-detected': 'nceDetected', 'detected-before-run': 'nceDetected',
  'missing-owner': 'nceOwner', 'invalid-due-date': 'nceDue', 'due-before-detected': 'nceDue',
} as const;

export function CreateNceModal({ prefill, onClose, onCreated }: { prefill: NceCreatePrefill | null; onClose: () => void; onCreated: (dossier: NceDossierView) => void }) {
  const { users, create, load } = useNceStore(useShallow((s) => ({ users: s.users, create: s.create, load: s.load })));
  const tests = useManageStore((s) => s.tests);
  const me = useAuthStore((s) => s.user);
  const [source, setSource] = useState<NceSource>(prefill ? 'iqc' : 'instrument');
  const [phase, setPhase] = useState<'pre' | 'exam' | 'post'>('exam');
  const [testId, setTestId] = useState(prefill?.testId ?? '');
  const [description, setDescription] = useState(prefill ? prefill.summary : '');
  const [correction, setCorrection] = useState('');
  const [hold, setHold] = useState<'' | 'yes' | 'no'>('');
  const [detectedAt, setDetectedAt] = useState(todayIso());
  const [retrospective, setRetrospective] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState(users.some((u) => u.id === me?.id) ? me!.id : '');
  const [dueDate, setDueDate] = useState('');
  const [operationError, setOperationError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const formError = useFormError(CREATE_FIELDS);

  const { busy: saving, run: submit } = useAsyncAction(async () => {
    if (uncertain) return;
    if (!hold) { formError.handle({ code: 'missing-hold', message: 'Chọn có dừng/giữ kết quả liên quan hay không.' }); return; }
    formError.clear();
    setOperationError('');
    let created: NceDossierView;
    try {
      const result = await withDeadline(() => create({
        source, phase: source === 'iqc' ? 'exam' : phase, testId: testId || undefined,
        trigger: prefill ? { date: prefill.date, runId: prefill.runId } : undefined,
        description, correction, holdResults: hold === 'yes', detectedAt, ownerUserId, dueDate: dueDate || undefined,
      }), 30_000);
      if (!result.ok) {
        if (result.error.code === 'internal-error') throw new Error(result.error.message);
        if (formError.handle(result.error)) return;
        await errorDialog(result.error.message, { title: 'Chưa lập được hồ sơ' });
        return;
      }
      created = result.data;
      assertDossier(created);
    } catch (error) {
      sendClientError(error);
      setUncertain(true);
      setOperationError('Chưa xác nhận được hồ sơ đã được lập hay chưa. Về danh sách để đối chiếu trước khi lập lại; nội dung đang nhập vẫn được giữ trong biểu mẫu này.');
      // Đây là đọc để đối chiếu một lệnh chưa rõ kết quả, không tự gửi lại lệnh ghi.
      void load();
      return;
    }
    onCreated(created);
  });

  return (
    <Modal title={prefill ? `Lập hồ sơ NCE — ${prefill.testName}` : 'Lập hồ sơ NCE từ nguồn khác'} size="lg" onClose={onClose} busy={saving}
      footer={<><button type="button" className="btn ghost" disabled={saving} onClick={onClose}>{uncertain ? 'Về danh sách' : 'Bỏ qua'}</button><button type="button" className="btn teal" disabled={saving || uncertain} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lập hồ sơ'}</button></>}>
      {operationError && <div className="alert rej" role="alert">{operationError}</div>}
      {prefill
        ? <div className="alert info">Lần chạy {nceRunLabel(prefill)} bị loại. Mức, lô, luật và kết luận Westgard được chụp tự động từ lần chạy này.</div>
        : <div className="hint">Dùng cho sự cố không bắt đầu từ một lần chạy QC bị loại: ngoại kiểm, thiết bị, hoá chất, hiệu chuẩn, tín hiệu CUSUM hoặc sai sót khác.</div>}
      <div className="nce-form-grid" ref={formError.rootRef}>
        <FormErrorMessage rootRef={formError.rootRef} error={formError.error} id={formError.errorId} />
        {!prefill && <>
          <Field label="Nguồn phát hiện" htmlFor="nceSource"><OptionSelect id="nceSource" value={source} options={OTHER_SOURCES} onChange={(v) => { formError.clear(); setSource(v as NceSource); }} /></Field>
          <Field label="Giai đoạn quá trình" htmlFor="ncePhase"><OptionSelect id="ncePhase" value={phase} options={NCE_PHASE_LABEL} onChange={(v) => setPhase(v as typeof phase)} /></Field>
          <Field label="Xét nghiệm liên quan (nếu có)" htmlFor="nceTest">
            <select id="nceTest" value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">— Không gắn xét nghiệm —</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </>}
        <Field label="Mô tả sự kiện và yêu cầu không được đáp ứng" htmlFor="nceDescription" wide>
          <textarea id="nceDescription" rows={3} value={description} onChange={(e) => { formError.clear(); setDescription(e.target.value); }} />
        </Field>
        <Field label="Xử lý tức thời đã thực hiện" htmlFor="nceCorrection" wide>
          <textarea id="nceCorrection" rows={2} value={correction} onChange={(e) => { formError.clear(); setCorrection(e.target.value); }} placeholder="Dừng trả kết quả, cô lập vật liệu, chạy lại QC…" />
        </Field>
        <div className="field nce-field-wide" role="radiogroup" aria-labelledby="nceHoldLabel">
          <label id="nceHoldLabel">Có dừng/giữ kết quả bệnh nhân liên quan không?</label>
          <div className="nce-radio-row">
            <label><input type="radio" name="nceHold" checked={hold === 'yes'} onChange={() => { formError.clear(); setHold('yes'); }} /> Có, đã dừng/giữ</label>
            <label><input type="radio" name="nceHold" checked={hold === 'no'} onChange={() => { formError.clear(); setHold('no'); }} /> Không cần</label>
          </div>
        </div>
        <div className="nce-field-wide nce-create-detected">
          <p className="nce-note">Ngày lập hồ sơ do hệ thống ghi lúc lưu, khác ngày phát hiện. QC xác minh không được trước ngày phát hiện.</p>
          <label className="nce-check"><input type="checkbox" checked={retrospective} onChange={(e) => { setRetrospective(e.target.checked); setDetectedAt(e.target.checked ? '' : todayIso()); }} /> Nhập hồi cứu: sự cố đã được phát hiện trước đây, nay mới lập hồ sơ</label>
          {retrospective && <p className="nce-note">Ghi ngày phát hiện thực tế theo nhật ký, không mặc định lấy ngày QC. Quyết định cho hoạt động trở lại vẫn ghi theo giờ hiện tại.</p>}
          {prefill && prefill.date < detectedAt && <div className="alert warn">Lần QC gây sự cố là {nceRunLabel(prefill)}, trước ngày phát hiện đang chọn. Các lần QC trước {detectedAt.split('-').reverse().join('/')} sẽ không dùng làm bằng chứng xác minh. Nếu chỉ mới phát hiện hôm nay, giữ đúng ngày này.</div>}
        </div>
        <DateField label="Ngày phát hiện thực tế" id="nceDetected" value={detectedAt} onChange={(value) => { formError.clear(); setDetectedAt(value); }} />
        <Field label="Người phụ trách" htmlFor="nceOwner"><UserSelect id="nceOwner" value={ownerUserId} users={users} onChange={(value) => { formError.clear(); setOwnerUserId(value); }} /></Field>
        <DateField label="Hạn hoàn thành (để trống: theo cấu hình)" id="nceDue" value={dueDate} onChange={(value) => { formError.clear(); setDueDate(value); }} />
      </div>
    </Modal>
  );
}
