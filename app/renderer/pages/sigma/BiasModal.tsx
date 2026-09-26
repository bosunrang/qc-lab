// Hộp thoại tính Bias% RMS từ các vòng EQA/EQC của trang Six Sigma.
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { RowActionButton } from '../../components/RowActionButton';
import { infoDialog } from '../../state/dialog-store';
import { parseEqaDraft } from '../../lib/sigma-workflow';
import { eqaRoundBias, eqaRoundsStats } from '../../../main/domain/sigma-metrics';
import type { SigmaEqaRound } from '../../../shared/qc-api';

export function BiasModal({ initialRounds, onClose, onSubmit }: {
  initialRounds: SigmaEqaRound[]; onClose: () => void;
  onSubmit: (rounds: Array<{ lab: number; target: number }>) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [rounds, setRounds] = useState(() => initialRounds.length
    ? initialRounds.map((round) => ({ lab: round.lab != null ? String(round.lab) : '', target: round.target != null ? String(round.target) : '' }))
    : [{ lab: '', target: '' }, { lab: '', target: '' }, { lab: '', target: '' }]);
  const { parsedRounds, hasIncompleteRound } = parseEqaDraft(rounds);
  // Xem trước dùng đúng công thức main dùng khi lưu (RMS các vòng, giữ dấu khi chỉ 1 vòng).
  const eqa = eqaRoundsStats(parsedRounds.map((round) => eqaRoundBias(round.lab, round.target)));
  const rms = eqa?.rms ?? 0;
  const mean = eqa?.mean ?? 0;
  const mixedSigns = eqa?.mixedSigns ?? false;

  async function submit() {
    if (hasIncompleteRound) {
      await infoDialog('Mỗi vòng đã nhập cần đủ KQ PXN và Target EQA hợp lệ (Target khác 0).', { title: 'Chưa thể áp dụng Bias%', type: 'warn' });
      return;
    }
    if (!parsedRounds.length) {
      await infoDialog('Nhập ít nhất 1 vòng EQA/EQC.', { title: 'Chưa thể áp dụng Bias%', type: 'warn' });
      return;
    }
    const result = await onSubmit(parsedRounds);
    if (!result.ok) await infoDialog(result.error?.message || 'Lỗi không xác định.', { title: 'Không thể áp dụng Bias%', type: 'warn' });
  }

  return (
    <Modal title="Tính Bias% từ EQA/EQC" onClose={onClose} size="md"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng Bias%</button></>}>
      <div className="sg-eqa-table-wrap">
        <table className="sg-eqa-table">
          <thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th>Thao tác</th></tr></thead>
          <tbody>
            {rounds.map((v, i) => {
                const lab = Number(v.lab), target = Number(v.target);
                const bias = v.lab.trim() !== '' && v.target.trim() !== '' && Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? (lab - target) / Math.abs(target) * 100 : null;
              return (
                <tr key={i}>
                  <td className="sg-eqa-index">{i + 1}</td>
                  <td><input type="number" step="any" value={v.lab} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? { ...x, lab: e.target.value } : x)))} /></td>
                  <td><input type="number" step="any" value={v.target} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} /></td>
                  <td className="sg-eqa-bias" style={{ color: bias != null ? (Math.abs(bias) > 10 ? 'var(--danger-text)' : 'var(--accent)') : undefined }}>{bias != null ? `${bias.toFixed(2)}%` : '—'}</td>
                  <td><RowActionButton kind="delete" label={`Xóa vòng EQA ${i + 1}`} className="sg-eqa-del" onClick={() => setRounds((r) => r.filter((_, j) => j !== i))} disabled={rounds.length <= 1} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn ghost sm sg-eqa-add" onClick={() => setRounds((r) => [...r, { lab: '', target: '' }])}>+ Thêm vòng</button>
      <div className={`sg-eqa-summary${parsedRounds.length ? '' : ' is-empty'}`}>
        {parsedRounds.length ? (
          <>
              <div><span>Số vòng hợp lệ</span><b>{parsedRounds.length}</b></div>
            <div><span>Bias có dấu TB</span><b>{mean.toFixed(3)}</b></div>
            <div><span>Bias RMS dùng tính Sigma</span><b className="sg-eqa-average">{rms.toFixed(3)}</b></div>
            {mixedSigns && <div className="sg-eqa-warning">Bias đổi dấu giữa các vòng — RMS giúp tránh triệt tiêu.</div>}
          </>
        ) : <span className="sg-eqa-empty">Nhập đủ KQ PXN và Target EQA cho ít nhất 1 vòng.</span>}
      </div>
    </Modal>
  );
}
