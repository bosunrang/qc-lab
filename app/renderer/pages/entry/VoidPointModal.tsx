// Hộp thoại huỷ điểm QC. Tự giữ trạng thái form (loại huỷ, lý do, có mở NCE
// không): trước khi tách (2026-09-26), mỗi ký tự gõ vào ô lý do làm vẽ lại cả
// bảng nhập 31 ngày và mọi biểu đồ của trang.
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useEntryStore } from '../../store/entry-store';
import { voidNceChoice, type VoidKind } from '../../../main/domain/entry-validation';
import { formatQcValue, vnDate } from './shared';
import type { QcPointView } from '../../../shared/qc-api';

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

  async function submitVoid() {
    if (voidChoice.reasonRequired && voidReason.trim().length < 5) { setVoidErr('Cần ghi lý do hủy tối thiểu 5 ký tự.'); return; }
    const openNce = voidChoice.forced ? voidChoice.openNce : voidOpenNce;
    const result = await voidPoint(point.id, voidReason.trim(), voidKind, openNce);
    if (!result.ok) { setVoidErr(result.error.message); return; }
    const followup = result.data.nceId
      ? (result.data.reusedAction ? ' Đã giữ liên kết với hồ sơ NCE đang mở.' : ` Đã mở hồ sơ ${result.data.nceId} để tiếp tục điều tra.`)
      : ' Không yêu cầu NCE/QC chạy lại.';
    onVoided(`Đã hủy điểm QC ngày ${vnDate(point.date)}. Điểm không còn tham gia tính toán.${followup}`);
  }

  return (
    <Modal title="Hủy điểm QC" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><button className="btn danger" onClick={submitVoid}>Hủy điểm này</button></>}>
      <div className="hint">Ngày {vnDate(point.date)} · Mức {point.level} · Giá trị {formatQcValue(point.val, decimals)}</div>
      <div className="field">
        <label htmlFor="voidKindInput">Loại hủy</label>
        <select id="voidKindInput" aria-label="Loại hủy điểm QC" value={voidKind}
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
          : voidKind === 'data-entry' ? 'Chỉ lưu dấu vết hủy; không mở NCE và không yêu cầu chạy lại QC.'
          : 'Chọn mục này nếu sự việc cần điều tra và xác nhận QC chạy lại.'}</div>
      </div>
      <div className="field">
        <label htmlFor="voidReasonInput">{voidChoice.reasonRequired ? 'Lý do hủy (bắt buộc, tối thiểu 5 ký tự)' : 'Ghi chú / bằng chứng (khuyến nghị)'}</label>
        <textarea id="voidReasonInput" autoFocus value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3}
          placeholder="VD: Máy báo lỗi hút mẫu lúc 08:15, đã ghi nhận trong sổ bảo trì..." />
        {voidErr && <p className="field-error">{voidErr}</p>}
      </div>
    </Modal>
  );
}
