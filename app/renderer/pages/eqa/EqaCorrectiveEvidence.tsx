import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { EqaCorrectiveRow, EqaNceEvidence } from '../../../shared/qc-api';
import { EmptyState } from '../../components/EmptyState';
import { DateField } from '../../components/DateField';
import { vnDate } from '../../lib/format';
import { ClassTag, Facts, numText, rawNum } from './shared';
import { useEqaRead } from './useEqaRead';
import { useEqaPanelHeight } from './useEqaPanelHeight';

export function EqaEvidenceContent({ evidence, runDateControl }: { evidence: EqaNceEvidence; runDateControl?: ReactNode }) {
  const r = evidence.result;
  const extraReasons = evidence.reasons.filter(reason => reason !== 'Kết quả không chấp nhận' && !reason.startsWith('Cảnh báo đơn lẻ'));
  const points = evidence.iqc_runs.flatMap(run => run.points).filter(point => !point.voided);
  const iqcStatus = !evidence.run_date ? 'Chưa chọn ngày' : !evidence.iqc_runs.length ? 'Chưa có dữ liệu'
    : evidence.iqc_runs.some(run => !run.complete) ? 'Chưa đủ mức'
    : points.some(point => point.verdict === 'rej' || point.verdict === 'warn') ? 'Có tín hiệu'
    : !points.length || points.some(point => point.verdict !== 'ok') ? 'Chưa đủ dữ liệu' : 'Đủ dữ liệu đối chiếu';
  const peerValues = r.peer.map(p => [String(p.n ?? '—'), rawNum(p.mean), rawNum(p.sd), numText(p.cv), numText(p.sdi)]);
  return <div className="eqa-corrective-evidence-content">
    <div><b>{r.test_name}</b><p className="eqa-note">{r.instrument_name} · {evidence.round.round}/{evidence.round.year} · Mẫu {r.sample || '—'}</p></div>
    <div className="eqa-tags"><ClassTag cls={r.class} /></div>
    <dl className="eqa-facts eqa-evidence-metrics">
      <div><dt>Kết quả</dt><dd>{rawNum(r.result)}<small>{r.unit || '—'}</small></dd></div>
      <div><dt>Ấn định</dt><dd>{rawNum(r.assigned)}</dd></div>
      <div><dt>z chính thức</dt><dd>{numText(r.z_official)}</dd></div>
    </dl>
    {(evidence.required || r.class === 'warn') && <p className="eqa-note">{evidence.required ? ['Bắt buộc điều tra', ...extraReasons].join(' · ') : 'Xem xét có cần điều tra.'}</p>}
    {r.assigned_check?.uncertain && <p className="eqa-note">Giá trị ấn định kém chắc chắn · z′ = {numText(r.assigned_check.z_prime)}.</p>}
    <div className="eqa-evidence-disclosures">
      <details className="eqa-details"><summary>Số liệu báo cáo</summary><div className="eqa-evidence-detail-body">
        <Facts items={[[`Đơn vị`, r.unit || '—'], ['σp', rawNum(r.sigma_p)], ['z nhà cung cấp', numText(r.z_provider)], ['Mã báo cáo', evidence.round.report_code || '—'],
          ['Đợt chấp nhận gần nhất', evidence.last_accepted ? `${evidence.last_accepted.round}/${evidence.last_accepted.year}` : 'Chưa có dữ liệu'], ['Ngày báo cáo đợt đạt', evidence.last_accepted ? vnDate(evidence.last_accepted.report_date) : '—']]} />
        <p className="eqa-note">Dùng đợt đạt gần nhất để đối chiếu phạm vi rà soát kết quả bệnh nhân.</p>
      </div></details>
      <details className="eqa-details"><summary>Nhóm so sánh</summary><div className="eqa-evidence-detail-body">
        <Facts items={[[`Phương pháp`, r.method || 'Chưa khai'], ['Nhóm thiết bị', r.peer_group || 'Chưa khai']]} />
        {r.peer.length ? <div className="eqa-table-wrap"><table className="eqa-table eqa-center-rest eqa-evidence-table" aria-label="Thống kê nhóm so sánh"><thead><tr><th>Chỉ số</th>{r.peer.map(p => <th key={p.level}>{p.level === 'all' ? 'Tất cả' : p.level === 'method' ? 'Phương pháp' : 'Thiết bị'}</th>)}</tr></thead>
          <tbody>{['N', 'Mean', 'SD', 'CV (%)', 'SDI'].map((label, index) => <tr key={label}><td>{label}</td>{r.peer.map((p, peerIndex) => <td key={p.level}>{peerValues[peerIndex][index]}</td>)}</tr>)}</tbody>
        </table></div> : <p className="eqa-note">Chưa có thống kê nhóm so sánh.</p>}
      </div></details>
      {evidence.related_results.length > 0 && <details className="eqa-details"><summary>Kết quả liên quan ({evidence.related_results.length})</summary><div className="eqa-evidence-detail-body">
        <div className="eqa-table-wrap"><table className="eqa-table eqa-center-rest eqa-evidence-table" aria-label="Kết quả ngoại kiểm liên quan"><thead><tr><th>Xét nghiệm</th><th>z chính thức</th></tr></thead><tbody>{evidence.related_results.map(p => {
          const context = [p.instrument_id !== r.instrument_id ? p.instrument_name : '', p.sample !== r.sample ? `Mẫu ${p.sample || '—'}` : ''].filter(Boolean).join(' · ');
          return <tr key={p.id}><td>{p.test_name}{context && <span className="eqa-sub">{context}</span>}</td><td>{numText(p.z_official)}</td></tr>;
        })}</tbody></table></div>
      </div></details>}
      <details className="eqa-details"><summary>Nội kiểm · {iqcStatus}</summary><div className="eqa-evidence-detail-body">
        {runDateControl || <Facts items={[[`Ngày chạy mẫu`, evidence.run_date ? vnDate(evidence.run_date) : 'Chưa ghi nhận']]} />}
        {!evidence.iqc_runs.length ? <p className="eqa-note">Chưa có dữ liệu nội kiểm để đối chiếu.</p> : evidence.iqc_runs.map(run => <div key={`${run.date}:${run.run_id}`}>
          <p className="eqa-note">Lần {run.run_id || 'mặc định'} · {run.complete ? 'Đủ mức' : 'Chưa đủ mức'}</p>
          <div className="eqa-table-wrap"><table className="eqa-table eqa-center-rest eqa-evidence-table" aria-label={`Nội kiểm lần ${run.run_id || 'mặc định'}`}><thead><tr><th>Mức / lô</th><th>Kết quả</th><th>Kết luận</th></tr></thead><tbody>{run.points.map((p, i) => <tr key={i}>
            <td>Mức {p.level}<span className="eqa-sub">{p.lot}</span></td><td>{rawNum(p.value)}<span className="eqa-sub">z={numText(p.z)}</span></td>
            <td>{p.voided ? 'Đã huỷ' : p.verdict === 'rej' ? 'Loại bỏ' : p.verdict === 'warn' ? 'Cảnh báo' : p.verdict === 'ok' ? 'Chấp nhận' : 'Chưa đủ dải QC'}{p.rules.length > 0 && <span className="eqa-sub">{p.rules.join(', ')}</span>}</td>
          </tr>)}</tbody></table></div>
        </div>)}
      </div></details>
    </div>
  </div>;
}

