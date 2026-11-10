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
import { NCE_DRAFT_BLANK } from '../../../main/domain/nce/containment-draft';
import { useDetectedAtCorrection } from './DetectedAtCorrection';
import type { DossierError } from './dossier-session';
import { dateText, timeText, Facts, Field, OptionSelect, RUN_ROLE_LABEL, runPoints, ScaleSelect, Section, SnapshotTable, UserSelect, type DossierWrite } from './shared';

export interface SectionProps { dossier: NceDossierView; users: readonly NceUserOption[]; busy: boolean; run: (write: DossierWrite) => Promise<boolean>; onIdentity?: () => void; error?: DossierError | null }

type Patch = Record<string, unknown>;

/** Khung xem/sửa dùng chung: nút "Sửa" mở bản nháp, "Lưu" gửi đúng các trường của phần đó. */
export function useEditor<T extends Patch>(props: SectionProps, initial: () => T) {
  const update = useNceStore((s) => s.update);
  const [draft, setDraft] = useState<T | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((current) => current && { ...current, [key]: value });
  const save = async () => {
    if (!draft) return;
    // Trường còn "chưa xác định" (null, ví dụ chưa ghi có giữ kết quả hay
    // không) thì không gửi: main chỉ nhận giá trị đã chọn.
    const patch = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== null));
    // Phiên bản thuộc BẢN NHÁP, không lấy phiên bản vừa được tự nạp lại:
    // người khác sửa trong lúc mở form thì main phải trả `stale`.
    if (await props.run((base) => update({ ...base, expectedVersion: draftVersion, patch }))) setDraft(null);
  };
  const actions = (canEdit: boolean): ReactNode => !canEdit ? null : draft
    ? <>{draftVersion !== props.dossier.record.row_version && <span className="nce-editor-warning">Hồ sơ đã được cập nhật ở nơi khác</span>}<button type="button" className="btn ghost sm" onClick={() => setDraft(null)}>Bỏ qua</button><button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Lưu</button></>
    : <button type="button" className="btn ghost sm" onClick={() => { setDraft(initial()); setDraftVersion(props.dossier.record.row_version); }}>Sửa</button>;
  return { draft, set, actions };
}

const CHECK_STATUS_LABEL: Record<string, string> = { ok: 'Đạt', abnormal: 'Bất thường', na: 'Không áp dụng' };

