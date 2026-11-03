// Các phần QUYẾT ĐỊNH của hồ sơ (append-only, có người chịu trách nhiệm):
// ảnh hưởng kết quả bệnh nhân, cho phép hoạt động trở lại, đánh giá hiệu lực,
// nộp duyệt/duyệt/trả lại/huỷ. Điều kiện của từng bước do main kiểm.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DateField } from '../../components/DateField';
import { useNceStore } from '../../store/nce-store';
import { confirmDialog } from '../../state/dialog-store';
import { todayIso } from '../../lib/format';
import type { NceDecisionRow, NceReleasePreview, NceTechnicalAssessmentInput } from '../../../shared/qc-api';
import {
  NCE_EFFECTIVENESS_RESULT_LABEL, NCE_MEAN_RESET_LABEL, NCE_PATIENT_OUTCOME_LABEL, NCE_RISK_LEVEL_LABEL,
  NCE_TECHNICAL_ERROR_LABEL, NCE_TECHNICAL_SIGNAL_LABEL,
} from '../../../main/domain/nce/labels';
import { nceRerunChoices, nceRiskText, nceRunLabel, type NceRunChoice } from '../../../main/domain/nce/presentation';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { useEditor, type SectionProps } from './DossierContent';
import { dateText, Facts, Field, OptionSelect, runPoints, ScaleSelect, Section, SnapshotTable, timeText } from './shared';

function payload<T>(row: NceDecisionRow): T {
  try { return JSON.parse(row.payload_json || '{}') as T; } catch { return {} as T; }
}

// ------------------------------------------ 3. Xác minh kỹ thuật IQC

interface TechnicalPayload extends NceTechnicalAssessmentInput {
  deltaSeCrit: number | null; deltaReCrit: number | null; seObs: number | null; reObs: number | null;
  technicalSignal: 'below_threshold' | 'exceeds_threshold' | 'not_calculated';
}

const METRIC_MODE_LABEL = { calculated: 'Tính ngưỡng TEa / Bias / SD', not_applicable: 'Không áp dụng định lượng' } as const;
const EMPTY_TECHNICAL: NceTechnicalAssessmentInput = {
  errorNature: 'undetermined', verificationMethod: '', correctiveEvidence: '', technicalConclusion: '',
  metricMode: 'not_applicable', metricReason: '', unit: '', tea: null, teaSource: '', stableBias: null,
  incidentBias: null, postCorrectionBias: null, sd: null, sdSource: '', observedDispersion: null, sampleCount: null,
  meanResetDecision: 'not_applicable', meanResetReason: '', meanResetEvidence: '',
};

const numberText = (value: number | null | undefined) => value == null ? '—' : String(value);
const metricNumber = (value: string): number | null => value === '' ? null : Number(value);

