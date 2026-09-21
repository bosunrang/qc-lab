// Six Sigma — thiết lập nguồn TEa, trạng thái cấu hình, không gian làm việc
// theo kỳ (CV/Bias có nguồn gốc theo từng mức QC), modal Bias% RMS có cảnh
// báo lệch dấu và modal MU ba thành phần. Bộ chọn xét nghiệm CHỈ lấy từ Cấu
// hình chung — không tạo xét nghiệm trong Sigma (nguyên tắc đã chốt).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useSigmaStore, type SigmaLevelSaveInput } from '../store/sigma-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { Modal } from '../components/Modal';
import { CalcIcon, DownloadIcon, PrintIcon, TrashIcon } from '../components/BtnIcons';
import { RowActionButton } from '../components/RowActionButton';
import { PageHeader } from '../components/PageHeader';
import { SigmaTrendChart, SigmaMdcChart } from '../components/SigmaCharts';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import type { SigmaCohortView, SigmaEqaRound, SigmaLevelResult, SigmaPeriodView, Test } from '../../shared/qc-api';
import { resolveSigmaTea, teaCriterionText, type SigmaTeaSource } from '../lib/sigma-tea';

function rmsOf(values: number[]): number {
  if (!values.length) return 0;
  return Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
}

/** Dải năm cho bộ lọc và hộp thêm kỳ: năm nay ± 5. */
const PERIOD_YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

/** 4 nguồn TEa của app cũ (`TEA_SOURCE_REGISTRY`). Giá trị cấu hình của xét
 * nghiệm được chụp vào kỳ Sigma khi tạo, để lịch sử không bị đổi ngầm. */
const TEA_SOURCES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'lab', label: 'TEa chuẩn hóa của phòng xét nghiệm' },
  { value: 'eflm', label: 'EFLM - nhập từ database' },
  { value: 'clia', label: 'CLIA PT (CMS-3355-F)' },
  { value: 'ricos', label: 'Ricos / Westgard biological variation' },
];

/** `formatSigmaDpmo()` app cũ — dưới 10 giữ 2 chữ số, dưới 1000 làm tròn,
 * còn lại phân nhóm nghìn kiểu en-US. */
function formatDpmo(value: unknown): string {
  const dpmo = Number(value);
  if (!Number.isFinite(dpmo)) return '—';
  return dpmo < 10 ? dpmo.toFixed(2) : dpmo < 1000 ? dpmo.toFixed(0) : Math.round(dpmo).toLocaleString('en-US');
}

/** `vnPeriod()` app cũ: 2026-09 → "Kỳ 09/2026". */
function vnPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  return m ? `Kỳ ${m[2]}/${m[1]}` : (period || '?');
}

/** Nội dung bản in là dữ liệu do người dùng nhập; không ghép thẳng vào HTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}
function vnDate(date: string): string { return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : '—'; }
/** Chỉ rút gọn khi hiển thị trong control; giá trị lưu và tính Sigma vẫn giữ
 * nguyên độ chính xác. Dùng chung cả lúc khôi phục sau khi lưu lỗi để ô không
 * bất ngờ hiện lại một dãy thập phân dài. */
function editablePercent(value: number | null | undefined): string { return value != null ? value.toFixed(2) : ''; }
/** Tháng hiện hành theo múi giờ máy, tương đương `isoMonth()` ở app cũ.
 * Không dùng `toISOString()` trực tiếp vì rạng sáng ở Việt Nam có thể rơi về
 * tháng trước theo UTC. */
function currentPeriod(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 7);
}
/** Sigma = (TEa − |Bias|) / CV cần ĐỦ BA đầu vào. Thiếu cái nào thì phải nói
 * đích danh cái đó: thông báo cũ ("Chưa nhập CV hoặc Bias được chọn" /
 * "Chưa đủ dữ liệu") không hề nhắc TEa, nên khi CV và Bias đã nhập đủ mà TEa
 * chưa có thì người dùng không có cách nào biết còn thiếu gì. */
function missingSigmaInputs(level: SigmaLevelResult): string[] {
  const missing: string[] = [];
  if (level.tea == null) missing.push('TEa');
  if (level.cv == null) missing.push('CV IQC%');
  if (level.biasEqa == null) missing.push('Bias EQA%');
  return missing;
}

function cohortStatusLabel(status: SigmaCohortView['status'] | string): string {
  return status === 'eligible' ? 'Đủ dữ liệu' : status === 'provisional' ? 'Tạm thời (20–29)' : status === 'insufficient' ? 'Chưa đủ (<20)'
    : status === 'out-of-control' ? 'Mất kiểm soát chưa xử lý' : 'Không ổn định';
}

/** Màu trạng thái dùng bộ badge chung, để bảng chọn cohort không tự tạo một
 * ngôn ngữ cảnh báo riêng với phần còn lại của ứng dụng. */
function cohortStatusTone(status: SigmaCohortView['status'] | string): 'ok' | 'warn' | 'rej' {
  return status === 'eligible' ? 'ok' : status === 'provisional' || status === 'insufficient' ? 'warn' : 'rej';
}

/** N/R của thiết kế QC, kèm phương án tương đương mà Westgard nêu sẵn.
 * Westgard công bố HAI bảng khác nhau cho 2 mức và 3 mức QC, nên phải nói rõ
 * bảng nào đang áp — nếu không, một phòng chạy 3 mức sẽ đọc N/R của bảng 2
 * mức mà không biết. */
function designRunText(design: { n: number; r: number; alternatives: { n: number; r: number; note?: string }[] }): string {
  const one = (n: number, r: number) => `N=${n}` + (r > 1 ? ` · R=${r}` : '');
  const alts = design.alternatives.map((alt) => one(alt.n, alt.r) + (alt.note ? ` (${alt.note})` : ''));
  return [one(design.n, design.r), ...alts].join(' hoặc ');
}

/** Port `sgTips()` app cũ — thẻ khuyến nghị cải thiện, chỉ hiện khi Sigma
 * tính được và < 4. Chia nguyên nhân theo tỉ lệ `|bias| / (|bias| + 1.65·cv)`
 * (>0.6 do bias, <0.4 do CV, còn lại do cả hai) và liệt kê đúng danh sách
 * hành động của bản cũ. */
const BIAS_ACTS = [
  'Hiệu chuẩn lại; kiểm tra lô/hạn dùng của calibrator.',
  'Kiểm tra giá trị đích EQA (nhóm peer cùng phương pháp/máy).',
  'Thử lô thuốc thử mới và chạy lại sau hiệu chuẩn.',
];
const CV_ACTS = [
  'Bảo trì định kỳ thiết bị (đèn, bơm, hệ quang).',
  'Kiểm tra lô thuốc thử & vật liệu QC (bảo quản, hạn dùng, độ đồng nhất).',
  'Ổn định nhiệt độ phòng/điện áp; tránh rung động.',
  'Chuẩn hóa thao tác (pipet, thời gian ủ); giảm khác biệt giữa người làm.',
];

function ImprovementCard({ level, result, tea }: { level: number; result: SigmaLevelResult; tea: number | null }) {
  const sigma = result.sigma?.sigma;
  if (sigma == null || !Number.isFinite(sigma) || sigma >= 4) return null;
  const teaN = Number(tea ?? result.sigma?.tea ?? 0);
  const cv = Number(result.cv ?? 0);
  const bias = Math.abs(Number(result.biasEqa ?? 0));
  const fail = sigma < 3;
  const cvNeed = (teaN - bias) / 4;
  const biasNeed = teaN - 4 * cv;
  const share = bias + 1.65 * cv === 0 ? 0 : bias / (bias + 1.65 * cv);
  const driver = share > 0.6 ? 'độ chệch (bias) lớn' : share < 0.4 ? 'độ chụm (CV) lớn' : 'cả độ chệch lẫn độ chụm';
  const acts = share > 0.6 ? BIAS_ACTS : share < 0.4 ? CV_ACTS : [BIAS_ACTS[0], CV_ACTS[0], BIAS_ACTS[1], CV_ACTS[1]];
  const parts: string[] = [];
  if (cvNeed > 0) parts.push(`giảm CV ≤ ${cvNeed.toFixed(2)}% (hiện ${cv.toFixed(2)}%)`);
  if (biasNeed > 0) parts.push(`giảm |Bias| ≤ ${biasNeed.toFixed(2)}% (hiện ${bias.toFixed(2)}%)`);
  const zone = sigmaZone(sigma);
  return (
    <div className="alert sg-improvement-card" style={{ ['--sg-color' as never]: zone.c }}>
      <b>Khuyến nghị cải thiện — Mức {level}</b>
      <div className="sg-improvement-lead">
        {fail ? 'Phương pháp chưa đạt năng lực — cần khắc phục trước khi tin cậy kết quả.' : 'Hiệu năng cận biên — nên cải thiện để vượt 4σ.'} Nguyên nhân chủ yếu do {driver}.
      </div>
      <div className="sg-improvement-target">{parts.length ? `Để đạt ≥ 4σ: ${parts.join(' hoặc ')}.` : 'Độ chệch đã vượt mức cho phép — phải giảm bias trước.'}</div>
      <ul className="sg-improvement-list">
        {acts.map((a) => <li key={a}>{a}</li>)}
        {fail && <li>Tạm thời tăng QC tối đa; nếu không cải thiện, cân nhắc đổi thuốc thử/phương pháp/thiết bị.</li>}
      </ul>
    </div>
  );
}

