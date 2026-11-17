// Trang một hồ sơ NCE: đầu trang (mã, trạng thái, bước tiếp theo và những gì
// còn thiếu do main tính), rồi các phần theo thứ tự quy trình. Mỗi phần chỉ
// mở form khi người đang xem được phép (`dossier.can`).
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNceStore } from '../../store/nce-store';
import { EmptyState } from '../../components/EmptyState';
import { nceStatusBadge } from '../../lib/nce-labels';
import { NCE_SOURCE_LABEL, NCE_TIER_LABEL } from '../../../main/domain/nce/labels';
import { IdentitySection, QuickCheckSection } from './DossierContent';
import { PatientImpactSection, ReleaseSection, TechnicalAssessmentSection } from './DossierDecisions';
import { CapaWorkflow } from './CapaWorkflow';
import { EqaDossierEvidence } from './EqaDossierEvidence';
import { ReviewSection } from './DossierReview';
import { dateText, Facts, holdText, Section, timeText, useDossier } from './shared';
import { confirmDialog, errorDialog } from '../../state/dialog-store';
import { nextStage, NCE_STAGES, stageForMissing, type NceStage } from './workflow';

function LegacySection({ json }: { json: string }) {
  let detail: Record<string, unknown> = {};
  try { detail = JSON.parse((JSON.parse(json || '{}') as { detail_json?: string }).detail_json || '{}'); } catch { /* dữ liệu cũ hỏng: hiện phần còn đọc được */ }
  const text = (key: string) => String(detail[key] ?? '');
  return (
    <Section title="Dữ liệu hồ sơ phiên bản cũ">
      <p className="nce-note">Hồ sơ được chuyển từ phiên bản cũ. Các mục dưới đây là dữ liệu gốc, chỉ để tra cứu; nội dung mới ghi ở các phần trên.</p>
      <Facts items={[
        ['Người phụ trách (ghi tay)', text('owner')], ['Nguyên nhân', text('cause') || text('causeDescription')], ['Hành động khắc phục', text('action')],
        ['Cho phép trở lại', [text('releaseStatus') || text('releaseDecision'), text('releaseBy'), text('releaseNote')].filter(Boolean).join(' · ')],
        ['Ảnh hưởng bệnh nhân', [text('patientImpact'), text('patientAction')].filter(Boolean).join(' · ')],
        ['Hiệu lực', [text('effectivenessStatus'), text('effectivenessNote')].filter(Boolean).join(' · ')],
        ['Người duyệt', [text('approvedBy'), text('approvedAt')].filter(Boolean).join(' · ')],
      ]} />
    </Section>
  );
}