export function TechnicalAssessmentSection(props: SectionProps) {
  const { record, decisions, runs, can } = props.dossier;
  const saveAssessment = useNceStore((s) => s.recordTechnicalAssessment);
  const assessments = decisions.filter((decision) => decision.type === 'technical_assessment');
  const [form, setForm] = useState<NceTechnicalAssessmentInput | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const requiresMeanReview = runs
    .filter((run) => run.role !== 'rerun')
    .some((run) => runPoints(run).some((point) => point.rules.some((rule) => ['8x', '9x', '10x', '12x'].includes(rule))));
  const latest = assessments.at(-1);

  function set<K extends keyof NceTechnicalAssessmentInput>(key: K, value: NceTechnicalAssessmentInput[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!form) return;
    if (await props.run((base) => saveAssessment({ ...base, expectedVersion: draftVersion, assessment: form }))) setForm(null);
  }

  if (record.source !== 'iqc') {
    return <Section title="Xác minh kỹ thuật"><div className="nce-technical-na"><span className="tag none">Không áp dụng</span><p>Hồ sơ này không phát sinh từ nội kiểm. Bằng chứng kỹ thuật được ghi ở phần điều tra và hành động phù hợp với nguồn sự cố.</p></div></Section>;
  }

  return (
    <Section title="Xác minh kỹ thuật IQC" actions={can.edit && !form ? <button type="button" className="btn ghost sm" onClick={() => { setDraftVersion(record.row_version); setForm({ ...EMPTY_TECHNICAL, meanResetDecision: requiresMeanReview ? 'not_allowed' : 'not_applicable' }); }}>{latest ? 'Ghi đánh giá mới' : 'Ghi đánh giá'}</button> : null}>
      <div className="nce-technical-intro">
        <div><p className="nce-eyebrow">Sau kiểm tra nhanh</p><h3>Xác nhận bản chất sai số và hiệu quả xử lý</h3><p>Đối chiếu nhật ký, hiệu chuẩn, vật liệu và dữ liệu QC. Các ngưỡng chỉ hỗ trợ rà soát, không thay quyết định lâm sàng.</p></div>
        <div className="nce-technical-rule"><b>Trình tự</b><span>Xác minh nguyên nhân → xử lý → đánh giá số liệu → kết luận kỹ thuật</span></div>
      </div>

      {latest ? (() => {
        const value = payload<TechnicalPayload>(latest);
        const calculated = value.metricMode === 'calculated';
        const tone = value.technicalSignal === 'exceeds_threshold' ? 'warn' : value.technicalSignal === 'below_threshold' ? 'ok' : 'none';
        return <div className="nce-technical-record">
          <div className="nce-technical-record-head"><div><p className="nce-eyebrow">Đánh giá gần nhất · {timeText(latest.decided_at)}</p><h3>{NCE_TECHNICAL_ERROR_LABEL[value.errorNature] ?? value.errorNature}</h3><p>{latest.actor_name}</p></div><span className={`tag ${tone}`}>{NCE_TECHNICAL_SIGNAL_LABEL[value.technicalSignal] ?? 'Chưa tính'}</span></div>
          <div className="nce-technical-evidence-grid">
            <div><p className="nce-eyebrow">Phương pháp xác minh</p><p>{value.verificationMethod}</p></div>
            <div><p className="nce-eyebrow">Xử lý và bằng chứng</p><p>{value.correctiveEvidence}</p></div>
            <div className="nce-technical-conclusion"><p className="nce-eyebrow">Kết luận kỹ thuật</p><p>{value.technicalConclusion}</p></div>
          </div>
          {calculated ? <div className="nce-technical-metrics">
            <div><span>ΔSEcrit</span><b>{numberText(value.deltaSeCrit)}</b><small>(TEa − |Bias ổn định|) / SD − 1,65</small></div>
            <div><span>SEobs</span><b>{numberText(value.seObs)}</b><small>|Bias sự cố − Bias ổn định| / SD</small></div>
            <div><span>ΔREcrit</span><b>{numberText(value.deltaReCrit)}</b><small>(TEa − |Bias ổn định|) / (1,65 × SD)</small></div>
            <div><span>REobs</span><b>{numberText(value.reObs)}</b><small>Độ phân tán quan sát / SD</small></div>
          </div> : <div className="nce-technical-not-calculated"><b>Không áp dụng định lượng</b><span>{value.metricReason}</span></div>}
          {requiresMeanReview && <div className="nce-technical-mean"><p className="nce-eyebrow">Xem xét Mean/SD mới</p><b>{NCE_MEAN_RESET_LABEL[value.meanResetDecision] ?? value.meanResetDecision}</b><p>{value.meanResetReason}</p>{value.meanResetEvidence && <small>{value.meanResetEvidence}</small>}</div>}
        </div>;
      })() : !form && <div className="nce-technical-empty"><p>Chưa có đánh giá xác minh kỹ thuật. Hoàn tất mục này trước khi rà soát ảnh hưởng bệnh nhân và cho hoạt động trở lại.</p></div>}

      {form && <div className="nce-technical-form">
        <div className="nce-form-grid">
          <Field label="Bản chất sai số" htmlFor="techNature"><OptionSelect id="techNature" value={form.errorNature} options={NCE_TECHNICAL_ERROR_LABEL} onChange={(value) => set('errorNature', value as NceTechnicalAssessmentInput['errorNature'])} /></Field>
          <Field label="Cách đánh giá định lượng" htmlFor="techMode"><OptionSelect id="techMode" value={form.metricMode} options={METRIC_MODE_LABEL} onChange={(value) => set('metricMode', value as NceTechnicalAssessmentInput['metricMode'])} /></Field>
          <Field label="Phương pháp xác minh" htmlFor="techMethod" wide><textarea id="techMethod" rows={2} value={form.verificationMethod} onChange={(event) => set('verificationMethod', event.target.value)} placeholder="Đối chiếu nhật ký máy, hiệu chuẩn, lô vật liệu, thao tác…" /></Field>
          <Field label="Xử lý kỹ thuật và bằng chứng sau khắc phục" htmlFor="techEvidence" wide><textarea id="techEvidence" rows={2} value={form.correctiveEvidence} onChange={(event) => set('correctiveEvidence', event.target.value)} /></Field>
        </div>

        {form.metricMode === 'calculated' ? <div className="nce-technical-inputs">
          <div className="nce-technical-inputs-head"><div><p className="nce-eyebrow">Dữ liệu định lượng</p><h3>Dùng cùng đơn vị và ghi rõ nguồn</h3></div><span className="pill">Không dùng một điểm rerun đơn lẻ làm Bias</span></div>
          <div className="nce-form-grid">
            <Field label="Đơn vị chung" htmlFor="techUnit"><input id="techUnit" value={form.unit} onChange={(event) => set('unit', event.target.value)} /></Field>
            <Field label="TEa / APS" htmlFor="techTea"><input id="techTea" type="number" step="any" value={form.tea ?? ''} onChange={(event) => set('tea', metricNumber(event.target.value))} /></Field>
            <Field label="Nguồn TEa / APS và phiên bản" htmlFor="techTeaSource" wide><input id="techTeaSource" value={form.teaSource} onChange={(event) => set('teaSource', event.target.value)} /></Field>
            <Field label="Bias ổn định trước sự cố" htmlFor="techStableBias"><input id="techStableBias" type="number" step="any" value={form.stableBias ?? ''} onChange={(event) => set('stableBias', metricNumber(event.target.value))} /></Field>
            <Field label="Bias lúc sự cố" htmlFor="techIncidentBias"><input id="techIncidentBias" type="number" step="any" value={form.incidentBias ?? ''} onChange={(event) => set('incidentBias', metricNumber(event.target.value))} /></Field>
            <Field label="Bias sau khắc phục (khi xét Mean/SD)" htmlFor="techPostBias"><input id="techPostBias" type="number" step="any" value={form.postCorrectionBias ?? ''} onChange={(event) => set('postCorrectionBias', metricNumber(event.target.value))} /></Field>
            <Field label="SD nội bộ" htmlFor="techSd"><input id="techSd" type="number" min="0" step="any" value={form.sd ?? ''} onChange={(event) => set('sd', metricNumber(event.target.value))} /></Field>
            <Field label="Nguồn / khoảng dữ liệu SD" htmlFor="techSdSource" wide><input id="techSdSource" value={form.sdSource} onChange={(event) => set('sdSource', event.target.value)} /></Field>
            <Field label="Độ phân tán quan sát" htmlFor="techDispersion"><input id="techDispersion" type="number" min="0" step="any" value={form.observedDispersion ?? ''} onChange={(event) => set('observedDispersion', metricNumber(event.target.value))} /></Field>
            <Field label="Cỡ dữ liệu xác minh" htmlFor="techN"><input id="techN" type="number" min="2" step="1" value={form.sampleCount ?? ''} onChange={(event) => set('sampleCount', metricNumber(event.target.value))} /></Field>
          </div>
        </div> : <Field label="Lý do không áp dụng TEa / Bias / SD" htmlFor="techMetricReason" wide><textarea id="techMetricReason" rows={2} value={form.metricReason} onChange={(event) => set('metricReason', event.target.value)} /></Field>}

        {requiresMeanReview && <div className="nce-technical-mean-form">
          <div><p className="nce-eyebrow">Luật dịch chuyển dài</p><h3>Quyết định riêng về Mean/SD</h3><p>Chỉ xem xét Mean/SD mới khi có thay đổi hợp lệ, đủ số liệu và Bias sau khắc phục không vượt 1/4 TEa.</p></div>
          <div className="nce-form-grid">
            <Field label="Kết luận" htmlFor="techMean"><OptionSelect id="techMean" value={form.meanResetDecision} options={NCE_MEAN_RESET_LABEL} onChange={(value) => set('meanResetDecision', value as NceTechnicalAssessmentInput['meanResetDecision'])} /></Field>
            <Field label="Căn cứ" htmlFor="techMeanReason"><input id="techMeanReason" value={form.meanResetReason} onChange={(event) => set('meanResetReason', event.target.value)} /></Field>
            {form.meanResetDecision === 'eligible' && <Field label="Bằng chứng thay đổi hợp lệ và tập dữ liệu" htmlFor="techMeanEvidence" wide><textarea id="techMeanEvidence" rows={2} value={form.meanResetEvidence} onChange={(event) => set('meanResetEvidence', event.target.value)} /></Field>}
          </div>
        </div>}

        <Field label="Kết luận kỹ thuật" htmlFor="techConclusion" wide><textarea id="techConclusion" rows={3} value={form.technicalConclusion} onChange={(event) => set('technicalConclusion', event.target.value)} placeholder="Nêu sai số đã được kiểm soát hay chưa và căn cứ chuyển sang rà soát bệnh nhân." /></Field>
        <div className="nce-form-actions"><button type="button" className="btn ghost sm" onClick={() => setForm(null)}>Bỏ qua</button><button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi đánh giá kỹ thuật</button></div>
      </div>}
    </Section>
  );
}