export function EqaCorrectiveEvidence({ row, canCreate, onCreate, onClose, panelRef }: { row: EqaCorrectiveRow; canCreate: boolean; onCreate: (evidence: EqaNceEvidence) => void; onClose: () => void; panelRef?: RefObject<HTMLElement | null> }) {
  const ownPanelRef = useRef<HTMLElement>(null);
  const inspectorRef = panelRef ?? ownPanelRef;
  const maxHeight = useEqaPanelHeight(inspectorRef);
  const [runDate, setRunDate] = useState<string | undefined>(undefined);
  const read = useCallback(() => row.evidence ? Promise.resolve(row.evidence) : window.qcApi.getEqaCorrectiveEvidence({ resultId: row.result.id, ...(runDate !== undefined ? { runDate } : {}) }), [row.evidence, row.result.id, runDate]);
  const view = useEqaRead(`${row.result.id}:${row.fingerprint}:${runDate}`, read);
  // Đổi ngày chạy chỉ đọc lại nội kiểm: giữ căn cứ cũ trên màn hình trong lúc tải
  // để ô ngày không bị gỡ và mất tiêu điểm; nút lập hồ sơ vẫn chờ căn cứ mới.
  const lastData = useRef(view.data);
  if (view.data) lastData.current = view.data;
  const shown = view.data ?? (runDate !== undefined ? lastData.current : undefined);
  return <section ref={inspectorRef} className="panel eqa-corrective-inspector" aria-label="Căn cứ khắc phục ngoại kiểm" style={maxHeight === undefined ? undefined : { maxHeight }}>
    <div className="panel-head"><h2>Căn cứ điều tra</h2><div className="eqa-intro-actions">{!row.record && canCreate && <button type="button" className="btn ghost sm" disabled={!view.data || !!view.error} onClick={() => { if (view.data) onCreate(view.data); }}>Lập hồ sơ</button>}<button type="button" className="btn ghost sm" aria-label="Đóng căn cứ điều tra" onClick={onClose}>Đóng</button></div></div>
    <div className="eqa-section-body" role="region" aria-label="Nội dung căn cứ điều tra" tabIndex={0}>
      {view.error ? <EmptyState size="compact" title="Không tải được căn cứ" action={<button className="btn ghost sm" onClick={view.retry}>Thử lại</button>}>{view.error}</EmptyState>
        : !shown ? <EmptyState size="compact" title="Đang tải căn cứ…" /> : <>
          {!row.current && <p className="alert warn">Báo cáo nguồn đã thay đổi. Đây là căn cứ được lưu khi lập hồ sơ.</p>}
          <EqaEvidenceContent evidence={shown} runDateControl={!row.record ? <DateField label="Ngày chạy mẫu" value={runDate ?? shown.run_date} onChange={setRunDate} /> : undefined} />
        </>}
    </div>
  </section>;
}
