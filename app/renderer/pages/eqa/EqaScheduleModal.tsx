// Hộp thêm/sửa một đợt trong lịch ngoại kiểm. Kiểm tra dữ liệu do main làm
// (`domain/eqa/schedule.ts`); form chỉ chỉ ra ô sai theo mã lỗi.
import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { Modal } from '../../components/Modal';
import { DateField } from '../../components/DateField';
import { EmptyState } from '../../components/EmptyState';
import { useAsyncAction } from '../../components/AsyncButton';
import { formError, formErrorFrom, type FieldErrorMap, type FormError } from '../../lib/field-error';
import { useInvalidField } from '../../lib/useInvalidField';
import { showToast } from '../../state/toast-store';
import { isoLocalDate } from '../../../main/domain/local-date';
import { EQA_SAMPLE_TYPES } from '../../../main/domain/eqa/schedule';
import type { EqaScheduleRow } from '../../../shared/qc-api';

const NEW_PROGRAM = '__new__';
const FIELD_ERRORS: FieldErrorMap = {
  'missing-program': 'programId', 'invalid-year': 'year', 'invalid-round': 'round', 'duplicate-round': 'round',
  'invalid-due-date': 'dueDate', 'invalid-receive-date': 'receiveDate', 'invalid-run-date': 'runDate',
  'run-after-due': 'runDate', 'receive-after-run': 'receiveDate', 'invalid-sample-type': 'sampleType',
  'invalid-instrument': 'instrumentIds', locked: 'instrumentIds',
};

