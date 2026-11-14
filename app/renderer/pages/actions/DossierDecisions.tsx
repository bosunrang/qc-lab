// Các phần QUYẾT ĐỊNH của hồ sơ (append-only, có người chịu trách nhiệm):
// ảnh hưởng kết quả bệnh nhân, cho phép hoạt động trở lại, đánh giá hiệu lực,
// nộp duyệt/duyệt/trả lại/huỷ. Điều kiện của từng bước do main kiểm.
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DateField } from '../../components/DateField';
import { EmptyState } from '../../components/EmptyState';
import { FormErrorMessage } from '../../components/FormErrorMessage';
import { controlValue, findFieldControl, formErrorFrom, pickField, type FieldErrorMap, type FormError } from '../../lib/field-error';
import { useInvalidField } from '../../lib/useInvalidField';
import { useFormError } from '../../lib/useFormError';
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
import { dateText, Facts, Field, InlineFieldErrorContext, OptionSelect, runPoints, ScaleSelect, Section, SnapshotTable, timeText } from './shared';
import { decisionPayload as payload } from './decision-data';

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

// Chỉ định vị lỗi main trả về, không lặp lại phép tính hay điều kiện nghiệp vụ.
const TECHNICAL_FIELD_ERRORS: FieldErrorMap = {
  'technical-error-nature': 'techNature', 'technical-method': 'techMethod',
  'technical-evidence': 'techEvidence', 'technical-conclusion': 'techConclusion',
  'technical-metric-mode': 'techMode', 'technical-metric-reason': 'techMetricReason',
  'technical-systematic-metrics': 'techMode', 'technical-unit': 'techUnit',
  'technical-tea': 'techTea', 'technical-tea-source': 'techTeaSource',
  'technical-bias': ['techStableBias', 'techIncidentBias'], 'technical-sd': 'techSd',
  'technical-sd-source': 'techSdSource', 'technical-dispersion': 'techDispersion',
  'technical-sample-count': 'techN', 'technical-mean-reset': 'techMean',
  'technical-mean-reset-reason': 'techMeanReason',
  'technical-mean-reset-metrics': ['techTea', 'techPostBias', 'techMode'],
  'technical-mean-reset-bias': 'techPostBias', 'technical-mean-reset-evidence': 'techMeanEvidence',
};

