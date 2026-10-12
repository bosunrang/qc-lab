// Các phần QUYẾT ĐỊNH của hồ sơ (append-only, có người chịu trách nhiệm):
// ảnh hưởng kết quả bệnh nhân, cho phép hoạt động trở lại, đánh giá hiệu lực,
// nộp duyệt/duyệt/trả lại/hủy. Điều kiện của từng bước do main kiểm.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DateField } from '../../components/DateField';
import { useNceStore } from '../../store/nce-store';
import { confirmDialog } from '../../state/dialog-store';
import { todayIso } from '../../lib/format';
import type { NceDecisionRow, NceReleasePreview } from '../../../shared/qc-api';
import { NCE_EFFECTIVENESS_RESULT_LABEL, NCE_PATIENT_OUTCOME_LABEL, NCE_RISK_LEVEL_LABEL } from '../../../main/domain/nce/labels';
import { nceRerunOptions, nceRiskText, nceRunLabel, type NceRunOption } from '../../../main/domain/nce/presentation';
import { useEditor, type SectionProps } from './DossierContent';
import { dateText, Facts, Field, OptionSelect, runPoints, ScaleSelect, Section, SnapshotTable, timeText } from './shared';

function payload<T>(row: NceDecisionRow): T {
  try { return JSON.parse(row.payload_json || '{}') as T; } catch { return {} as T; }
}

// ------------------------------------------------ 2. Ảnh hưởng bệnh nhân

interface ImpactPayload { outcome: string; description: string; resultCount: number | null; reference: string; notified: string }

