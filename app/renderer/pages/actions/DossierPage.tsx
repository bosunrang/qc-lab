// Trang một hồ sơ NCE: đầu trang (mã, trạng thái, bước tiếp theo và những gì
// còn thiếu do main tính), rồi các phần theo thứ tự quy trình. Mỗi phần chỉ
// mở form khi người đang xem được phép (`dossier.can`).
import { useShallow } from 'zustand/react/shallow';
import { useNceStore } from '../../store/nce-store';
import { EmptyState } from '../../components/EmptyState';
import { nceStatusBadge } from '../../lib/nce-labels';
import { NCE_SOURCE_LABEL } from '../../../main/domain/nce/labels';
import { nceHistory, nceSteps } from '../../../main/domain/nce/presentation';
import { IdentitySection, InvestigationSection, TierRiskSection } from './DossierContent';
import { EffectivenessSection, PatientImpactSection, ReleaseSection, ReviewSection } from './DossierDecisions';
import { ActionsSection } from './DossierActions';
import { dateText, Facts, Section, timeText, useDossier } from './shared';

const NEXT_STEP_LABEL: Record<string, string> = {
  release: 'Bước tiếp theo: cho phép hoạt động trở lại',
  submit: 'Bước tiếp theo: hoàn thiện điều tra, CAPA và nộp duyệt',
  approve: 'Bước tiếp theo: người duyệt độc lập duyệt đóng hồ sơ',
};

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
  const { dossier, error, busy, reload, run, clearError } = useDossier(id);

  if (dossier === undefined) return <div className="panel"><EmptyState size="compact">Đang tải hồ sơ…</EmptyState></div>;
  if (dossier === null) {
    return <div className="panel"><EmptyState title="Không tìm thấy hồ sơ" action={<button type="button" className="btn ghost" onClick={onBack}>Về danh sách</button>}>Hồ sơ có thể đã được phục hồi từ bản sao lưu khác.</EmptyState></div>;
  }
  const { record, missing } = dossier;
  const badge = nceStatusBadge(record);
  const props = { dossier, users, busy, run };
  const history = nceHistory(dossier);
  const terminal = record.status === 'closed' || record.status === 'cancelled';

  return (
    <div>
      <div className="panel">
        <div className="panel-head">
          <h2><button type="button" className="btn ghost sm" onClick={onBack}>← Danh sách</button>Hồ sơ {record.nce_id}</h2>
          <span className={`tag ${badge.tone}`}>{badge.label}</span>
        </div>
        <div className="nce-section-body">
          <p className="nce-meta">
            {NCE_SOURCE_LABEL[record.source] ?? record.source}{record.test_name ? ` · ${record.test_name}` : ''} · phát hiện {dateText(record.detected_at)} · cập nhật {timeText(record.updated_at)}
            {record.protocol_version < 4 && ' · hồ sơ phiên bản cũ'}
          </p>
          <ol className="nce-steps">
            {nceSteps(record.status).map((step, index) => (
              <li key={step.key} className={`nce-step is-${step.state}`}><span className="step-number">{index + 1}</span>{step.label}</li>
            ))}
          </ol>
          {error && (
            <div className="alert rej" role="alert">
              {error.message}
              {error.stale ? <button type="button" className="btn ghost sm" onClick={() => void reload()}>Tải lại hồ sơ</button> : <button type="button" className="btn ghost sm" onClick={clearError}>Đóng</button>}
            </div>
          )}
          {!terminal && dossier.record.next_step && (
            missing.length
              ? <div className="alert warn nce-missing"><b>{NEXT_STEP_LABEL[dossier.record.next_step]} — còn thiếu:</b><ul className="nce-list">{missing.map((item) => <li key={item.code}>{item.message}</li>)}</ul></div>
              : <div className="alert ok">{NEXT_STEP_LABEL[dossier.record.next_step]} — hồ sơ đã đủ điều kiện.</div>
          )}
        </div>
      </div>

      <IdentitySection {...props} />
      <PatientImpactSection {...props} />
      <ReleaseSection {...props} />
      <TierRiskSection {...props} />
      <InvestigationSection {...props} />
      <ActionsSection {...props} />
      <EffectivenessSection {...props} />
      <ReviewSection {...props} />
      {record.protocol_version < 4 && <LegacySection json={record.legacy_json} />}

      <Section title="Lịch sử hồ sơ">
        {history.length ? (
          <ol className="nce-history">
            {history.map((item, index) => (
              <li key={`${item.at}-${index}`}><b>{item.title}</b><span>{item.detail}</span><small>{item.actor} · {timeText(item.at)}</small></li>
            ))}
          </ol>
        ) : <p className="hint-inline">Chưa có quyết định hay lần sửa nào.</p>}
      </Section>
    </div>
  );
}
