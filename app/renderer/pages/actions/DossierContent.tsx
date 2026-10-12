// Các phần NỘI DUNG của hồ sơ, sửa qua `updateNce` (main ghi lịch sử từng
// trường): ghi nhận và xử lý tức thời, phân tầng và nguy cơ, điều tra và
// nguyên nhân. Mỗi phần có chế độ xem và chế độ sửa riêng.
import { useState, type ReactNode } from 'react';
import { DateField } from '../../components/DateField';
import { useNceStore } from '../../store/nce-store';
import type { NceDossierView, NceUserOption } from '../../../shared/qc-api';
import { checklistKeys } from '../../../main/domain/nce/checklist';
import {
  NCE_CAUSE_CATEGORY_LABEL, NCE_CAUSE_STATUS_LABEL, NCE_CHECK_LABELS, NCE_PHASE_LABEL, NCE_RISK_LEVEL_LABEL, NCE_TIER_LABEL,
} from '../../../main/domain/nce/labels';
import { nceRiskText } from '../../../main/domain/nce/presentation';
import { dateText, Facts, Field, holdText, OptionSelect, RUN_ROLE_LABEL, runPoints, runRowLabel, ScaleSelect, Section, SnapshotTable, UserSelect, type DossierWrite } from './shared';

export interface SectionProps { dossier: NceDossierView; users: readonly NceUserOption[]; busy: boolean; run: (write: DossierWrite) => Promise<boolean> }

type Patch = Record<string, unknown>;

/** Khung xem/sửa dùng chung: nút "Sửa" mở bản nháp, "Lưu" gửi đúng các trường của phần đó. */
export function useEditor<T extends Patch>(props: SectionProps, initial: () => T) {
  const update = useNceStore((s) => s.update);
  const [draft, setDraft] = useState<T | null>(null);
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((current) => current && { ...current, [key]: value });
  const save = async () => {
    if (!draft) return;
    // Trường còn "chưa xác định" (null, ví dụ chưa ghi có giữ kết quả hay
    // không) thì không gửi: main chỉ nhận giá trị đã chọn.
    const patch = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== null));
    if (await props.run((base) => update({ ...base, patch }))) setDraft(null);
  };
  const actions = (canEdit: boolean): ReactNode => !canEdit ? null : draft
    ? <><button type="button" className="btn ghost sm" onClick={() => setDraft(null)}>Hủy</button><button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Lưu</button></>
    : <button type="button" className="btn ghost sm" onClick={() => setDraft(initial())}>Sửa</button>;
  return { draft, set, actions };
}

const CHECK_STATUS_LABEL: Record<string, string> = { ok: 'Đạt', abnormal: 'Bất thường', na: 'Không áp dụng' };

export function IdentitySection(props: SectionProps) {
  const { record, runs, can } = props.dossier;
  const editor = useEditor(props, () => ({
    description: record.description, correction: record.correction, holdResults: record.hold_results === null ? null : !!record.hold_results,
    phase: record.phase, ownerUserId: record.owner_user_id, dueDate: record.due_date,
  }));
  const d = editor.draft;
  const failures = runs.filter((r) => r.role !== 'rerun');
  return (
    <Section n={1} title="Ghi nhận và xử lý tức thời" actions={editor.actions(can.edit)}>
      {d ? (
        <div className="nce-form-grid">
          <Field label="Mô tả sự kiện" htmlFor="idDesc" wide><textarea id="idDesc" rows={3} value={d.description} onChange={(e) => editor.set('description', e.target.value)} /></Field>
          <Field label="Xử lý tức thời đã thực hiện" htmlFor="idCorr" wide><textarea id="idCorr" rows={2} value={d.correction} onChange={(e) => editor.set('correction', e.target.value)} /></Field>
          <Field label="Dừng/giữ kết quả liên quan" htmlFor="idHold">
            <select id="idHold" value={d.holdResults === null ? '' : d.holdResults ? 'yes' : 'no'} onChange={(e) => editor.set('holdResults', e.target.value === 'yes')}>
              {d.holdResults === null && <option value="">— Chưa xác định —</option>}
              <option value="yes">Có — đã dừng/giữ</option><option value="no">Không cần</option>
            </select>
          </Field>
          <Field label="Giai đoạn quá trình" htmlFor="idPhase"><OptionSelect id="idPhase" value={d.phase} options={NCE_PHASE_LABEL} onChange={(v) => editor.set('phase', v as typeof d.phase)} /></Field>
          <Field label="Người phụ trách" htmlFor="idOwner"><UserSelect id="idOwner" value={d.ownerUserId} users={props.users} onChange={(v) => editor.set('ownerUserId', v)} /></Field>
          <DateField label="Hạn hoàn thành" id="idDue" value={d.dueDate} onChange={(v) => editor.set('dueDate', v)} />
        </div>
      ) : (
        <Facts items={[
          ['Mô tả sự kiện', record.description],
          ['Xử lý tức thời', record.correction],
          ['Dừng/giữ kết quả', holdText(record.hold_results)],
          ['Giai đoạn', NCE_PHASE_LABEL[record.phase] ?? record.phase],
          ['Người phụ trách', record.owner_name],
          ['Hạn hoàn thành', dateText(record.due_date)],
          ['Người báo cáo', `${record.reported_by_name || '—'} · phát hiện ${dateText(record.detected_at)}`],
        ]} />
      )}
      {failures.map((run) => (
        <div className="nce-run" key={run.id}>
          <h3>{RUN_ROLE_LABEL[run.role]} · {runRowLabel(run)}</h3>
          <SnapshotTable points={runPoints(run)} />
        </div>
      ))}
    </Section>
  );
}

