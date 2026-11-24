// Hộp thoại huỷ điểm QC. Tự giữ trạng thái form (loại huỷ, lý do, có mở NCE
// không): trước khi tách (2026-09-26), mỗi ký tự gõ vào ô lý do làm vẽ lại cả
// bảng nhập 31 ngày và mọi biểu đồ của trang.
import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useEntryStore } from '../../store/entry-store';
import { voidNceChoice, voidReasonMinimum, type VoidKind } from '../../../main/domain/entry-validation';
import { describeRunChanges, RETRO_REASON_MIN } from '../../../main/domain/run-conclusion-change';
import { formatQcValue, vnDate } from './shared';
import type { QcPointView, VoidPointAssessment } from '../../../shared/qc-api';
import { ERROR_CLASS_LABEL } from '../../../main/domain/westgard-rules';
import { AsyncButton } from '../../components/AsyncButton';
import { errorDialog } from '../../state/dialog-store';

export function VoidPointModal({ point, decimals, onClose, onVoided }: {
  point: QcPointView;
  decimals: number;
  onClose: () => void;
  /** Gọi sau khi huỷ thành công, kèm thông báo hiện dưới bảng nhập. */
  onVoided: (message: string) => void;
}) {
  const voidPoint = useEntryStore((s) => s.voidPoint);
  // Hai kind đầu khoá cứng openNce; chỉ 'other' cho phép người dùng bật/tắt.
  // Modal mặc định dùng nguyên nhân 'analytical'.
  const [voidKind, setVoidKind] = useState<VoidKind>('analytical');
  const [voidOpenNce, setVoidOpenNce] = useState(true);
  const [voidReason, setVoidReason] = useState('');
  const [voidErr, setVoidErr] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<VoidPointAssessment | null>(null);
  const [assessmentError, setAssessmentError] = useState('');
  useEffect(() => {
    let current = true;
    setAssessment(null); setAssessmentError('');
    void window.qcApi.getVoidPointAssessment(point.id).then((result) => {
      if (!current) return;
      if (result.ok) setAssessment(result.data);
      else setAssessmentError(result.error.message);
    }).catch(() => { if (current) setAssessmentError('Không tải được phân loại Westgard. Vui lòng đóng và mở lại hộp thoại.'); });
    return () => { current = false; };
  }, [point.id]);
  // Main báo huỷ điểm này đổi trạng thái loại bỏ của lần chạy KHÁC (N26): từ
  // đó lý do là bắt buộc, kể cả với loại "Nhập sai dữ liệu".
  const [retroRequired, setRetroRequired] = useState(false);
  const voidChoice = voidNceChoice(voidKind);
  // Điểm thuộc lần chạy bị loại cần lý do với mọi loại huỷ (N4); main kiểm lại.
  const runRejected = assessment?.run_rejected ?? (point.verdict === 'rej' || (point.runRejectedBy?.length ?? 0) > 0);
  const reasonMin = Math.max(voidReasonMinimum(voidKind, runRejected), retroRequired ? RETRO_REASON_MIN : 0);

  async function submitVoid() {
    if (voidReason.trim().length < reasonMin) { setVoidErr(`Cần ghi lý do huỷ tối thiểu ${reasonMin} ký tự.`); return; }
    const openNce = voidChoice.forced ? voidChoice.openNce : voidOpenNce;
    const result = await voidPoint(point.id, voidReason.trim(), voidKind, openNce);
    if (!result.ok) {
      if (result.error.code === 'reason-required-retro') { setRetroRequired(true); setVoidErr(result.error.message); }
      else await errorDialog(result.error.message, { title: 'Chưa huỷ được điểm QC' });
      return;
    }
    const followup = result.data.nceId
      ? (result.data.reusedAction ? ' Đã giữ liên kết với hồ sơ NCE đang mở.' : ` Đã mở hồ sơ ${result.data.nceId} để tiếp tục điều tra.`)
      : ' Không yêu cầu NCE/QC chạy lại.';
    const retro = result.data.retroChanges.length ? ` Đổi kết luận lần chạy khác: ${describeRunChanges(result.data.retroChanges)}.` : '';
    onVoided(`Đã huỷ điểm QC ngày ${vnDate(point.date)}. Điểm không còn tham gia tính toán.${followup}${retro}`);
  }

  return (
    <Modal title="Huỷ điểm QC" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><AsyncButton className="btn danger" onClick={submitVoid}>Huỷ điểm này</AsyncButton></>}>
      <div className="void-point-summary">Ngày {vnDate(point.date)} · Mức {point.level} · Giá trị {formatQcValue(point.val, decimals)}</div>
      <div className="field" role="status" aria-live="polite">
        {assessment ? <>
          <div><strong>Phân loại theo Westgard:</strong> {assessment.error_class ? ERROR_CLASS_LABEL[assessment.error_class] : 'Chưa đủ căn cứ phân loại'}</div>
          <div><strong>Luật làm căn cứ:</strong> {assessment.rules.length ? assessment.rules.join(', ') : 'Chưa có luật loại bỏ làm căn cứ phân loại'}</div>
        </> : assessmentError ? <div className="field-error">{assessmentError}</div> : <div className="hint">Đang tải phân loại Westgard của lần chạy…</div>}
      </div>
      {runRejected && <div className="alert warn void-run-rejected">Điểm này thuộc lần chạy bị loại{assessment?.rejected_levels.length ? ` (mức vi phạm: ${assessment.rejected_levels.join(', ')})` : ''}. Bằng chứng lần chạy bị loại vẫn được giữ sau khi huỷ; cần ghi rõ lý do.</div>}
      <div className="field">
        <label htmlFor="voidKindInput">Loại huỷ</label>
        <select id="voidKindInput" aria-label="Loại huỷ điểm QC" value={voidKind}
          onChange={(e) => { const k = e.target.value as VoidKind; setVoidKind(k); setVoidOpenNce(voidNceChoice(k).openNce); }}>
          <option value="analytical">Kết quả QC thực tế không hợp lệ</option>
          <option value="data-entry">Nhập sai dữ liệu</option>
          <option value="other">Lý do khác</option>
        </select>
      </div>
      <div className="void-nce-choice">
        <label><input type="checkbox" checked={voidChoice.forced ? voidChoice.openNce : voidOpenNce} disabled={voidChoice.forced}
          onChange={(e) => setVoidOpenNce(e.target.checked)} /><span>Lập hồ sơ NCE và yêu cầu chạy lại QC</span></label>
      </div>
      <div className="field">
        <label htmlFor="voidReasonInput">{reasonMin ? `Lý do huỷ (bắt buộc, tối thiểu ${reasonMin} ký tự)` : 'Ghi chú / bằng chứng (khuyến nghị)'}</label>
        <textarea id="voidReasonInput" autoFocus value={voidReason} aria-invalid={!!voidErr || undefined} aria-describedby={voidErr ? 'void-reason-error' : undefined} onChange={(e) => { setVoidReason(e.target.value); setVoidErr(null); }} rows={3}
          placeholder="VD: Máy báo lỗi hút mẫu lúc 08:15, đã ghi nhận trong sổ bảo trì..." />
        {voidErr && <p id="void-reason-error" className="field-error" role="alert">{voidErr}</p>}
      </div>
    </Modal>
  );
}