export function IdentitySection(props: SectionProps) {
  const { record, runs, can, timeline, containment_draft: containmentDraft } = props.dossier;
  const editor = useEditor(props, () => ({
    description: record.description, correction: record.correction, holdResults: record.hold_results === null ? null : !!record.hold_results,
    containmentNote: record.containment_note, occurredNote: record.occurred_note,
    phase: record.phase, ownerUserId: record.owner_user_id, dueDate: record.due_date,
  }));
  const d = editor.draft;
  const correction = useDetectedAtCorrection(props);
  const holdStatus = record.hold_results === 1
    ? { label: 'Đã dừng / giữ', tone: 'warn' }
    : record.hold_results === 0
      ? { label: 'Không cần dừng / giữ', tone: 'ok' }
      : { label: 'Chưa xác định', tone: 'none' };
  return (
    <Section title="Ghi nhận và xử lý tức thời" actions={editor.actions(can.edit)}>
      {d ? (
        <div className="nce-form-grid">
          <Field label="Mô tả sự kiện" htmlFor="idDesc" wide><textarea id="idDesc" rows={3} value={d.description} onChange={(e) => editor.set('description', e.target.value)} /></Field>
          <Field label="Xử lý tức thời đã thực hiện" htmlFor="idCorr" wide><textarea id="idCorr" rows={2} value={d.correction} onChange={(e) => editor.set('correction', e.target.value)} /></Field>
          <Field label="Phạm vi kiểm soát và thông báo" htmlFor="idContainment" wide>
            <textarea id="idContainment" rows={4} placeholder="Xét nghiệm/máy/lô/ca bị ảnh hưởng; đã giữ kết quả từ lúc nào; đã báo cho ai, khi nào. Nếu không dừng/giữ, ghi căn cứ và người quyết định." value={d.containmentNote} onChange={(e) => editor.set('containmentNote', e.target.value)} />
            {/* Bản nháp từ dữ liệu app biết; người làm chỉ bổ sung các chỗ [cần ghi]. */}
            {!d.containmentNote.trim() && containmentDraft && <div className="nce-field-assist"><button type="button" className="btn ghost sm" onClick={() => editor.set('containmentNote', containmentDraft)}>Điền sẵn từ dữ liệu</button><span>Xét nghiệm, máy, lô QC và khoảng nghi ngờ; bạn bổ sung đã giữ kết quả từ lúc nào và đã báo cho ai.</span></div>}
            {d.containmentNote.includes(NCE_DRAFT_BLANK) && <p className="nce-field-assist is-warning" role="status">Còn chỗ {NCE_DRAFT_BLANK} cần bổ sung trước khi cho hoạt động trở lại.</p>}
          </Field>
          <Field label="Ghi thêm về diễn biến (tuỳ chọn)" htmlFor="idOccurred" wide><textarea id="idOccurred" rows={2} placeholder="Chỉ ghi điều phần mềm không tự ghi được, ví dụ sự cố thực tế bắt đầu từ ca đêm theo nhật ký máy. Các mốc còn lại đã có ở dòng thời gian." value={d.occurredNote} onChange={(e) => editor.set('occurredNote', e.target.value)} /></Field>
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
          <div className="nce-identity-main">
            <article className="nce-identity-card is-event">
              <span className="nce-eyebrow">Sự cố</span>
              <p className="nce-identity-lead">{record.description || <span className="nce-identity-empty">Chưa ghi nhận</span>}</p>
              <footer><span>Người báo cáo</span><b>{record.reported_by_name || '—'}</b></footer>
            </article>
            <article className="nce-identity-card is-correction">
              <span className="nce-eyebrow">Xử lý tức thời và kiểm soát</span>
              <p className="nce-identity-lead">{record.correction || <span className="nce-identity-empty">Chưa ghi nhận</span>}</p>
              <div className="nce-identity-support">
                <div className="nce-identity-hold"><span>Kiểm soát kết quả</span><span className={`tag ${holdStatus.tone}`}>{holdStatus.label}</span></div>
                <span>Phạm vi kiểm soát &amp; thông báo</span>
                <p>{record.containment_note || <span className="nce-identity-empty">Chưa ghi nhận</span>}</p>
              </div>
              {record.occurred_note && <div className="nce-identity-support">
                <span>Ghi thêm về diễn biến</span>
                <p>{record.occurred_note}</p>
              </div>}
            </article>
          </div>
          <dl className="nce-identity-status" aria-label="Trạng thái xử lý sự cố">
            <div><dt>Giai đoạn</dt><dd>{NCE_PHASE_LABEL[record.phase] ?? record.phase}</dd></div>
            <div><dt>Người phụ trách</dt><dd>{record.owner_name || <span className="nce-identity-empty">Chưa phân công</span>}</dd></div>
            <div><dt>Hạn hoàn thành</dt><dd>{dateText(record.due_date)}</dd></div>
          </dl>
        </div>
      )}
      {/* Dòng thời gian là nơi duy nhất hiện các mốc: phát hiện (kèm nút đính
          chính), lập hồ sơ, lần chạy bị loại/chạy lại (mở bảng điểm QC ngay
          trên dòng đó). Lần chạy đã gắn mà không có mốc thì hiện cuối khung. */}
      <section className="nce-timeline" aria-label="Dòng thời gian hồ sơ">
        <div className="nce-timeline-head"><p className="nce-eyebrow">Dòng thời gian · tự ghi từ dữ liệu</p>{correction.button}</div>
        {correction.form}
        <ol>
          {timeline.map((entry, index) => {
            const run = entry.run && runs.find((r) => r.date === entry.run!.date && r.run_id === entry.run!.runId);
            const when = <time dateTime={entry.at}>{entry.dateOnly ? dateText(entry.at) : timeText(entry.at)}</time>;
            const text = <span className="nce-timeline-text"><b>{entry.label}</b>{entry.detail && <small>{entry.detail}</small>}</span>;
            return <li key={`${entry.at}-${index}`} className={run ? 'has-run' : undefined}>
              {run ? <RunDetails run={run} head={<>{when}{text}</>} /> : <>{when}{text}</>}
            </li>;
          })}
          {runs.filter((run) => !timeline.some((entry) => entry.run && entry.run.date === run.date && entry.run.runId === run.run_id)).map((run) => (
            <li key={run.id} className="has-run"><RunDetails run={run} head={<><time dateTime={run.date}>{dateText(run.date)}</time><span className="nce-timeline-text"><b>{RUN_ROLE_LABEL[run.role]}</b>{run.run_id && <small>lần {run.run_id}</small>}</span></>} /></li>
          ))}
        </ol>
      </section>
    </Section>
  );
}