// ------------------------------------------------ 2. Ảnh hưởng bệnh nhân

interface ImpactPayload { outcome: string; description: string; resultCount: number | null; reference: string; notified: string }
interface ImpactCoverage { lastAccepted: { date: string; runId: string } | null; through: { date: string; runId: string }; runCount: number }

function coverageText(coverage: ImpactCoverage | null | undefined): string {
  if (!coverage?.through) return 'Chưa ghi phạm vi đã rà soát';
  const start = coverage.lastAccepted ? `sau lần đạt ${nceRunLabel(coverage.lastAccepted)}` : 'từ lần chạy đầu tiên';
  return `Phạm vi đã rà soát: ${start} tới lần ${nceRunLabel(coverage.through)}`;
}

function impactTone(outcome: string): 'ok' | 'warn' | 'none' {
  if (outcome === 'reported_corrected') return 'warn';
  if (outcome === 'not_applicable') return 'none';
  return 'ok';
}

export function PatientImpactSection(props: SectionProps) {
  const { record, decisions, suspect_window: window_, can } = props.dossier;
  const recordImpact = useNceStore((s) => s.recordPatientImpact);
  const impacts = decisions.filter((d) => d.type === 'patient_impact');
  const [form, setForm] = useState<ImpactPayload | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const outcomes = Object.fromEntries(Object.entries(NCE_PATIENT_OUTCOME_LABEL).filter(([key]) => record.source !== 'iqc' || key !== 'not_applicable'));
  const windowStart = window_?.last_accepted
    ? `Sau lần chạy đạt cuối ${nceRunLabel(window_.last_accepted)}`
    : 'Từ lần chạy đầu tiên đang có';
  const extended = !!window_ && (window_.onset.date !== window_.trigger.date || window_.onset.runId !== window_.trigger.runId);
  const scopeProblems = props.dossier.missing.filter((item) => item.code.startsWith('patient-impact-'));
  const windowEnd = window_?.rerun
    ? `Trước lần rerun ${nceRunLabel(window_.rerun)}`
    : 'Đến khi cho phép hoạt động trở lại';
  async function save() {
    if (!form) return;
    const ok = await props.run((base) => recordImpact({ ...base, expectedVersion: draftVersion, impact: { ...form, resultCount: form.resultCount } }));
    if (ok) setForm(null);
  }
  return (
    <Section title="Ảnh hưởng kết quả bệnh nhân"
      actions={can.patient_impact && !form ? <button type="button" className="btn ghost sm" onClick={() => { setDraftVersion(record.row_version); setForm({ outcome: '', description: '', resultCount: null, reference: '', notified: '' }); }}>{impacts.length ? 'Ghi quyết định mới' : 'Ghi quyết định'}</button> : null}>
      <div className="nce-impact-layout">
        <div className="nce-impact-scope">
          <div>
            <p className="nce-eyebrow">Phạm vi cần rà soát</p>
            <h3>Kết quả trong khoảng nghi ngờ cần được đánh giá chuyên môn</h3>
          </div>
          {window_ ? (
            <dl className="nce-impact-window">
              <div><dt>Bắt đầu</dt><dd>{windowStart}</dd></div>
              <div><dt>Kết thúc</dt><dd>{windowEnd}</dd></div>
              <div><dt>Lần chạy QC</dt><dd>{window_.runs.length} lần trong khoảng</dd></div>
            </dl>
          ) : <p className="nce-note">Chưa xác định được khoảng nghi ngờ từ dữ liệu QC của hồ sơ.</p>}
          {extended && window_ && <p className="nce-impact-caution">Luật {window_.onset_rules.join(', ')} đếm qua nhiều lần chạy: chuỗi vi phạm bắt đầu từ lần {nceRunLabel(window_.onset)}, nên các lần chạy từng được chấp nhận trong chuỗi cũng thuộc khoảng nghi ngờ.</p>}
          <p className="nce-impact-caution">QC chạy lại đạt không làm các kết quả đã trả trong khoảng này mặc nhiên hợp lệ.</p>
          <p className="nce-impact-privacy">Chỉ ghi mã tham chiếu cần thiết; không nhập thông tin định danh người bệnh.</p>
        </div>
        <div className="nce-impact-decisions">
          <div className="nce-impact-decisions-head">
            <div>
              <p className="nce-eyebrow">Quyết định đã ghi</p>
              <h3>{impacts.length ? `${impacts.length} lần đánh giá` : 'Chưa có quyết định'}</h3>
            </div>
            {impacts.length > 0 && <span className="tag ok">Đã cập nhật</span>}
          </div>
          {impacts.length > 0 ? (
            <ol className="nce-impact-decision-list">
              {impacts.map((row) => {
                const p = payload<ImpactPayload>(row);
                const tone = impactTone(p.outcome);
                return (
                  <li className={`nce-impact-decision is-${tone}`} key={row.id}>
                    <div className="nce-impact-decision-head">
                      <div>
                        <strong>{NCE_PATIENT_OUTCOME_LABEL[p.outcome] ?? p.outcome}</strong>
                        <span className="nce-impact-decision-meta">{timeText(row.decided_at)} · {row.actor_name}</span>
                      </div>
                      <span className={`tag ${tone}`}>{p.resultCount ?? '—'} kết quả</span>
                    </div>
                    <p>{p.description || 'Chưa ghi căn cứ / cách rà soát.'}</p>
                    <p className="nce-impact-decision-meta">{coverageText(payload<{ coverage?: ImpactCoverage | null }>(row).coverage)}</p>
                    {(p.reference || p.notified) && <div className="nce-impact-reference">{[p.reference, p.notified].filter(Boolean).join(' · ')}</div>}
                  </li>
                );
              })}
            </ol>
          ) : !form && <p className="nce-impact-pending">Rà soát các kết quả trong phạm vi nêu trên, rồi ghi quyết định để tiếp tục bước cho hoạt động trở lại.</p>}
          {scopeProblems.length > 0 && <div className="alert warn"><ul className="nce-list">{scopeProblems.map((item) => <li key={item.code}>{item.message}</li>)}</ul></div>}
          {can.edit && !can.patient_impact && <p className="hint-inline">Quyết định ảnh hưởng bệnh nhân cần người có thẩm quyền (quyền nce.release). Quản trị viên cấp quyền ở trang Người dùng.</p>}
        </div>
      </div>
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
            <button type="button" className="btn ghost sm" onClick={() => setForm(null)}>Bỏ qua</button>
            <button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi quyết định</button>
          </div>
        </div>
      )}
    </Section>
  );
}

