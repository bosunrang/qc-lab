// Chỉ điều phối phần đang xem. Điều kiện hợp lệ và các mục thiếu vẫn lấy
// từ main; thu gọn giữ component trong DOM để không làm mất bản nháp.
import { useState } from 'react';
import { NCE_CAUSE_STATUS_LABEL, NCE_EFFECTIVENESS_RESULT_LABEL, NCE_RISK_LEVEL_LABEL, NCE_TIER_LABEL } from '../../../main/domain/nce/labels';
import { ActionsSection } from './DossierActions';
import { InvestigationSection, TierRiskSection, type SectionProps } from './DossierContent';
import { EffectivenessSection } from './DossierDecisions';
import { decisionPayload } from './decision-data';

type Part = 'tier' | 'cause' | 'actions' | 'effectiveness';

export function CapaWorkflow(props: SectionProps & { showAll: boolean }) {
  const { showAll, ...sectionProps } = props;
  const { record, actions, decisions, missing } = props.dossier;
  const [selected, setSelected] = useState<Part | null | undefined>(undefined);
  const [showExtra, setShowExtra] = useState(false);
  const full = record.tier === 'capa';
  // Hồ sơ ngoại kiểm phân loại nguyên nhân ở bước Rà soát (trước ảnh hưởng bệnh nhân, N-12).
  const eqaLinked = !!record.eqa_result_id;
  const hasMissing = (prefix: string) => missing.some((item) => item.code.startsWith(prefix));
  const openActions = actions.filter((action) => action.status === 'open').length;
  const liveActions = actions.filter((action) => action.status !== 'cancelled');
  const reviews = decisions.filter((row) => row.type === 'effectiveness');
  const lastReview = reviews.at(-1);
  const result = lastReview ? decisionPayload<{ result: string }>(lastReview).result ?? '' : '';
  const effectivenessMissing = hasMissing('criteria') || hasMissing('effectiveness') || hasMissing('residual-');
  // Phần chưa có dữ liệu được gợi ý trước. Các mã thiếu của main ưu tiên
  // mở lại phần cần rà soát, kể cả khi phần đó đã từng được ghi.
  const recommended: Part | null = !full && openActions > 0 ? 'actions'
    : !record.tier || !record.risk_level || hasMissing('tier') || hasMissing('risk') ? 'tier'
    : full && !eqaLinked && (!record.cause_status || hasMissing('cause')) ? 'cause'
      : openActions > 0 || (full && (!liveActions.length || hasMissing('corrective'))) ? 'actions'
        : full && (!lastReview || result !== 'effective' || effectivenessMissing) ? 'effectiveness' : null;
  const active = selected === undefined ? recommended : selected;
  const extraVisible = showAll || full || showExtra || openActions > 0;
  const savedExtra = !!record.cause_status || actions.length > 0 || !!record.effectiveness_criteria || reviews.length > 0;
  const summaries: Record<Part, string> = {
    tier: `${NCE_TIER_LABEL[record.tier] || 'Chưa phân tầng'} · Nguy cơ ${NCE_RISK_LEVEL_LABEL[record.risk_level]?.toLocaleLowerCase('vi') || 'chưa đánh giá'}`,
    cause: hasMissing('cause') ? 'Cần bổ sung nguyên nhân' : record.cause_status ? NCE_CAUSE_STATUS_LABEL[record.cause_status] : 'Chưa ghi nguyên nhân',
    actions: actions.length ? `${actions.filter((action) => action.status === 'done').length} hoàn thành · ${openActions} đang theo dõi` : 'Chưa có hành động',
    effectiveness: lastReview ? `${NCE_EFFECTIVENESS_RESULT_LABEL[result] || 'Đã ghi đánh giá'}${effectivenessMissing ? ' · Cần rà soát lại' : ''}` : record.effectiveness_criteria ? 'Đã đặt tiêu chí · Chưa đánh giá' : 'Chưa đặt tiêu chí đánh giá',
  };
  function group(part: Part): SectionProps {
    return {
      ...sectionProps,
      headingLevel: 3,
      onSaved: () => setSelected(undefined),
      disclosure: showAll || (part === 'tier' && !full) ? undefined : {
        expanded: active === part,
        summary: summaries[part],
        onToggle: () => setSelected(active === part ? null : part),
        // Khi đang thao tác, ghim phần này đến lúc lưu thành công; cập nhật
        // từ cửa sổ khác không được tự thu gọn biểu mẫu đang nhập.
        onInteract: () => setSelected(part),
      },
    };
  }
  const title = eqaLinked ? 'Hành động khắc phục' : 'Điều tra & CAPA';
  return <section className="panel nce-capa-shell" aria-label={title}>
    <div className="panel-head"><h2>{title}</h2></div>
    <div className="nce-capa-workflow">
    <TierRiskSection {...group('tier')} />
    {!showAll && !full && <div className="nce-capa-extra-toggle">
      {openActions === 0 && <button type="button" className="btn ghost sm" aria-expanded={extraVisible} onClick={() => setShowExtra(!showExtra)}>{savedExtra ? 'Thông tin điều tra & hành động đã ghi' : 'Ghi thêm điều tra / hành động'}{showExtra ? ' · Thu gọn' : ''}</button>}
      {openActions > 0 && <span className="nce-note">Còn {openActions} hành động đang theo dõi cần hoàn tất.</span>}
    </div>}
    <div className="nce-capa-steps" hidden={!extraVisible}>
      {!eqaLinked && <InvestigationSection {...group('cause')} />}
      <ActionsSection {...group('actions')} />
      <EffectivenessSection {...group('effectiveness')} />
    </div>
    </div>
  </section>;
}