export function TierRiskSection(props: SectionProps) {
  const { record, can, capa_triggers: triggers, recurrence } = props.dossier;
  const editor = useEditor(props, () => ({
    tier: record.tier, tierReason: record.tier_reason, riskSeverity: record.risk_severity, riskProbability: record.risk_probability,
    riskLevel: record.risk_level, riskBasis: record.risk_basis,
  }));
  const d = editor.draft;
  return (
    <Section n={4} title="Phân tầng và đánh giá nguy cơ" actions={editor.actions(can.edit)}>
      {triggers.length > 0 && (
        <div className="alert warn">Phải xử lý theo CAPA đầy đủ vì: {triggers.map((t) => t.message).join('; ')}.</div>
      )}
      {recurrence && !triggers.some((t) => t.code === 'recurrence') && <div className="alert warn">Có hồ sơ cùng xét nghiệm, cùng loại sai số trong cửa sổ theo dõi tái diễn.</div>}
      {d ? (
        <div className="nce-form-grid">
          <Field label="Tầng xử lý" htmlFor="tierSel"><OptionSelect id="tierSel" value={d.tier} options={NCE_TIER_LABEL} placeholder="— Chưa phân tầng —" onChange={(v) => editor.set('tier', v as typeof d.tier)} /></Field>
          {d.tier === 'low' && <Field label="Lý do không cần RCA/CAPA" htmlFor="tierReason" wide><textarea id="tierReason" rows={2} value={d.tierReason} onChange={(e) => editor.set('tierReason', e.target.value)} /></Field>}
          <Field label="Mức độ nghiêm trọng (1–5)" htmlFor="riskS"><ScaleSelect id="riskS" value={d.riskSeverity} onChange={(v) => editor.set('riskSeverity', v)} /></Field>
          <Field label="Khả năng xảy ra (1–5)" htmlFor="riskP"><ScaleSelect id="riskP" value={d.riskProbability} onChange={(v) => editor.set('riskProbability', v)} /></Field>
          <Field label={`Phân loại theo SOP (điểm ${nceRiskText(d.riskSeverity, d.riskProbability)})`} htmlFor="riskL"><OptionSelect id="riskL" value={d.riskLevel} options={NCE_RISK_LEVEL_LABEL} placeholder="— Chưa phân loại —" onChange={(v) => editor.set('riskLevel', v as typeof d.riskLevel)} /></Field>
          <Field label="Căn cứ phân loại (mã SOP, bảng ma trận)" htmlFor="riskB" wide><input id="riskB" value={d.riskBasis} onChange={(e) => editor.set('riskBasis', e.target.value)} /></Field>
        </div>
      ) : (
        <Facts items={[
          ['Tầng xử lý', NCE_TIER_LABEL[record.tier] ?? record.tier],
          ...(record.tier === 'low' ? [['Lý do không cần RCA/CAPA', record.tier_reason] as [string, ReactNode]] : []),
          ['Nguy cơ ban đầu', record.risk_level ? `${NCE_RISK_LEVEL_LABEL[record.risk_level]} · mức độ ${record.risk_severity} × khả năng ${record.risk_probability} = ${nceRiskText(record.risk_severity, record.risk_probability)}` : ''],
          ['Căn cứ', record.risk_basis],
        ]} />
      )}
    </Section>
  );
}