// --------------------------------------- 3. Cho phép hoạt động trở lại

interface ReleasePayload { reason: string; notApplicable: boolean; rerun: { date: string; runId: string } | null; lotChangeNote: string; verificationWarnings?: { code: string; message: string }[] }

function useRerunOptions(testId: string | null, failures: { date: string; runId: string }[], notBefore: string, enabled: boolean) {
  const [choices, setChoices] = useState<NceRunChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  useStoreInvalidation(['qc_points', 'tests', 'test_levels', 'qc_lots', 'lot_groups', 'lot_transitions', 'instruments', 'qc_panels', 'qc_panel_tests', 'nce_records', 'nce_cuts', 'period_locks', 'app_meta'], testId ?? undefined, refresh);
  const failureKey = failures.map((f) => `${f.date}/${f.runId}`).join(',');
  useEffect(() => {
    if (!enabled || !testId) { setChoices([]); setLoading(false); return; }
    let alive = true;
    setLoading(true); setError('');
    void (async () => {
      try {
        const levels = (await window.qcApi.listTestLevels(testId)).filter((level) => level.operational);
        const points = (await Promise.all(levels.map((level) => window.qcApi.queryPoints(testId, level.level)))).flat();
        if (alive) setChoices(nceRerunChoices(points, failures, notBefore));
      } catch (error) {
        if (alive) { setChoices([]); setError(error instanceof Error ? error.message : 'Không tải được lần chạy QC.'); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // `failures` dựng lại mỗi lần vẽ; khoá theo nội dung.
  }, [enabled, testId, failureKey, notBefore, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  return { choices, loading, error, refresh, revision };
}

export function ReleaseSection(props: SectionProps) {
  const { record, runs, decisions, can } = props.dossier;
  const { release, previewRelease } = useNceStore(useShallow((s) => ({ release: s.release, previewRelease: s.previewRelease })));
  const decision = decisions.find((d) => d.type === 'release');
  const rerunRun = runs.find((r) => r.role === 'rerun');
  const failures = runs.filter((r) => r.role !== 'rerun').map((r) => ({ date: r.date, runId: r.run_id }));
  const open = record.status === 'open';
  const candidates = useRerunOptions(record.test_id, failures, record.detected_at, open && can.release);
  const options = candidates.choices.filter((o) => !o.exclusionReasons.length);
  const excluded = candidates.choices.filter((o) => o.exclusionReasons.length);
  const [runKey, setRunKey] = useState('');
  const [preview, setPreview] = useState<NceReleasePreview | null>(null);
  const [lotChangeNote, setLotChangeNote] = useState('');
  const [reason, setReason] = useState('');
  const [notApplicable, setNotApplicable] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const chosen = options.find((o) => o.key === runKey) ?? null;
  const iqc = record.source === 'iqc';
  const prerequisites = props.dossier.missing.filter((item) => !item.code.includes('rerun'));
  const chosenDate = chosen?.date, chosenRunId = chosen?.runId;

  // Tính lại preview khi QC đổi hoặc giải thích đổi lô đổi; bỏ phản hồi cũ
  // nếu người dùng chuyển ứng viên trong lúc yêu cầu trước còn đang chạy.
  useEffect(() => {
    let alive = true;
    setPreviewError('');
    if (!open || !can.release || !chosenDate || chosenRunId === undefined || candidates.loading) { setPreview(null); setPreviewLoading(false); return; }
    setPreviewLoading(true);
    void previewRelease(record.id, { date: chosenDate, runId: chosenRunId }, lotChangeNote).then((result) => {
      if (!alive) return;
      setPreviewLoading(false);
      if (result.ok) setPreview(result.data); else { setPreview(null); setPreviewError(result.error.message); }
    }).catch((error) => { if (alive) { setPreview(null); setPreviewLoading(false); setPreviewError(error instanceof Error ? error.message : 'Không đánh giá được lần QC.'); } });
    return () => { alive = false; };
  }, [record.id, open, can.release, chosenDate, chosenRunId, lotChangeNote, candidates.loading, candidates.revision, previewRelease]);

  async function submit() {
    const target = chosen ? `Từ lần chạy ${chosen.label}, luật Westgard nhiều lần chạy và CUSUM bắt đầu chuỗi mới; ` : '';
    if (!(await confirmDialog(`${target}hồ sơ sẽ không huỷ được nữa. Cho phép hoạt động trở lại?`, { title: 'Cho phép hoạt động trở lại', confirmLabel: 'Cho phép', cancelLabel: 'Quay lại' }))) return;
    await props.run((base) => release({ ...base, expectedVersion: draftVersion ?? record.row_version, release: { reason, rerun: chosen ? { date: chosen.date, runId: chosen.runId } : null, lotChangeNote, notApplicable: !chosen && notApplicable } }));
  }

  if (decision) {
    const p = payload<ReleasePayload>(decision);
    return (
      <Section title="Cho phép hoạt động trở lại">
        <div className="nce-release-record">
          <div className="nce-release-record-main">
            <div className="nce-release-record-head">
              <div>
                <p className="nce-eyebrow">Quyết định đã ghi</p>
                <h3>Đã cho phép hoạt động trở lại</h3>
                <p>{decision.actor_name} · {timeText(decision.decided_at)}</p>
              </div>
              <span className="tag ok">Đã cho phép</span>
            </div>
            <div className="nce-release-record-details">
              <div><p className="nce-eyebrow">Căn cứ</p><p>{p.reason || 'Chưa ghi nhận căn cứ.'}</p></div>
              <div>
                <p className="nce-eyebrow">Lần chạy rerun / xác minh</p>
                <p>{p.rerun ? <>{nceRunLabel(p.rerun)}<span className="nce-release-record-support">Mốc bắt đầu lại chuỗi Westgard/CUSUM</span></> : p.notApplicable ? 'Không phải dừng dịch vụ' : 'Không dùng lần chạy QC'}</p>
              </div>
              {p.lotChangeNote && <div><p className="nce-eyebrow">Giải thích đổi lô</p><p>{p.lotChangeNote}</p></div>}
            </div>
          </div>
          {rerunRun && (
            <div className="nce-release-evidence">
              <div><p className="nce-eyebrow">Bằng chứng QC xác minh</p><h3>{nceRunLabel({ date: rerunRun.date, runId: rerunRun.run_id })}</h3></div>
              <div className="nce-release-evidence-table"><SnapshotTable points={runPoints(rerunRun)} /></div>
            </div>
          )}
        </div>
        {!!p.verificationWarnings?.length && <div className="alert warn"><ul className="nce-list">{p.verificationWarnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul></div>}
      </Section>
    );
  }
  if (!open) return null;
  return (
    <Section title="Cho phép hoạt động trở lại">
      <div className="nce-release-intro">
        <div>
          <p className="nce-eyebrow">Bước 4 · Khôi phục vận hành</p>
          <h3>Chỉ cho phép khi lần QC xác minh đạt yêu cầu</h3>
          <p>Đối chiếu lần chạy sau khi xử lý kỹ thuật hoàn tất và đủ các mức theo SOP.</p>
        </div>
        <div className="nce-release-boundary">
          <b>Phạm vi quyết định</b>
          <span>Không đồng nghĩa cho trả các kết quả cũ đang giữ hoặc đóng hồ sơ CAPA.</span>
        </div>
      </div>
      {!can.release ? <div className="alert info">Bước này cần tài khoản có quyền cho phép hoạt động trở lại (nce.release). Quản trị viên cấp quyền ở trang Người dùng.</div> : (
        <div className="nce-release-flow">
          {record.test_id && (
            <div className="nce-release-stage nce-release-choice">
              <div className="nce-release-stage-heading">
                <span className="step-number">1</span>
                <div><p className="nce-eyebrow">Chọn bằng chứng QC</p><h3>{iqc ? 'Lần chạy rerun' : 'Lần chạy QC xác minh'}</h3></div>
              </div>
              <Field label={iqc ? 'Lần chạy QC rerun' : 'Lần chạy QC xác minh (nếu có)'} htmlFor="relRun">
                <select id="relRun" disabled={candidates.loading} value={chosen ? runKey : ''} onChange={(e) => { setDraftVersion((v) => v ?? record.row_version); setPreview(null); setRunKey(e.target.value); }}>
                  <option value="">{candidates.loading ? '— Đang tải các lần QC —' : options.length ? '— Chọn lần QC để đánh giá —' : '— Chưa có lần QC phù hợp để chọn —'}</option>
                  {options.map((o) => <option key={o.key} value={o.key}>{o.label} · {o.levels.map((l) => `M${l}`).join(', ')}</option>)}
                </select>
              </Field>
              <p className="nce-release-helper">Ngày phát hiện: {dateText(record.detected_at)}. Danh sách đã được lọc theo ngày và thứ tự lần chạy.</p>
              <div className="nce-release-choice-actions"><button type="button" className="btn ghost sm" disabled={candidates.loading} onClick={candidates.refresh}>Cập nhật lần chạy QC</button></div>
              {candidates.error && <div className="alert rej" role="alert">Không tải được danh sách QC: {candidates.error}</div>}
              {!candidates.loading && !candidates.error && !candidates.choices.length && <div className="alert info">Không tìm thấy điểm QC ở các mức đang vận hành của xét nghiệm này. Kiểm tra đúng xét nghiệm, mức và dữ liệu đã lưu.</div>}
            </div>
          )}
          <div className="nce-release-stage nce-release-verification">
            <div className="nce-release-stage-heading">
              <span className="step-number">2</span>
              <div><p className="nce-eyebrow">Đánh giá lại</p><h3>{chosen ? chosen.label : 'Chưa chọn lần QC'}</h3></div>
              <span className={`tag ${preview?.ok ? 'ok' : preview ? 'rej' : 'none'}`}>{previewLoading ? 'Đang đánh giá' : preview?.ok ? 'Đạt' : preview ? 'Chưa đạt' : 'Chờ đánh giá'}</span>
            </div>
            {previewError && <div className="alert rej" role="alert">{previewError}</div>}
            {previewLoading && <p className="nce-release-placeholder" role="status">Đang đánh giá lại lần QC đã chọn…</p>}
            {!preview && !previewLoading && !previewError && <p className="nce-release-placeholder">Chọn một lần QC ở bước 1 để kiểm tra đầy đủ mức, lô, giá trị và luật Westgard.</p>}
            {preview && !previewLoading && (
              <div className="nce-release-preview">
                <SnapshotTable points={preview.points} />
                {preview.warnings.length > 0 && <div className="alert warn"><ul className="nce-list">{preview.warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul></div>}
                {preview.ok
                  ? <div className="alert ok">Lần chạy đạt khi đánh giá trong giai đoạn mới.</div>
                  : <div className="alert rej"><ul className="nce-list">{preview.problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul></div>}
                {preview.impact_problems.length > 0 && <div className="alert rej"><ul className="nce-list">{preview.impact_problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul></div>}
              </div>
            )}
          </div>
          {excluded.length > 0 && <details className="nce-rerun-excluded" open={!options.length}>
                <summary>{excluded.length} lần QC không được chọn — xem lý do</summary>
                <table className="nce-table"><thead><tr><th>Lần chạy</th><th>Lý do không được chọn</th></tr></thead><tbody>{excluded.slice(0, 20).map((o) => <tr key={o.key}><td>{o.label}</td><td>{o.exclusionReasons.join('; ')}</td></tr>)}</tbody></table>
                {excluded.length > 20 && <p className="nce-note">Hiển thị 20 lần không được chọn gần nhất.</p>}
                {excluded.some((o) => o.date < record.detected_at) && <p className="nce-note">Nếu nhập nhầm ngày phát hiện, đính chính có căn cứ ở bước Ghi nhận sự cố. Nếu thực sự mới phát hiện, không dùng QC trước ngày đó làm bằng chứng sau phát hiện.{props.onIdentity && <button type="button" className="btn ghost sm" onClick={props.onIdentity}>Đến phần ghi nhận</button>}</p>}
              </details>}
          {preview && preview.lot_changed_levels.length > 0 && (
            <Field label="Giải thích dùng lô QC khác lần chạy khởi đầu" htmlFor="relLot" wide><input id="relLot" value={lotChangeNote} onChange={(e) => { setDraftVersion((v) => v ?? record.row_version); setLotChangeNote(e.target.value); }} /></Field>
          )}
          {!iqc && !chosen && (
            <label className="nce-check nce-field-wide"><input type="checkbox" checked={notApplicable} onChange={(e) => setNotApplicable(e.target.checked)} /> Không phải dừng dịch vụ (ghi lý do ở dưới)</label>
          )}
          <div className="nce-release-decision">
            <div className="nce-release-stage-heading">
              <span className="step-number">3</span>
              <div><p className="nce-eyebrow">Xác nhận quyết định</p><h3>Ghi căn cứ và cho phép hoạt động</h3></div>
            </div>
            <Field label="Căn cứ cho phép hoạt động trở lại" htmlFor="relReason"><textarea id="relReason" rows={2} value={reason} onChange={(e) => { setDraftVersion((v) => v ?? record.row_version); setReason(e.target.value); }} /></Field>
            {!!prerequisites.length && <div className="alert warn nce-release-prerequisites"><p>Trước khi cho hoạt động trở lại, cần hoàn tất:</p><ul className="nce-list">{prerequisites.map((item) => <li key={item.code}>{item.message}</li>)}</ul></div>}
            <div className="nce-form-actions">
              <button type="button" className="btn" disabled={props.busy || candidates.loading || previewLoading || !!prerequisites.length || reason.trim().length < (iqc ? 5 : 10) || (iqc && !chosen) || (!!chosen && (preview?.ok !== true || preview.impact_problems.length > 0))} onClick={() => void submit()}>Cho phép hoạt động trở lại</button>
            </div>
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
  const [draftVersion, setDraftVersion] = useState(0);
  const d = editor.draft;
  async function save() {
    if (!form) return;
    if (await props.run((base) => reviewStore({ ...base, expectedVersion: draftVersion, review: form }))) setForm(null);
  }
  return (
    <Section title="Đánh giá hiệu lực và nguy cơ còn lại" actions={editor.actions(can.edit)}>
      {props.dossier.missing.some((item) => item.code === 'effectiveness-basis-changed') && <div className="alert warn">Đánh giá cũ vẫn lưu trong lịch sử nhưng không còn khớp nội dung hiện tại. Rà soát tiêu chí, nguy cơ, hành động rồi ghi đánh giá mới.</div>}
      {d ? (
        <div className="nce-form-grid">
          <Field label="Tiêu chí đánh giá hiệu lực (đặt trước khi đánh giá)" htmlFor="effCrit" wide><textarea id="effCrit" rows={2} value={d.effectivenessCriteria} onChange={(e) => editor.set('effectivenessCriteria', e.target.value)} /></Field>
          <DateField label="Ngày dự kiến đánh giá" id="effDue" value={d.effectivenessReviewDue} onChange={(v) => editor.set('effectivenessReviewDue', v)} />
        </div>
      ) : (
        <div className="nce-effectiveness-plan">
          <div className={`nce-capa-summary-card${record.effectiveness_criteria ? ' is-set' : ' is-empty'}`}><p className="nce-eyebrow">Tiêu chí đánh giá</p><h3>{record.effectiveness_criteria || 'Chưa đặt tiêu chí'}</h3></div>
          <div className={`nce-capa-summary-card${record.effectiveness_review_due ? ' is-set' : ' is-empty'}`}><p className="nce-eyebrow">Ngày dự kiến đánh giá</p><h3>{record.effectiveness_review_due ? dateText(record.effectiveness_review_due) : 'Chưa lên lịch'}</h3></div>
        </div>
      )}
      {reviews.length > 0 && (
        <ol className="nce-effectiveness-list">{reviews.map((row) => {
            const p = payload<ReviewPayload>(row);
            return (
              <li className="nce-effectiveness-item" key={row.id}>
                <div className="nce-effectiveness-item-head"><div><p className="nce-eyebrow">{dateText(p.reviewedAt)}</p><h3>{row.actor_name}</h3></div><span className={`tag ${p.result === 'effective' ? 'ok' : p.result === 'ineffective' ? 'rej' : 'warn'}`}>{NCE_EFFECTIVENESS_RESULT_LABEL[p.result] ?? p.result}</span></div>
                <div className="nce-effectiveness-item-body"><div><p className="nce-eyebrow">Bằng chứng</p><p>{p.evidence || 'Chưa ghi nhận bằng chứng.'}</p></div><div><p className="nce-eyebrow">Nguy cơ còn lại</p><p>{p.result === 'effective' ? `${NCE_RISK_LEVEL_LABEL[p.residualLevel] ?? '—'} · điểm ${nceRiskText(p.residualSeverity, p.residualProbability)}` : 'Chưa đánh giá lại.'}</p></div></div>
              </li>
            );
          })}</ol>
      )}
      {can.review_effectiveness && !form && <div className="nce-form-actions"><button type="button" className="btn ghost sm" onClick={() => { setDraftVersion(record.row_version); setForm({ result: '', reviewedAt: todayIso(), evidence: '', residualSeverity: 0, residualProbability: 0, residualLevel: '', residualBasis: '' }); }}>Ghi đánh giá hiệu lực</button></div>}
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
            <button type="button" className="btn ghost sm" onClick={() => setForm(null)}>Bỏ qua</button>
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
  const [noteVersion, setNoteVersion] = useState<number | null>(null);
  const approval = decisions.find((d) => d.type === 'approve');
  const lastReturn = [...decisions].reverse().find((d) => d.type === 'return');
  const cancelled = decisions.find((d) => d.type === 'cancel');
  const pending = record.status === 'pending_approval';

  async function decide(write: Parameters<SectionProps['run']>[0]) {
    // Ghi chú thuộc một lần quyết định. Sau khi lưu thành công phải mở bản
    // nháp mới cho vòng duyệt kế tiếp; lỗi thì giữ nguyên nội dung/phiên bản.
    if (await props.run(write)) { setNote(''); setNoteVersion(null); }
  }

  async function doCancel() {
    // Giữ đúng phiên bản đang được xác nhận, kể cả khi dữ liệu tự nạp lại
    // trong lúc hộp thoại chờ câu trả lời của người dùng.
    const expectedVersion = noteVersion ?? record.row_version;
    if (!(await confirmDialog('Huỷ hồ sơ này? Hồ sơ vẫn được lưu để truy xuất.', { title: 'Huỷ hồ sơ NCE', danger: true, confirmLabel: 'Huỷ hồ sơ', cancelLabel: 'Quay lại' }))) return;
    await decide((base) => cancel({ ...base, expectedVersion, reason: note }));
  }

  return (
    <Section title="Nộp duyệt và phê duyệt">
      {approval && <Facts items={[['Đã duyệt đóng', `${approval.actor_name} · ${timeText(approval.decided_at)}`], ['Ghi chú', payload<{ note?: string }>(approval).note ?? '']]} />}
      {cancelled && <Facts items={[['Đã huỷ', `${cancelled.actor_name} · ${timeText(cancelled.decided_at)}`], ['Lý do', payload<{ reason?: string }>(cancelled).reason ?? '']]} />}
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
              <Field label="Ghi chú duyệt / lý do trả lại" htmlFor="revNote" wide><textarea id="revNote" rows={2} value={note} onChange={(e) => { setNoteVersion((v) => v ?? record.row_version); setNote(e.target.value); }} /></Field>
              <div className="nce-form-actions nce-field-wide">
                {can.return && <button type="button" className="btn ghost" disabled={props.busy} onClick={() => void decide((base) => returnForRevision({ ...base, expectedVersion: noteVersion ?? record.row_version, note }))}>Trả lại</button>}
                {can.approve && <button type="button" className="btn" disabled={props.busy} onClick={() => void decide((base) => approve({ ...base, expectedVersion: noteVersion ?? record.row_version, note }))}>Duyệt đóng hồ sơ</button>}
              </div>
            </div>
          ) : !approveBlock && <p className="hint-inline">Hồ sơ đang chờ người có quyền duyệt (nce.approve).</p>}
        </>
      )}
      {record.status === 'open' && can.cancel && (
        <div className="nce-form-grid nce-cancel">
          <Field label="Lý do huỷ (hồ sơ lập nhầm, trùng)" htmlFor="cancelReason" wide><input id="cancelReason" value={note} onChange={(e) => { setNoteVersion((v) => v ?? record.row_version); setNote(e.target.value); }} /></Field>
          <div className="nce-form-actions nce-field-wide"><button type="button" className="btn danger sm" disabled={props.busy} onClick={() => void doCancel()}>Huỷ hồ sơ</button></div>
        </div>
      )}
    </Section>
  );
}
