// Các phần NỘI DUNG của hồ sơ, sửa qua `updateNce` (main ghi lịch sử từng
// trường): ghi nhận và xử lý tức thời, phân tầng và nguy cơ, điều tra và
// nguyên nhân. Mỗi phần có chế độ xem và chế độ sửa riêng.
import { useRef, useState, type ReactNode } from 'react';
import { DateField } from '../../components/DateField';
import { FormErrorMessage } from '../../components/FormErrorMessage';
import { useNceStore } from '../../store/nce-store';
import { controlValue, findFieldControl, formErrorFrom, pickField, type FieldErrorMap, type FormError } from '../../lib/field-error';
import { useInvalidField } from '../../lib/useInvalidField';
import type { NceDossierView, NceUserOption } from '../../../shared/qc-api';
import { checklistKeys, checklistLabel } from '../../../main/domain/nce/checklist';
import {
  NCE_CAUSE_CATEGORY_LABEL, NCE_CAUSE_STATUS_LABEL, NCE_PHASE_LABEL, NCE_RISK_LEVEL_LABEL, NCE_TIER_LABEL,
} from '../../../main/domain/nce/labels';
import { nceRiskText } from '../../../main/domain/nce/presentation';
import { NCE_DRAFT_BLANK } from '../../../main/domain/nce/containment-draft';
import { useDetectedAtCorrection } from './DetectedAtCorrection';
import { QcRunDetails } from './DossierTimeline';
import type { DossierError } from './dossier-session';
import { dateText, timeText, Field, OptionSelect, RUN_ROLE_LABEL, ScaleSelect, Section, UserSelect, type DossierWrite, type DossierWriteOptions, type SectionDisclosure } from './shared';

export interface SectionProps { dossier: NceDossierView; users: readonly NceUserOption[]; busy: boolean; pending: boolean; run: (write: DossierWrite, options?: DossierWriteOptions) => Promise<boolean>; onIdentity?: () => void; error?: DossierError | null; disclosure?: SectionDisclosure; headingLevel?: 2 | 3; onSaved?: () => void }

type Patch = Record<string, unknown>;

const IDENTITY_FIELD_ERRORS: FieldErrorMap = {
  'missing-description': 'idDesc', 'missing-correction': 'idCorr', 'invalid-hold': 'idHold',
  'invalid-phase': 'idPhase', 'missing-owner': 'idOwner',
  'invalid-due-date': 'idDue', 'due-before-detected': 'idDue',
};
const TIER_FIELD_ERRORS: FieldErrorMap = {
  'invalid-tier': 'tierSel', 'invalid-risk-scale': ['riskS', 'riskP'], 'invalid-risk-level': 'riskL',
};
const CAUSE_FIELD_ERRORS: FieldErrorMap = {
  'invalid-cause-status': 'causeStatus', 'invalid-cause-category': 'causeCat',
};

/** Khung xem/sửa dùng chung: nút "Sửa" mở bản nháp, "Lưu" gửi đúng các trường của phần đó. */
export function useEditor<T extends Patch>(props: SectionProps, initial: () => T, fieldErrors: FieldErrorMap = {}) {
  const update = useNceStore((s) => s.update);
  const [draft, setDraft] = useState<T | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [fieldError, setFieldError] = useState<FormError | null>(null);
  const formRoot = useRef<HTMLDivElement>(null);
  const errorId = useInvalidField(formRoot, fieldError);
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setFieldError(null);
    setDraft((current) => current && { ...current, [key]: value });
  };
  const save = async () => {
    if (!draft) return;
    setFieldError(null);
    // Trường còn "chưa xác định" (null, ví dụ chưa ghi có giữ kết quả hay
    // không) thì không gửi: main chỉ nhận giá trị đã chọn.
    const patch = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== null));
    // Phiên bản thuộc BẢN NHÁP, không lấy phiên bản vừa được tự nạp lại:
    // người khác sửa trong lúc mở form thì main phải trả `stale`.
    if (await props.run((base) => update({ ...base, expectedVersion: draftVersion, patch }), {
      handleValidationError: (error) => {
        const root = formRoot.current;
        if (!root || root.closest('.nce-stage[hidden]')) return false;
        const mapped = formErrorFrom(error, fieldErrors);
        const field = pickField(mapped.fields, (name) => {
          const control = findFieldControl(root, name);
          return control ? controlValue(control) : null;
        });
        if (!field) return false;
        setFieldError({ message: mapped.message, fields: [field] });
        return true;
      },
    })) { setFieldError(null); setDraft(null); props.onSaved?.(); }
  };
  const begin = () => { setFieldError(null); setDraft(initial()); setDraftVersion(props.dossier.record.row_version); };
  const actions = (canEdit: boolean): ReactNode => !canEdit ? null : draft
    ? <>{draftVersion !== props.dossier.record.row_version && <span className="nce-editor-warning">Hồ sơ đã được cập nhật ở nơi khác</span>}<button type="button" className="btn ghost sm" disabled={props.pending} onClick={() => setDraft(null)}>Bỏ qua</button><button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Lưu</button></>
    : <button type="button" className="btn ghost sm" disabled={props.busy} onClick={begin}>Sửa</button>;
  return { draft, set, actions, begin, fieldError, formRoot, errorId };
}

