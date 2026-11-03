// Hộp đánh dấu đã nộp kết quả theo từng máy của một đợt. Máy đã có trong báo
// cáo của trung tâm coi như đã nộp nên không cần tích.
import { useState } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { Modal } from '../../components/Modal';
import { useAsyncAction } from '../../components/AsyncButton';
import { errorDialog } from '../../state/dialog-store';
import { showToast } from '../../state/toast-store';
import { vnDate } from '../../lib/format';
import type { EqaScheduleRow } from '../../../shared/qc-api';

export function EqaSubmitModal({ row, onClose }: { row: EqaScheduleRow; onClose: () => void }) {
  const markSubmitted = useEqaStore((s) => s.markSubmitted);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(row.instruments.filter((m) => m.submitted_at).map((m) => m.instrument_id)));

  async function save() {
    const result = await markSubmitted(row.id, [...checked]);
    if (!result.ok) { await errorDialog(result.error.message); return; }
    showToast(`Đã lưu tình trạng nộp ${row.program_name} ${row.round}/${row.year}.`);
    onClose();
  }
  const saving = useAsyncAction(save);

  return (
    <Modal busy={saving.busy} title="Đánh dấu đã nộp" onClose={onClose} size="sm"
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Huỷ</button><button type="button" className="btn teal" disabled={saving.busy} onClick={() => void saving.run()}>{saving.busy ? 'Đang lưu…' : 'Lưu'}</button></>}>
      <p className="eqa-submit-head"><b className="eqa-strong">{row.program_name} · {row.round}/{row.year}</b><span className="eqa-sub">Hạn nộp {vnDate(row.due_date)}</span></p>
      <div className="eqa-machine-picker" role="group" aria-label="Máy đã nộp kết quả">
        {row.instruments.map((m) => (
          <label key={m.instrument_id}>
            <input type="checkbox" checked={m.reported || checked.has(m.instrument_id)} disabled={m.reported} onChange={(e) => {
              setChecked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(m.instrument_id); else next.delete(m.instrument_id); return next; });
            }} />
            <span><b>{m.instrument_name}</b><small>{m.reported ? 'Đã có trong báo cáo của trung tâm'
              : m.submitted_at ? `Nộp ${vnDate(m.submitted_at.slice(0, 10))}${m.submitted_by ? ` · ${m.submitted_by}` : ''}` : 'Chưa nộp'}</small></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