export function PatientImpactSection(props: SectionProps) {
  const { record, decisions, suspect_window: window_, can } = props.dossier;
  const recordImpact = useNceStore((s) => s.recordPatientImpact);
  const impacts = decisions.filter((d) => d.type === 'patient_impact');
  const [form, setForm] = useState<ImpactPayload | null>(null);
  const outcomes = Object.fromEntries(Object.entries(NCE_PATIENT_OUTCOME_LABEL).filter(([key]) => record.source !== 'iqc' || key !== 'not_applicable'));
  async function save() {
    if (!form) return;
    const ok = await props.run((base) => recordImpact({ ...base, impact: { ...form, resultCount: form.resultCount } }));
    if (ok) setForm(null);
  }
  return (
    <Section n={2} title="Ảnh hưởng kết quả bệnh nhân"
      actions={can.edit && !form ? <button type="button" className="btn ghost sm" onClick={() => setForm({ outcome: '', description: '', resultCount: null, reference: '', notified: '' })}>{impacts.length ? 'Ghi quyết định mới' : 'Ghi quyết định'}</button> : null}>
      {window_ && (
        <p className="nce-note">
          Khoảng nghi ngờ: từ sau {window_.last_accepted ? `lần chạy đạt cuối ${nceRunLabel(window_.last_accepted)}` : 'lần chạy đầu tiên đang có'} đến
          {window_.rerun ? ` trước lần rerun ${nceRunLabel(window_.rerun)}` : ' khi cho phép hoạt động trở lại'} — {window_.runs.length} lần chạy QC trong khoảng.
          Kết quả bệnh nhân trả trong khoảng này phải được rà soát; QC chạy lại đạt không làm chúng mặc nhiên hợp lệ.
        </p>
      )}
      {impacts.length > 0 ? (
        <table className="nce-table">
          <thead><tr><th scope="col">Thời điểm</th><th scope="col">Kết luận</th><th scope="col">Căn cứ / cách rà soát</th><th scope="col">Số kết quả</th><th scope="col">Phiếu sửa / thông báo</th></tr></thead>
          <tbody>{impacts.map((row) => {
            const p = payload<ImpactPayload>(row);
            return (
              <tr key={row.id}>
                <td>{timeText(row.decided_at)}<div className="nce-sub">{row.actor_name}</div></td>
                <td>{NCE_PATIENT_OUTCOME_LABEL[p.outcome] ?? p.outcome}</td>
                <td className="nce-col-text">{p.description}</td>
                <td>{p.resultCount ?? '—'}</td>
                <td>{[p.reference, p.notified].filter(Boolean).join(' · ') || '—'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      ) : !form && <p className="hint-inline">Chưa có quyết định ảnh hưởng kết quả bệnh nhân.</p>}
      {form && (
        <div className="nce-form-grid nce-subform">
          <Field label="Kết luận" htmlFor="impOutcome" wide><OptionSelect id="impOutcome" value={form.outcome} options={outcomes} placeholder="— Chọn kết luận —" onChange={(v) => setForm({ ...form, outcome: v })} /></Field>
          <Field label="Căn cứ / cách rà soát" htmlFor="impDesc" wide><textarea id="impDesc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Số kết quả cần rà soát" htmlFor="impCount"><input id="impCount" type="number" min={0} value={form.resultCount ?? ''} onChange={(e) => setForm({ ...form, resultCount: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          {form.outcome === 'reported_corrected' && <>
            <Field label="Mã phiếu sửa báo cáo / tham chiếu" htmlFor="impRef"><input id="impRef" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
            <Field label="Đã thông báo cho ai, khi nào, qua kênh nào" htmlFor="impNotified" wide><input id="impNotified" value={form.notified} onChange={(e) => setForm({ ...form, notified: e.target.value })} /></Field>
          </>}
          <div className="nce-form-actions nce-field-wide">
            <button type="button" className="btn ghost sm" onClick={() => setForm(null)}>Hủy</button>
            <button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi quyết định</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// --------------------------------------- 3. Cho phép hoạt động trở lại

interface ReleasePayload { reason: string; notApplicable: boolean; rerun: { date: string; runId: string } | null; lotChangeNote: string }

function useRerunOptions(testId: string | null, failures: { date: string; runId: string }[], notBefore: string, enabled: boolean): NceRunOption[] {
  const [options, setOptions] = useState<NceRunOption[]>([]);
  const failureKey = failures.map((f) => `${f.date}/${f.runId}`).join(',');
  useEffect(() => {
    if (!enabled || !testId) { setOptions([]); return; }
    let alive = true;
    void (async () => {
      const levels = (await window.qcApi.listTestLevels(testId)).filter((level) => level.operational);
      const points = (await Promise.all(levels.map((level) => window.qcApi.queryPoints(testId, level.level)))).flat();
      if (alive) setOptions(nceRerunOptions(points, failures, notBefore));
    })();
    return () => { alive = false; };
    // `failures` dựng lại mỗi lần vẽ; khoá theo nội dung.
  }, [enabled, testId, failureKey, notBefore]); // eslint-disable-line react-hooks/exhaustive-deps
  return options;
}

export function ReleaseSection(props: SectionProps) {
  const { record, runs, decisions, can } = props.dossier;
  const { release, previewRelease } = useNceStore(useShallow((s) => ({ release: s.release, previewRelease: s.previewRelease })));
  const decision = decisions.find((d) => d.type === 'release');
  const rerunRun = runs.find((r) => r.role === 'rerun');
  const failures = runs.filter((r) => r.role !== 'rerun').map((r) => ({ date: r.date, runId: r.run_id }));
  const open = record.status === 'open';
  const options = useRerunOptions(record.test_id, failures, record.detected_at, open && can.release);
  const [runKey, setRunKey] = useState('');
  const [preview, setPreview] = useState<NceReleasePreview | null>(null);
  const [lotChangeNote, setLotChangeNote] = useState('');
  const [reason, setReason] = useState('');
  const [notApplicable, setNotApplicable] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const chosen = options.find((o) => o.key === runKey) ?? null;
  const iqc = record.source === 'iqc';

  async function runPreview(option: NceRunOption | null) {
    setPreview(null); setPreviewError('');
    if (!option) return;
    const result = await previewRelease(record.id, { date: option.date, runId: option.runId }, lotChangeNote);
    if (result.ok) setPreview(result.data); else setPreviewError(result.error.message);
  }

  async function submit() {
    const target = chosen ? `Từ lần chạy ${chosen.label}, luật Westgard nhiều lần chạy và CUSUM bắt đầu chuỗi mới; ` : '';
    if (!(await confirmDialog(`${target}hồ sơ sẽ không hủy được nữa. Cho phép hoạt động trở lại?`, { title: 'Cho phép hoạt động trở lại', confirmLabel: 'Cho phép' }))) return;
    await props.run((base) => release({ ...base, release: { reason, rerun: chosen ? { date: chosen.date, runId: chosen.runId } : null, lotChangeNote, notApplicable: !chosen && notApplicable } }));
  }

  if (decision) {
    const p = payload<ReleasePayload>(decision);
    return (
      <Section n={3} title="Cho phép hoạt động trở lại">
        <Facts items={[
          ['Quyết định', `${decision.actor_name} · ${timeText(decision.decided_at)}`],
          ['Căn cứ', p.reason],
          ['Lần chạy rerun / xác minh', p.rerun ? `${nceRunLabel(p.rerun)} — mốc bắt đầu lại chuỗi Westgard/CUSUM` : p.notApplicable ? 'Không phải dừng dịch vụ' : 'Không dùng lần chạy QC'],
          ...(p.lotChangeNote ? [['Giải thích đổi lô', p.lotChangeNote] as [string, string]] : []),
        ]} />
        {rerunRun && <SnapshotTable points={runPoints(rerunRun)} />}
      </Section>
    );
  }
  if (!open) return null;
  return (
    <Section n={3} title="Cho phép hoạt động trở lại">
      {!can.release ? <div className="alert info">Bước này cần tài khoản có quyền cho phép hoạt động trở lại (nce.release). Quản trị viên cấp quyền ở trang Người dùng.</div> : (
        <div className="nce-form-grid">
          {record.test_id && (
            <Field label={iqc ? 'Lần chạy QC rerun' : 'Lần chạy QC xác minh (nếu có)'} htmlFor="relRun" wide>
              <select id="relRun" value={runKey} onChange={(e) => { setRunKey(e.target.value); void runPreview(options.find((o) => o.key === e.target.value) ?? null); }}>
                <option value="">{options.length ? '— Chọn lần chạy —' : '— Chưa có lần chạy nào sau sự cố —'}</option>
                {options.map((o) => <option key={o.key} value={o.key}>{o.label} · {o.levels.map((l) => `M${l}`).join(', ')}</option>)}
              </select>
            </Field>
          )}
          {previewError && <div className="alert rej nce-field-wide">{previewError}</div>}
          {preview && (
            <div className="nce-field-wide">
              <SnapshotTable points={preview.points} />
              {preview.ok
                ? <div className="alert ok">Lần chạy đạt khi đánh giá trong giai đoạn mới.</div>
                : <div className="alert rej"><ul className="nce-list">{preview.problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul></div>}
            </div>
          )}
          {preview && preview.lot_changed_levels.length > 0 && (
            <Field label="Giải thích dùng lô QC khác lần chạy khởi đầu" htmlFor="relLot" wide><input id="relLot" value={lotChangeNote} onChange={(e) => setLotChangeNote(e.target.value)} onBlur={() => void runPreview(chosen)} /></Field>
          )}
          {!iqc && !chosen && (
            <label className="nce-check nce-field-wide"><input type="checkbox" checked={notApplicable} onChange={(e) => setNotApplicable(e.target.checked)} /> Không phải dừng dịch vụ (ghi lý do ở dưới)</label>
          )}
          <Field label="Căn cứ cho phép hoạt động trở lại" htmlFor="relReason" wide><textarea id="relReason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="nce-form-actions nce-field-wide">
            <button type="button" className="btn" disabled={props.busy || (iqc && !chosen)} onClick={() => void submit()}>Cho phép hoạt động trở lại</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------- 7. Đánh giá hiệu lực

interface ReviewPayload { result: string; reviewedAt: string; evidence: string; residualSeverity: number; residualProbability: number; residualLevel: string; residualBasis: string }

export function EffectivenessSection(props: SectionProps) {
  const { record, decisions, can } = props.dossier;
  const reviewStore = useNceStore((s) => s.reviewEffectiveness);
  const reviews = decisions.filter((d) => d.type === 'effectiveness');
  const editor = useEditor(props, () => ({ effectivenessCriteria: record.effectiveness_criteria, effectivenessReviewDue: record.effectiveness_review_due }));
  const [form, setForm] = useState<ReviewPayload | null>(null);
  const d = editor.draft;
  async function save() {
    if (!form) return;
    if (await props.run((base) => reviewStore({ ...base, review: form }))) setForm(null);
  }
  return (
    <Section n={7} title="Đánh giá hiệu lực và nguy cơ còn lại" actions={editor.actions(can.edit)}>
      {d ? (
        <div className="nce-form-grid">
          <Field label="Tiêu chí đánh giá hiệu lực (đặt trước khi đánh giá)" htmlFor="effCrit" wide><textarea id="effCrit" rows={2} value={d.effectivenessCriteria} onChange={(e) => editor.set('effectivenessCriteria', e.target.value)} /></Field>
          <DateField label="Ngày dự kiến đánh giá" id="effDue" value={d.effectivenessReviewDue} onChange={(v) => editor.set('effectivenessReviewDue', v)} />
        </div>
      ) : (
        <Facts items={[['Tiêu chí đánh giá', record.effectiveness_criteria], ['Ngày dự kiến đánh giá', record.effectiveness_review_due ? dateText(record.effectiveness_review_due) : '']]} />
      )}
      {reviews.length > 0 && (
        <table className="nce-table">
          <thead><tr><th scope="col">Ngày đánh giá</th><th scope="col">Kết luận</th><th scope="col">Bằng chứng</th><th scope="col">Nguy cơ còn lại</th></tr></thead>
          <tbody>{reviews.map((row) => {
            const p = payload<ReviewPayload>(row);
            return (
              <tr key={row.id}>
                <td>{dateText(p.reviewedAt)}<div className="nce-sub">{row.actor_name}</div></td>
                <td><span className={`tag ${p.result === 'effective' ? 'ok' : p.result === 'ineffective' ? 'rej' : 'warn'}`}>{NCE_EFFECTIVENESS_RESULT_LABEL[p.result] ?? p.result}</span></td>
                <td className="nce-col-text">{p.evidence}</td>
                <td>{p.result === 'effective' ? `${NCE_RISK_LEVEL_LABEL[p.residualLevel] ?? '—'} · điểm ${nceRiskText(p.residualSeverity, p.residualProbability)}` : '—'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      {can.review_effectiveness && !form && <div className="nce-form-actions"><button type="button" className="btn ghost sm" onClick={() => setForm({ result: '', reviewedAt: todayIso(), evidence: '', residualSeverity: 0, residualProbability: 0, residualLevel: '', residualBasis: '' })}>Ghi đánh giá hiệu lực</button></div>}
      {form && (
        <div className="nce-form-grid nce-subform">
          <Field label="Kết luận" htmlFor="revResult"><OptionSelect id="revResult" value={form.result} options={NCE_EFFECTIVENESS_RESULT_LABEL} placeholder="— Chọn —" onChange={(v) => setForm({ ...form, result: v })} /></Field>
          <DateField label="Ngày đánh giá" id="revDate" value={form.reviewedAt} onChange={(v) => setForm({ ...form, reviewedAt: v })} />
          <Field label="Bằng chứng theo tiêu chí đã đặt" htmlFor="revEvidence" wide><textarea id="revEvidence" rows={2} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} /></Field>
          {form.result === 'effective' && <>
            <Field label="Mức độ còn lại (1–5)" htmlFor="revS"><ScaleSelect id="revS" value={form.residualSeverity} onChange={(v) => setForm({ ...form, residualSeverity: v })} /></Field>
            <Field label="Khả năng xảy ra còn lại (1–5)" htmlFor="revP"><ScaleSelect id="revP" value={form.residualProbability} onChange={(v) => setForm({ ...form, residualProbability: v })} /></Field>
            <Field label="Phân loại nguy cơ còn lại" htmlFor="revL"><OptionSelect id="revL" value={form.residualLevel} options={NCE_RISK_LEVEL_LABEL} placeholder="— Chọn —" onChange={(v) => setForm({ ...form, residualLevel: v })} /></Field>
            <Field label="Căn cứ đánh giá lại" htmlFor="revB"><input id="revB" value={form.residualBasis} onChange={(e) => setForm({ ...form, residualBasis: e.target.value })} /></Field>
          </>}
          <div className="nce-form-actions nce-field-wide">
            <button type="button" className="btn ghost sm" onClick={() => setForm(null)}>Hủy</button>
            <button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi đánh giá</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ------------------------------------------- 8. Nộp duyệt và phê duyệt

export function ReviewSection(props: SectionProps) {
  const { record, decisions, can, approve_block: approveBlock, missing } = props.dossier;
  const { submit, approve, returnForRevision, cancel } = useNceStore(useShallow((s) => ({ submit: s.submit, approve: s.approve, returnForRevision: s.returnForRevision, cancel: s.cancel })));
  const [note, setNote] = useState('');
  const approval = decisions.find((d) => d.type === 'approve');
  const lastReturn = [...decisions].reverse().find((d) => d.type === 'return');
  const cancelled = decisions.find((d) => d.type === 'cancel');
  const pending = record.status === 'pending_approval';

  async function doCancel() {
    if (!(await confirmDialog('Hủy hồ sơ này? Hồ sơ vẫn được lưu để truy xuất.', { title: 'Hủy hồ sơ NCE', danger: true, confirmLabel: 'Hủy hồ sơ', cancelLabel: 'Quay lại' }))) return;
    await props.run((base) => cancel({ ...base, reason: note }));
  }

  return (
    <Section n={8} title="Nộp duyệt và phê duyệt">
      {approval && <Facts items={[['Đã duyệt đóng', `${approval.actor_name} · ${timeText(approval.decided_at)}`], ['Ghi chú', payload<{ note?: string }>(approval).note ?? '']]} />}
      {cancelled && <Facts items={[['Đã hủy', `${cancelled.actor_name} · ${timeText(cancelled.decided_at)}`], ['Lý do', payload<{ reason?: string }>(cancelled).reason ?? '']]} />}
      {lastReturn && record.status === 'released' && <div className="alert warn">Bị trả lại bởi {lastReturn.actor_name} ({timeText(lastReturn.decided_at)}): {payload<{ note?: string }>(lastReturn).note}</div>}
      {record.status === 'released' && (
        can.submit
          ? <div className="nce-form-actions"><button type="button" className="btn" disabled={props.busy || missing.length > 0} onClick={() => void props.run((base) => submit(base))}>Nộp duyệt</button>{missing.length > 0 && <span className="hint-inline">Hoàn thiện các mục còn thiếu ở đầu trang trước khi nộp.</span>}</div>
          : <p className="hint-inline">Người phụ trách hoặc người báo cáo nộp duyệt hồ sơ.</p>
      )}
      {pending && (
        <>
          {approveBlock && <div className="alert info">{approveBlock}</div>}
          {(can.approve || can.return) ? (
            <div className="nce-form-grid">
              <Field label="Ghi chú duyệt / lý do trả lại" htmlFor="revNote" wide><textarea id="revNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <div className="nce-form-actions nce-field-wide">
                {can.return && <button type="button" className="btn ghost" disabled={props.busy} onClick={() => void props.run((base) => returnForRevision({ ...base, note }))}>Trả lại</button>}
                {can.approve && <button type="button" className="btn" disabled={props.busy} onClick={() => void props.run((base) => approve({ ...base, note }))}>Duyệt đóng hồ sơ</button>}
              </div>
            </div>
          ) : !approveBlock && <p className="hint-inline">Hồ sơ đang chờ người có quyền duyệt (nce.approve).</p>}
        </>
      )}
      {record.status === 'open' && can.cancel && (
        <div className="nce-form-grid nce-cancel">
          <Field label="Lý do hủy (hồ sơ lập nhầm, trùng)" htmlFor="cancelReason" wide><input id="cancelReason" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="nce-form-actions nce-field-wide"><button type="button" className="btn danger sm" disabled={props.busy} onClick={() => void doCancel()}>Hủy hồ sơ</button></div>
        </div>
      )}
    </Section>
  );
}