const CHECK_STATUS_LABEL: Record<string, string> = { ok: 'Đạt', abnormal: 'Bất thường', na: 'Không áp dụng' };

export function IdentitySection(props: SectionProps) {
  const { record, runs, can, containment_draft: containmentDraft } = props.dossier;
  const incidentRuns = runs.filter((run) => run.role !== 'rerun');
  const editor = useEditor(props, () => ({
    description: record.description, correction: record.correction, holdResults: record.hold_results === null ? null : !!record.hold_results,
    containmentNote: record.containment_note,
    phase: record.phase, ownerUserId: record.owner_user_id, dueDate: record.due_date,
  }), IDENTITY_FIELD_ERRORS);
  const d = editor.draft;
  const focusContainment = useRef(false);
  const correction = useDetectedAtCorrection(props);
  const containmentMissing = props.dossier.missing.some((item) => item.code === 'containment' || item.code === 'containment-blank');
  const holdStatus = record.hold_results === 1
    ? 'Đã dừng / giữ'
    : record.hold_results === 0
      ? 'Không cần dừng / giữ'
      : 'Chưa xác định';
  return (
    <Section title="Ghi nhận và xử lý tức thời" actions={editor.actions(can.edit)}>
      {d ? (
        <div className="nce-form-grid" ref={editor.formRoot}>
          <FormErrorMessage rootRef={editor.formRoot} error={editor.fieldError} id={editor.errorId} />
          <Field label="Mô tả sự kiện" htmlFor="idDesc" wide><textarea id="idDesc" rows={3} value={d.description} onChange={(e) => editor.set('description', e.target.value)} /></Field>
          <Field label="Xử lý tức thời đã thực hiện" htmlFor="idCorr" wide><textarea id="idCorr" rows={2} value={d.correction} onChange={(e) => editor.set('correction', e.target.value)} /></Field>
          <Field label="Phạm vi kiểm soát và thông báo" htmlFor="idContainment" wide>
            <textarea id="idContainment" ref={(element) => {
              // Nút bổ sung mở đúng bản nháp hiện hành và đưa con trỏ tới mục thiếu.
              if (element && focusContainment.current) {
                focusContainment.current = false;
                element.scrollIntoView({ block: 'center' });
                element.focus({ preventScroll: true });
              }
            }} rows={4} placeholder="Xét nghiệm/máy/lô/ca bị ảnh hưởng; đã giữ kết quả từ lúc nào; đã báo cho ai, khi nào. Nếu không dừng/giữ, ghi căn cứ và người quyết định." value={d.containmentNote} onChange={(e) => editor.set('containmentNote', e.target.value)} />
            {/* Bản nháp từ dữ liệu app biết; người làm chỉ bổ sung các chỗ [cần ghi]. */}
            {!d.containmentNote.trim() && containmentDraft && <div className="nce-field-assist"><button type="button" className="btn ghost sm" onClick={() => editor.set('containmentNote', containmentDraft)}>Điền sẵn từ dữ liệu</button><span>Xét nghiệm, máy, lô QC và khoảng nghi ngờ; bạn bổ sung đã giữ kết quả từ lúc nào và đã báo cho ai.</span></div>}
            {d.containmentNote.includes(NCE_DRAFT_BLANK) && <p className="nce-field-assist is-warning" role="status">Còn chỗ {NCE_DRAFT_BLANK} cần bổ sung trước khi cho hoạt động trở lại.</p>}
          </Field>
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
        <div className="nce-identity-view">
          <div className="nce-identity-heading">
            <div className="nce-identity-heading-main">
              <p className="nce-eyebrow">Sự cố đã ghi nhận</p>
              <h3 className="nce-identity-lead">{record.description || <span className="nce-identity-empty">Chưa ghi nhận sự cố</span>}</h3>
              <p className="nce-identity-reporter">Người báo cáo <b>{record.reported_by_name || '—'}</b></p>
            </div>
            <div className="nce-identity-control"><span>Kiểm soát kết quả</span><span className="tag none">{holdStatus}</span></div>
          </div>
          <dl className="nce-identity-status" aria-label="Trạng thái xử lý sự cố">
            <div><dt>Giai đoạn</dt><dd>{NCE_PHASE_LABEL[record.phase] ?? record.phase}</dd></div>
            <div><dt>Người phụ trách</dt><dd>{record.owner_name || <span className="nce-identity-empty">Chưa phân công</span>}</dd></div>
            <div><dt>Hạn hoàn thành</dt><dd>{dateText(record.due_date)}</dd></div>
          </dl>
          <dl className="nce-identity-details">
            <div className="nce-identity-row"><dt>Xử lý tức thời</dt><dd>{record.correction || <span className="nce-identity-empty">Chưa ghi nhận xử lý tức thời.</span>}</dd></div>
            <div className="nce-identity-row">
              <dt>Phạm vi &amp; thông báo</dt>
              <dd><div className="nce-identity-scope"><div>{record.containment_note || <span className="nce-identity-empty">Chưa bổ sung phạm vi kiểm soát và thông báo.</span>}{containmentMissing && <small className="nce-identity-required">Cần bổ sung trước khi cho hoạt động trở lại.</small>}</div>{containmentMissing && can.edit && <button type="button" className="btn ghost sm" aria-label="Bổ sung phạm vi kiểm soát và thông báo" disabled={props.busy} onClick={() => { focusContainment.current = true; editor.begin(); }}>Bổ sung →</button>}</div></dd>
            </div>
            {record.occurred_note && <div className="nce-identity-row"><dt>Ghi thêm về diễn biến</dt><dd>{record.occurred_note}</dd></div>}
          </dl>
        </div>
      )}
      <div className="nce-identity-milestones">
        <dl className="nce-identity-dates">
          <div><dt>Ngày phát hiện</dt><dd><time dateTime={record.detected_at}>{dateText(record.detected_at)}</time></dd></div>
          <div><dt>Ngày lập hồ sơ</dt><dd><time dateTime={record.created_at}>{timeText(record.created_at)}</time></dd></div>
        </dl>
        {correction.button}
      </div>
      {correction.form}
      {/* Ghi nhận chỉ giữ bằng chứng gây sự cố; diễn biến và quyết định về
          sau được xem trong dòng thời gian tổng thể ở Phê duyệt & lịch sử. */}
      {incidentRuns.length > 0 && <section className="nce-timeline" aria-label="Bằng chứng QC của sự cố">
        <details className="nce-timeline-disclosure">
          <summary><span>Bằng chứng QC của sự cố ({incidentRuns.length})</span><span className="nce-timeline-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg></span></summary>
          <div className="nce-timeline-content">
            <ol>
              {incidentRuns.map((run) => (
                <li key={run.id} className="has-run"><QcRunDetails run={run} head={<><time dateTime={run.date}>{dateText(run.date)}</time><span className="nce-timeline-text"><b>{run.role === 'trigger' ? 'Lần chạy QC bị loại' : RUN_ROLE_LABEL[run.role]}</b>{run.run_id && <small>lần {run.run_id}</small>}</span></>} /></li>
              ))}
            </ol>
          </div>
        </details>
      </section>}
    </Section>
  );
}