function parseChecklist(json: string): Record<string, { status: string; note: string }> {
  try { return JSON.parse(json || '{}'); } catch { return {}; }
}

export function InvestigationSection(props: SectionProps) {
  const { record, can } = props.dossier;
  const keys = checklistKeys(record.source);
  const editor = useEditor(props, () => ({
    checklist: Object.fromEntries(keys.map((key) => [key, parseChecklist(record.checklist_json)[key] ?? { status: '', note: '' }])),
    causeStatus: record.cause_status, causeCategory: record.cause_category, causeText: record.cause_text, causeCheckPlan: record.cause_check_plan,
  }));
  const d = editor.draft;
  const checklist = d?.checklist ?? parseChecklist(record.checklist_json);
  const setCheck = (key: string, field: 'status' | 'note', value: string) => d && editor.set('checklist', { ...d.checklist, [key]: { ...d.checklist[key], [field]: value } });
  return (
    <Section n={5} title="Điều tra và nguyên nhân" actions={editor.actions(can.edit)}>
      {keys.length > 0 && (
        <table className="nce-table">
          <thead><tr><th scope="col">Mục rà soát</th><th scope="col">Kết quả</th><th scope="col">Bằng chứng / lý do</th></tr></thead>
          <tbody>{keys.map((key) => {
            const item = checklist[key] ?? { status: '', note: '' };
            return (
              <tr key={key}>
                <td>{NCE_CHECK_LABELS[key] ?? key}</td>
                <td>{d
                  ? <select aria-label={`Kết quả: ${NCE_CHECK_LABELS[key]}`} value={item.status} onChange={(e) => setCheck(key, 'status', e.target.value)}><option value="">— Chưa đánh giá —</option>{Object.entries(CHECK_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : item.status ? <span className={`tag ${item.status === 'ok' ? 'ok' : item.status === 'abnormal' ? 'rej' : 'none'}`}>{CHECK_STATUS_LABEL[item.status]}</span> : <span className="hint-inline">Chưa đánh giá.</span>}</td>
                <td>{d ? <input aria-label={`Bằng chứng: ${NCE_CHECK_LABELS[key]}`} value={item.note} onChange={(e) => setCheck(key, 'note', e.target.value)} /> : item.note || '—'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      {d ? (
        <div className="nce-form-grid">
          <Field label="Kết luận nguyên nhân" htmlFor="causeStatus"><OptionSelect id="causeStatus" value={d.causeStatus} options={NCE_CAUSE_STATUS_LABEL} placeholder="— Chưa kết luận —" onChange={(v) => editor.set('causeStatus', v as typeof d.causeStatus)} /></Field>
          {d.causeStatus !== 'undetermined' && <Field label="Nhóm nguyên nhân" htmlFor="causeCat"><OptionSelect id="causeCat" value={d.causeCategory} options={NCE_CAUSE_CATEGORY_LABEL} placeholder="— Chọn nhóm —" onChange={(v) => editor.set('causeCategory', v)} /></Field>}
          {d.causeStatus !== 'undetermined'
            ? <Field label="Mô tả nguyên nhân (trực tiếp, góp phần, gốc)" htmlFor="causeText" wide><textarea id="causeText" rows={3} value={d.causeText} onChange={(e) => editor.set('causeText', e.target.value)} /></Field>
            : <Field label="Kế hoạch kiểm tra tiếp để xác định nguyên nhân" htmlFor="causePlan" wide><textarea id="causePlan" rows={3} value={d.causeCheckPlan} onChange={(e) => editor.set('causeCheckPlan', e.target.value)} /></Field>}
        </div>
      ) : (
        <Facts items={[
          ['Kết luận nguyên nhân', NCE_CAUSE_STATUS_LABEL[record.cause_status] ?? ''],
          ...(record.cause_status === 'undetermined'
            ? [['Kế hoạch kiểm tra', record.cause_check_plan] as [string, ReactNode]]
            : [['Nhóm nguyên nhân', NCE_CAUSE_CATEGORY_LABEL[record.cause_category] ?? ''] as [string, ReactNode], ['Mô tả nguyên nhân', record.cause_text] as [string, ReactNode]]),
        ]} />
      )}
    </Section>
  );
}