export function DossierPage({ id, onBack }: { id: string; onBack: () => void }) {
  const users = useNceStore(useShallow((s) => s.users));
  const { dossier, error, busy, pending, loading, reload, run, clearError } = useDossier(id);
  const [selectedStage, setSelectedStage] = useState<NceStage | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const workspace = useRef<HTMLDivElement>(null);
  const status = dossier?.record.status;

  // Chuyển bước sau một quyết định thành công; khi chờ duyệt, mở toàn bộ
  // bằng chứng để người duyệt không phải tìm qua từng mục.
  useEffect(() => {
    setSelectedStage(null);
    setShowAll(status === 'pending_approval' || status === 'closed' || status === 'cancelled');
  }, [status]);

  // Lỗi ghi không gắn được với ô là lỗi thao tác: dùng hộp thoại chung thay
  // vì một thanh đỏ nằm xa biểu mẫu. Lỗi tải, stale và chưa rõ kết quả vẫn
  // giữ ở cấp hồ sơ vì cần tải lại/đối chiếu.
  useEffect(() => {
    if (error?.kind !== 'write' || error.stale) return;
    let active = true;
    void errorDialog(error.message, { title: 'Chưa lưu được' }).then(() => { if (active) clearError(); });
    return () => { active = false; };
  }, [error, clearError]);

  if (dossier === undefined) return <div className="panel"><EmptyState size="compact" title={error ? 'Không tải được hồ sơ' : 'Đang tải hồ sơ…'} action={error && <button type="button" className="btn ghost" disabled={loading} onClick={() => void reload()}>{loading ? 'Đang thử lại…' : 'Thử lại'}</button>}>{error?.message}</EmptyState></div>;
  if (dossier === null) {
    return <div className="panel"><EmptyState title="Không tìm thấy hồ sơ" action={<button type="button" className="btn ghost" onClick={onBack}>Về danh sách</button>}>Hồ sơ có thể đã được phục hồi từ bản sao lưu khác.</EmptyState></div>;
  }
  const { record, missing } = dossier;
  const badge = nceStatusBadge(record);
  const props = { dossier, users, busy, pending, run, error, onIdentity: () => openStage('identity') };
  const terminal = record.status === 'closed' || record.status === 'cancelled';
  const currentStage = nextStage(record, missing);
  const activeStage = selectedStage ?? currentStage;

  // Chỉ hiển thị trạng thái đã được main xác định; không suy đoán một bước
  // đã hoàn tất chỉ từ vị trí của nó trong thanh điều hướng.
  const missingByStage = new Map<NceStage, typeof missing>();
  for (const item of missing) {
    const stage = stageForMissing(item);
    missingByStage.set(stage, [...(missingByStage.get(stage) ?? []), item]);
  }

  function openStage(stage: NceStage) {
    setSelectedStage(stage);
    setShowAll(false);
    workspace.current?.scrollIntoView({ block: 'start' });
  }

  async function reloadDrafts() {
    if (!(await confirmDialog('Tải dữ liệu mới sẽ bỏ các bản nháp đang mở trong hồ sơ này. Bạn có thể sao chép nội dung cần giữ trước khi tải lại.', { title: 'Hồ sơ đã được cập nhật', confirmLabel: 'Tải dữ liệu mới', cancelLabel: 'Quay lại' }))) return;
    if (await reload()) setEditorEpoch((value) => value + 1);
  }

  return (
    <div className="nce-dossier">
      <div className="panel nce-dossier-summary">
        <div className="panel-head">
          <h2><button type="button" className="btn ghost sm" onClick={onBack}>← Danh sách</button>Hồ sơ {record.nce_id}</h2>
          <span className={`tag ${badge.tone}`}>{badge.label}</span>
        </div>
        <div className="nce-section-body">
          <h3 className="nce-dossier-description">{record.description}</h3>
          <p className="nce-meta">
            {NCE_SOURCE_LABEL[record.source] ?? record.source}{record.test_name ? ` · ${record.test_name}` : ''} · phát hiện {dateText(record.detected_at)} · cập nhật {timeText(record.updated_at)}
            {record.protocol_version < 4 && ' · hồ sơ phiên bản cũ'}
          </p>
          <dl className="nce-dossier-meta">
            <div><dt>Người phụ trách</dt><dd>{record.owner_name || 'Chưa ghi nhận'}</dd></div>
            <div><dt>Hạn hoàn thành</dt><dd className={record.overdue_days ? 'nce-overdue' : undefined}>{dateText(record.due_date)}{record.overdue_days > 0 && ` · quá hạn ${record.overdue_days} ngày`}</dd></div>
            <div><dt>Phân tầng</dt><dd>{NCE_TIER_LABEL[record.tier] || 'Chưa phân tầng'}</dd></div>
            <div><dt>Kiểm soát kết quả</dt><dd>{holdText(record.hold_results)}</dd></div>
          </dl>
        </div>
      </div>

      <EqaDossierEvidence dossier={dossier} />
      {error && (error.kind !== 'write' || error.stale) && <div className="alert rej nce-dossier-error" role="alert"><div>{error.message}{error.stale && <p className="nce-note">Bản nháp chưa được lưu. Tải dữ liệu mới để xem thay đổi của người khác.</p>}</div>{error.stale || error.kind === 'uncertain' ? <button type="button" className="btn ghost sm" disabled={loading} onClick={() => void reloadDrafts()}>Tải dữ liệu mới</button> : <button type="button" className="btn ghost sm" disabled={loading} onClick={() => void reload()}>Thử lại</button>}</div>}

      <div className="nce-workspace" ref={workspace}>
        <nav className="nce-workflow-nav" aria-label="Các bước xử lý hồ sơ">
          <p className="nce-eyebrow">{record.nce_id}</p>
          <ol className="nce-steps">{NCE_STAGES.map((stage, index) => {
            const stageMissing = missingByStage.get(stage.id)?.length ?? 0;
            const isCurrent = !showAll && activeStage === stage.id;
            const readyLabel = !terminal && stage.id === currentStage && !missing.length
              ? record.status === 'pending_approval' ? 'Chờ duyệt' : 'Sẵn sàng'
              : '';
            return <li className={`nce-step is-${record.status === 'closed' ? 'done' : isCurrent ? 'current' : 'todo'}`} key={stage.id}>
              <button type="button" className={`nce-stage-link${isCurrent ? ' on' : ''}`} aria-pressed={isCurrent} onClick={() => openStage(stage.id)}>
                <span className="step-number">{index + 1}</span>
                <span className="nce-stage-copy">
                  <span className="nce-stage-title-row"><b>{stage.label}</b>{stageMissing > 0 ? <span className="tag warn nce-stage-status">{stageMissing} thiếu</span> : readyLabel ? <span className="tag ok nce-stage-status">{readyLabel}</span> : null}</span>
                  <small>{stage.description}</small>
                </span>
              </button>
            </li>;
          })}</ol>
          {missing.length > 0 && <details className="nce-workflow-missing" key={`${record.next_step}-${record.updated_at}`}>
            <summary><span><b>{missing.length}</b> điều kiện còn thiếu</span><span className="nce-workflow-missing-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="m4 6 4 4 4-4" /></svg></span></summary>
            <ul className="nce-workflow-missing-list">{missing.map((item) => <li key={item.code}><button type="button" onClick={() => openStage(stageForMissing(item))}>{item.message}<span aria-hidden="true">→</span></button></li>)}</ul>
          </details>}
          <button type="button" className={`btn ghost sm nce-view-all${showAll ? ' on' : ''}`} aria-pressed={showAll} onClick={() => { setShowAll((value) => !value); workspace.current?.scrollIntoView({ block: 'start' }); }}>{showAll ? 'Quay về từng bước' : 'Xem toàn bộ hồ sơ'}</button>
          <p className="nce-note">{record.status === 'pending_approval' ? 'Hồ sơ đang khoá sửa để người duyệt rà soát.' : terminal ? 'Hồ sơ chỉ đọc, giữ nguyên nội dung và lịch sử.' : 'Nội dung đã lưu được giữ khi chuyển bước.'}</p>
        </nav>
        {/* Giữ các phần được gắn trong DOM để chuyển bước không làm mất bản
            nháp. Chỉ tải lại có xác nhận mới đặt lại các form đang mở. */}
        <div className="nce-stage-content" key={editorEpoch}>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'identity'}><IdentitySection {...props} /></div>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'check'}><QuickCheckSection {...props} /></div>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'technical'}><TechnicalAssessmentSection {...props} /></div>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'impact'}><PatientImpactSection {...props} /></div>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'release'}><ReleaseSection {...props} /></div>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'capa'}><CapaWorkflow {...props} showAll={showAll} /><div className="nce-stage-footer"><button type="button" className="btn ghost" onClick={() => openStage('review')}>Đến bước phê duyệt →</button></div></div>
          <div className="nce-stage" hidden={!showAll && activeStage !== 'review'}>
            <ReviewSection {...props} onViewEvidence={!showAll ? () => setShowAll(true) : undefined} onMissing={(item) => openStage(stageForMissing(item))} />
            {record.protocol_version < 4 && <LegacySection json={record.legacy_json} />}
          </div>
        </div>
      </div>
    </div>
  );
}
