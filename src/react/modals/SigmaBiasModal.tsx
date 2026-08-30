import { useState } from 'react';
import { getKernel } from '../state/kernel';
import { closeModal } from '../dialogs/modal-store';

type BiasRound = { lab: string; target: string };
type BiasPeriod = { id: string; label: string };

export type SigmaBiasModel = {
  eid: string;
  level: number | string;
  periodIds: string[];
  rounds: BiasRound[];
  periods: BiasPeriod[];
};

function roundBias(round: BiasRound): number | null {
  const lab = parseFloat(round.lab), target = parseFloat(round.target);
  return Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? (lab - target) / Math.abs(target) * 100 : null;
}

export function SigmaBiasModal({ level, periodIds: initialPeriodIds, rounds: initialRounds, periods }: SigmaBiasModel) {
  const [rounds, setRounds] = useState<BiasRound[]>(initialRounds.length ? initialRounds : [{ lab: '', target: '' }]);
  const [periodIds, setPeriodIds] = useState<string[]>(initialPeriodIds);

  const stats = getKernel().sigma.sgBiasStats(rounds) as { valid: { bias: number }[]; signedMean: number | null; rms: number | null };
  const mixedSigns = stats.valid.some(r => r.bias < 0) && stats.valid.some(r => r.bias > 0);
  const fmt = (n: number) => getKernel().pres.fmt(n, 2);

  const updateRound = (i: number, field: 'lab' | 'target', value: string) =>
    setRounds(rs => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRound = () => setRounds(rs => [...rs, { lab: '', target: '' }]);
  const delRound = (i: number) =>
    setRounds(rs => { const next = rs.filter((_, idx) => idx !== i); return next.length ? next : [{ lab: '', target: '' }]; });
  const togglePeriod = (id: string, checked: boolean) =>
    setPeriodIds(ids => (checked ? [...ids, id] : ids.filter(x => x !== id)));

  const apply = () => { getKernel().sigma.sgBiasApply(level, periodIds, rounds); };

  return (
    <div className="modal sg-eqa-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h"><h3 id="modalTitle">Tính Bias% từ EQA/EQC — Mức {level}</h3><button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={closeModal}>✕</button></div>
      <div className="modal-b">
        <div className="sg-eqa-table-wrap">
          <table className="sg-eqa-table">
            <thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {rounds.map((r, i) => {
                const bias = roundBias(r);
                return (
                  <tr className="sg-eqa-row" key={i}>
                    <td className="sg-eqa-index">{i + 1}</td>
                    <td><input type="number" step="any" value={r.lab} placeholder="—" onChange={e => updateRound(i, 'lab', e.target.value)} /></td>
                    <td><input type="number" step="any" value={r.target} placeholder="—" onChange={e => updateRound(i, 'target', e.target.value)} /></td>
                    <td className="sg-eqa-bias" style={{ color: bias != null && Math.abs(bias) > 10 ? 'var(--red)' : 'var(--teal)' }}>{bias == null ? '—' : fmt(bias) + '%'}</td>
                    <td><button type="button" className="btn danger sm sg-eqa-del" title="Xóa vòng" onClick={() => delRound(i)}>Xóa</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn ghost sm sg-eqa-add" onClick={addRound}>+ Thêm vòng</button>
        <div id="sgBiasSummary" className={`sg-eqa-summary alert info${stats.valid.length ? '' : ' is-empty'}`}>
          {stats.valid.length ? (
            <>
              <div><span>Số vòng hợp lệ</span><b>{stats.valid.length}</b></div>
              <div><span>Bias có dấu TB</span><b>{fmt(stats.signedMean as number)}%</b></div>
              <div><span>Bias RMS dùng tính Sigma</span><b className="sg-eqa-average">{fmt(stats.rms as number)}%</b></div>
              {mixedSigns ? <div className="sg-eqa-warning">Bias đổi dấu giữa các vòng — RMS giúp tránh triệt tiêu.</div> : null}
            </>
          ) : <span className="sg-eqa-empty">Chưa có vòng hợp lệ.</span>}
        </div>
        <div className="sg-eqa-period-wrap">
          <div className="sg-eqa-period-head">
            <b>Áp dụng cho kỳ nào?</b>
            <div>
              <button type="button" className="btn ghost sm" onClick={() => setPeriodIds(periods.map(p => p.id))}>Chọn tất cả</button>
              <button type="button" className="btn ghost sm" onClick={() => setPeriodIds([])}>Bỏ chọn</button>
            </div>
          </div>
          <div className="sg-eqa-period-list">
            {periods.map(p => (
              <label className="sg-eqa-period" key={p.id}>
                <input type="checkbox" checked={periodIds.includes(p.id)} onChange={e => togglePeriod(p.id, e.target.checked)} />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={closeModal}>Hủy</button>
        <button type="button" className="btn teal" onClick={apply}>Áp dụng Bias%</button>
      </div>
    </div>
  );
}