export function TierRiskSection(props: SectionProps) {
  const { record, can, capa_triggers: triggers, recurrence } = props.dossier;
  const editor = useEditor(props, () => ({
    tier: record.tier, tierReason: record.tier_reason, riskSeverity: record.risk_severity, riskProbability: record.risk_probability,
    riskLevel: record.risk_level, riskBasis: record.risk_basis,
  }), TIER_FIELD_ERRORS);
  const d = editor.draft;
  return (
    <Section title="Phân tầng và đánh giá nguy cơ" actions={editor.actions(can.edit)} disclosure={props.disclosure} headingLevel={props.headingLevel}>
      {triggers.length > 0 && (
        <div className="alert warn">Phải xử lý theo CAPA đầy đủ vì: {triggers.map((t) => t.message).join('; ')}.</div>
      )}
      {recurrence && !triggers.some((t) => t.code === 'recurrence') && <div className="alert warn">Có hồ sơ cùng xét nghiệm, cùng loại sai số trong cửa sổ theo dõi tái diễn.</div>}
      {d ? (
        <div className="nce-capa-form" ref={editor.formRoot}>
          <FormErrorMessage rootRef={editor.formRoot} error={editor.fieldError} id={editor.errorId} />
          <Field label="Tầng xử lý" htmlFor="tierSel"><OptionSelect id="tierSel" value={d.tier} options={NCE_TIER_LABEL} placeholder="— Chưa phân tầng —" onChange={(v) => editor.set('tier', v as typeof d.tier)} /></Field>
          {d.tier === 'low' && <Field label="Lý do không cần RCA/CAPA" htmlFor="tierReason" wide><textarea id="tierReason" rows={2} value={d.tierReason} onChange={(e) => editor.set('tierReason', e.target.value)} /></Field>}
          <div className="nce-form-grid nce-capa-risk-grid">
          <Field label="Mức độ nghiêm trọng (1–5)" htmlFor="riskS"><ScaleSelect id="riskS" value={d.riskSeverity} onChange={(v) => editor.set('riskSeverity', v)} /></Field>
          <Field label="Khả năng xảy ra (1–5)" htmlFor="riskP"><ScaleSelect id="riskP" value={d.riskProbability} onChange={(v) => editor.set('riskProbability', v)} /></Field>
          <Field label={`Phân loại theo SOP (điểm ${nceRiskText(d.riskSeverity, d.riskProbability)})`} htmlFor="riskL"><OptionSelect id="riskL" value={d.riskLevel} options={NCE_RISK_LEVEL_LABEL} placeholder="— Chưa phân loại —" onChange={(v) => editor.set('riskLevel', v as typeof d.riskLevel)} /></Field>
          </div>
          <Field label="Căn cứ phân loại (mã SOP, bảng ma trận)" htmlFor="riskB" wide><input id="riskB" value={d.riskBasis} onChange={(e) => editor.set('riskBasis', e.target.value)} /></Field>
        </div>
      ) : (
        <div className="nce-capa-record">
          <dl className="nce-capa-overview">
            <div><dt>Tầng xử lý</dt><dd>{NCE_TIER_LABEL[record.tier] ?? 'Chưa phân tầng'}</dd></div>
            <div><dt>Nguy cơ ban đầu</dt><dd>{record.risk_level ? NCE_RISK_LEVEL_LABEL[record.risk_level] : 'Chưa đánh giá'}</dd></div>
            <div><dt>Điểm nguy cơ</dt><dd>{nceRiskText(record.risk_severity, record.risk_probability)}{record.risk_severity > 0 && record.risk_probability > 0 && <small>{record.risk_severity} × {record.risk_probability}</small>}</dd></div>
          </dl>
          <dl className="nce-capa-details">
            <div><dt>Căn cứ phân loại</dt><dd>{record.risk_basis || 'Chưa ghi nhận căn cứ, mã SOP hoặc bảng ma trận.'}</dd></div>
            {record.tier === 'low' && <div><dt>Lý do không cần RCA/CAPA</dt><dd>{record.tier_reason || 'Chưa ghi nhận lý do.'}</dd></div>}
          </dl>
        </div>
      )}
    </Section>
  );
}

