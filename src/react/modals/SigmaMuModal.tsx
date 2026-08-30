import { useState } from 'react';
import { getKernel } from '../state/kernel';
import { closeModal } from '../dialogs/modal-store';
import { dateBoxHtml } from '../bridge/sigmaBridge';

type MuRow = { level: number | string; uCal: string; uCalBasis: string; muBiasMode: string };
type MuPeriod = { id: string; label: string };
type MuPreview = { uc: number; U: number; complete: boolean; missing: string[] } | null;

export type SigmaMuModel = {
  eid: string;
  sourceLabel: string;
  rows: MuRow[];
  periodIds: string[];
  periods: MuPeriod[];
  reviewedBy: string;
  reviewedDate: string;
  modelNoteHtml: string;
};

export function SigmaMuModal({ eid, sourceLabel, rows: initialRows, periodIds: initialPeriodIds, periods, reviewedBy: initialReviewedBy, reviewedDate, modelNoteHtml }: SigmaMuModel) {
  const [rows, setRows] = useState<MuRow[]>(initialRows);
  const [periodIds, setPeriodIds] = useState<string[]>(initialPeriodIds);
  const [reviewedBy, setReviewedBy] = useState(initialReviewedBy);
  const fmt = (n: number) => getKernel().pres.fmt(n, 2);

  const updateRow = (level: MuRow['level'], field: 'uCal' | 'uCalBasis' | 'muBiasMode', value: string) =>
    setRows(rs => rs.map(r => (r.level === level ? { ...r, [field]: value } : r)));
  const togglePeriod = (id: string, checked: boolean) =>
    setPeriodIds(ids => (checked ? [...ids, id] : ids.filter(x => x !== id)));

  const apply = () => {
    const dateEl = document.getElementById('sgMuDate') as HTMLInputElement | null;
    getKernel().sigma.sgMuApply(eid, periodIds, rows, reviewedBy, dateEl?.value ?? reviewedDate);
  };

  return (
    <div className="modal sg-eqa-modal sg-mu-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h"><h3 id="modalTitle">Ngân sách độ không đảm bảo đo (MU)</h3><button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={closeModal}>✕</button></div>
      <div className="modal-b">
        <div className="sg-mu-intro"><div><b>Nhập thông tin theo từng mức QC</b></div><span className="tag none">Kỳ gốc: {sourceLabel}</span></div>
        <div className="sg-eqa-table-wrap">
          <table className="sg-eqa-table sg-mu-table">
            <thead><tr><th>Mức QC</th><th>u(cal) từ CoA</th><th>Nguồn / mã CoA</th><th>Xử lý u(bias)</th><th>MU dự kiến</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const mu = getKernel().sigma.sgMuPreview(eid, r.level, rows) as MuPreview;
                return (
                  <tr className="sg-mu-row" key={r.level}>
                    <td><b>Mức {r.level}</b></td>
                    <td>
                      <div className="sg-mu-number-field">
                        <input type="number" step="any" min="0" aria-label={`u(cal) phần trăm cho mức ${r.level}`} value={r.uCal} placeholder="0,00" onChange={e => updateRow(r.level, 'uCal', e.target.value)} />
                        <span aria-hidden="true">%</span>
                      </div>
                    </td>
                    <td><input type="text" aria-label={`Nguồn CoA của u(cal) cho mức ${r.level}`} value={r.uCalBasis} placeholder="VD: CoA lô 1234, mục U(k=2)" onChange={e => updateRow(r.level, 'uCalBasis', e.target.value)} /></td>
                    <td>
                      <select aria-label={`Cách xử lý độ chệch cho mức ${r.level}`} value={r.muBiasMode} onChange={e => updateRow(r.level, 'muBiasMode', e.target.value)}>
                        <option value="include">Cộng u(bias)</option>
                        <option value="exclude">Đã hiệu chỉnh — không cộng</option>
                      </select>
                    </td>
                    <td className="sg-mu-preview">
                      {mu ? (
                        <>
                          <div className="sg-mu-preview-values"><span><small>u<sub>c</sub></small><b>{fmt(mu.uc)}%</b></span><span className="is-u"><small>U (k=2)</small><b>{fmt(mu.U)}%</b></span></div>
                          <div className={`sg-mu-preview-state ${mu.complete ? 'ok' : 'warn'}`}>{mu.complete ? 'Đủ thành phần' : `Thiếu ${mu.missing.join(', ')}`}</div>
                        </>
                      ) : <div className="sg-mu-preview-empty">Chưa có CV IQC</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="alert info" style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: modelNoteHtml }} />
        <div className="sg-mu-section-title"><b>Thông tin rà soát</b></div>
        <div className="sg-setup-fields">
          <div><label htmlFor="sgMuBy">Người rà soát</label><input id="sgMuBy" value={reviewedBy} placeholder="Họ tên người rà soát ngân sách MU" onChange={e => setReviewedBy(e.target.value)} /></div>
          <div><label htmlFor="sgMuDate">Ngày rà soát</label><span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: dateBoxHtml('sgMuDate', reviewedDate, '', '') }} /></div>
        </div>
        <div className="sg-eqa-period-wrap sg-mu-period-wrap">
          <div className="sg-eqa-period-head">
            <div><b>Kỳ áp dụng</b></div>
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
        <button type="button" className="btn teal" onClick={apply}>Áp dụng ngân sách MU</button>
      </div>
    </div>
  );
}
