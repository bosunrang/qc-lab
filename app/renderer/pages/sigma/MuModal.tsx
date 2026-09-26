// Hộp thoại ngân sách độ không đảm bảo đo (MU) của trang Six Sigma.
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { uncertaintyBudget } from '../../../main/domain/sigma-metrics';
import type { SigmaLevelResult } from '../../../shared/qc-api';

export function MuModal({ level, onClose, onSubmit }: {
  level: SigmaLevelResult; onClose: () => void;
  onSubmit: (uCref: number | undefined, uCal: number | undefined, muBiasMode: 'include' | 'exclude') => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [uCref, setUCref] = useState(level.uCref != null ? String(level.uCref) : '');
  const [uCal, setUCal] = useState(level.uCal != null ? String(level.uCal) : '');
  const [includeBias, setIncludeBias] = useState(level.muBiasMode ? level.muBiasMode !== 'exclude' : level.mu?.includeBias !== false);
  const [err, setErr] = useState<string | null>(null);
  const preview = uncertaintyBudget({ cv: level.cv, bias: level.biasEqa, uCref, uCal, includeBias, tea: level.tea, target: level.targetMean });

  async function submit() {
    const result = await onSubmit(uCref === '' ? undefined : Number(uCref), uCal === '' ? undefined : Number(uCal), includeBias ? 'include' : 'exclude');
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title="Ngân sách độ không đảm bảo đo (MU)" onClose={onClose} size="lg" className="sg-mu-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng ngân sách MU</button></>}>
      {err && <p className="field-error">{err}</p>}
      <table className="sg-mu-detail-table">
        <thead><tr><th>Thành phần</th><th>Giá trị</th></tr></thead>
        <tbody>
          <tr><td>u(Rw) — từ CV%</td><td>{level.cv != null ? level.cv.toFixed(3) : <span className="tag warn">Chưa có</span>}</td></tr>
          <tr><td>Bias quan sát (RMS các vòng EQA)</td><td>{level.biasEqa != null ? Math.abs(level.biasEqa).toFixed(3) : <span className="tag warn">Chưa có</span>}</td></tr>
          <tr><td>u(Cref)% — giá trị gán EQA/CRM</td><td>{preview?.uCref != null ? preview.uCref.toFixed(3) : <span className="tag warn">Chưa đánh giá / không áp dụng</span>}</td></tr>
          <tr><td>u(bias)% = √(bias² + u(Cref)²)</td><td>{preview?.uBias != null ? preview.uBias.toFixed(3) : <span className="tag warn">Chưa có / không áp dụng</span>}</td></tr>
          <tr><td>u(cal)%</td><td>{preview?.uCal != null ? preview.uCal.toFixed(3) : <span className="tag warn">Chưa đánh giá</span>}</td></tr>
        </tbody>
      </table>
      <label className="sg-mu-bias-toggle">
        <input type="checkbox" checked={includeBias} onChange={(e) => setIncludeBias(e.target.checked)} /> Đưa u(bias) vào ngân sách
      </label>
      <div className="field"><label>u(Cref) % — độ không đảm bảo của giá trị gán, từ báo cáo EQA/chứng chỉ CRM</label><input type="number" step="0.001" min="0" value={uCref} onChange={(e) => setUCref(e.target.value)} /></div>
      <details className="alert info sg-mu-help">
        <summary>Hướng dẫn xác định u(Cref)</summary>
        <p>Nhập độ không đảm bảo chuẩn theo %. Nếu chứng chỉ cho độ không đảm bảo mở rộng U, tính u = U/k với hệ số phủ k trên chứng chỉ; chỉ chia 2 khi k = 2. Nếu u ở đơn vị nồng độ, đổi u% = 100 × u / |giá trị tham chiếu|. Áp dụng cách quy đổi này cho cả u(Cref) và u(cal); không chia lại nếu tài liệu đã cho u chuẩn. Không suy u(Cref) từ độ phân tán các vòng bias{level.biasSem != null ? ` (SEM hiện ${level.biasSem.toFixed(3)}%, chỉ tham khảo)` : ''}. Bỏ trống là chưa đánh giá, không phải 0.</p>
        <p>Mô hình có/không cộng bias phải được người phụ trách phê duyệt; bỏ bias cần chứng cứ xử lý/hiệu chỉnh và tránh tính trùng thành phần.</p>
      </details>
      <div className="field"><label>u(cal)% chuẩn — từ CoA hiệu chuẩn (0 là kết luận hợp lệ, khác với bỏ trống)</label><input type="number" step="0.001" min="0" value={uCal} onChange={(e) => setUCal(e.target.value)} /></div>
      {preview && (
        <p className="sg-mu-preview">
          {preview.complete ? 'Dự tính' : 'Tạm tính chưa đầy đủ'}: u_c = {preview.uc.toFixed(3)}% · U (k=2) = {preview.U.toFixed(3)}%
          {!preview.complete && <span className="field-error sg-mu-incomplete">Thiếu: {preview.missing.join(', ')} — không dùng để kết luận đạt TEa.</span>}
        </p>
      )}
    </Modal>
  );
}
