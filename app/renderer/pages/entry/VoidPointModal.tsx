// Hộp thoại huỷ điểm QC. Tự giữ trạng thái form (loại huỷ, lý do, có mở NCE
// không): trước khi tách (2026-09-26), mỗi ký tự gõ vào ô lý do làm vẽ lại cả
// bảng nhập 31 ngày và mọi biểu đồ của trang.
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useEntryStore } from '../../store/entry-store';
import { voidNceChoice, voidReasonMinimum, type VoidKind } from '../../../main/domain/entry-validation';
import { formatQcValue, vnDate } from './shared';
import type { QcPointView } from '../../../shared/qc-api';
import { AsyncButton } from '../../components/AsyncButton';

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
  const voidChoice = voidNceChoice(voidKind);
  // Điểm thuộc lần chạy bị loại cần lý do với mọi loại huỷ (N4); main kiểm lại.
  const runRejected = point.verdict === 'rej' || (point.runRejectedBy?.length ?? 0) > 0;
  const reasonMin = voidReasonMinimum(voidKind, runRejected);

  async function submitVoid() {
    if (voidReason.trim().length < reasonMin) { setVoidErr(`Cần ghi lý do huỷ tối thiểu ${reasonMin} ký tự.`); return; }
    const openNce = voidChoice.forced ? voidChoice.openNce : voidOpenNce;
    const result = await voidPoint(point.id, voidReason.trim(), voidKind, openNce);
    if (!result.ok) { setVoidErr(result.error.message); return; }
    const followup = result.data.nceId
      ? (result.data.reusedAction ? ' Đã giữ liên kết với hồ sơ NCE đang mở.' : ` Đã mở hồ sơ ${result.data.nceId} để tiếp tục điều tra.`)
      : ' Không yêu cầu NCE/QC chạy lại.';
    onVoided(`Đã huỷ điểm QC ngày ${vnDate(point.date)}. Điểm không còn tham gia tính toán.${followup}`);
  }

  return (
    <Modal title="Huỷ điểm QC" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><AsyncButton className="btn danger" onClick={submitVoid}>Huỷ điểm này</AsyncButton></>}>
      <div className="hint">Ngày {vnDate(point.date)} · Mức {point.level} · Giá trị {formatQcValue(point.val, decimals)}</div>
      {runRejected && <div className="alert warn">Điểm này thuộc lần chạy bị loại{point.rules.length ? ` (luật ${point.rules.join(', ')})` : ''}. Bằng chứng lần chạy bị loại vẫn được giữ sau khi huỷ; cần ghi rõ lý do.</div>}
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
          onChange={(e) => setVoidOpenNce(e.target.checked)} /> Lập hồ sơ NCE và yêu cầu chạy lại QC</label>
        <div className="hint">{voidKind === 'analytical'
          ? 'Hệ thống sẽ lập hồ sơ NCE mới, hoặc dùng lại hồ sơ đang mở của điểm này, rồi chờ một kết quả QC chạy lại được chấp nhận.'
          : voidKind === 'data-entry' ? 'Chỉ lưu dấu vết huỷ; không mở NCE và không yêu cầu chạy lại QC.'
          : 'Chọn mục này nếu sự việc cần điều tra và xác nhận QC chạy lại.'}</div>
      </div>
      <div className="field">
        <label htmlFor="voidReasonInput">{reasonMin ? `Lý do huỷ (bắt buộc, tối thiểu ${reasonMin} ký tự)` : 'Ghi chú / bằng chứng (khuyến nghị)'}</label>
        <textarea id="voidReasonInput" autoFocus value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3}
          placeholder="VD: Máy báo lỗi hút mẫu lúc 08:15, đã ghi nhận trong sổ bảo trì..." />
        {voidErr && <p className="field-error" role="alert">{voidErr}</p>}
      </div>
    </Modal>
  );
}