/** Một lần chạy QC trên dòng thời gian: số mức đạt/bị loại, mở ra là bảng điểm. */
function RunDetails({ run, head }: { run: NceDossierView['runs'][number]; head: ReactNode }) {
  const points = runPoints(run);
  const rejected = points.filter((point) => !point.voided && point.verdict === 'rej').length;
  const accepted = points.filter((point) => !point.voided && point.verdict === 'ok').length;
  return <details className="nce-run">
    <summary>{head}<span className="nce-run-counts">{accepted > 0 && <span className="tag ok">{accepted} đạt</span>}{rejected > 0 && <span className="tag rej">{rejected} bị loại</span>}</span><span className="nce-run-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg></span></summary>
    <div className="nce-run-body"><SnapshotTable points={points} /></div>
  </details>;
}

export function TierRiskSection(props: SectionProps) {
  const { record, can, capa_triggers: triggers, recurrence } = props.dossier;
  const editor = useEditor(props, () => ({
    tier: record.tier, tierReason: record.tier_reason, riskSeverity: record.risk_severity, riskProbability: record.risk_probability,
    riskLevel: record.risk_level, riskBasis: record.risk_basis,
  }));
  const d = editor.draft;
  return (
    <Section title="Phân tầng và đánh giá nguy cơ" actions={editor.actions(can.edit)}>
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
        <div className="nce-capa-tier-view">
          <div className={`nce-capa-summary-card${record.tier ? ' is-set' : ' is-empty'}`}>
            <p className="nce-eyebrow">Tầng xử lý</p>
            <h3>{NCE_TIER_LABEL[record.tier] ?? 'Chưa phân tầng'}</h3>
            <p>{record.tier === 'capa' ? 'Cần điều tra nguyên nhân, hành động khắc phục và đánh giá hiệu lực.' : record.tier === 'low' ? 'Xử lý nhanh theo căn cứ đã ghi nhận.' : 'Chọn tầng xử lý để xác định các điều kiện cần hoàn tất.'}</p>
          </div>
          <div className={`nce-capa-summary-card${record.risk_level ? ' is-risk' : ' is-empty'}`}>
            <p className="nce-eyebrow">Nguy cơ ban đầu</p>
            <h3>{record.risk_level ? NCE_RISK_LEVEL_LABEL[record.risk_level] : 'Chưa ghi nhận'}</h3>
            <p>{record.risk_level ? `Mức độ ${record.risk_severity} × khả năng ${record.risk_probability} = ${nceRiskText(record.risk_severity, record.risk_probability)}` : 'Đánh giá mức độ và khả năng xảy ra theo ma trận nguy cơ của SOP.'}</p>
          </div>
          <div className="nce-capa-basis">
            <div><p className="nce-eyebrow">Căn cứ phân loại</p><p>{record.risk_basis || 'Chưa ghi nhận căn cứ, mã SOP hoặc bảng ma trận.'}</p></div>
            {record.tier === 'low' && <div><p className="nce-eyebrow">Lý do không cần RCA/CAPA</p><p>{record.tier_reason || 'Chưa ghi nhận lý do.'}</p></div>}
          </div>
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
  const keys = checklistKeys(record.source);
  const editor = useEditor(props, () => ({
    checklist: Object.fromEntries(keys.map((key) => [key, parseChecklist(record.checklist_json)[key] ?? { status: '', note: '' }])),
  }));
  const d = editor.draft;
  const checklist = d?.checklist ?? parseChecklist(record.checklist_json);
  const setCheck = (key: string, field: 'status' | 'note', value: string) => d && editor.set('checklist', { ...d.checklist, [key]: { ...d.checklist[key], [field]: value } });
  const assessed = keys.filter((key) => CHECK_STATUS_LABEL[checklist[key]?.status]).length;
  const abnormal = keys.filter((key) => checklist[key]?.status === 'abnormal').length;
  const remaining = keys.filter((key) => !CHECK_STATUS_LABEL[checklist[key]?.status]);
  const hints = props.dossier.checklist_hints ?? {};
  // Chỉ đánh dấu Đạt cho mục CHƯA đánh giá; mục đã chọn Bất thường/Không áp
  // dụng giữ nguyên. Mục có lời nhắc từ dữ liệu cũng bỏ qua để người rà soát
  // tự xem trước khi kết luận.
  const quickOk = remaining.filter((key) => !hints[key]);
  const markRemainingOk = () => d && editor.set('checklist', { ...d.checklist, ...Object.fromEntries(quickOk.map((key) => [key, { ...d.checklist[key], status: 'ok' }])) });
  return (
    <Section title="Kiểm tra nhanh các yếu tố thường gặp" actions={keys.length ? editor.actions(can.edit) : null}>
      <p className="nce-note">Rà soát trước khi chọn QC xác minh; không chỉ chạy lặp lại đến khi gặp một kết quả đạt.</p>
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
              const label = NCE_CHECK_LABELS[key] ?? key;
              // Chỉ tách phần mô tả để trình bày; nhãn chuẩn của nghiệp vụ
              // vẫn được giữ nguyên cho API, báo cáo và tên truy cập ô nhập.
              const parts = /^(.+?) \((.+)\)$/.exec(label);
              const tone = item.status === 'ok' ? 'ok' : item.status === 'abnormal' ? 'rej' : item.status === 'na' ? 'warn' : 'none';
              const needsNote = item.status === 'abnormal' || item.status === 'na';
              return (
                <li className={`nce-checklist-row is-${item.status || 'empty'}`} key={key}>
                  <div className="nce-checklist-row-main">
                    <div className="nce-checklist-text">
                      <span className="nce-checklist-title">{parts?.[1] ?? label}</span>
                      {parts && <span className="nce-checklist-detail">{parts[2]}</span>}
                      {hints[key] && <span className="nce-checklist-hint">{hints[key]}</span>}
                    </div>
                    {d
                      ? <div className="dayseg nce-checklist-choice" role="group" aria-label={`Kết quả: ${label}`}>
                        {Object.entries(CHECK_STATUS_LABEL).map(([value, text]) => (
                          <button type="button" key={value} className={item.status === value ? 'on' : ''} aria-pressed={item.status === value}
                            onClick={() => setCheck(key, 'status', value)}>{text}</button>
                        ))}
                      </div>
                      : <span className={`tag ${tone}`}>{CHECK_STATUS_LABEL[item.status] ?? 'Chưa đánh giá'}</span>}
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
  const editor = useEditor(props, () => ({
    causeStatus: record.cause_status, causeCategory: record.cause_category, causeText: record.cause_text, causeCheckPlan: record.cause_check_plan,
  }));
  const d = editor.draft;
  return (
    <Section title="Điều tra và nguyên nhân" actions={editor.actions(can.edit)}>
      <div className="nce-capa-guidance"><p className="nce-eyebrow">Nguyên tắc điều tra</p><p>Luật QC chỉ gợi ý kiểu sai số, không chứng minh nguyên nhân. Đối chiếu nhật ký máy, hiệu chuẩn, vật liệu QC và phương pháp; không hiệu chuẩn lại hay đổi Mean chỉ để hết cảnh báo.</p></div>
      {d ? (
        <div className="nce-form-grid">
          <Field label="Kết luận nguyên nhân" htmlFor="causeStatus"><OptionSelect id="causeStatus" value={d.causeStatus} options={NCE_CAUSE_STATUS_LABEL} placeholder="— Chưa kết luận —" onChange={(v) => editor.set('causeStatus', v as typeof d.causeStatus)} /></Field>
          {d.causeStatus !== 'undetermined' && <Field label="Nhóm nguyên nhân" htmlFor="causeCat"><OptionSelect id="causeCat" value={d.causeCategory} options={NCE_CAUSE_CATEGORY_LABEL} placeholder="— Chọn nhóm —" onChange={(v) => editor.set('causeCategory', v)} /></Field>}
          {d.causeStatus !== 'undetermined'
            ? <Field label="Mô tả nguyên nhân (trực tiếp, góp phần, gốc)" htmlFor="causeText" wide><textarea id="causeText" rows={3} value={d.causeText} onChange={(e) => editor.set('causeText', e.target.value)} /></Field>
            : <Field label="Kế hoạch kiểm tra tiếp để xác định nguyên nhân" htmlFor="causePlan" wide><textarea id="causePlan" rows={3} value={d.causeCheckPlan} onChange={(e) => editor.set('causeCheckPlan', e.target.value)} /></Field>}
        </div>
      ) : (
        <div className="nce-capa-cause-view">
          <div className={`nce-capa-summary-card${record.cause_status ? ' is-set' : ' is-empty'}`}>
            <p className="nce-eyebrow">Kết luận nguyên nhân</p>
            <h3>{NCE_CAUSE_STATUS_LABEL[record.cause_status] || 'Chưa kết luận'}</h3>
          </div>
          <div className={`nce-capa-summary-card${record.cause_category ? ' is-set' : ' is-empty'}`}>
            <p className="nce-eyebrow">Nhóm nguyên nhân</p>
            <h3>{NCE_CAUSE_CATEGORY_LABEL[record.cause_category] || 'Chưa ghi nhận'}</h3>
          </div>
          <div className="nce-capa-narrative">
            <p className="nce-eyebrow">{record.cause_status === 'undetermined' ? 'Kế hoạch kiểm tra tiếp' : 'Mô tả nguyên nhân'}</p>
            <p>{record.cause_status === 'undetermined' ? record.cause_check_plan || 'Chưa ghi kế hoạch xác định nguyên nhân.' : record.cause_text || 'Chưa ghi nhận mô tả nguyên nhân.'}</p>
          </div>
        </div>
      )}
    </Section>
  );
}
