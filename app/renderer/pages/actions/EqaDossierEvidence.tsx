import type { EqaNceEvidence, NceDossierView } from '../../../shared/qc-api';
import { EqaEvidenceContent } from '../eqa/EqaCorrectiveEvidence';

export function EqaDossierEvidence({ dossier }: { dossier: NceDossierView }) {
  if (!dossier.record.eqa_result_id) return null;
  let saved: EqaNceEvidence | null = null;
  try { saved = JSON.parse(dossier.record.eqa_snapshot_json) as EqaNceEvidence; } catch { /* Hồ sơ thiếu ảnh chụp không được thay bằng số liệu của báo cáo mới. */ }
  if (!saved?.round?.id || !saved?.result?.id) saved = null;
  const followup = dossier.eqa_followup;
  return <section className="panel" aria-label="Căn cứ hồ sơ ngoại kiểm">
    <div className="panel-head"><h2>Căn cứ ngoại kiểm</h2><span className="tag none">Đã chụp khi lập hồ sơ</span></div>
    <div className="nce-section-body">
      {saved ? <details className="eqa-details"><summary>{saved.round.program_name} · {saved.round.round}/{saved.round.year} · {saved.result.test_name} · Mẫu {saved.result.sample || '—'}</summary><EqaEvidenceContent evidence={saved} /></details> : <p className="alert rej">Không đọc được căn cứ đã lưu. Không dùng số liệu hiện tại để thay thế.</p>}
      {followup && <details className="eqa-details"><summary>Đối chiếu hiệu lực với đợt kế tiếp</summary>
        {followup.missing.length ? <ul className="eqa-list">{followup.missing.map(s => <li key={s}>{s}</li>)}</ul> : <p className="eqa-note">Đã có đợt kế tiếp chấp nhận và dữ liệu nội kiểm cùng ngày không còn tín hiệu. Người có thẩm quyền vẫn cần ghi đánh giá hiệu lực và duyệt độc lập.</p>}
        {followup.evidence && <EqaEvidenceContent evidence={followup.evidence} />}
      </details>}
    </div>
  </section>;
}
