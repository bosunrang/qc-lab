// Hộp thoại lập hồ sơ NCE. Từ hàng chờ: nguồn là nội kiểm và chỉ gửi khoá lần
// chạy — main tự đọc xét nghiệm, mức, lô, luật và chụp snapshot. Từ nguồn
// khác: chọn nguồn, giai đoạn và (nếu có) xét nghiệm.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { useNceStore } from '../../store/nce-store';
import { useManageStore } from '../../store/manage-store';
import { useAuthStore } from '../../store/auth-store';
import { todayIso } from '../../lib/format';
import { NCE_PHASE_LABEL, NCE_SOURCE_LABEL } from '../../../main/domain/nce/labels';
import type { NceDossierView, NceSource } from '../../../shared/qc-api';
import { nceRunLabel } from '../../../main/domain/nce/presentation';
import { Field, OptionSelect, UserSelect } from './shared';

export interface NceCreatePrefill { testId: string; testName: string; date: string; runId: string; summary: string }

const OTHER_SOURCES = Object.fromEntries(Object.entries(NCE_SOURCE_LABEL).filter(([key]) => key !== 'iqc'));

export function CreateNceModal({ prefill, onClose, onCreated }: { prefill: NceCreatePrefill | null; onClose: () => void; onCreated: (dossier: NceDossierView) => void }) {
  const { users, create } = useNceStore(useShallow((s) => ({ users: s.users, create: s.create })));
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!hold) { setError('Chọn có dừng/giữ kết quả liên quan hay không.'); return; }
    setSaving(true); setError('');
    const result = await create({
      source, phase: source === 'iqc' ? 'exam' : phase, testId: testId || undefined,
      trigger: prefill ? { date: prefill.date, runId: prefill.runId } : undefined,
      description, correction, holdResults: hold === 'yes', detectedAt, ownerUserId, dueDate: dueDate || undefined,
    });
    setSaving(false);
    if (!result.ok) { setError(result.error.message); return; }
    onCreated(result.data);
  }

  return (
    <Modal title={prefill ? `Lập hồ sơ NCE — ${prefill.testName}` : 'Lập hồ sơ NCE từ nguồn khác'} size="lg" onClose={onClose} busy={saving}
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Bỏ qua</button><button type="button" className="btn teal" disabled={saving} onClick={submit}>{saving ? 'Đang lưu…' : 'Lập hồ sơ'}</button></>}>
      {error && <div className="alert rej" role="alert">{error}</div>}
      {prefill
        ? <div className="alert info">Lần chạy {nceRunLabel(prefill)} bị loại. Mức, lô, luật và kết luận Westgard được chụp tự động từ lần chạy này.</div>
        : <div className="hint">Dùng cho sự cố không bắt đầu từ một lần chạy QC bị loại: ngoại kiểm, thiết bị, hoá chất, hiệu chuẩn, tín hiệu CUSUM hoặc sai sót khác.</div>}
      <div className="nce-form-grid">
        {!prefill && <>
          <Field label="Nguồn phát hiện" htmlFor="nceSource"><OptionSelect id="nceSource" value={source} options={OTHER_SOURCES} onChange={(v) => setSource(v as NceSource)} /></Field>
          <Field label="Giai đoạn quá trình" htmlFor="ncePhase"><OptionSelect id="ncePhase" value={phase} options={NCE_PHASE_LABEL} onChange={(v) => setPhase(v as typeof phase)} /></Field>
          <Field label="Xét nghiệm liên quan (nếu có)" htmlFor="nceTest">
            <select id="nceTest" value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">— Không gắn xét nghiệm —</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </>}
        <Field label="Mô tả sự kiện và yêu cầu không được đáp ứng" htmlFor="nceDescription" wide>
          <textarea id="nceDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Xử lý tức thời đã thực hiện" htmlFor="nceCorrection" wide>
          <textarea id="nceCorrection" rows={2} value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Dừng trả kết quả, cô lập vật liệu, chạy lại QC…" />
        </Field>
        <div className="field nce-field-wide" role="radiogroup" aria-labelledby="nceHoldLabel">
          <label id="nceHoldLabel">Có dừng/giữ kết quả bệnh nhân liên quan không?</label>
          <div className="nce-radio-row">
            <label><input type="radio" name="nceHold" checked={hold === 'yes'} onChange={() => setHold('yes')} /> Có, đã dừng/giữ</label>
            <label><input type="radio" name="nceHold" checked={hold === 'no'} onChange={() => setHold('no')} /> Không cần</label>
          </div>
        </div>
        <div className="nce-field-wide">
          <p className="nce-note">Ngày lập hồ sơ được hệ thống ghi tại lúc lưu, tách biệt với ngày phát hiện thực tế. QC xác minh không được trước ngày phát hiện.</p>
          <label className="nce-check"><input type="checkbox" checked={retrospective} onChange={(e) => { setRetrospective(e.target.checked); setDetectedAt(e.target.checked ? '' : todayIso()); }} /> Nhập hồi cứu: sự cố đã được phát hiện trước đây, nay mới lập hồ sơ</label>
          {retrospective && <p className="nce-note">Chọn ngày phát hiện thực tế theo nhật ký. Không tự lấy ngày QC làm ngày phát hiện; quyết định cho hoạt động trở lại vẫn ghi ở thời điểm hiện tại.</p>}
          {prefill && prefill.date < detectedAt && <div className="alert warn">Lần QC gây sự cố là {nceRunLabel(prefill)}, trước ngày phát hiện đang chọn. Các lần QC trước {detectedAt.split('-').reverse().join('/')} sẽ không dùng làm bằng chứng xác minh. Nếu chỉ mới phát hiện hôm nay, giữ đúng ngày này.</div>}
        </div>
        <DateField label="Ngày phát hiện thực tế" id="nceDetected" value={detectedAt} onChange={setDetectedAt} />
        <Field label="Người phụ trách" htmlFor="nceOwner"><UserSelect id="nceOwner" value={ownerUserId} users={users} onChange={setOwnerUserId} /></Field>
        <DateField label="Hạn hoàn thành (để trống: theo cấu hình)" id="nceDue" value={dueDate} onChange={setDueDate} />
      </div>
    </Modal>
  );
}