function parseChecklist(json: string): Record<string, { status: string; note: string }> {
  try { return JSON.parse(json || '{}'); } catch { return {}; }
}

export function QuickCheckSection(props: SectionProps) {
  const { record, can } = props.dossier;
  const eqaLinked = !!record.eqa_result_id;
  const labels: Record<string, string> = eqaLinked ? { ok: 'Đã loại trừ', abnormal: 'Nghi ngờ', root: 'Nguyên nhân gốc', na: 'Không áp dụng' } : CHECK_STATUS_LABEL;
  const keys = checklistKeys(record.source, eqaLinked);
  const editor = useEditor(props, () => ({
    checklist: Object.fromEntries(keys.map((key) => [key, parseChecklist(record.checklist_json)[key] ?? { status: '', note: '' }])),
  }));
  const d = editor.draft;
  const checklist = d?.checklist ?? parseChecklist(record.checklist_json);
  const setCheck = (key: string, field: 'status' | 'note', value: string) => d && editor.set('checklist', { ...d.checklist, [key]: { ...d.checklist[key], [field]: value } });
  const assessed = keys.filter((key) => labels[checklist[key]?.status]).length;
  const abnormal = keys.filter((key) => checklist[key]?.status === 'abnormal').length;
  const remaining = keys.filter((key) => !labels[checklist[key]?.status]);
  const hints = props.dossier.checklist_hints ?? {};
  // Chỉ đánh dấu Đạt cho mục CHƯA đánh giá; mục đã chọn Bất thường/Không áp
  // dụng giữ nguyên. Mục có lời nhắc từ dữ liệu cũng bỏ qua để người rà soát
  // tự xem trước khi kết luận.
  const quickOk = eqaLinked ? [] : remaining.filter((key) => !hints[key]);
  const markRemainingOk = () => d && editor.set('checklist', { ...d.checklist, ...Object.fromEntries(quickOk.map((key) => [key, { ...d.checklist[key], status: 'ok' }])) });
  return (
    <Section title={eqaLinked ? 'Rà soát nguyên nhân ngoại kiểm' : 'Kiểm tra nhanh các yếu tố thường gặp'} actions={keys.length ? editor.actions(can.edit) : null}>
      {!keys.length && <p className="hint-inline">Nguồn này chưa có checklist định sẵn. Ghi nội dung kiểm tra phù hợp ở phần xử lý tức thời và điều tra nguyên nhân.</p>}
      {keys.length > 0 && (
        <>
          {/* Danh sách gọn (đánh giá giao diện 09/11/2026): mỗi mục một dòng,
              kết quả chọn bằng ba nút; ô bằng chứng chỉ hiện khi Bất thường /
              Không áp dụng (cổng chỉ bắt buộc bằng chứng cho hai trạng thái
              đó) hoặc khi mục đã có ghi chú. */}
          <div className="nce-checklist-summary">
            <p className="nce-checklist-total">{assessed}/{keys.length} mục đã đánh giá</p>
            {abnormal > 0 && <span className="tag rej">{abnormal} bất thường</span>}
            {d && quickOk.length > 0 && <button type="button" className="btn ghost sm nce-checklist-all-ok" onClick={markRemainingOk}>
              Đánh dấu {quickOk.length === remaining.length ? `${quickOk.length} mục còn lại` : `${quickOk.length} mục không có lời nhắc`} là Đạt
            </button>}
          </div>
          <ul className="nce-checklist-list" aria-label="Danh sách kiểm tra nhanh">
            {keys.map((key) => {
              const item = checklist[key] ?? { status: '', note: '' };
              const label = checklistLabel(key, record.source, eqaLinked);
              // Chỉ tách phần mô tả để trình bày; nhãn chuẩn của nghiệp vụ
              // vẫn được giữ nguyên cho API, báo cáo và tên truy cập ô nhập.
              const parts = /^(.+?) \((.+)\)$/.exec(label);
              const detail = parts?.[2];
              const detailText = detail ? detail.charAt(0).toLocaleUpperCase('vi') + detail.slice(1) : '';
              const tone = item.status === 'ok' ? 'ok' : item.status === 'abnormal' ? 'rej' : item.status === 'na' ? 'warn' : 'none';
              const needsNote = eqaLinked || item.status === 'abnormal' || item.status === 'na';
              return (
                <li className={`nce-checklist-row is-${item.status || 'empty'}`} key={key}>
                  <div className="nce-checklist-row-main">
                    <div className="nce-checklist-text">
                      <span className="nce-checklist-title">{parts?.[1] ?? label}</span>
                      {detailText && <span className="nce-checklist-detail">{detailText}</span>}
                      {hints[key] && <span className="nce-checklist-hint">{hints[key]}</span>}
                    </div>
                    {d
                      ? <div className="dayseg nce-checklist-choice" role="group" aria-label={`Kết quả: ${label}`}>
                        {Object.entries(labels).map(([value, text]) => (
                          <button type="button" key={value} className={item.status === value ? 'on' : ''} aria-pressed={item.status === value}
                            onClick={() => setCheck(key, 'status', value)}>{text}</button>
                        ))}
                      </div>
                      : <span className={`tag ${tone}`}>{labels[item.status] ?? 'Chưa đánh giá'}</span>}
                  </div>
                  {d
                    ? (needsNote || item.note) && <textarea className="nce-checklist-note-input" aria-label={`Bằng chứng: ${label}`} rows={2} maxLength={2000}
                      placeholder={item.status === 'abnormal' ? 'Bắt buộc: ghi phát hiện và xử lý đã làm…' : item.status === 'na' ? 'Bắt buộc: ghi lý do không áp dụng…' : 'Nhật ký, mã phiếu hoặc ghi chú…'}
                      value={item.note} onChange={(e) => setCheck(key, 'note', e.target.value)} />
                    : item.note
                      ? <p className="nce-checklist-evidence">{item.note}</p>
                      : needsNote && <p className="nce-checklist-required">Chưa ghi bằng chứng / lý do</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}

export function InvestigationSection(props: SectionProps) {
  const { record, can } = props.dossier;
  const causeLabels = Object.fromEntries(Object.entries(NCE_CAUSE_CATEGORY_LABEL).filter(([key]) => !key || (record.eqa_result_id ? key.startsWith('eqa_') : !key.startsWith('eqa_'))));
  const editor = useEditor(props, () => ({
    causeStatus: record.cause_status, causeCategory: record.cause_category, causeText: record.cause_text, causeCheckPlan: record.cause_check_plan,
  }), CAUSE_FIELD_ERRORS);
  const d = editor.draft;
  return (
    <Section title={record.eqa_result_id ? 'Phân loại nguyên nhân ngoại kiểm' : 'Điều tra và nguyên nhân'} actions={editor.actions(can.edit)} disclosure={props.disclosure} headingLevel={props.headingLevel}>
      <div className="nce-capa-guidance" role="note"><p>{record.eqa_result_id ? 'Đối chiếu báo cáo nhà cung cấp, lỗi hành chính, sáu nhóm kỹ thuật và chương trình/mẫu. Ghi 5 Whys cùng bằng chứng; phân loại nguyên nhân hành chính, kỹ thuật, chương trình/mẫu hoặc chưa xác định kèm kế hoạch theo dõi.' : 'Luật QC chỉ gợi ý kiểu sai số, không chứng minh nguyên nhân. Đối chiếu nhật ký máy, hiệu chuẩn, vật liệu QC và phương pháp; không hiệu chuẩn lại hay đổi Mean chỉ để hết cảnh báo.'}</p></div>
      {d ? (
        <div className="nce-form-grid nce-capa-form" ref={editor.formRoot}>
          <FormErrorMessage rootRef={editor.formRoot} error={editor.fieldError} id={editor.errorId} />
          <Field label="Kết luận nguyên nhân" htmlFor="causeStatus"><OptionSelect id="causeStatus" value={d.causeStatus} options={NCE_CAUSE_STATUS_LABEL} placeholder="— Chưa kết luận —" onChange={(v) => editor.set('causeStatus', v as typeof d.causeStatus)} /></Field>
          {d.causeStatus !== 'undetermined' && <Field label="Nhóm nguyên nhân" htmlFor="causeCat"><OptionSelect id="causeCat" value={d.causeCategory} options={causeLabels} placeholder="— Chọn nhóm —" onChange={(v) => editor.set('causeCategory', v)} /></Field>}
          {d.causeStatus !== 'undetermined'
            ? <Field label="Mô tả nguyên nhân (trực tiếp, góp phần, gốc)" htmlFor="causeText" wide><textarea id="causeText" rows={3} value={d.causeText} onChange={(e) => editor.set('causeText', e.target.value)} /></Field>
            : <Field label="Kế hoạch kiểm tra tiếp để xác định nguyên nhân" htmlFor="causePlan" wide><textarea id="causePlan" rows={3} value={d.causeCheckPlan} onChange={(e) => editor.set('causeCheckPlan', e.target.value)} /></Field>}
        </div>
      ) : (
        <dl className="nce-capa-details">
          <div><dt>Kết luận nguyên nhân</dt><dd>{NCE_CAUSE_STATUS_LABEL[record.cause_status] || 'Chưa kết luận'}</dd></div>
          {record.cause_status !== 'undetermined' && <div><dt>Nhóm nguyên nhân</dt><dd>{NCE_CAUSE_CATEGORY_LABEL[record.cause_category] || 'Chưa ghi nhận'}</dd></div>}
          <div><dt>{record.cause_status === 'undetermined' ? 'Kế hoạch kiểm tra tiếp' : 'Mô tả nguyên nhân'}</dt><dd>{record.cause_status === 'undetermined' ? record.cause_check_plan || 'Chưa ghi kế hoạch xác định nguyên nhân.' : record.cause_text || 'Chưa ghi nhận mô tả nguyên nhân.'}</dd></div>
        </dl>
      )}
    </Section>
  );
}