export function EqaScheduleModal({ row, onClose }: { row: EqaScheduleRow | null; onClose: () => void }) {
  const { programs, instruments, saveSchedule } = useEqaStore(useShallow((s) => ({ programs: s.programs, instruments: s.instruments, saveSchedule: s.saveSchedule })));
  const initialProgram = programs.find((p) => p.id === row?.program_id) ?? (row ? undefined : programs[0]);
  const [programId, setProgramId] = useState(row?.program_id ?? (programs[0]?.id || NEW_PROGRAM));
  const [sampleType, setSampleType] = useState(row?.sample_type ?? initialProgram?.sample_type ?? '');
  const [machineIds, setMachineIds] = useState<Set<string>>(() => new Set(row ? row.instruments.map((m) => m.instrument_id) : initialProgram?.instrument_ids ?? []));
  const [receiveDate, setReceiveDate] = useState(row?.receive_date ?? '');
  const [runDate, setRunDate] = useState(row?.run_date ?? '');
  const [dueDate, setDueDate] = useState(row?.due_date ?? '');
  const [err, setErr] = useState<FormError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useInvalidField(formRef, err);
  const program = programs.find((p) => p.id === programId);
  // Máy đã nộp không gỡ được ở đây (main cũng chặn); máy ngừng hoạt động chỉ
  // hiện khi đợt đang có nó.
  const submittedIds = new Set(row?.instruments.filter((m) => m.submitted_at).map((m) => m.instrument_id) ?? []);
  const machines = instruments.filter((i) => i.active === 1 || machineIds.has(i.id));

  function pickProgram(id: string) {
    setProgramId(id);
    const next = programs.find((p) => p.id === id);
    setSampleType(next?.sample_type ?? '');
    // Đợt mới nhận máy gợi sẵn của chương trình; đợt đang sửa giữ máy đã khai.
    if (!row) setMachineIds(new Set(next?.instrument_ids ?? []));
  }

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const isNew = programId === NEW_PROGRAM;
    const result = await saveSchedule({
      programId: isNew ? '' : programId,
      programName: isNew ? String(fd.get('programName') || '') : '', provider: isNew ? String(fd.get('provider') || '') : '',
      year: Number(fd.get('year')), round: String(fd.get('round') || ''),
      receiveDate, runDate, dueDate, sampleType, instrumentIds: [...machineIds],
      assignee: String(fd.get('assignee') || ''), note: String(fd.get('note') || ''),
    }, row?.id);
    if (!result.ok) {
      setErr(isNew && result.error.code === 'missing-program' ? formError(result.error.message, 'programName') : formErrorFrom(result.error, FIELD_ERRORS));
      return;
    }
    showToast(row ? 'Đã lưu đợt trong lịch.' : 'Đã thêm đợt vào lịch.');
    onClose();
  }
  const saving = useAsyncAction(submit);

  return (
    <Modal busy={saving.busy} title={row ? 'Sửa đợt ngoại kiểm' : 'Thêm đợt ngoại kiểm'} onClose={onClose} size="md"
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Huỷ</button><button className="btn teal" type="submit" form="eqa-schedule-form" disabled={saving.busy}>{saving.busy ? 'Đang lưu…' : row ? 'Lưu thay đổi' : 'Thêm vào lịch'}</button></>}>
      <form id="eqa-schedule-form" ref={formRef} className="eqa-form" onSubmit={(e) => { e.preventDefault(); void saving.run(e.currentTarget); }}>
        {err && <p id={errorId} className="field-error" role="alert">{err.message}</p>}
        <div className="eqa-form-program">
          <div className="field">
            <label htmlFor="eqa-s-program">Chương trình</label>
            <select id="eqa-s-program" name="programId" value={programId} onChange={(e) => pickProgram(e.target.value)}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={NEW_PROGRAM}>Chương trình mới…</option>
            </select>
            {program?.provider && <div className="hint eqa-field-hint">{program.provider}</div>}
          </div>
          <div className="field">
            <label htmlFor="eqa-s-sample">Loại mẫu</label>
            <select id="eqa-s-sample" name="sampleType" value={sampleType} onChange={(e) => setSampleType(e.target.value)}>
              <option value="">Chưa chọn</option>
              {EQA_SAMPLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="hint eqa-field-hint">Dùng chung cho mọi đợt của chương trình.</div>
          </div>
        </div>
        {programId === NEW_PROGRAM && (
          <div className="grid2">
            <div className="field"><label htmlFor="eqa-s-name">Tên chương trình</label><input id="eqa-s-name" name="programName" placeholder="Như trên báo cáo của trung tâm" /></div>
            <div className="field"><label htmlFor="eqa-s-provider">Đơn vị tổ chức</label><input id="eqa-s-provider" name="provider" /></div>
          </div>
        )}
        <div className="grid2">
          <div className="field"><label htmlFor="eqa-s-round">Đợt</label><input id="eqa-s-round" name="round" defaultValue={row?.round ?? ''} placeholder="Ví dụ: ĐỢT 11" /></div>
          <div className="field"><label htmlFor="eqa-s-year">Năm</label><input id="eqa-s-year" name="year" type="number" defaultValue={row?.year ?? Number(isoLocalDate().slice(0, 4))} /></div>
        </div>
        <div className="eqa-form-dates">
          <DateField id="eqa-s-receive" name="receiveDate" label="Ngày nhận mẫu" value={receiveDate} onChange={setReceiveDate} />
          <DateField id="eqa-s-run" name="runDate" label="Ngày chạy mẫu" value={runDate} onChange={setRunDate} />
          <DateField id="eqa-s-due" name="dueDate" label="Hạn nộp kết quả" value={dueDate} onChange={setDueDate} />
        </div>
        <div className="field">
          <label id="eqa-s-machines-label">Máy chạy mẫu</label>
          <div className="eqa-machine-picker" role="group" aria-labelledby="eqa-s-machines-label">
            {!machines.length && <EmptyState size="compact">Chưa có máy xét nghiệm. Thêm máy ở Cấu hình chung.</EmptyState>}
            {machines.map((m) => (
              <label key={m.id}>
                <input type="checkbox" data-field="instrumentIds" checked={machineIds.has(m.id)} disabled={submittedIds.has(m.id)} onChange={(e) => {
                  setMachineIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(m.id); else next.delete(m.id); return next; });
                }} />
                <span><b>{m.name}</b><small>{submittedIds.has(m.id) ? 'Đã nộp kết quả' : [m.manufacturer, m.model].filter(Boolean).join(' · ') || m.section || '—'}</small></span>
              </label>
            ))}
          </div>
          <div className="hint eqa-field-hint">Mỗi máy nộp phiếu kết quả riêng; đợt tính đã nộp khi đủ máy. Không chọn máy thì đánh dấu nộp cho cả đợt.</div>
        </div>
        <div className="field"><label htmlFor="eqa-s-assignee">Người phụ trách</label><input id="eqa-s-assignee" name="assignee" defaultValue={row?.assignee ?? ''} /></div>
        <div className="field"><label htmlFor="eqa-s-note">Ghi chú</label><input id="eqa-s-note" name="note" defaultValue={row?.note ?? ''} /></div>
      </form>
    </Modal>
  );
}