/** 5 bậc màu Sigma — sao chép nguyên giá trị/ngưỡng từ `sigmaZone()` bản cũ
 * (src/domain/sigma/sigma-presentation.ts), không tự đặt lại thang màu. */
function sigmaZone(value: number | null | undefined): { c: string; label: string } {
  const sigma = Number(value);
  if (!Number.isFinite(sigma)) return { c: '#506674', label: '—' };
  if (sigma >= 6) return { c: '#13603f', label: 'Đẳng cấp thế giới' };
  if (sigma >= 5) return { c: '#2c7d5c', label: 'Xuất sắc' };
  if (sigma >= 4) return { c: '#3f9a55', label: 'Tốt' };
  if (sigma >= 3) return { c: '#dd8b1f', label: 'Cận biên' };
  return { c: '#c0362c', label: 'Không đạt' };
}

export function SigmaPage() {
  const { tests, teaRefs, levelsByTestId, loadTests, loadTeaRefs, loadLevels, instruments, loadInstruments} = useManageStore();
  const { periods, loadPeriods, loadCohorts, savePeriod, removePeriod, setTracking: setSigmaTrackingStore, saveTeaConfig: saveTeaConfigStore } = useSigmaStore();
  // Vai trò chỉ-xem: vẫn đọc được bảng kỳ/Sigma/MU, không sửa được (main
  // chặn bằng requireWrite ở sigma-handlers.savePeriod).
  const writable = canWrite(useAuthStore((s) => s.user)?.role);
  const [testId, setTestId] = useState('');
  /** Kỳ được chọn điều khiển workspace, OPSpecs và MU. `null` rơi về kỳ mới
   * nhất; khi đổi xét nghiệm, danh sách kỳ và lựa chọn đều phải được đặt lại. */
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [historyMonthFilter, setHistoryMonthFilter] = useState('');
  const [historyYearFilter, setHistoryYearFilter] = useState('');
  useEffect(() => { setSelectedPeriodId(null); setHistoryMonthFilter(''); setHistoryYearFilter(''); }, [testId]);
  const [trackingPickerOpen, setTrackingPickerOpen] = useState(false);
  const [biasModal, setBiasModal] = useState<{ period: SigmaPeriodView; level: SigmaLevelResult } | null>(null);
  const [muModal, setMuModal] = useState<{ period: SigmaPeriodView; level: SigmaLevelResult } | null>(null);
  const [cohortModal, setCohortModal] = useState<{ period: SigmaPeriodView; cohorts: SigmaCohortView[] } | null>(null);
  const [addPeriodOpen, setAddPeriodOpen] = useState(false);
  const [teaSource, setTeaSource] = useState('lab');
  const navigate = useNavigate();

  useEffect(() => { loadTests(); loadTeaRefs(); loadInstruments(); }, [loadTests, loadTeaRefs, loadInstruments]);
  // App cũ (`sigma-page-controller.ts`: `if (!ui().sgTest || !tests.find(...))
  // ui().sgTest = tests[0].id`) TỰ CHỌN xét nghiệm đầu tiên trong danh sách
  // theo dõi — mở trang là thấy ngay bảng kỳ. Bản app-v2 để rỗng nên chỉ
  // render vỏ, gate parity đo được 73 class thiếu chỉ vì lý do này (cùng lớp
  // với trang Nhập QC ở D3.5).
  useEffect(() => {
    const tracked = tests.filter((item) => item.sigma_tracked !== 0);
    if (!tracked.length) { if (testId) setTestId(''); return; }
    if (testId && tracked.some((t) => t.id === testId)) return;
    setTestId(tracked[0].id);
  }, [tests, testId]);
  useEffect(() => { if (testId) { loadPeriods(testId); loadLevels(testId); } }, [testId, loadPeriods, loadLevels]);
  useStoreInvalidation(['sigma_data'], testId || undefined, () => { if (testId) loadPeriods(testId); });
  useStoreInvalidation(['tests', 'test_levels', 'instruments', 'tea_refs'], testId || undefined, () => {
    loadTests(); loadTeaRefs(); loadInstruments();
    if (testId) loadLevels(testId);
  });

  const sigmaTests = tests.filter((item) => item.sigma_tracked !== 0);
  const test = tests.find((t) => t.id === testId);
  const sourceTargetMean = (levelsByTestId[testId] || []).find((level) => Number.isFinite(level.mean) && level.mean !== 0)?.mean;
  const teaResolution = useMemo(
    () => test ? resolveSigmaTea(test, teaRefs, teaSource as SigmaTeaSource, sourceTargetMean) : null,
    [test, teaRefs, teaSource, sourceTargetMean],
  );
  const admin = isAdmin(useAuthStore((s) => s.user)?.role);
  const instrumentName = instruments.find((i) => i.id === test?.instrument_id)?.name || '';
  useEffect(() => {
    if (test?.tea_source && TEA_SOURCES.some((source) => source.value === test.tea_source)) setTeaSource(test.tea_source);
    else setTeaSource('lab');
  }, [test?.id, test?.tea_source]);
  const teaSourceValueText = (source: string): string => {
    if (!test) return 'chưa có';
    return teaCriterionText(resolveSigmaTea(test, teaRefs, source as SigmaTeaSource, sourceTargetMean));
  };
  // Câu nhắc của nguồn CLIA phải nói rõ TEa% được giải RIÊNG tại Mean của
  // từng mức QC — nếu in một con số % chung cho cả xét nghiệm thì người đọc
  // sẽ đối chiếu sai với cột Sigma của từng mức.
  // Thiếu TEa là nguyên nhân phổ biến nhất làm Sigma không tính được, mà bản
  // thân dòng "TEa đang dùng: chưa có" không nói phải làm gì để có. Nói luôn
  // hai đường xử lý: đổi nguồn, hoặc tạo hồ sơ TEa PXN ở Cấu hình chung.
  const teaMissingHint = teaResolution?.value == null
    ? ' Chưa có TEa thì KHÔNG tính được Sigma dù đã nhập đủ CV và Bias. Cách xử lý: đổi “Nguồn TEa” sang CLIA/Ricos/EFLM (xét nghiệm phải được gán analyte trong Bảng TEa tham chiếu), hoặc tạo hồ sơ TEa chuẩn hóa của phòng xét nghiệm ở Cấu hình chung → Bảng TEa tham chiếu.'
    : '';
  const teaHint = teaSource === 'clia'
    ? `Tiêu chí CLIA đang dùng: ${teaSourceValueText('clia')}. TEa% được tính riêng tại Mean mục tiêu của từng mức QC.${teaResolution?.note ? ` ${teaResolution.note}` : ''}${teaMissingHint}`
    : `TEa đang dùng: ${teaSourceValueText(teaSource)} · nguồn ${TEA_SOURCES.find((s) => s.value === teaSource)?.label || '—'}.${teaResolution?.note ? ` ${teaResolution.note}` : ''}${teaMissingHint}`;
  const configuredTea = teaResolution?.value ?? null;
  const configuredTeaSource = teaResolution?.criterion || '';
  const targetMeanForLevel = (levelNumber: number) => (levelsByTestId[testId] || []).find((level) => level.level === levelNumber)?.mean ?? null;
  const teaForLevel = (levelNumber: number) => {
    return test ? resolveSigmaTea(test, teaRefs, teaSource as SigmaTeaSource, targetMeanForLevel(levelNumber)).value : null;
  };

  async function saveTeaConfig(patch: { source?: string; tea?: string; eflmAnalyte?: string; eflmAps?: string; eflmLookupDate?: string; eflmRef?: string }) {
    if (!test) return;
    const nextSource = (patch.source ?? teaSource) as SigmaTeaSource;
    const resolved = resolveSigmaTea(test, teaRefs, nextSource, sourceTargetMean);
    if (patch.source) setTeaSource(patch.source);
    const result = await saveTeaConfigStore({
      testId: test.id, source: nextSource,
      // EFLM do người dùng nhập; catalog/hồ sơ Lab không được tái dùng số
      // TEa cũ của nguồn khác khi đổi nguồn.
      tea: patch.tea === undefined ? (nextSource === 'eflm' ? undefined : (resolved.value ?? 0)) : (patch.tea === '' ? 0 : Number(patch.tea)),
      eflmAnalyte: patch.eflmAnalyte ?? test.eflm_analyte,
      eflmAps: patch.eflmAps ?? test.eflm_aps,
      eflmLookupDate: patch.eflmLookupDate ?? test.eflm_lookup_date,
      eflmRef: patch.eflmRef ?? test.eflm_ref,
    });
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    await loadTests();
  }

  const operationalLevels = (levelsByTestId[testId] || []).map((l) => l.level).sort((a, b) => a - b);
  const tableLevels = operationalLevels.length ? operationalLevels : Array.from(new Set(periods.flatMap((p) => p.levels.map((lv) => lv.level)))).sort((a, b) => a - b);
  const latestPeriod = periods[periods.length - 1];
  const historyYears = Array.from(new Set(periods.map((period) => period.period.slice(0, 4)))).sort((left, right) => right.localeCompare(left));
  const filteredPeriods = periods.filter((period) =>
    (!historyMonthFilter || period.period.slice(5, 7) === historyMonthFilter)
    && (!historyYearFilter || period.period.slice(0, 4) === historyYearFilter),
  );
  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId);
  const displayPeriod = selectedPeriod && filteredPeriods.some((period) => period.id === selectedPeriod.id)
    ? selectedPeriod : filteredPeriods[filteredPeriods.length - 1] || selectedPeriod || latestPeriod;
  useEffect(() => {
    if (displayPeriod && selectedPeriodId !== displayPeriod.id) setSelectedPeriodId(displayPeriod.id);
  }, [displayPeriod?.id, selectedPeriodId]);
  const hasChartData = periods.some((period) => period.levels.some((level) => Number.isFinite(level.sigma?.sigma)));
  // Thiết kế QC chung phải lấy mức IQC hợp lệ có Sigma thấp nhất: đó là mức
  // chi phối nguy cơ. Không lấy CV nhập tay hay cohort chưa đủ 30 điểm.
  const governingLevel = displayPeriod?.levels
    .filter((level) => level.cvSource === 'iqc-cohort' && level.cohortStatus === 'eligible' && level.sigma && level.qualityDesign)
    .sort((left, right) => Number(left.sigma?.sigma) - Number(right.sigma?.sigma))[0];

  function levelPayload(level: SigmaLevelResult): SigmaLevelSaveInput {
    return {
      level: level.level, tea: level.tea ?? undefined, targetMean: level.targetMean ?? undefined, cv: level.cv ?? undefined, biasEqa: level.biasEqa ?? undefined,
      eqaRounds: level.eqaRounds.map(({ lab, target, bias }) => ({ lab, target, bias })), uCref: level.uCref ?? undefined, uCal: level.uCal ?? undefined,
      muBiasMode: level.mu?.includeBias === false ? 'exclude' : 'include', cvSource: level.cvSource, cohortN: level.cohortN ?? undefined,
      sourceLot: level.sourceLot, sourceStart: level.sourceStart, sourceEnd: level.sourceEnd, cohortStatus: level.cohortStatus,
    };
  }

  function levelsPayloadFrom(period: SigmaPeriodView, overrideLevel: number, patch: Partial<SigmaLevelSaveInput>): SigmaLevelSaveInput[] {
    return period.levels.map((level) => ({ ...levelPayload(level), ...(level.level === overrideLevel ? patch : {}) }));
  }

  function periodTeaText(period: SigmaPeriodView): string {
    const values = Array.from(new Set(period.levels.map((level) => level.tea).filter((tea): tea is number => tea != null)));
    if (values.length === 1) return `${values[0].toFixed(2)}%`;
    if (values.length > 1) return 'theo mức QC';
    return '—';
  }

  async function removePeriodRow(period: SigmaPeriodView) {
    if (!(await confirmDialog(`Xóa kỳ ${vnPeriod(period.period)}? Số liệu CV/Bias của kỳ này sẽ mất.`, { title: 'Xóa kỳ Six Sigma', danger: true, confirmLabel: 'Xóa' }))) return;
    const result = await removePeriod(period.id, testId);
    if (!result.ok) await infoDialog(result.error.message, { type: 'warn' });
  }

  /** Bảng xuất/in: 1 hàng cho mỗi (kỳ × mức) — cùng bộ cột với bảng trên
   * màn hình để người đọc file đối chiếu được. */
  const exportRows = (rows: SigmaPeriodView[]) => rows.flatMap((p) => p.levels.map((lv) => [
    vnPeriod(p.period), `Mức ${lv.level}`, lv.tea ?? p.tea ?? '', lv.targetMean ?? '', lv.cv ?? '', lv.biasEqa ?? '', lv.sigma ? Number(lv.sigma.sigma.toFixed(2)) : '',
    lv.sigma ? formatDpmo(lv.sigma.dpmo) : '', lv.mu?.U != null ? Number(lv.mu.U.toFixed(4)) : '', lv.mu?.absoluteU != null ? Number(lv.mu.absoluteU.toFixed(4)) : '', lv.mu?.teaRatio != null ? Number((lv.mu.teaRatio * 100).toFixed(1)) : '',
  ]));
  const EXPORT_HEADERS = ['Kỳ', 'Mức', 'TEa% snapshot', 'Mean mục tiêu', 'CV IQC%', 'Bias EQA%', 'Sigma', 'DPMO', 'U (k=2)%', 'U tại Mean', 'U / TEa%'];

  async function exportPeriod(period: SigmaPeriodView) {
    const error = await exportTableXlsx(`Sigma ${period.period}`, EXPORT_HEADERS, exportRows([period]), `sigma-${test?.name || 'xet-nghiem'}-${period.period}.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function exportAllPeriods() {
    const error = await exportTableXlsx('Sigma tong hop', EXPORT_HEADERS, exportRows(periods), `sigma-${test?.name || 'xet-nghiem'}-tong-hop.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  function printHtml(title: string, rows: SigmaPeriodView[]): string {
    const body = exportRows(rows).map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font:13px system-ui,sans-serif;color:#163541;padding:18px}h1{font-size:17px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d9e0;padding:5px 7px;text-align:left}
      th{background:#eef4f7;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head>
      <body><h1>${escapeHtml(title)}</h1><div>${escapeHtml(test?.name)}</div>
      <table><thead><tr>${EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }
  async function printPeriod(period: SigmaPeriodView) {
    const error = await printHtmlToPdf(printHtml(`Six Sigma — ${vnPeriod(period.period)}`, [period]), `sigma-${period.period}.pdf`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function printAllPeriods() {
    const error = await printHtmlToPdf(printHtml('Six Sigma — tổng hợp các kỳ', periods), 'sigma-tong-hop.pdf');
    if (error) await infoDialog(error, { type: 'warn' });
  }

  async function commitCv(period: SigmaPeriodView, level: number, value: string): Promise<boolean> {
    const result = await savePeriod(testId, period.period, period.tea ?? undefined, period.teaSource,
      levelsPayloadFrom(period, level, { cv: value === '' ? undefined : Number(value), cvSource: 'manual', cohortN: undefined, sourceLot: '', sourceStart: '', sourceEnd: '', cohortStatus: '' }));
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return false; }
    return true;
  }

  /** Kỳ mới chụp cấu hình đang hiệu lực tại thời điểm tạo. Người dùng có thể
   * chọn trực tiếp một kỳ trước đó, thay vì phải thêm kỳ hiện tại rồi đổi tên
   * bản ghi. Hành vi lưu/snapshot vẫn đi qua cùng IPC transaction như trước. */
  async function addPeriod(period: string) {
    if (periods.some((item) => item.period === period)) {
      return { ok: false as const, error: { code: 'duplicate-period', message: `Đã có kỳ Sigma ${period}. Hãy cập nhật kỳ hiện có.` } };
    }
    const result = await savePeriod(
      testId,
      period,
      configuredTea ?? undefined,
      configuredTeaSource || undefined,
      operationalLevels.map((level) => ({ level, tea: teaForLevel(level) ?? undefined, targetMean: targetMeanForLevel(level) ?? undefined })),
      true,
    );
    if (!result.ok) return result;
    setSelectedPeriodId(result.data.id);
    return result;
  }

  async function commitBias(period: SigmaPeriodView, level: number, value: string): Promise<boolean> {
    const result = await savePeriod(testId, period.period, period.tea ?? undefined, period.teaSource,
      levelsPayloadFrom(period, level, { biasEqa: value === '' ? undefined : Number(value), eqaRounds: [] }));
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return false; }
    return true;
  }

  async function setTracking(nextTestId: string, tracked: boolean) {
    const result = await setSigmaTrackingStore(nextTestId, tracked);
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    await loadTests();
    if (tracked) { setTestId(nextTestId); setTrackingPickerOpen(false); }
  }

  if (!sigmaTests.length) {
    return <>
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="panel"><div className="empty-state analysis-empty-state">
        <b>Chưa có xét nghiệm nào trong Sigma</b>
        <span>{admin ? 'Bấm “+ Thêm xét nghiệm” để chọn từ danh mục đã khai báo trong Cấu hình chung.' : 'Liên hệ quản trị viên để thêm xét nghiệm từ Cấu hình chung.'}</span>
        {admin && <button className="btn teal" onClick={() => setTrackingPickerOpen(true)}>+ Thêm xét nghiệm</button>}
      </div></div>
      {trackingPickerOpen && <SigmaTrackingModal tests={tests} onClose={() => setTrackingPickerOpen(false)} onTrack={(id) => setTracking(id, true)} />}
    </>;
  }

  if (!tableLevels.length) {
    return <>
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="panel sg-no-level-panel">
        <div className="row-flex sg-control-row"><div className="sg-test-picker"><label>Chọn xét nghiệm</label><select value={testId} onChange={(e) => setTestId(e.target.value)}>{sigmaTests.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          {admin && <div className="sg-inline-btns"><label>&nbsp;</label><div className="sg-inline-btns-row"><button className="btn teal" onClick={() => setTrackingPickerOpen(true)}>+ Thêm</button><button className="btn danger" onClick={() => setTracking(testId, false)}>Xóa</button></div></div>}
        </div>
        <div className="alert warn sg-no-level-alert">Xét nghiệm này chưa có mức QC hoặc dữ liệu IQC lịch sử để tính Sigma. Hãy kiểm tra Panel QC, nhóm lô QC, Mean/SD và dữ liệu QC trong Cấu hình chung.
          {admin && <button className="btn teal sm" onClick={() => navigate('/manage', { state: { tab: 'mean-sd' } })}>Cấu hình Mean/SD</button>}
        </div>
      </div>
      {trackingPickerOpen && <SigmaTrackingModal tests={tests} onClose={() => setTrackingPickerOpen(false)} onTrack={(id) => setTracking(id, true)} />}
    </>;
  }

  async function openCohorts(period: SigmaPeriodView) {
    const cohorts = await loadCohorts(testId, period.period, period.levels.map((level) => level.level));
    setCohortModal({ period, cohorts });
  }

  return (
    <div className="sigma-page">
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="sg-top-grid">
        <div className="panel">
          <h2 className="sg-setup-heading panel-title">Thiết lập phân tích</h2>
          <div className="row-flex sg-control-row">
            <div className="sg-test-picker">
              <label>Chọn xét nghiệm</label>
              <select id="sgTestSelect" aria-label="Chọn xét nghiệm" value={testId} onChange={(e) => setTestId(e.target.value)}>
                {sigmaTests.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            {admin && (
              <div className="sg-inline-btns">
                <label>&nbsp;</label>
                <div className="sg-inline-btns-row">
                  <button className="btn teal" onClick={() => setTrackingPickerOpen(true)}>+ Thêm</button>
                  <button className="btn danger" onClick={() => setTracking(testId, false)}><TrashIcon />Xóa</button>
                </div>
              </div>
            )}
          </div>
          <div className="sg-setup-fields">
            <div><label>Tên xét nghiệm</label><input value={test?.name || ''} aria-label="Tên xét nghiệm" readOnly /></div>
            <div><label>Đơn vị</label><input value={test?.unit || ''} aria-label="Đơn vị" readOnly /></div>
            <div><label>Thiết bị</label><input value={instrumentName} readOnly placeholder="Bấm để chọn / quản lý thiết bị" /></div>
            <div className="sg-tea-source">
              <label>Nguồn TEa</label>
              <select aria-label="Nguồn TEa" disabled={!writable} value={teaSource} onChange={(e) => saveTeaConfig({ source: e.target.value })}>
                {TEA_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label} · {teaSourceValueText(s.value)}</option>)}
              </select>
            </div>
            <div className="sg-tea-input">
              <label>{teaSource === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu'}</label>
              <input key={`tea-${test?.id || 'none'}-${teaSource}`} type={teaSource === 'eflm' ? 'number' : 'text'} step="any" aria-label={teaSource === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu'} defaultValue={teaSource === 'eflm' ? (Number(test?.tea) > 0 ? String(test?.tea) : '') : teaSourceValueText(teaSource)} disabled={teaSource !== 'eflm' || !writable} readOnly={teaSource !== 'eflm'} placeholder={teaSource === 'eflm' ? 'Nhập TEa%' : undefined} onBlur={(e) => { if (teaSource === 'eflm') saveTeaConfig({ tea: e.currentTarget.value }); }} />
            </div>
          </div>
          {teaSource === 'eflm' && test && <div className="sg-eflm-box">
            <div><label>Analyte trên EFLM</label><input disabled={!writable} defaultValue={test.eflm_analyte || test.name} placeholder="VD: Glucose" onBlur={(e) => saveTeaConfig({ eflmAnalyte: e.currentTarget.value })} /></div>
            <div><label>Mức APS</label><select disabled={!writable} value={test.eflm_aps || 'desirable'} onChange={(e) => saveTeaConfig({ eflmAps: e.target.value })}><option value="minimum">minimum</option><option value="desirable">desirable</option><option value="optimum">optimum</option></select></div>
            <div><label>Ngày tra cứu</label><input type="date" disabled={!writable} defaultValue={test.eflm_lookup_date} onBlur={(e) => saveTeaConfig({ eflmLookupDate: e.currentTarget.value })} /></div>
            <div><label>Link/tài liệu EFLM</label><input disabled={!writable} defaultValue={test.eflm_ref} placeholder="biologicalvariation.eu / bản in PDF" onBlur={(e) => saveTeaConfig({ eflmRef: e.currentTarget.value })} /></div>
          </div>}
          <div className="alert info sg-sigma-input-note">
            <div className="sg-sigma-note-list">
              <p>{teaHint}</p>
              <ul>
                <li>Mỗi mức dùng <b>CV từ IQC</b> và <b>Bias từ EQA/EQC</b>.</li>
                <li>Nhiều vòng EQA được tổng hợp bằng <b>RMS</b> để tránh triệt tiêu dấu; dữ liệu IQC không được dùng để tính Bias.</li>
                <li>Quy tắc thận trọng: &lt;20 điểm chỉ hiển thị ước tính, 20–29 điểm là tạm thời, ≥30 điểm mới dùng để gợi ý QC.</li>
                <li>DPMO/Yield chỉ là quy đổi tham khảo với dịch 1,5σ.</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="panel">
          <h2 className="sg-setup-heading panel-title">Tình trạng</h2>
          {!displayPeriod
            ? <div className="hint">Chưa có kỳ Sigma. Hãy thêm kỳ để bắt đầu.</div>
            : (
              <>
                <div className="hint space-after-item">Kỳ đang xem: <b>{vnPeriod(displayPeriod.period)}</b> · {test?.name || ''} · TEa {periodTeaText(displayPeriod)}</div>
                <div id="sgStatus"><div className="sgcards">
                  {displayPeriod.levels.map((lv) => {
                    const zone = sigmaZone(lv.sigma?.sigma);
                    return (
                      <div className="sgbig" key={lv.level} style={{ background: zone.c }}>
                        <div className="lab">Mức {lv.level} — Sigma</div>
                        <div className="v">{lv.sigma ? lv.sigma.sigma.toFixed(2) : '—'}</div>
                        <div className="grade">{lv.sigma ? zone.label : ''}</div>
                        <div className="sub">
                          {lv.sigma
                            ? <>CV IQC {lv.cv != null ? lv.cv.toFixed(2) : '—'}% · Bias EQA/EQC{lv.eqaRounds && lv.eqaRounds.length > 1 ? ' (RMS)' : ''} {lv.biasEqa != null ? lv.biasEqa.toFixed(2) : '—'}%<br />DPMO {formatDpmo(lv.sigma.dpmo)} · Yield {lv.sigma.yieldPercent.toFixed(4)}%</>
                            : `Chưa tính được Sigma — còn thiếu ${missingSigmaInputs(lv).join(', ')}`}
                        </div>
                      </div>
                    );
                  })}
                </div></div>
                {displayPeriod.levels.map((lv) => <ImprovementCard key={lv.level} level={lv.level} result={lv} tea={lv.tea} />)}
              </>
            )}
        </div>
      </div>

      {testId && (
        <div className="panel">
          <div className="sg-data-head">
            <h2 className="panel-title">Số liệu theo kỳ</h2>
            {writable && operationalLevels.length > 0 && <div className="sg-data-head-actions"><button className="btn teal sm" onClick={() => setAddPeriodOpen(true)}>+ Thêm kỳ</button></div>}
          </div>
          {operationalLevels.length === 0 && (
            <div className="alert warn sg-historical-level-note">
              Chỉ còn dữ liệu Sigma lịch sử; xét nghiệm hiện không có mức QC đang vận hành. Không thể tạo kỳ mới để tránh sinh mức QC giả.
              {admin && <button className="btn teal sm" onClick={() => navigate('/manage', { state: { tab: 'mean-sd' } })}>Cấu hình Mean/SD</button>}
            </div>
          )}
          {periods.length > 0 && displayPeriod ? <div className="sg-period-workspace">
            <div className="sg-period-history" role="navigation" aria-label="Lịch sử kỳ Sigma">
              <div className="sg-period-history-filter">
                <select value={historyMonthFilter} onChange={(event) => setHistoryMonthFilter(event.target.value)} aria-label="Lọc lịch sử theo kỳ" title="Lọc theo kỳ">
                  <option value="">Tất cả</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={String(value).padStart(2, '0')}>{String(value).padStart(2, '0')}</option>)}
                </select>
                <select value={historyYearFilter} onChange={(event) => setHistoryYearFilter(event.target.value)} aria-label="Lọc lịch sử theo năm" title="Lọc theo năm">
                  <option value="">Tất cả năm</option>
                  {historyYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <div className="sg-period-history-list">
                {filteredPeriods.map((p) => {
                  const complete = p.levels.length > 0 && p.levels.every((lv) => lv.sigma != null);
                  return <button type="button" key={p.id} className={`sg-period-history-item${p.id === displayPeriod.id ? ' is-selected' : ''}`}
                    aria-pressed={p.id === displayPeriod.id} onClick={() => setSelectedPeriodId(p.id)}>
                    <b>{vnPeriod(p.period)}</b>
                    <span>{complete ? p.levels.map((lv) => `M${lv.level} σ ${lv.sigma?.sigma.toFixed(2)}`).join(' · ') : 'Chưa đủ dữ liệu Sigma'}</span>
                  </button>;
                })}
                {!filteredPeriods.length && <p className="sg-period-history-empty">Không có kỳ phù hợp.</p>}
              </div>
            </div>
            <section className="sg-period-workbench" key={displayPeriod.id} aria-label={`Chi tiết kỳ ${vnPeriod(displayPeriod.period)}`}>
              <div className="sg-level-matrix-wrap">
                <div className="sg-level-matrix" role="table" aria-label={`Dữ liệu Sigma kỳ ${vnPeriod(displayPeriod.period)}`}>
                  <div className="sg-level-matrix-head" role="row"><span>Mức QC</span><span>CV IQC</span><span>Bias EQA/EQC</span><span>Sigma</span></div>
                  {displayPeriod.levels.map((lv) => {
                    const zone = sigmaZone(lv.sigma?.sigma);
                    const cvSource = lv.cvSource === 'iqc-cohort' ? `Lô ${lv.sourceLot || '—'} · n=${lv.cohortN ?? 0}` : 'Nhập tay';
                    const biasSource = lv.eqaRounds.length ? `${lv.eqaRounds.length} vòng EQA · RMS` : 'Nhập tay';
                    return <div className="sg-level-row" role="row" key={lv.level}>
                      <div className="sg-level-identity" role="cell"><b>Mức {lv.level}</b><span>TEa {lv.tea != null ? `${lv.tea.toFixed(2)}%` : 'chưa có'}</span></div>
                      <div className="sg-level-cell" role="cell">
                        <div className="sg-level-input-row"><input key={`cv-${displayPeriod.id}-${lv.level}-${lv.cv ?? ''}`} className="sg-number" type="number" step="0.01" defaultValue={editablePercent(lv.cv)} placeholder="CV%" disabled={!writable} aria-label={`CV IQC mức ${lv.level}`} onBlur={async (e) => {
                          if (!(await commitCv(displayPeriod, lv.level, e.currentTarget.value))) e.currentTarget.value = editablePercent(lv.cv);
                        }} />{writable && <button className="btn ghost" title={`Chọn CV IQC theo lô cho ${vnPeriod(displayPeriod.period)}`} onClick={() => openCohorts(displayPeriod)}><DownloadIcon />Nạp lô</button>}</div>
                        <span className="sg-level-source" title={lv.cvSource === 'iqc-cohort' ? `CV lấy từ lô ${lv.sourceLot}, ${lv.cohortN ?? 0} điểm (${vnDate(lv.sourceStart)}–${vnDate(lv.sourceEnd)})` : undefined}>{cvSource}</span>
                      </div>
                      <div className="sg-level-cell" role="cell">
                        <div className="sg-level-input-row"><input key={`bias-${displayPeriod.id}-${lv.level}-${lv.biasEqa ?? ''}`} className="sg-number" type="number" step="any" defaultValue={editablePercent(lv.biasEqa)} disabled={!writable} placeholder="Bias%" aria-label={`Bias EQA mức ${lv.level}`} onBlur={async (e) => {
                          if (!(await commitBias(displayPeriod, lv.level, e.currentTarget.value))) e.currentTarget.value = editablePercent(lv.biasEqa);
                        }} />{writable && <button className="btn ghost" title={`Nhập hoặc rà soát các vòng EQA/EQC cho mức ${lv.level}`} onClick={() => setBiasModal({ period: displayPeriod, level: lv })}><CalcIcon />Chi tiết</button>}</div>
                        <span className="sg-level-source">{biasSource}</span>
                      </div>
                      <div className="sg-level-cell sg-level-sigma" role="cell"><b style={{ color: zone.c }}>{lv.sigma ? lv.sigma.sigma.toFixed(2) : '—'}</b><span style={{ color: zone.c }}>{lv.sigma ? zone.label : `Thiếu ${missingSigmaInputs(lv).join(', ')}`}</span></div>
                    </div>;
                  })}
                </div>
              </div>
              <div className="sg-period-workbench-foot">
                <button className="btn ghost sm" title={`Xuất Excel riêng kỳ ${vnPeriod(displayPeriod.period)}`} onClick={() => exportPeriod(displayPeriod)}><DownloadIcon />Excel</button>
                <button className="btn ghost sm" title={`Tạo bản in PDF riêng kỳ ${vnPeriod(displayPeriod.period)}`} onClick={() => printPeriod(displayPeriod)}><PrintIcon />In PDF</button>
                {admin && <RowActionButton kind="delete" label={`Xóa kỳ ${vnPeriod(displayPeriod.period)}`} onClick={() => removePeriodRow(displayPeriod)} />}
              </div>
            </section>
          </div> : <div className="empty sg-period-empty">Chưa có kỳ nào. Hãy thêm kỳ đánh giá để bắt đầu.</div>}
          {periods.length > 0 && (
            <div className="sg-data-foot">
              <button className="btn teal" title="Xuất báo cáo Excel tổng hợp để so sánh Sigma giữa các kỳ" onClick={exportAllPeriods}><DownloadIcon />Xuất Excel</button>
              <button className="btn teal" title="Tạo bản in PDF tổng hợp để so sánh Sigma giữa các kỳ" onClick={printAllPeriods}><PrintIcon />Xuất PDF</button>
            </div>
          )}
        </div>
      )}

      {testId && displayPeriod && (
        <details className="panel sg-collapse-panel">
          <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Thiết kế QC theo Sigma (OPSpecs)</span></summary>
          <div className="sg-collapse-body">
            <div className="hint sg-selected-period-hint">Kỳ đang xem: <b>{vnPeriod(displayPeriod.period)}</b>. Gợi ý không tự thay đổi luật Westgard đang áp dụng.</div>
            <div className="sg-opspec-table-wrap"><table className="sg-opspec-table"><thead><tr><th>Mức</th><th>Sigma</th><th>Bộ quy tắc QC gợi ý</th><th>Mức nguy cơ tham khảo</th><th>Hành động</th></tr></thead><tbody>
              {displayPeriod.levels.map((lv) => {
                const eligible = lv.cvSource === 'iqc-cohort' && lv.cohortStatus === 'eligible';
                const design = eligible ? lv.qualityDesign : null;
                return <tr key={lv.level}><td>Mức {lv.level}</td><td className="num" style={{ color: sigmaZone(lv.sigma?.sigma).c }}>{lv.sigma?.sigma.toFixed(2) ?? '—'}</td>
                  {!lv.sigma ? <><td>—</td><td>Chưa đủ CV/Bias</td><td>Chưa đánh giá</td></>
                    : !eligible ? <><td><span className="hint">Chưa đủ dữ liệu</span></td><td>{lv.cvSource === 'iqc-cohort' ? cohortStatusLabel(lv.cohortStatus) : 'CV nhập tay'}</td><td>Không dùng để đề xuất QC</td></>
                      : !design ? <><td>—</td><td>—</td><td>—</td></>
                        : <><td><b>{design.rules.join(' / ')}</b><div className="sg-cell-meta">{designRunText(design)} · bảng {design.levels} mức</div></td><td>{design.risk}</td><td>{design.plan}</td></>}
                </tr>;
              })}
            </tbody></table></div>
            {governingLevel?.qualityDesign ? (
              <div className="alert info sg-governing-rule">
                <b>Thiết kế QC dùng chung cho xét nghiệm</b>
                <div>Mức quyết định: Mức {governingLevel.level} · Sigma {governingLevel.sigma?.sigma.toFixed(2)}. Áp dụng tham khảo: <b>{governingLevel.qualityDesign.rules.join(' / ')}</b> · {designRunText(governingLevel.qualityDesign)} · theo bảng Westgard Sigma Rules cho <b>{governingLevel.qualityDesign.levels} mức QC</b> (xét nghiệm đang có {governingLevel.qualityDesign.levelCount} mức).</div>
              </div>
            ) : <div className="hint sg-governing-rule">Chưa có mức IQC đủ điều kiện (≥30 điểm, cùng lô và Mean/SD ổn định) để đưa ra thiết kế QC dùng chung.</div>}
            <div className="alert info sg-opspec-note">Gợi ý theo <b>Westgard Sigma Rules</b> chỉ là điểm khởi đầu. Người phụ trách phải rà soát nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng trước khi tự cấu hình luật Westgard.</div>
          </div>
        </details>
      )}

      {testId && displayPeriod && (
        <details className="panel sg-collapse-panel sg-mu-panel">
          <summary className="sg-collapse-summary"><span role="heading" aria-level={2}>Độ không đảm bảo đo (MU)</span></summary>
          <div className="sg-collapse-body">
            <div className="sg-mu-table-wrap">
              <table className="sg-mu-summary-table">
                <thead><tr><th>Mức</th><th className="num">Mean mục tiêu</th><th className="num">u(Rw)</th><th className="num">u(Cref)</th><th className="num">u(bias)</th><th className="num">u(cal)</th><th className="num">u_c</th><th className="num">U (k=2)</th><th className="num">U tại Mean</th><th className="num">U / TEa</th><th>Trạng thái</th><th>Thành phần thiếu</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {displayPeriod.levels.map((lv) => (
                    <tr key={lv.level}>
                      <td>Mức {lv.level}</td>
                      <td className="num">{lv.targetMean != null ? `${lv.targetMean}${test?.unit ? ` ${test.unit}` : ''}` : '—'}</td>
                      <td className="num">{lv.mu?.uRw != null ? lv.mu.uRw.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uCref != null ? lv.mu.uCref.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uBias != null ? lv.mu.uBias.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uCal != null ? lv.mu.uCal.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.uc != null ? lv.mu.uc.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.U != null ? lv.mu.U.toFixed(4) : '—'}</td>
                      <td className="num">{lv.mu?.absoluteU != null ? `${lv.mu.absoluteU.toFixed(4)}${test?.unit ? ` ${test.unit}` : ''}` : '—'}</td>
                      <td className="num">{lv.mu?.teaRatio != null ? <b className={lv.mu.withinTea ? 'sg-mu-within' : 'sg-mu-over'}>{(lv.mu.teaRatio * 100).toFixed(0)}%</b> : '—'}</td>
                      <td>{!lv.mu ? <span className="hint">Chưa có CV IQC</span> : !lv.mu.complete ? <span className="badge warn">Chưa đủ</span> : lv.mu.withinTea === false ? <span className="badge rej">U vượt TEa</span> : <span className="badge ok">Đủ thành phần</span>}</td>
                      <td>{lv.mu?.missing?.length ? lv.mu.missing.join(', ') : <span className="hint">Đủ thành phần</span>}</td>
                      <td>{writable && <button type="button" className="btn ghost sm" onClick={() => setMuModal({ period: displayPeriod, level: lv })}>{lv.mu ? 'Sửa MU' : 'Nhập MU'}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {testId && periods.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Biểu đồ Sigma &amp; MDC</h2>
          <div className="sg-chart-grid">
            <div className="sg-chart-box">
              <h3>Xu hướng Sigma theo kỳ</h3>
              <div className="chart-inner">
                <SigmaTrendChart periods={periods} />
                {hasChartData && <div className="legend">
                  {tableLevels.map((lv) => <span key={lv}>Mức {lv}</span>)}
                  <span>Mốc 3σ (tối thiểu)</span><span>Mốc 6σ (đẳng cấp thế giới)</span>
                </div>}
              </div>
            </div>
            <div className="sg-chart-box">
              <h3>Biểu đồ Quyết định Phương pháp (MDC)</h3>
              {hasChartData && <div className="hint">X = CV/TEA, Y = |BIAS|/TEA. Điểm to nhất là kỳ gần nhất.</div>}
              <div className="chart-inner"><SigmaMdcChart periods={periods} /></div>
            </div>
          </div>
        </div>
      )}

      {biasModal && (
        <BiasModal
          initialRounds={biasModal.level.eqaRounds}
          onClose={() => setBiasModal(null)}
          onSubmit={async (rounds) => {
            const result = await savePeriod(testId, biasModal.period.period, biasModal.period.tea ?? undefined, biasModal.period.teaSource,
              levelsPayloadFrom(biasModal.period, biasModal.level.level, { eqaRounds: rounds, biasEqa: undefined }));
            if (result.ok) setBiasModal(null);
            return result;
          }}
        />
      )}

      {addPeriodOpen && (
        <AddSigmaPeriodModal
          periods={periods.map((period) => period.period)}
          onClose={() => setAddPeriodOpen(false)}
          onSubmit={async (period) => {
            const result = await addPeriod(period);
            if (result.ok) setAddPeriodOpen(false);
            return result;
          }}
        />
      )}

      {muModal && (
        <MuModal
          level={muModal.level}
          onClose={() => setMuModal(null)}
          onSubmit={async (uCref, uCal, muBiasMode) => {
            const result = await savePeriod(testId, muModal.period.period, muModal.period.tea ?? undefined, muModal.period.teaSource,
              levelsPayloadFrom(muModal.period, muModal.level.level, { uCref, uCal, muBiasMode }));
            if (result.ok) setMuModal(null);
            return result;
          }}
        />
      )}
      {cohortModal && (
        <CohortModal period={cohortModal.period} cohorts={cohortModal.cohorts} onClose={() => setCohortModal(null)} onSubmit={async (choices) => {
          const levels = levelsPayloadFrom(cohortModal.period, -1, {}).map((level) => {
            const cohort = choices[level.level];
            return cohort && cohort.cv != null && cohort.cv > 0
              ? { ...level, targetMean: cohort.targetMean ?? level.targetMean, cv: cohort.cv, cvSource: 'iqc-cohort' as const, cohortN: cohort.n, sourceLot: cohort.lot, sourceStart: cohort.start, sourceEnd: cohort.end, cohortStatus: cohort.status }
              : level;
          });
          const result = await savePeriod(testId, cohortModal.period.period, cohortModal.period.tea ?? undefined, cohortModal.period.teaSource, levels);
          if (result.ok) setCohortModal(null);
          return result;
        }} />
      )}
      {trackingPickerOpen && <SigmaTrackingModal tests={tests} onClose={() => setTrackingPickerOpen(false)} onTrack={(id) => setTracking(id, true)} />}
    </div>
  );
}

function SigmaTrackingModal({ tests, onClose, onTrack }: { tests: Test[]; onClose: () => void; onTrack: (id: string) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('vi');
  const rows = tests.filter((test) => !q || [test.name, test.unit, test.section].some((value) => value.toLocaleLowerCase('vi').includes(q)));
  const availableCount = tests.filter((test) => test.sigma_tracked === 0).length;
  function openTestCatalog() {
    onClose();
    navigate('/manage', { state: { tab: 'tests' } });
  }
  return <Modal title="Thêm xét nghiệm vào Six Sigma" onClose={onClose} className="sg-tracking-modal" footer={<button className="btn ghost" onClick={onClose}>Đóng</button>}>
    <div className="sg-tracking-toolbar">
      <div className="sg-tracking-heading">
        <div><b>Chọn từ danh mục xét nghiệm</b><span className="sg-tracking-subtitle">Thêm xét nghiệm cần theo dõi hiệu năng bằng Six Sigma.</span></div>
        <span className="sg-tracking-count">{availableCount} có thể thêm</span>
      </div>
      <label htmlFor="sgTrackingSearch">Tìm xét nghiệm</label>
      <div className="sg-tracking-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.2 4.2" /></svg>
        <input id="sgTrackingSearch" className="sg-tracking-search-input" type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên xét nghiệm, khoa hoặc đơn vị..." />
        {query && <button type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => setQuery('')}>✕</button>}
      </div>
    </div>
    <div className="sg-tracking-list" aria-live="polite">
      {rows.map((test) => <div className="sg-tracking-row" key={test.id}>
        <div className="sg-tracking-test">
          <span className="sg-tracking-mark" aria-hidden="true">Σ</span>
          <div><b>{test.name}</b><span>{[test.section, test.unit].filter(Boolean).join(' · ') || 'Chưa có thông tin bổ sung'}</span></div>
        </div>
        {test.sigma_tracked !== 0 ? <span className="badge ok">Đang theo dõi</span> : <button className="btn teal sm" onClick={() => onTrack(test.id)}>+ Thêm</button>}
      </div>)}
      {!rows.length && <div className="sg-tracking-empty" role="status">
        <div className="sg-tracking-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32"><path d="M8 6h16M10 6v7l-5 10.2A2 2 0 0 0 6.8 26h18.4a2 2 0 0 0 1.8-2.8L22 13V6" /><path d="M8.2 20h15.6" /><path d="M13 15.5h6" /></svg>
        </div>
        <b>{tests.length ? 'Không tìm thấy xét nghiệm phù hợp' : 'Danh mục xét nghiệm đang trống'}</b>
        <p>{tests.length ? 'Thử tên xét nghiệm, khoa hoặc đơn vị khác.' : 'Hãy khai báo xét nghiệm trong Cấu hình chung trước khi thêm vào Six Sigma.'}</p>
        {tests.length
          ? <button type="button" className="btn ghost sm" onClick={() => setQuery('')}>Xóa từ khóa</button>
          : <button type="button" className="btn teal sm" onClick={openTestCatalog}>Mở Cấu hình chung</button>}
      </div>}
    </div>
  </Modal>;
}

function AddSigmaPeriodModal({ periods, onClose, onSubmit }: {
  periods: string[]; onClose: () => void;
  onSubmit: (period: string) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const initial = currentPeriod();
  const [month, setMonth] = useState(initial.slice(5, 7));
  const [year, setYear] = useState(initial.slice(0, 4));
  const [error, setError] = useState<string | null>(null);
  const period = `${year}-${month}`;
  const duplicate = periods.includes(period);

  async function submit() {
    if (duplicate) { setError(`Kỳ ${vnPeriod(period)} đã tồn tại. Hãy chọn một kỳ khác.`); return; }
    const result = await onSubmit(period);
    if (!result.ok) setError(result.error?.message || 'Không thể thêm kỳ Sigma.');
  }

  return <Modal title="Thêm kỳ Sigma" onClose={onClose} className="sg-add-period-modal"
    footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Thêm kỳ</button></>}>
    <div className="sg-add-period-form">
      <p className="hint">Chọn trực tiếp kỳ cần nhập, kể cả kỳ trước đó. Kỳ đã tồn tại sẽ không bị ghi đè.</p>
      <div className="sg-add-period-picker">
        <label>Tháng
          <select value={month} onChange={(event) => { setMonth(event.target.value); setError(null); }} aria-label="Tháng kỳ mới">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={String(value).padStart(2, '0')}>{String(value).padStart(2, '0')}</option>)}
          </select>
        </label>
        <label>Năm
          <select value={year} onChange={(event) => { setYear(event.target.value); setError(null); }} aria-label="Năm kỳ mới">
            {PERIOD_YEARS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  </Modal>;
}

function BiasModal({ initialRounds, onClose, onSubmit }: {
  initialRounds: SigmaEqaRound[]; onClose: () => void;
  onSubmit: (rounds: Array<{ lab: number; target: number }>) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [rounds, setRounds] = useState(() => initialRounds.length
    ? initialRounds.map((round) => ({ lab: round.lab != null ? String(round.lab) : '', target: round.target != null ? String(round.target) : '' }))
    : [{ lab: '', target: '' }, { lab: '', target: '' }, { lab: '', target: '' }]);
  const [err, setErr] = useState<string | null>(null);
  const draftRounds = rounds.map((round) => ({
    lab: Number(round.lab), target: Number(round.target),
    complete: round.lab.trim() !== '' || round.target.trim() !== '',
  }));
  const parsedRounds = draftRounds.filter((round) => Number.isFinite(round.lab) && Number.isFinite(round.target) && round.target !== 0)
    .map(({ lab, target }) => ({ lab, target }));
  const biases = parsedRounds.map((round) => (round.lab - round.target) / Math.abs(round.target) * 100);
  const rms = rmsOf(biases);
  const mean = biases.length ? biases.reduce((s, v) => s + v, 0) / biases.length : 0;
  const mixedSigns = biases.some((v) => v > 0) && biases.some((v) => v < 0);
  const hasIncompleteRound = draftRounds.some((round) => round.complete && (!Number.isFinite(round.lab) || !Number.isFinite(round.target) || round.target === 0));

  async function submit() {
    if (hasIncompleteRound) { setErr('Mỗi vòng đã nhập cần đủ KQ PXN và Target EQA hợp lệ (Target khác 0).'); return; }
    if (!parsedRounds.length) { setErr('Nhập ít nhất 1 vòng EQA/EQC.'); return; }
    const result = await onSubmit(parsedRounds);
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title="Tính Bias% từ EQA/EQC" onClose={onClose} className="sg-eqa-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng Bias%</button></>}>
      {err && <p className="field-error">{err}</p>}
      <div className="sg-eqa-table-wrap">
        <table className="sg-eqa-table">
          <thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th>Thao tác</th></tr></thead>
          <tbody>
            {rounds.map((v, i) => {
                const lab = Number(v.lab), target = Number(v.target);
                const bias = Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? (lab - target) / Math.abs(target) * 100 : null;
              return (
                <tr key={i}>
                  <td className="sg-eqa-index">{i + 1}</td>
                  <td><input type="number" step="any" value={v.lab} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? { ...x, lab: e.target.value } : x)))} /></td>
                  <td><input type="number" step="any" value={v.target} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} /></td>
                  <td className="sg-eqa-bias" style={{ color: bias != null ? (Math.abs(bias) > 10 ? 'var(--red)' : 'var(--teal)') : undefined }}>{bias != null ? `${bias.toFixed(2)}%` : '—'}</td>
                  <td><RowActionButton kind="delete" label={`Xóa vòng EQA ${i + 1}`} className="sg-eqa-del" onClick={() => setRounds((r) => r.filter((_, j) => j !== i))} disabled={rounds.length <= 1} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn ghost sm sg-eqa-add" onClick={() => setRounds((r) => [...r, { lab: '', target: '' }])}>+ Thêm vòng</button>
      <div className={`sg-eqa-summary${parsedRounds.length ? '' : ' is-empty'}`}>
        {parsedRounds.length ? (
          <>
              <div><span>Số vòng hợp lệ</span><b>{parsedRounds.length}</b></div>
            <div><span>Bias có dấu TB</span><b>{mean.toFixed(3)}</b></div>
            <div><span>Bias RMS dùng tính Sigma</span><b className="sg-eqa-average">{rms.toFixed(3)}</b></div>
            {mixedSigns && <div className="sg-eqa-warning">Bias đổi dấu giữa các vòng — RMS giúp tránh triệt tiêu.</div>}
          </>
        ) : <span className="sg-eqa-empty">Nhập đủ KQ PXN và Target EQA cho ít nhất 1 vòng.</span>}
      </div>
    </Modal>
  );
}

function CohortModal({ period, cohorts, onClose, onSubmit }: {
  period: SigmaPeriodView; cohorts: SigmaCohortView[]; onClose: () => void;
  onSubmit: (choices: Record<number, SigmaCohortView | undefined>) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const byLevel = useMemo(() => new Map(period.levels.map((level) => [level.level, cohorts.filter((cohort) => cohort.level === level.level)])), [period.levels, cohorts]);
  const [choices, setChoices] = useState<Record<number, string>>(() => Object.fromEntries(period.levels.map((level) => [level.level, level.sourceLot || byLevel.get(level.level)?.at(-1)?.lot || ''])));
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    const selected: Record<number, SigmaCohortView | undefined> = {};
    for (const level of period.levels) selected[level.level] = byLevel.get(level.level)?.find((cohort) => cohort.lot === choices[level.level]);
    const result = await onSubmit(selected);
    if (!result.ok) setErr(result.error?.message || 'Không thể nạp CV từ IQC.');
  }
  return <Modal title={`Chọn dữ liệu CV IQC theo lô — ${vnPeriod(period.period)}`} onClose={onClose} className="sg-cohort-modal"
    footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Dùng dữ liệu đã chọn</button></>}>
    {err && <p className="field-error">{err}</p>}
    <div className="hint space-after-item">Dữ liệu IQC được gom xuyên tháng nhưng luôn tách theo lô và mức QC. Dữ liệu được tính đến hết kỳ đang chọn; đổi Mean/SD mục tiêu sẽ được đánh dấu không ổn định.</div>
    <div className="sg-cohort-table-wrap"><table className="sg-cohort-table"><thead><tr><th>Mức</th><th>Lô QC</th><th>Khoảng dữ liệu</th><th className="num">n</th><th className="num">CV</th><th>Trạng thái</th></tr></thead><tbody>
      {period.levels.flatMap((level) => {
        const rows = byLevel.get(level.level) || [];
        if (!rows.length) return <tr key={level.level}><td>Mức {level.level}</td><td colSpan={5} className="hint">Chưa có điểm IQC hợp lệ theo lô trong kỳ này.</td></tr>;
        return rows.map((cohort, index) => <tr key={`${level.level}:${cohort.lot}:${cohort.start}`}><td>{index === 0 ? `Mức ${level.level}` : ''}</td><td><label><input type="radio" name={`cohort-${level.level}`} checked={choices[level.level] === cohort.lot} onChange={() => setChoices((old) => ({ ...old, [level.level]: cohort.lot }))} /> Lô {cohort.lot || '—'}</label></td><td>{vnDate(cohort.start)}–{vnDate(cohort.end)}</td><td className="num">{cohort.n}</td><td className="num">{cohort.cv != null ? `${cohort.cv.toFixed(2)}%` : '—'}</td><td><span className={`badge ${cohortStatusTone(cohort.status)}`}>{cohortStatusLabel(cohort.status)}</span>{cohort.issues.length ? <div className="sg-cohort-issue">{cohort.issues.join(' · ')}</div> : null}</td></tr>);
      })}
    </tbody></table></div>
  </Modal>;
}

function MuModal({ level, onClose, onSubmit }: {
  level: SigmaLevelResult; onClose: () => void;
  onSubmit: (uCref: number | undefined, uCal: number | undefined, muBiasMode: 'include' | 'exclude') => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [uCref, setUCref] = useState(level.uCref != null ? String(level.uCref) : '');
  const [uCal, setUCal] = useState(level.uCal != null ? String(level.uCal) : '');
  const [includeBias, setIncludeBias] = useState(level.mu?.includeBias !== false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const result = await onSubmit(uCref === '' ? undefined : Number(uCref), uCal === '' ? undefined : Number(uCal), includeBias ? 'include' : 'exclude');
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title="Ngân sách độ không đảm bảo đo (MU)" onClose={onClose} className="sg-eqa-modal sg-mu-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng ngân sách MU</button></>}>
      {err && <p className="field-error">{err}</p>}
      <table className="sg-mu-detail-table">
        <thead><tr><th>Thành phần</th><th>Giá trị</th></tr></thead>
        <tbody>
          <tr><td>u(Rw) — từ CV%</td><td>{level.cv != null ? level.cv.toFixed(3) : <span className="badge warn">Chưa có</span>}</td></tr>
          <tr><td>Bias quan sát (RMS các vòng EQA)</td><td>{level.biasEqa != null ? Math.abs(level.biasEqa).toFixed(3) : <span className="badge warn">Chưa có</span>}</td></tr>
          <tr><td>u(Cref) — giá trị gán EQA/CRM</td><td>{level.mu?.uCref != null ? level.mu.uCref.toFixed(3) : <span className="badge warn">Chưa đánh giá</span>}</td></tr>
          <tr><td>u(bias) = √(bias² + u(Cref)²)</td><td>{level.mu?.uBias != null ? level.mu.uBias.toFixed(3) : <span className="badge warn">Chưa có</span>}</td></tr>
          <tr><td>u(cal)</td><td>{level.mu?.uCal != null ? level.mu.uCal.toFixed(3) : <span className="badge warn">Chưa đánh giá</span>}</td></tr>
        </tbody>
      </table>
      <label className="sg-mu-bias-toggle">
        <input type="checkbox" checked={includeBias} onChange={(e) => setIncludeBias(e.target.checked)} /> Đưa u(bias) vào ngân sách
      </label>
      <div className="field"><label>u(Cref) % — độ không đảm bảo của giá trị gán, từ báo cáo EQA/chứng chỉ CRM</label><input type="number" step="0.001" min="0" value={uCref} onChange={(e) => setUCref(e.target.value)} /></div>
      <details className="alert info sg-mu-help">
        <summary>Hướng dẫn xác định u(Cref)</summary>
        <p>Chứng chỉ CRM ghi U(Cref) mở rộng thì lấy U(Cref)/2. Kết quả EQA/PT theo ISO 13528 thì lấy U/2 của giá trị gán vòng đó. Đây là con số do nhà cung cấp công bố — không suy từ độ phân tán của chính các vòng bias (số đó chỉ cho biết ước lượng bias ổn định tới đâu{level.biasSem != null ? `, hiện là ${level.biasSem.toFixed(3)}%` : ''}). Bỏ trống nghĩa là u(Cref) vắng mặt và ngân sách bị đánh dấu chưa đủ, không được coi là 0.</p>
      </details>
      <div className="field"><label>u(cal) — từ CoA hiệu chuẩn (0 là kết luận hợp lệ, khác với bỏ trống)</label><input type="number" step="0.001" value={uCal} onChange={(e) => setUCal(e.target.value)} /></div>
      {level.mu && (
        <p className="sg-mu-preview">
          u_c = {level.mu.uc.toFixed(3)} · U = {level.mu.U.toFixed(3)}
          {!level.mu.complete && <span className="field-error sg-mu-incomplete">Thiếu: {level.mu.missing.join(', ')} — U hiện tại KHÔNG đầy đủ.</span>}
        </p>
      )}
    </Modal>
  );
}