export function TechnicalAssessmentSection(props: SectionProps) {
  const { record, decisions, runs, can } = props.dossier;
  const saveAssessment = useNceStore((s) => s.recordTechnicalAssessment);
  const assessments = decisions.filter((decision) => decision.type === 'technical_assessment');
  const [form, setForm] = useState<NceTechnicalAssessmentInput | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const formRoot = useRef<HTMLDivElement>(null);
  const [fieldError, setFieldError] = useState<FormError | null>(null);
  const errorId = useInvalidField(formRoot, fieldError);
  useEffect(() => {
    const field = fieldError?.fields[0];
    if (formRoot.current && field) findFieldControl(formRoot.current, field)?.scrollIntoView({ block: 'center' });
  }, [fieldError]);
  const requiresMeanReview = runs
    .filter((run) => run.role !== 'rerun')
    .some((run) => runPoints(run).some((point) => point.rules.some((rule) => ['8x', '9x', '10x', '12x'].includes(rule))));
  const latest = assessments.at(-1);

  function set<K extends keyof NceTechnicalAssessmentInput>(key: K, value: NceTechnicalAssessmentInput[K]) {
    setFieldError(null);
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  // Số liệu main tính sẵn từ dữ liệu QC (đơn vị %, TEa vận hành, Bias, SD…):
  // điền vào form khi mở, người dùng xem lại và sửa nếu cần (đánh giá giao
  // diện 09/11/2026). Bản chất sai số gợi ý theo loại sai số của lần khởi đầu.
  const prefill = props.dossier.technical_prefill;
  const [prefilled, setPrefilled] = useState(false);
  function startForm() {
    setFieldError(null);
    setDraftVersion(record.row_version);
    const base: NceTechnicalAssessmentInput = { ...EMPTY_TECHNICAL, meanResetDecision: requiresMeanReview ? 'not_allowed' : 'not_applicable' };
    const errorNature = record.error_class === 'SE' ? 'systematic' : record.error_class === 'RE' ? 'random' : base.errorNature;
    if (!prefill) { setPrefilled(false); setForm({ ...base, errorNature }); return; }
    setPrefilled(true);
    setForm({
      ...base, errorNature, metricMode: 'calculated',
      unit: prefill.unit, tea: prefill.tea, teaSource: prefill.teaSource,
      stableBias: prefill.stableBias, incidentBias: prefill.incidentBias,
      sd: prefill.sd, sdSource: prefill.sdSource,
      observedDispersion: prefill.observedDispersion, sampleCount: prefill.sampleCount,
    });
  }

  async function save() {
    if (!form) return;
    setFieldError(null);
    if (await props.run((base) => saveAssessment({ ...base, expectedVersion: draftVersion, assessment: form }), {
      handleValidationError: (error) => {
        const root = formRoot.current;
        if (!root || root.closest('.nce-stage[hidden]')) return false;
        const mapped = formErrorFrom(error, TECHNICAL_FIELD_ERRORS);
        const field = pickField(mapped.fields, (id) => {
          const control = findFieldControl(root, id);
          return control ? controlValue(control) : null;
        });
        if (!field) return false;
        setFieldError({ message: mapped.message, fields: [field] });
        return true;
      },
    })) { setFieldError(null); setForm(null); }
  }

  if (record.source !== 'iqc') {
    return <Section title="Xác minh kỹ thuật"><div className="nce-technical-na"><span className="tag none">Không áp dụng</span><p>Hồ sơ này không phát sinh từ nội kiểm. Bằng chứng kỹ thuật được ghi ở phần điều tra và hành động phù hợp với nguồn sự cố.</p></div></Section>;
  }

  return (
    <Section title="Xác minh kỹ thuật IQC" actions={can.edit && latest && !form ? <button type="button" className="btn ghost sm" onClick={startForm}>Ghi đánh giá mới</button> : null}>
      {latest && !form ? (() => {
        const value = payload<TechnicalPayload>(latest);
        const calculated = value.metricMode === 'calculated';
        const tone = value.technicalSignal === 'exceeds_threshold' ? 'warn' : value.technicalSignal === 'below_threshold' ? 'ok' : 'none';
        return <div className="nce-technical-record">
          <div className="nce-technical-record-head">
            <div><p className="nce-eyebrow">Kết luận kỹ thuật gần nhất</p><h3>{NCE_TECHNICAL_ERROR_LABEL[value.errorNature ?? ''] ?? 'Chưa ghi nhận bản chất sai số'}</h3><p className="nce-technical-conclusion">{value.technicalConclusion}</p><p className="nce-technical-record-meta">{latest.actor_name} · {timeText(latest.decided_at)}</p></div>
            <span className={`tag ${tone}`}>{NCE_TECHNICAL_SIGNAL_LABEL[value.technicalSignal ?? ''] ?? 'Chưa tính'}</span>
          </div>
          <dl className="nce-technical-evidence">
            <div><dt>Phương pháp xác minh</dt><dd>{value.verificationMethod}</dd></div>
            <div><dt>Xử lý và bằng chứng</dt><dd>{value.correctiveEvidence}</dd></div>
          </dl>
          {calculated ? <details className="nce-technical-calculations">
          <summary>Số liệu và căn cứ định lượng</summary>
          <div className="nce-technical-metrics">
            <div><span>ΔSEcrit</span><b>{numberText(value.deltaSeCrit)}</b><small>(TEa − |Bias ổn định|) / SD − 1,65</small></div>
            <div><span>SEobs</span><b>{numberText(value.seObs)}</b><small>|Bias sự cố − Bias ổn định| / SD</small></div>
            <div><span>ΔREcrit</span><b>{numberText(value.deltaReCrit)}</b><small>(TEa − |Bias ổn định|) / (1,65 × SD)</small></div>
            <div><span>REobs</span><b>{numberText(value.reObs)}</b><small>Độ phân tán quan sát / SD</small></div>
          </div>
          <Facts items={[
            ['Đơn vị chung', value.unit], ['TEa / APS', numberText(value.tea)], ['Nguồn TEa / APS', value.teaSource],
            ['Bias ổn định trước sự cố', numberText(value.stableBias)], ['Bias lúc sự cố', numberText(value.incidentBias)],
            ['SD nội bộ', numberText(value.sd)], ['Nguồn / khoảng dữ liệu SD', value.sdSource],
            ['Độ phân tán quan sát', numberText(value.observedDispersion)], ['Cỡ dữ liệu xác minh', numberText(value.sampleCount)],
            ['Bias sau khắc phục', numberText(value.postCorrectionBias)],
          ]} />
          </details> : <dl className="nce-technical-evidence"><div><dt>Đánh giá định lượng</dt><dd><b>{value.metricMode === 'not_applicable' ? 'Không áp dụng' : 'Chưa ghi nhận'}</b><p>{value.metricReason}</p></dd></div></dl>}
          {requiresMeanReview && <div className="nce-technical-mean"><p className="nce-eyebrow">Xem xét Mean/SD mới</p><b>{NCE_MEAN_RESET_LABEL[value.meanResetDecision ?? ''] ?? 'Chưa ghi nhận'}</b><p>{value.meanResetReason}</p>{value.meanResetEvidence && <small>{value.meanResetEvidence}</small>}</div>}
        </div>;
      })() : !form && <EmptyState size="compact" title="Chưa có đánh giá kỹ thuật" action={can.edit && <button type="button" className="btn ghost" onClick={startForm}>Ghi đánh giá</button>}>Ghi bản chất sai số, bằng chứng xử lý và kết luận xác minh.</EmptyState>}

      {form && <InlineFieldErrorContext.Provider value={fieldError ? { field: fieldError.fields[0], id: errorId, message: fieldError.message } : null}><div className="nce-technical-form" ref={formRoot}>
        {draftVersion !== record.row_version && <p className="nce-editor-warning">Hồ sơ đã được cập nhật ở nơi khác</p>}
        <section className="nce-technical-form-section" aria-label="Bản chất sai số và bằng chứng">
        <h3>Bản chất sai số và bằng chứng</h3>
        <div className="nce-technical-mode"><Field label="Bản chất sai số" htmlFor="techNature"><OptionSelect id="techNature" value={form.errorNature} options={NCE_TECHNICAL_ERROR_LABEL} onChange={(value) => set('errorNature', value as NceTechnicalAssessmentInput['errorNature'])} /></Field></div>
        <div className="nce-form-grid">
          <Field label="Phương pháp xác minh" htmlFor="techMethod" wide><textarea id="techMethod" rows={2} value={form.verificationMethod} onChange={(event) => set('verificationMethod', event.target.value)} placeholder="Đối chiếu nhật ký máy, hiệu chuẩn, lô vật liệu, thao tác…" /></Field>
          <Field label="Xử lý kỹ thuật và bằng chứng sau khắc phục" htmlFor="techEvidence" wide><textarea id="techEvidence" rows={2} value={form.correctiveEvidence} onChange={(event) => set('correctiveEvidence', event.target.value)} /></Field>
        </div>
        </section>

        <section className="nce-technical-form-section" aria-label="Đánh giá định lượng">
        <h3>Đánh giá định lượng</h3>
        <div className="nce-technical-mode"><Field label="Cách đánh giá" htmlFor="techMode"><OptionSelect id="techMode" value={form.metricMode} options={METRIC_MODE_LABEL} onChange={(value) => set('metricMode', value as NceTechnicalAssessmentInput['metricMode'])} /></Field></div>
        {form.metricMode === 'calculated' ? <div className="nce-technical-inputs">
          <p className="nce-note">Dùng cùng đơn vị và ghi rõ nguồn. Không dùng một điểm rerun đơn lẻ làm Bias.</p>
          {prefilled && prefill && <details className="nce-technical-prefill" open>
            <summary>Số liệu điền sẵn · M{prefill.level} · Lô {prefill.lot}</summary>
            <div><p>Đơn vị % so với Mean đích. Bias ổn định và SD tính từ {prefill.sampleCount ?? 0} điểm được chấp nhận trước sự cố; Bias lúc sự cố từ {prefill.incidentCount} điểm của chuỗi vi phạm. Kiểm tra lại và sửa nếu cần trước khi ghi.</p>
            {prefill.notes.map((note) => <p key={note}>{note}</p>)}</div>
          </details>}
          <div className="nce-form-grid nce-technical-input-grid">
            <Field label="Đơn vị chung" htmlFor="techUnit"><input id="techUnit" value={form.unit} onChange={(event) => set('unit', event.target.value)} /></Field>
            <Field label="TEa / APS" htmlFor="techTea"><input id="techTea" type="number" step="any" value={form.tea ?? ''} onChange={(event) => set('tea', metricNumber(event.target.value))} /></Field>
            <Field label="Nguồn TEa / APS và phiên bản" htmlFor="techTeaSource"><input id="techTeaSource" value={form.teaSource} onChange={(event) => set('teaSource', event.target.value)} /></Field>
            <Field label="Bias ổn định trước sự cố" htmlFor="techStableBias"><input id="techStableBias" type="number" step="any" value={form.stableBias ?? ''} onChange={(event) => set('stableBias', metricNumber(event.target.value))} /></Field>
            <Field label="Bias lúc sự cố" htmlFor="techIncidentBias"><input id="techIncidentBias" type="number" step="any" value={form.incidentBias ?? ''} onChange={(event) => set('incidentBias', metricNumber(event.target.value))} /></Field>
            <Field label="Bias sau khắc phục (khi xét Mean/SD)" htmlFor="techPostBias"><input id="techPostBias" type="number" step="any" value={form.postCorrectionBias ?? ''} onChange={(event) => set('postCorrectionBias', metricNumber(event.target.value))} /></Field>
            <Field label="SD nội bộ" htmlFor="techSd"><input id="techSd" type="number" min="0" step="any" value={form.sd ?? ''} onChange={(event) => set('sd', metricNumber(event.target.value))} /></Field>
            <Field label="Nguồn / khoảng dữ liệu SD" htmlFor="techSdSource"><input id="techSdSource" value={form.sdSource} onChange={(event) => set('sdSource', event.target.value)} /></Field>
            <Field label="Độ phân tán quan sát" htmlFor="techDispersion"><input id="techDispersion" type="number" min="0" step="any" value={form.observedDispersion ?? ''} onChange={(event) => set('observedDispersion', metricNumber(event.target.value))} /></Field>
            <Field label="Cỡ dữ liệu xác minh" htmlFor="techN"><input id="techN" type="number" min="2" step="1" value={form.sampleCount ?? ''} onChange={(event) => set('sampleCount', metricNumber(event.target.value))} /></Field>
          </div>
        </div> : <Field label="Lý do không áp dụng TEa / Bias / SD" htmlFor="techMetricReason" wide><textarea id="techMetricReason" rows={2} value={form.metricReason} onChange={(event) => set('metricReason', event.target.value)} /></Field>}
        </section>

        {requiresMeanReview && <div className="nce-technical-mean-form">
          <div><p className="nce-eyebrow">Luật dịch chuyển dài</p><h3>Quyết định riêng về Mean/SD</h3><p>Chỉ xem xét Mean/SD mới khi có thay đổi hợp lệ, đủ số liệu và Bias sau khắc phục không vượt 1/4 TEa.</p></div>
          <div className="nce-form-grid">
            <Field label="Kết luận" htmlFor="techMean"><OptionSelect id="techMean" value={form.meanResetDecision} options={NCE_MEAN_RESET_LABEL} onChange={(value) => set('meanResetDecision', value as NceTechnicalAssessmentInput['meanResetDecision'])} /></Field>
            <Field label="Căn cứ" htmlFor="techMeanReason"><input id="techMeanReason" value={form.meanResetReason} onChange={(event) => set('meanResetReason', event.target.value)} /></Field>
            {form.meanResetDecision === 'eligible' && <Field label="Bằng chứng thay đổi hợp lệ và tập dữ liệu" htmlFor="techMeanEvidence" wide><textarea id="techMeanEvidence" rows={2} value={form.meanResetEvidence} onChange={(event) => set('meanResetEvidence', event.target.value)} /></Field>}
          </div>
        </div>}

        <section className="nce-technical-form-section" aria-label="Kết luận kỹ thuật">
        <h3>Kết luận kỹ thuật</h3>
        <Field label="Nội dung kết luận" htmlFor="techConclusion" wide><textarea id="techConclusion" rows={3} value={form.technicalConclusion} onChange={(event) => set('technicalConclusion', event.target.value)} placeholder="Nêu sai số đã được kiểm soát hay chưa và căn cứ chuyển sang rà soát bệnh nhân." /></Field>
        </section>
        <div className="nce-form-actions"><button type="button" className="btn ghost sm" disabled={props.pending} onClick={() => { setFieldError(null); setForm(null); }}>Bỏ qua</button><button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi đánh giá kỹ thuật</button></div>
      </div></InlineFieldErrorContext.Provider>}
    </Section>
  );
}

// ------------------------------------------------ Ảnh hưởng bệnh nhân

interface ImpactPayload { outcome: string; description: string; resultCount: number | null; reference: string; notified: string }
interface ImpactCoverage { lastAccepted: { date: string; runId: string } | null; through: { date: string; runId: string }; runCount: number }

function coverageText(coverage: ImpactCoverage | null | undefined): string {
  if (!coverage?.through) return 'Chưa ghi phạm vi đã rà soát';
  const start = coverage.lastAccepted ? `Sau lần đạt ${nceRunLabel(coverage.lastAccepted)}` : 'Từ lần chạy đầu tiên';
  return `${start} tới lần ${nceRunLabel(coverage.through)}`;
}

function impactTone(outcome: string): 'ok' | 'warn' | 'none' {
  if (outcome === 'reported_corrected') return 'warn';
  if (outcome === 'not_applicable') return 'none';
  return 'ok';
}

const IMPACT_FIELD_ERRORS: FieldErrorMap = {
  'invalid-outcome': 'impOutcome', 'outcome-not-applicable': 'impOutcome',
  'missing-description': 'impDesc', 'invalid-count': 'impCount', 'missing-count': 'impCount',
  'missing-affected-count': 'impCount', 'missing-reference': 'impRef', 'missing-notified': 'impNotified',
};

/** Đọc nguyên quyết định và phạm vi đã chụp; không thay bằng khoảng hiện tại. */
function ImpactDecision({ row }: { row: NceDecisionRow }) {
  const value = payload<ImpactPayload & { coverage?: ImpactCoverage | null }>(row);
  const tone = impactTone(value.outcome ?? '');
  return <li className="nce-impact-decision">
    <div className="nce-impact-decision-head">
      <div><strong>{NCE_PATIENT_OUTCOME_LABEL[value.outcome ?? ''] ?? 'Chưa ghi nhận kết luận'}</strong><span className="nce-impact-decision-meta">{row.actor_name} · {timeText(row.decided_at)}</span></div>
      <span className={`tag ${tone}`}>{value.resultCount ?? '—'} kết quả</span>
    </div>
    <dl className="nce-impact-decision-details">
      <div><dt>Căn cứ / cách rà soát</dt><dd>{value.description || 'Chưa ghi căn cứ / cách rà soát.'}</dd></div>
      <div><dt>Phạm vi đã rà soát</dt><dd>{coverageText(value.coverage)}</dd></div>
      {value.reference && <div><dt>Mã tham chiếu</dt><dd>{value.reference}</dd></div>}
      {value.notified && <div><dt>Đã thông báo</dt><dd>{value.notified}</dd></div>}
    </dl>
  </li>;
}

export function PatientImpactSection(props: SectionProps) {
  const { record, decisions, suspect_window: window_, can } = props.dossier;
  const recordImpact = useNceStore((s) => s.recordPatientImpact);
  const impacts = decisions.filter((d) => d.type === 'patient_impact');
  const [form, setForm] = useState<ImpactPayload | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const formRoot = useRef<HTMLDivElement>(null);
  const [fieldError, setFieldError] = useState<FormError | null>(null);
  const errorId = useInvalidField(formRoot, fieldError);
  useEffect(() => {
    const field = fieldError?.fields[0];
    if (formRoot.current && field) findFieldControl(formRoot.current, field)?.scrollIntoView({ block: 'center' });
  }, [fieldError]);
  const outcomes = Object.fromEntries(Object.entries(NCE_PATIENT_OUTCOME_LABEL).filter(([key]) => record.source !== 'iqc' || key !== 'not_applicable'));
  const extended = !!window_ && (window_.onset.date !== window_.trigger.date || window_.onset.runId !== window_.trigger.runId);
  const scopeProblems = props.dossier.missing.filter((item) => item.code.startsWith('patient-impact-'));
  function startForm() {
    setFieldError(null);
    setDraftVersion(record.row_version);
    setForm({ outcome: '', description: '', resultCount: null, reference: '', notified: '' });
  }
  function set<K extends keyof ImpactPayload>(key: K, value: ImpactPayload[K]) {
    setFieldError(null);
    setForm((current) => current ? { ...current, [key]: value } : current);
  }
  async function save() {
    if (!form) return;
    setFieldError(null);
    const ok = await props.run((base) => recordImpact({ ...base, expectedVersion: draftVersion, impact: { ...form, resultCount: form.resultCount } }), {
      handleValidationError: (error) => {
        const root = formRoot.current;
        if (!root || root.closest('.nce-stage[hidden]')) return false;
        const mapped = formErrorFrom(error, IMPACT_FIELD_ERRORS);
        const field = pickField(mapped.fields, (id) => {
          const control = findFieldControl(root, id);
          return control ? controlValue(control) : null;
        });
        if (!field) return false;
        setFieldError({ message: mapped.message, fields: [field] });
        return true;
      },
    });
    if (ok) { setFieldError(null); setForm(null); }
  }
  return (
    <Section title="Ảnh hưởng kết quả bệnh nhân"
      actions={can.patient_impact && impacts.length > 0 && !form ? <button type="button" className="btn ghost sm" onClick={startForm}>Ghi quyết định mới</button> : null}>
      <div className="nce-impact-layout">
        <div className="nce-impact-scope">
          <h3>Phạm vi cần rà soát</h3>
          {window_ ? (
            <dl className="nce-impact-window">
              <div><dt>Bắt đầu</dt><dd>{window_.last_accepted ? <><span>Sau lần QC đạt cuối</span><strong>{dateText(window_.last_accepted.date)}</strong>{window_.last_accepted.runId && <small>Lần {window_.last_accepted.runId}</small>}</> : 'Từ lần chạy đầu tiên đang có'}</dd></div>
              <div><dt>Kết thúc</dt><dd>{window_.rerun ? <><span>Trước lần QC chạy lại</span><strong>{dateText(window_.rerun.date)}</strong>{window_.rerun.runId && <small>Lần {window_.rerun.runId}</small>}</> : 'Đến khi cho phép hoạt động trở lại'}</dd></div>
              <div><dt>Lần chạy QC</dt><dd><strong>{window_.runs.length} lần</strong><small>Trong khoảng cần rà soát</small></dd></div>
            </dl>
          ) : <p className="nce-note">Chưa xác định được khoảng nghi ngờ từ dữ liệu QC của hồ sơ.</p>}
          <div className="nce-impact-caution" role="note">
            {extended && window_ && <p>Luật {window_.onset_rules.join(', ')} đếm qua nhiều lần chạy: chuỗi vi phạm bắt đầu từ lần {nceRunLabel(window_.onset)}, nên các lần chạy từng được chấp nhận trong chuỗi cũng thuộc khoảng nghi ngờ.</p>}
            <p>QC chạy lại đạt không làm các kết quả đã trả trong khoảng này mặc nhiên hợp lệ.</p>
          </div>
        </div>
        {/* Quyết định nằm ngay dưới phạm vi; form ghi mở trong khung này. Chưa
            có quyết định thì chỉ một dòng nhắc, không chiếm nửa khung trống. */}
        <div className="nce-impact-decisions">
          {!form && impacts.length > 0 ? <>
            <h3>Quyết định gần nhất</h3>
            <ol className="nce-impact-decision-list"><ImpactDecision row={impacts.at(-1)!} /></ol>
            {impacts.length > 1 && <details className="nce-impact-history">
              <summary>Lịch sử quyết định ({impacts.length - 1})</summary>
              <ol className="nce-impact-decision-list">{impacts.slice(0, -1).reverse().map((row) => <ImpactDecision key={row.id} row={row} />)}</ol>
            </details>}
          </> : !form && <EmptyState size="compact" title="Chưa có quyết định" action={can.patient_impact && <button type="button" className="btn ghost" onClick={startForm}>Ghi quyết định</button>}>Ghi kết luận sau khi rà soát các kết quả trong phạm vi trên.</EmptyState>}
          {scopeProblems.length > 0 && <div className="alert warn"><ul className="nce-list">{scopeProblems.map((item) => <li key={item.code}>{item.message}</li>)}</ul></div>}
          {can.edit && !can.patient_impact && <p className="hint-inline">Bạn cần được cấp quyền đánh giá ảnh hưởng bệnh nhân để ghi quyết định. Liên hệ quản trị viên để cấp quyền.</p>}
          {form && <InlineFieldErrorContext.Provider value={fieldError ? { field: fieldError.fields[0], id: errorId, message: fieldError.message } : null}><div className="nce-impact-form" ref={formRoot}>
            <h3>Ghi quyết định</h3>
            {draftVersion !== record.row_version && <p className="nce-editor-warning">Hồ sơ đã được cập nhật ở nơi khác</p>}
            <div className="nce-form-grid nce-impact-form-grid">
              <Field label="Kết luận" htmlFor="impOutcome"><OptionSelect id="impOutcome" value={form.outcome} options={outcomes} placeholder="— Chọn kết luận —" onChange={(v) => set('outcome', v)} /></Field>
              <Field label={form.outcome === 'reported_corrected' ? 'Số kết quả bị ảnh hưởng' : 'Số kết quả đã rà soát'} htmlFor="impCount"><input id="impCount" type="number" min={0} value={form.resultCount ?? ''} onChange={(e) => set('resultCount', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <Field label="Căn cứ / cách rà soát" htmlFor="impDesc" wide><textarea id="impDesc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
              {form.outcome === 'reported_corrected' && <>
                <Field label="Mã phiếu sửa báo cáo / tham chiếu" htmlFor="impRef" wide><input id="impRef" value={form.reference} onChange={(e) => set('reference', e.target.value)} /></Field>
                <Field label="Đã thông báo cho ai, khi nào, qua kênh nào" htmlFor="impNotified" wide><input id="impNotified" value={form.notified} onChange={(e) => set('notified', e.target.value)} /></Field>
              </>}
            </div>
            <p className="nce-impact-privacy">Chỉ ghi mã tham chiếu cần thiết; không nhập thông tin định danh người bệnh.</p>
            <div className="nce-form-actions">
              <button type="button" className="btn ghost sm" disabled={props.pending} onClick={() => { setFieldError(null); setForm(null); }}>Bỏ qua</button>
              <button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi quyết định</button>
            </div>
          </div></InlineFieldErrorContext.Provider>}
        </div>
      </div>
    </Section>
  );
}

// --------------------------------------- Cho phép hoạt động trở lại

interface ReleasePayload { reason: string; notApplicable: boolean; rerun: { date: string; runId: string } | null; lotChangeNote: string; verificationWarnings?: { code: string; message: string }[] }

/** Đếm số lần chạy theo từng lý do bị loại khỏi danh sách rerun. */
function reasonCounts(choices: readonly { exclusionReasons: string[] }[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const choice of choices) for (const reason of choice.exclusionReasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts];
}

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
  const releaseError = useFormError({ 'missing-rerun': 'relRun', 'invalid-rerun': 'relRun', 'missing-reason': 'relReason', 'rerun-lot-change': 'relLot' });
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
    await props.run((base) => release({ ...base, expectedVersion: draftVersion ?? record.row_version, release: { reason, rerun: chosen ? { date: chosen.date, runId: chosen.runId } : null, lotChangeNote, notApplicable: !chosen && notApplicable } }), { handleValidationError: releaseError.handle });
  }

  if (decision) {
    const p = payload<ReleasePayload>(decision);
    return (
      <Section title="Cho phép hoạt động trở lại" actions={<span className="tag ok">Đã cho phép</span>}>
        <div className="nce-release-record">
          <div className="nce-release-record-main">
            <div className="nce-release-record-head">
              <p className="nce-eyebrow">Quyết định đã ghi</p>
              <h3>Đã cho phép hoạt động trở lại</h3>
              <p>{decision.actor_name} · {timeText(decision.decided_at)}</p>
            </div>
            <div className="nce-release-record-field"><p className="nce-eyebrow">Căn cứ</p><p>{p.reason || 'Chưa ghi nhận căn cứ.'}</p></div>
            <div className="nce-release-record-field">
              <p className="nce-eyebrow">Lần chạy rerun / xác minh</p>
              <p>{p.rerun ? <>{nceRunLabel(p.rerun)}<span className="nce-release-record-support">Mốc bắt đầu lại chuỗi Westgard/CUSUM</span></> : p.notApplicable ? 'Không phải dừng dịch vụ' : 'Không dùng lần chạy QC'}</p>
            </div>
            {p.lotChangeNote && <div className="nce-release-record-field nce-release-lot-note"><p className="nce-eyebrow">Giải thích đổi lô</p><p>{p.lotChangeNote}</p></div>}
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
        <p>Chỉ cho phép hoạt động trở lại khi QC xác minh sau xử lý đạt yêu cầu và đủ các mức theo SOP.</p>
        <p>Quyết định này không đồng nghĩa cho trả các kết quả cũ đang giữ hoặc đóng hồ sơ CAPA.</p>
      </div>
      {!can.release ? <p className="hint-inline">Bạn cần được cấp quyền cho phép hoạt động trở lại. Liên hệ quản trị viên để cấp quyền.</p> : (
        <div className="nce-release-flow" ref={releaseError.rootRef}>
          <FormErrorMessage rootRef={releaseError.rootRef} error={releaseError.error} id={releaseError.errorId} />
          {record.test_id && (
            <div className="nce-release-choice">
              <div className="nce-release-selector">
                <Field label={iqc ? 'Lần chạy QC xác minh (rerun)' : 'Lần chạy QC xác minh (nếu có)'} htmlFor="relRun">
                  <select id="relRun" disabled={candidates.loading} value={chosen ? runKey : ''} onChange={(e) => { releaseError.clear(); setDraftVersion((v) => v ?? record.row_version); setPreview(null); setRunKey(e.target.value); }}>
                    <option value="">{candidates.loading ? '— Đang tải các lần QC —' : options.length ? '— Chọn lần QC để đánh giá —' : '— Chưa có lần QC phù hợp để chọn —'}</option>
                    {options.map((o) => <option key={o.key} value={o.key}>{o.label} · {o.levels.map((l) => `M${l}`).join(', ')}</option>)}
                  </select>
                </Field>
                <button type="button" className="btn ghost sm" disabled={candidates.loading} onClick={candidates.refresh}>Cập nhật lần chạy QC</button>
              </div>
              <p className="nce-release-helper">Ngày phát hiện: {dateText(record.detected_at)}. Danh sách đã được lọc theo ngày và thứ tự lần chạy.</p>
              {candidates.error && <div className="alert rej" role="alert">Không tải được danh sách QC: {candidates.error}</div>}
              {!candidates.loading && !candidates.error && !candidates.choices.length && <div className="alert info">Không tìm thấy điểm QC ở các mức đang vận hành của xét nghiệm này. Kiểm tra đúng xét nghiệm, mức và dữ liệu đã lưu.</div>}
            </div>
          )}
          {(chosen || previewLoading || previewError) && <div className="nce-release-verification" aria-busy={previewLoading}>
            <div className="nce-release-stage-heading">
              <h3>Kết quả QC xác minh</h3>
              <span className={`tag ${preview?.ok ? 'ok' : preview ? 'rej' : 'none'}`}>{previewLoading ? 'Đang đánh giá' : preview?.ok ? 'Đạt' : preview ? 'Chưa đạt' : 'Chờ đánh giá'}</span>
            </div>
            {previewError && <div className="alert rej" role="alert">{previewError}</div>}
            {previewLoading && <p className="nce-release-helper" role="status">Đang đánh giá lại lần QC đã chọn…</p>}
            {preview && !previewLoading && (
              <div className="nce-release-preview">
                <div className="nce-release-evidence-table"><SnapshotTable points={preview.points} /></div>
                {preview.warnings.length > 0 && <div className="alert warn"><ul className="nce-list">{preview.warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul></div>}
                {preview.ok
                  ? <p className="nce-release-result" role="status">Lần chạy đạt khi đánh giá trong giai đoạn mới.</p>
                  : <div className="alert rej"><ul className="nce-list">{preview.problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul></div>}
                {preview.impact_problems.length > 0 && <div className="alert rej"><ul className="nce-list">{preview.impact_problems.map((p) => <li key={p.code}>{p.message}</li>)}</ul></div>}
              </div>
            )}
          </div>}
          {/* Chỉ giải thích khi không còn lần nào chọn được, và gom theo lý do
              thay vì liệt kê từng lần chạy (danh sách sẽ dài dần theo thời gian). */}
          {!candidates.loading && !options.length && excluded.length > 0 && (
            <div className="alert info nce-rerun-excluded" role="status">
              <p>Chưa có lần QC phù hợp. {excluded.length} lần QC hiện có không dùng được vì:</p>
              <ul className="nce-list">{reasonCounts(excluded).map(([reason, count]) => <li key={reason}>{reason}: {count} lần</li>)}</ul>
              {excluded.some((o) => o.date < record.detected_at) && <p>Nếu nhập nhầm ngày phát hiện, đính chính có căn cứ ở bước Ghi nhận sự cố.{props.onIdentity && <button type="button" className="btn ghost sm" onClick={props.onIdentity}>Đến phần ghi nhận</button>}</p>}
            </div>
          )}
          {preview && preview.lot_changed_levels.length > 0 && (
            <Field label="Giải thích dùng lô QC khác lần chạy khởi đầu" htmlFor="relLot" wide><input id="relLot" value={lotChangeNote} onChange={(e) => { releaseError.clear(); setDraftVersion((v) => v ?? record.row_version); setLotChangeNote(e.target.value); }} /></Field>
          )}
          {!iqc && !chosen && (
            <label className="nce-check nce-field-wide"><input type="checkbox" checked={notApplicable} onChange={(e) => setNotApplicable(e.target.checked)} /> Không phải dừng dịch vụ (ghi lý do ở dưới)</label>
          )}
          <div className="nce-release-decision">
            <h3>Xác nhận cho phép hoạt động trở lại</h3>
            <Field label="Căn cứ cho phép hoạt động trở lại" htmlFor="relReason"><textarea id="relReason" rows={2} value={reason} onChange={(e) => { releaseError.clear(); setDraftVersion((v) => v ?? record.row_version); setReason(e.target.value); }} /></Field>
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

// ---------------------------------------------- Đánh giá hiệu lực

interface ReviewPayload { result: string; reviewedAt: string; evidence: string; residualSeverity: number; residualProbability: number; residualLevel: string; residualBasis: string }

/** Kết quả từng lần đánh giá giữ đúng bằng chứng và nguy cơ đã lưu. */
function EffectivenessRecord({ row }: { row: NceDecisionRow }) {
  const value = payload<ReviewPayload>(row);
  return <li className="nce-effectiveness-item">
    <div className="nce-effectiveness-item-head">
      <div><h4>Đánh giá ngày {dateText(value.reviewedAt ?? '')}</h4><p className="nce-note">{row.actor_name} · {timeText(row.decided_at)}</p></div>
      <span className={`tag ${value.result === 'effective' ? 'ok' : value.result === 'ineffective' ? 'rej' : value.result === 'extend' ? 'warn' : 'none'}`}>{NCE_EFFECTIVENESS_RESULT_LABEL[value.result ?? ''] ?? 'Chưa ghi nhận kết luận'}</span>
    </div>
    <dl className="nce-capa-details">
      <div><dt>Bằng chứng</dt><dd>{value.evidence || 'Chưa ghi nhận bằng chứng.'}</dd></div>
      <div><dt>Nguy cơ còn lại</dt><dd>{value.result === 'effective' ? <>{NCE_RISK_LEVEL_LABEL[value.residualLevel ?? ''] ?? '—'} · điểm {nceRiskText(value.residualSeverity ?? 0, value.residualProbability ?? 0)}<small>Mức độ {value.residualSeverity ?? '—'} × khả năng {value.residualProbability ?? '—'}</small></> : 'Chưa đánh giá lại.'}</dd></div>
      {value.residualBasis && <div><dt>Căn cứ đánh giá lại</dt><dd>{value.residualBasis}</dd></div>}
    </dl>
  </li>;
}

export function EffectivenessSection(props: SectionProps) {
  const { record, decisions, can } = props.dossier;
  const reviewStore = useNceStore((s) => s.reviewEffectiveness);
  const reviews = decisions.filter((d) => d.type === 'effectiveness');
  const editor = useEditor(props, () => ({ effectivenessCriteria: record.effectiveness_criteria, effectivenessReviewDue: record.effectiveness_review_due }), { 'invalid-review-due': 'effDue' });
  const [form, setForm] = useState<ReviewPayload | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const reviewError = useFormError({
    'invalid-result': 'revResult', 'invalid-review-date': 'revDate', 'review-before-action': 'revDate',
    'missing-evidence': 'revEvidence', 'missing-residual': ['revS', 'revP', 'revL', 'revB'],
    'residual-above-initial': ['revS', 'revP'],
  });
  const d = editor.draft;
  async function save() {
    if (!form) return;
    if (await props.run((base) => reviewStore({ ...base, expectedVersion: draftVersion, review: form }), { handleValidationError: reviewError.handle })) { setForm(null); props.onSaved?.(); }
  }
  const reviewAction = can.review_effectiveness && !form
    ? <button type="button" className="btn ghost sm" onClick={() => { reviewError.clear(); setDraftVersion(record.row_version); setForm({ result: '', reviewedAt: todayIso(), evidence: '', residualSeverity: 0, residualProbability: 0, residualLevel: '', residualBasis: '' }); }}>Ghi đánh giá hiệu lực</button>
    : null;
  return (
    <Section title="Đánh giá hiệu lực và nguy cơ còn lại" actions={<>{editor.actions(can.edit)}{reviews.length > 0 && reviewAction}</>} disclosure={props.disclosure} headingLevel={props.headingLevel}>
      {props.dossier.missing.some((item) => item.code === 'effectiveness-basis-changed') && <div className="alert warn">Đánh giá cũ vẫn lưu trong lịch sử nhưng không còn khớp nội dung hiện tại. Rà soát tiêu chí, nguy cơ, hành động rồi ghi đánh giá mới.</div>}
      {d ? (
        <div className="nce-capa-form" ref={editor.formRoot}>
          <FormErrorMessage rootRef={editor.formRoot} error={editor.fieldError} id={editor.errorId} />
          <Field label="Tiêu chí đánh giá hiệu lực (đặt trước khi đánh giá)" htmlFor="effCrit" wide><textarea id="effCrit" rows={2} value={d.effectivenessCriteria} onChange={(e) => editor.set('effectivenessCriteria', e.target.value)} /></Field>
          <DateField label="Ngày dự kiến đánh giá" id="effDue" value={d.effectivenessReviewDue} onChange={(v) => editor.set('effectivenessReviewDue', v)} />
        </div>
      ) : (
        <dl className="nce-capa-details">
          <div><dt>Tiêu chí đánh giá</dt><dd>{record.effectiveness_criteria || 'Chưa đặt tiêu chí'}</dd></div>
          <div><dt>Ngày dự kiến đánh giá</dt><dd>{record.effectiveness_review_due ? dateText(record.effectiveness_review_due) : 'Chưa lên lịch'}</dd></div>
        </dl>
      )}
      {!form && (reviews.length > 0 ? <>
        <ol className="nce-effectiveness-list"><EffectivenessRecord row={reviews.at(-1)!} /></ol>
        {reviews.length > 1 && <details className="nce-effectiveness-history">
          <summary>Các lần đánh giá trước ({reviews.length - 1})</summary>
          <ol className="nce-effectiveness-list">{reviews.slice(0, -1).reverse().map((row) => <EffectivenessRecord key={row.id} row={row} />)}</ol>
        </details>}
      </> : <EmptyState size="compact" title="Chưa đánh giá hiệu lực" action={reviewAction}>Ghi bằng chứng theo tiêu chí đã đặt và kết luận hiệu quả của hành động.</EmptyState>)}
      {form && (
        <div className="nce-capa-form nce-subform" ref={reviewError.rootRef}>
          <FormErrorMessage rootRef={reviewError.rootRef} error={reviewError.error} id={reviewError.errorId} />
          <h4>Ghi đánh giá hiệu lực</h4>
          {draftVersion !== record.row_version && <p className="nce-editor-warning">Hồ sơ đã được cập nhật ở nơi khác</p>}
          <div className="nce-form-grid">
          <Field label="Kết luận" htmlFor="revResult"><OptionSelect id="revResult" value={form.result} options={NCE_EFFECTIVENESS_RESULT_LABEL} placeholder="— Chọn —" onChange={(v) => setForm({ ...form, result: v })} /></Field>
          <DateField label="Ngày đánh giá" id="revDate" value={form.reviewedAt} onChange={(v) => setForm({ ...form, reviewedAt: v })} />
          </div>
          <Field label="Bằng chứng theo tiêu chí đã đặt" htmlFor="revEvidence" wide><textarea id="revEvidence" rows={2} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} /></Field>
          {form.result === 'effective' && <>
            <div className="nce-form-grid nce-capa-risk-grid">
            <Field label="Mức độ còn lại (1–5)" htmlFor="revS"><ScaleSelect id="revS" value={form.residualSeverity} onChange={(v) => setForm({ ...form, residualSeverity: v })} /></Field>
            <Field label="Khả năng xảy ra còn lại (1–5)" htmlFor="revP"><ScaleSelect id="revP" value={form.residualProbability} onChange={(v) => setForm({ ...form, residualProbability: v })} /></Field>
            <Field label="Phân loại nguy cơ còn lại" htmlFor="revL"><OptionSelect id="revL" value={form.residualLevel} options={NCE_RISK_LEVEL_LABEL} placeholder="— Chọn —" onChange={(v) => setForm({ ...form, residualLevel: v })} /></Field>
            </div>
            <Field label="Căn cứ đánh giá lại" htmlFor="revB"><input id="revB" value={form.residualBasis} onChange={(e) => setForm({ ...form, residualBasis: e.target.value })} /></Field>
          </>}
          <div className="nce-form-actions nce-field-wide">
            <button type="button" className="btn ghost sm" disabled={props.pending} onClick={() => setForm(null)}>Bỏ qua</button>
            <button type="button" className="btn sm" disabled={props.busy} onClick={() => void save()}>Ghi đánh giá</button>
          </div>
        </div>
      )}
    </Section>
  );
}
