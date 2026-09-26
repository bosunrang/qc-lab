// Hộp thoại thiết lập dải PXN / hoàn dải nhà sản xuất. Tự giữ trạng thái
// form (lý do, cách áp dụng, Mean/SD chỉnh tay, cổng an toàn) để gõ vào đây
// không vẽ lại bảng nhập và biểu đồ của trang.
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { reauthDialog } from '../../state/dialog-store';
import { useEntryStore } from '../../store/entry-store';
import type { RangeCandidateView } from '../../../shared/qc-api';

export type RangeMode = 'apply' | 'revert';

export function RangeWorkflowModal({ mode, testId, testName, rangeCandidate, decimals, onClose, onApplied }: {
  mode: RangeMode;
  testId: string;
  testName: string;
  rangeCandidate: RangeCandidateView;
  decimals: number;
  onClose: () => void;
  /** Gọi sau khi main đã đổi Mean/SD, để trang nạp lại mức và dữ liệu. */
  onApplied: () => Promise<void>;
}) {
  const applyLabRange = useEntryStore((s) => s.applyLabRange);
  const revertManufacturerRange = useEntryStore((s) => s.revertManufacturerRange);
  const proposed = rangeCandidate.proposed;
  const [rangeReason, setRangeReason] = useState('');
  const [rangeSubmitError, setRangeSubmitError] = useState<string | null>(null);
  const [rangeCauseConfirmed, setRangeCauseConfirmed] = useState(false);
  const [rangeBias, setRangeBias] = useState('');
  const [rangeSelection, setRangeSelection] = useState<'proposed' | 'manual'>('proposed');
  const [rangeManualMean, setRangeManualMean] = useState(() => (proposed ? proposed.mean.toFixed(decimals) : ''));
  const [rangeManualSd, setRangeManualSd] = useState(() => (proposed ? proposed.sd.toFixed(4) : ''));

  async function submitRangeWorkflow() {
    const minimum = mode === 'apply' ? 10 : 5;
    if (rangeReason.trim().length < minimum) { setRangeSubmitError(`Cần ghi lý do tối thiểu ${minimum} ký tự.`); return; }
    const manual = mode === 'apply' && rangeSelection === 'manual';
    const manualMean = Number(rangeManualMean), manualSd = Number(rangeManualSd);
    if (manual && (!rangeManualMean.trim() || !rangeManualSd.trim() || !Number.isFinite(manualMean) || !Number.isFinite(manualSd) || manualSd <= 0)) {
      setRangeSubmitError('Nhập Mean hợp lệ và SD lớn hơn 0.'); return;
    }
    const verified = await reauthDialog({ title: 'Xác thực thay đổi dải QC', message: 'Nhập lại mật khẩu để xác nhận thay đổi Mean/SD đang dùng.' });
    if (!verified) return;
    const level = rangeCandidate.level;
    const result = mode === 'apply'
      ? await applyLabRange(testId, level, rangeReason.trim(), rangeCauseConfirmed, rangeBias === '' ? undefined : Number(rangeBias), manual ? manualMean : undefined, manual ? manualSd : undefined)
      : await revertManufacturerRange(testId, level, rangeReason.trim());
    if (!result.ok) { setRangeSubmitError(result.error.message); return; }
    await onApplied();
    onClose();
  }

  return (
    <Modal title={mode === 'apply' ? 'Thiết lập dải QC mới' : 'Hoàn dải QC nhà sản xuất'} onClose={onClose} size="lg" className="range-workflow-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Đóng</button><button className={`btn ${mode === 'apply' ? 'teal' : 'danger'}`} disabled={mode === 'apply' && !rangeCandidate.eligible} onClick={submitRangeWorkflow}>{mode === 'apply' ? (rangeSelection === 'manual' ? 'Áp dụng dải chỉnh tay' : 'Áp dụng dải đề xuất') : 'Hoàn dải'}</button></>}>
      {mode === 'apply' && proposed && (
        <>
          <p className="range-workflow-meta">{testName || 'Xét nghiệm'} · Mức {rangeCandidate.level}{rangeCandidate.lot ? ` · Lô ${rangeCandidate.lot}` : ''}</p>
          <section className="range-workflow-table-section" aria-labelledby="range-conditions-title">
            <h3 id="range-conditions-title">Điều kiện</h3>
            <div className="range-workflow-table-wrap"><table className="range-workflow-table">
              <thead><tr><th>Điều kiện</th><th>Hiện tại</th><th>Chuẩn kiểm tra</th><th>Kết quả</th></tr></thead>
              <tbody>
                <tr><td>Tổng số kết quả</td><td><b>{proposed.n}</b></td><td>≥20</td><td><span className={`tag ${proposed.n >= 20 ? 'ok' : 'rej'}`}>{proposed.n >= 20 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                <tr><td>Số ngày độc lập</td><td><b>{proposed.days}</b></td><td>≥20 ngày</td><td><span className={`tag ${proposed.days >= 20 ? 'ok' : 'rej'}`}>{proposed.days >= 20 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                <tr><td>Điểm thuộc lần chạy bị loại</td><td><b>{proposed.rejected}</b></td><td>Phải bằng 0</td><td><span className={`tag ${proposed.rejected === 0 ? 'ok' : 'rej'}`}>{proposed.rejected === 0 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                <tr><td>Cảnh báo 1-2s</td><td><b>{proposed.warnings}</b></td><td>Thông tin, không chặn</td><td>{proposed.warnings ? <span className="tag warn">Theo dõi</span> : <span className="tag none">Không có</span>}</td></tr>
                <tr><td>SD đề xuất hợp lệ</td><td><b>{proposed.sd.toFixed(4)}</b></td><td>&gt;0</td><td><span className={`tag ${proposed.sd > 0 ? 'ok' : 'rej'}`}>{proposed.sd > 0 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
              </tbody>
            </table></div>
          </section>
          <section className="range-workflow-table-section" aria-labelledby="range-comparison-title">
            <h3 id="range-comparison-title">So sánh dải kiểm soát</h3>
            <div className="range-workflow-table-wrap"><table className="range-workflow-table range-comparison-table">
              <thead><tr><th>Dải</th><th>Mean</th><th>SD</th><th>CV%</th><th>±2SD</th></tr></thead>
              <tbody>
                <tr><td>Đang dùng ({rangeCandidate.source === 'lab' ? 'PXN' : 'NSX'})</td><td><b>{rangeCandidate.current.mean?.toFixed(decimals) ?? '—'}</b></td><td><b>{rangeCandidate.current.sd?.toFixed(4) ?? '—'}</b></td><td><b>{rangeCandidate.current.cv?.toFixed(2) ?? '—'}</b></td><td>{rangeCandidate.current.mean != null && rangeCandidate.current.sd != null ? `${(rangeCandidate.current.mean - 2 * rangeCandidate.current.sd).toFixed(decimals)} – ${(rangeCandidate.current.mean + 2 * rangeCandidate.current.sd).toFixed(decimals)}` : '—'}</td></tr>
                <tr className="range-proposed-row"><td><b>Đề xuất PXN</b></td><td><b>{proposed.mean.toFixed(decimals)}</b></td><td><b>{proposed.sd.toFixed(4)}</b></td><td><b>{proposed.cv.toFixed(2)}</b></td><td><b>{(proposed.mean - 2 * proposed.sd).toFixed(decimals)} – {(proposed.mean + 2 * proposed.sd).toFixed(decimals)}</b></td></tr>
              </tbody>
            </table></div>
          </section>
          <div className="range-workflow-note">Mean/SD đề xuất được tính trên toàn bộ tập dữ liệu đang xét; hệ thống không tự loại điểm để làm đẹp SD.</div>
          <div className="range-apply-choice" role="group" aria-label="Chọn cách áp dụng dải">
            <span>Giá trị áp dụng</span>
            <div className="dayseg"><button type="button" className={rangeSelection === 'proposed' ? 'on' : ''} aria-pressed={rangeSelection === 'proposed'} onClick={() => setRangeSelection('proposed')}>Dải đề xuất</button><button type="button" className={rangeSelection === 'manual' ? 'on' : ''} aria-pressed={rangeSelection === 'manual'} onClick={() => setRangeSelection('manual')}>Chỉnh thủ công</button></div>
          </div>
          {rangeSelection === 'manual' && <div className="range-manual-fields">
            <label className="field"><span>Mean chốt <b>*</b></span><input aria-label="Mean chốt thủ công" type="number" inputMode="decimal" step="any" value={rangeManualMean} onChange={(e) => setRangeManualMean(e.target.value)} /></label>
            <label className="field"><span>SD chốt <b>*</b></span><input aria-label="SD chốt thủ công" type="number" inputMode="decimal" min="0" step="any" value={rangeManualSd} onChange={(e) => setRangeManualSd(e.target.value)} /></label>
          </div>}
          {rangeCandidate.safety.needed && (
            <div className="alert warn range-safety-gate">
              <b>Cổng an toàn sai số hệ thống {rangeCandidate.safety.nceId ? `· ${rangeCandidate.safety.nceId}` : ''}</b>
              <label><input type="checkbox" checked={rangeCauseConfirmed} onChange={(e) => setRangeCauseConfirmed(e.target.checked)} /> Đã xác nhận và xử lý nguyên nhân hệ thống</label>
              <label className="field"><span>Bias đo được (%) · yêu cầu trong ±{rangeCandidate.safety.biasThreshold?.toFixed(2) ?? '—'}% (TEa/4)</span><input type="number" step="any" value={rangeBias} onChange={(e) => setRangeBias(e.target.value)} /></label>
            </div>
          )}
        </>
      )}
      {mode === 'revert' && <p>Khôi phục Mean={rangeCandidate.manufacturer.mean?.toFixed(decimals) ?? '—'} và SD={rangeCandidate.manufacturer.sd?.toFixed(4) ?? '—'} của nhà sản xuất.</p>}
      <label className="field"><span>Lý do <b>*</b></span><textarea rows={3} value={rangeReason} onChange={(e) => setRangeReason(e.target.value)} placeholder={mode === 'apply' ? 'Tối thiểu 10 ký tự' : 'Tối thiểu 5 ký tự'} /></label>
      {rangeSubmitError && <div className="alert warn">{rangeSubmitError}</div>}
    </Modal>
  );
}
