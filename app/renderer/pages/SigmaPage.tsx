// Six Sigma — thiết lập nguồn TEa, trạng thái cấu hình, không gian làm việc
// theo kỳ (CV/Bias có nguồn gốc theo từng mức QC), modal Bias% RMS có cảnh
// báo lệch dấu và modal MU ba thành phần. Bộ chọn luôn lấy toàn bộ danh mục
// Cấu hình chung — không tạo hay bật/tắt xét nghiệm riêng trong Sigma.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useSigmaStore, type SigmaLevelSaveInput } from '../store/sigma-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { Modal } from '../components/Modal';
import { CalcIcon, DownloadIcon, PrintIcon } from '../components/BtnIcons';
import { RowActionButton } from '../components/RowActionButton';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { DateField } from '../components/DateField';
import { SigmaTrendChart, SigmaMdcChart } from '../components/SigmaCharts';
import { printHtmlToPdf } from '../lib/export';
import { exportSigmaReportXlsx } from '../lib/sigma-summary-export';
import { buildSigmaComparisonPrintHtml, buildSigmaPeriodPrintHtml } from '../lib/sigma-print-report';
import { vnDate as formatVnDate } from '../lib/format';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import type { SigmaCohortView, SigmaEqaRound, SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';
import { resolveSigmaTea, teaCriterionText, type SigmaTeaSource } from '../lib/sigma-tea';
import { governingSigmaLevel, sigmaDesignEligible, parseEqaDraft } from '../lib/sigma-workflow';
import { uncertaintyBudget } from '../../main/domain/sigma-metrics';

function rmsOf(values: number[]): number {
  if (!values.length) return 0;
  return values.length === 1 ? values[0] : Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
}

/** Dải năm cho bộ lọc và hộp thêm kỳ: năm nay ± 5. */
const PERIOD_YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

/** Nguồn TEa được hỗ trợ. Cấu hình được chụp vào kỳ Sigma khi tạo để lịch sử
 * không bị thay đổi ngầm. */
const TEA_SOURCES: ReadonlyArray<{ value: SigmaTeaSource; label: string }> = [
  { value: 'lab', label: 'TEa chuẩn hóa của phòng xét nghiệm' },
  { value: 'eflm', label: 'EFLM - nhập từ database' },
  { value: 'clia', label: 'CLIA PT (CMS-3355-F)' },
  { value: 'ricos', label: 'Ricos / Westgard biological variation' },
];

function isKnownTeaSource(value: string): value is SigmaTeaSource {
  return TEA_SOURCES.some((source) => source.value === value);
}

/** DPMO dưới 10 giữ 2 chữ số; dưới 1000 làm tròn; các số lớn phân nhóm nghìn. */
function formatDpmo(value: unknown): string {
  const dpmo = Number(value);
  if (!Number.isFinite(dpmo)) return '—';
  return dpmo < 10 ? dpmo.toFixed(2) : dpmo < 1000 ? dpmo.toFixed(0) : Math.round(dpmo).toLocaleString('en-US');
}

/** Định dạng kỳ ISO thành nhãn tiếng Việt, ví dụ `2026-09` → `Kỳ 09/2026`. */
function vnPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  return m ? `Kỳ ${m[2]}/${m[1]}` : (period || '?');
}

const vnDate = (date: string) => formatVnDate(date, '—');
/** Chỉ rút gọn khi hiển thị trong control; giá trị lưu và tính Sigma vẫn giữ
 * nguyên độ chính xác. Dùng chung cả lúc khôi phục sau khi lưu lỗi để ô không
 * bất ngờ hiện lại một dãy thập phân dài. */
function editablePercent(value: number | null | undefined): string { return value != null ? value.toFixed(2) : ''; }
/** Tháng hiện hành theo múi giờ máy. Không dùng `toISOString()` trực tiếp vì
 * rạng sáng ở Việt Nam có thể rơi về
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
  if (level.biasEqa == null) missing.push('Bias RMS EQA%');
  return missing;
}

function cohortStatusLabel(status: SigmaCohortView['status'] | string): string {
  return status === 'eligible' ? 'Đủ số điểm — cần rà soát' : status === 'provisional' ? 'Tạm thời (20–29)' : status === 'insufficient' ? 'Chưa đủ (<20)'
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

/** Thẻ khuyến nghị cải thiện chỉ hiện khi Sigma tính được và < 4. Phân nhóm
 * nguyên nhân theo tỉ lệ `|bias| / (|bias| + 1.65·cv)`: >0,6 do Bias,
 * <0,4 do CV, còn lại do cả hai. */
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
      {!sigmaDesignEligible(result) && <div className="sg-improvement-target">Ước tính tham khảo — dữ liệu IQC chưa đủ điều kiện hoặc chưa được xác nhận rà soát.</div>}
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

/** Năm bậc màu và ngưỡng diễn giải Sigma dùng thống nhất trong toàn thẻ. */
function sigmaZone(value: number | null | undefined): { c: string; label: string } {
  const sigma = value == null ? NaN : Number(value);
  if (!Number.isFinite(sigma)) return { c: '#506674', label: '—' };
  if (sigma >= 6) return { c: '#13603f', label: 'Đẳng cấp thế giới' };
  if (sigma >= 5) return { c: '#2c7d5c', label: 'Xuất sắc' };
  if (sigma >= 4) return { c: '#3f9a55', label: 'Tốt' };
  if (sigma >= 3) return { c: '#dd8b1f', label: 'Cận biên' };
  return { c: '#c0362c', label: 'Không đạt' };
}

export function SigmaPage() {
  const { tests, teaRefs, levelsByTestId, loadTests, loadTeaRefs, loadLevels, instruments, loadInstruments} = useManageStore();
  const { periods: loadedPeriods, loading, error: loadError, loadPeriods, loadCohorts, savePeriod, removePeriod, saveTeaConfig: saveTeaConfigStore } = useSigmaStore();
  // Vai trò chỉ-xem: vẫn đọc được bảng kỳ/Sigma/MU, không sửa được (main
  // chặn bằng requireWrite ở sigma-handlers.savePeriod).
  const writable = canWrite(useAuthStore((s) => s.user)?.role);
  const [testId, setTestId] = useState('');
  const currentTest = useRef(testId);
  currentTest.current = testId;
  const periods = loadedPeriods.filter(period => period.testId === testId);
  /** Kỳ được chọn điều khiển workspace, OPSpecs và MU. `null` rơi về kỳ mới
   * nhất; khi đổi xét nghiệm, danh sách kỳ và lựa chọn đều phải được đặt lại. */
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [historyMonthFilter, setHistoryMonthFilter] = useState('');
  const [historyYearFilter, setHistoryYearFilter] = useState('');
  const [testSearch, setTestSearch] = useState('');
  useEffect(() => { setSelectedPeriodId(null); setHistoryMonthFilter(''); setHistoryYearFilter(''); }, [testId]);
  const [biasModal, setBiasModal] = useState<{ period: SigmaPeriodView; level: SigmaLevelResult } | null>(null);
  const [muModal, setMuModal] = useState<{ period: SigmaPeriodView; level: SigmaLevelResult } | null>(null);
  const [cohortModal, setCohortModal] = useState<{ period: SigmaPeriodView; cohorts: SigmaCohortView[] } | null>(null);
  const [addPeriodOpen, setAddPeriodOpen] = useState(false);
  const [teaSource, setTeaSource] = useState('lab');
  useEffect(() => { setBiasModal(null); setMuModal(null); setCohortModal(null); setAddPeriodOpen(false); }, [testId]);
  const navigate = useNavigate();

  useEffect(() => { loadTests(); loadTeaRefs(); loadInstruments(); }, [loadTests, loadTeaRefs, loadInstruments]);
  // Mọi xét nghiệm đã khai trong Cấu hình chung đều có thể được đánh giá
  // Sigma. Tự chọn dòng đầu tiên để mở trang là thấy ngay không gian làm việc.
  useEffect(() => {
    if (!tests.length) { if (testId) setTestId(''); return; }
    if (testId && tests.some((item) => item.id === testId)) return;
    setTestId(tests[0].id);
  }, [tests, testId]);
  useEffect(() => { loadPeriods(testId); if (testId) loadLevels(testId); }, [testId, loadPeriods, loadLevels]);
  useStoreInvalidation(['sigma_data', 'qc_points', 'actions', 'app_meta'], testId || undefined, () => { if (testId) loadPeriods(testId); });
  useStoreInvalidation(['tests', 'test_levels', 'instruments', 'tea_refs'], testId || undefined, () => {
    loadTests(); loadTeaRefs(); loadInstruments();
    if (testId) loadLevels(testId);
    if (testId) loadPeriods(testId);
  });

  const sigmaTests = tests;
  const test = tests.find((t) => t.id === testId);
  const sourceTargetMean = (levelsByTestId[testId] || []).find((level) => Number.isFinite(level.mean) && level.mean !== 0)?.mean;
  const teaResolution = useMemo(
    () => test ? resolveSigmaTea(test, teaRefs, teaSource as SigmaTeaSource, sourceTargetMean) : null,
    [test, teaRefs, teaSource, sourceTargetMean],
  );
  const admin = isAdmin(useAuthStore((s) => s.user)?.role);
  const instrumentName = instruments.find((i) => i.id === test?.instrument_id)?.name || '';
  // Cùng một analyte có thể được khai trên nhiều máy. `tests` giữ từng tổ
  // hợp xét nghiệm–máy riêng, nên nhãn selector phải nêu máy để không chọn
  // nhầm cấu hình/chuỗi kỳ Sigma của máy khác.
  const sigmaTestLabel = (item: typeof tests[number]) => {
    const machine = instruments.find((instrument) => instrument.id === item.instrument_id)?.name;
    return machine ? `${item.name} — ${machine}` : item.name;
  };
  const normalizedTestSearch = testSearch.trim().toLocaleLowerCase('vi');
  const visibleSigmaTests = useMemo(() => sigmaTests.filter((item) => {
    if (!normalizedTestSearch) return true;
    const machine = instruments.find((instrument) => instrument.id === item.instrument_id)?.name || '';
    return [item.name, machine, item.unit, item.section].some((value) => value.toLocaleLowerCase('vi').includes(normalizedTestSearch));
  }), [sigmaTests, instruments, normalizedTestSearch]);
  const selectedVisible = visibleSigmaTests.some((item) => item.id === testId);
  useEffect(() => {
    if (normalizedTestSearch && visibleSigmaTests.length && !selectedVisible) setTestId(visibleSigmaTests[0].id);
  }, [normalizedTestSearch, visibleSigmaTests, selectedVisible]);
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
  const configuredTeaSource = teaSource;
  const targetMeanForLevel = (levelNumber: number) => (levelsByTestId[testId] || []).find((level) => level.level === levelNumber)?.mean ?? null;
  const teaForLevel = (levelNumber: number) => {
    return test ? resolveSigmaTea(test, teaRefs, teaSource as SigmaTeaSource, targetMeanForLevel(levelNumber)).value : null;
  };

  async function saveTeaConfig(patch: { source?: string; tea?: string; eflmAnalyte?: string; eflmAps?: string; eflmLookupDate?: string; eflmRef?: string }) {
    if (!test) return;
    const nextSource = (patch.source ?? teaSource) as SigmaTeaSource;
    const resolved = resolveSigmaTea(test, teaRefs, nextSource, sourceTargetMean);
    const result = await saveTeaConfigStore({
      testId: test.id, source: nextSource,
      // EFLM do người dùng nhập; catalog/hồ sơ Lab không được tái dùng số
      // TEa của nguồn khác khi đổi nguồn.
      tea: patch.tea === undefined ? (nextSource === 'eflm' ? undefined : (resolved.value ?? 0)) : (patch.tea === '' ? 0 : Number(patch.tea)),
      eflmAnalyte: patch.eflmAnalyte ?? test.eflm_analyte,
      eflmAps: patch.eflmAps ?? test.eflm_aps,
      eflmLookupDate: patch.eflmLookupDate ?? test.eflm_lookup_date,
      eflmRef: patch.eflmRef ?? test.eflm_ref,
    });
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return; }
    if (patch.source && currentTest.current === test.id) setTeaSource(patch.source);
    await loadTests();
  }

  // Chỉ mức thuộc thiết kế QC ĐANG VẬN HÀNH mới được tạo dòng trong kỳ Sigma:
  // số dòng đó là đầu vào chọn bảng Westgard Sigma Rules (2 mức hay 3 mức),
  // nên phải cùng một định nghĩa "mức đang chạy" với Nhập QC và Westgard.
  const operationalLevels = (levelsByTestId[testId] || []).filter((l) => l.operational !== 0).map((l) => l.level).sort((a, b) => a - b);
  const hasSingleOperationalLevel = operationalLevels.length === 1;
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
  const governingLevel = governingSigmaLevel(displayPeriod);

  function levelPayload(level: SigmaLevelResult): SigmaLevelSaveInput {
    return {
      // `teaSnapshot` chứ KHÔNG phải `tea`: `tea` là giá trị đã giải để hiển
      // thị, có thể đến từ bậc dự phòng (nguồn khác nguồn chốt của kỳ). Gửi nó
      // lại là đóng băng một TEa không nguồn gốc vào hồ sơ chỉ vì người dùng
      // sửa CV. Kỳ chưa có snapshot thì cứ để trống và tiếp tục được giải lại.
      level: level.level, tea: level.teaSnapshot ?? undefined, targetMean: level.targetMean ?? undefined, cv: level.cv ?? undefined, biasEqa: level.biasEqa ?? undefined,
      eqaRounds: level.eqaRounds.map(({ lab, target, bias }) => ({ lab, target, bias })), uCref: level.uCref ?? undefined, uCal: level.uCal ?? undefined,
      muBiasMode: level.muBiasMode ?? (level.mu?.includeBias === false ? 'exclude' : 'include'), cvSource: level.cvSource, cohortN: level.cohortN ?? undefined,
      sourceLot: level.sourceLot, sourceStart: level.sourceStart, sourceEnd: level.sourceEnd, cohortStatus: level.cohortStatus,
    };
  }

  function levelsPayloadFrom(period: SigmaPeriodView, overrideLevel: number, patch: Partial<SigmaLevelSaveInput>): SigmaLevelSaveInput[] {
    return period.levels.map((level) => ({ ...levelPayload(level), ...(level.level === overrideLevel ? patch : {}) }));
  }

  function saveOwnedPeriod(period: SigmaPeriodView, levels: SigmaLevelSaveInput[]) {
    if (period.testId !== currentTest.current || useSigmaStore.getState().loading) return Promise.resolve({ ok: false as const, error: { code: 'stale-sigma-view', message: 'Xét nghiệm hoặc dữ liệu đang xem đã thay đổi. Vui lòng tải lại kỳ trước khi lưu.' } });
    // Nếu mã nguồn TEa đã lưu không còn hợp lệ, dùng nguồn cấu hình hiện hành
    // để tiếp tục sửa kỳ. Snapshot TEa hợp lệ của kỳ vẫn được giữ nguyên.
    const teaSource = isKnownTeaSource(period.teaSource) ? period.teaSource : configuredTeaSource;
    return savePeriod(period.testId, period.period, period.tea ?? undefined, teaSource, levels);
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

  async function exportPeriod(period: SigmaPeriodView) {
    if (!test) return;
    const error = await exportSigmaReportXlsx({ test, instrumentName, periods: [period], mode: 'period' });
    if (error) await infoDialog(error, { title: 'Không xuất được báo cáo kỳ', type: 'warn' });
  }
  async function exportAllPeriods() {
    if (!test) return;
    const error = await exportSigmaReportXlsx({ test, instrumentName, periods, mode: 'comparison' });
    if (error) await infoDialog(error, { title: 'Không xuất được báo cáo các kỳ', type: 'warn' });
  }

  async function printPeriod(period: SigmaPeriodView) {
    if (!test) return;
    // Đọc ngay trước lúc mở hộp in để tên bệnh viện/khoa luôn là hồ sơ đã
    // đồng bộ hiện hành, kể cả khi Cài đặt vừa được chỉnh ở cửa sổ khác.
    const [lab, template] = await Promise.all([window.qcApi.getLabProfile(), window.qcApi.getReportTemplateSettings()]);
    const error = await printHtmlToPdf(buildSigmaPeriodPrintHtml({
      title: `Báo cáo Six Sigma — ${vnPeriod(period.period)}`,
      labName: lab.name,
      labDept: lab.dept,
      labAddress: lab.address,
      logoData: lab.logo_data,
      formCode: template.formCode,
      formVersion: template.version,
      testName: test.name,
      unit: test.unit,
      instrumentName,
      teaSource: TEA_SOURCES.find((source) => source.value === teaSource)?.label || teaSource,
      teaCriterion: teaSourceValueText(teaSource),
      period,
    }), `Báo cáo Six Sigma - ${period.period}.pdf`, { pageNumbers: true });
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function printAllPeriods() {
    if (!test) return;
    const [lab, template] = await Promise.all([window.qcApi.getLabProfile(), window.qcApi.getReportTemplateSettings()]);
    const error = await printHtmlToPdf(buildSigmaComparisonPrintHtml({
      title: 'Báo cáo tổng hợp theo dõi Six Sigma — so sánh các kỳ',
      labName: lab.name,
      labDept: lab.dept,
      labAddress: lab.address,
      logoData: lab.logo_data,
      formCode: template.formCode,
      formVersion: template.version,
      testName: test.name,
      unit: test.unit,
      instrumentName,
      periods,
    }), `Báo cáo tổng hợp Six Sigma - ${test.name}.pdf`, { pageNumbers: true });
    if (error) await infoDialog(error, { type: 'warn' });
  }

  async function commitCv(period: SigmaPeriodView, level: number, value: string): Promise<boolean> {
    const previous = period.levels.find(item => item.level === level)!;
    if (value === editablePercent(previous.cv) || (value !== '' && Number(value) === previous.cv)) return true;
    if (previous.cvSource === 'iqc-cohort' && !await confirmDialog('Chuyển CV sang nhập tay? Nguồn lô và xác nhận rà soát IQC của mức này sẽ được gỡ.', { title: 'Đổi nguồn CV' })) return false;
    const result = await saveOwnedPeriod(period,
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
    if (currentTest.current === testId) setSelectedPeriodId(result.data.id);
    return result;
  }

  async function commitBias(period: SigmaPeriodView, level: number, value: string): Promise<boolean> {
    const previous = period.levels.find(item => item.level === level)!;
    if (value === editablePercent(previous.biasEqa) || (value !== '' && Number(value) === previous.biasEqa)) return true;
    if (previous.eqaRounds.length && !await confirmDialog('Thay các vòng EQA bằng Bias nhập tay? Để giữ chi tiết từng vòng, hãy dùng nút Chi tiết.', { title: 'Đổi nguồn Bias' })) return false;
    const result = await saveOwnedPeriod(period,
      levelsPayloadFrom(period, level, { biasEqa: value === '' ? undefined : Number(value), eqaRounds: [] }));
    if (!result.ok) { await infoDialog(result.error.message, { type: 'warn' }); return false; }
    return true;
  }

  if (!sigmaTests.length) {
    return <>
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="panel"><EmptyState
        title="Chưa có xét nghiệm nào để đánh giá Six Sigma"
        action={admin && <button className="btn teal" onClick={() => navigate('/manage', { state: { tab: 'tests' } })}>Mở Cấu hình chung</button>}
      >{admin ? 'Hãy thêm xét nghiệm trong Cấu hình chung để bắt đầu đánh giá.' : 'Liên hệ quản trị viên để thêm xét nghiệm từ Cấu hình chung.'}</EmptyState></div>
    </>;
  }

  if (!tableLevels.length) {
    return <>
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      <div className="panel sg-no-level-panel">
        <div className="row-flex sg-control-row"><div className="field sg-test-picker"><label>Chọn xét nghiệm</label><select value={testId} onChange={(e) => setTestId(e.target.value)}>{sigmaTests.map((item) => <option key={item.id} value={item.id}>{sigmaTestLabel(item)}</option>)}</select></div>
        </div>
        <div className="alert warn sg-no-level-alert">Xét nghiệm này chưa có mức QC hoặc dữ liệu IQC lịch sử để tính Sigma. Hãy kiểm tra Panel QC, nhóm lô QC, Mean/SD và dữ liệu QC trong Cấu hình chung.
          {admin && <button className="btn teal sm" onClick={() => navigate('/manage', { state: { tab: 'mean-sd' } })}>Cấu hình Mean/SD</button>}
        </div>
      </div>
    </>;
  }

  async function openCohorts(period: SigmaPeriodView) {
    try {
      const cohorts = await loadCohorts(period.testId, period.period, period.levels.map((level) => level.level));
      if (currentTest.current === period.testId) setCohortModal({ period, cohorts });
    } catch { await infoDialog('Không tải được dữ liệu IQC theo lô. Vui lòng thử lại.', { type: 'warn' }); }
  }

  return (
    <div className="sigma-page">
      <PageHeader title="Six Sigma & Sai số" subtitle="Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC" />
      {loading && <div className="hint" role="status">Đang tải dữ liệu Sigma…</div>}
      {loadError && <div className="alert warn" role="alert">{loadError} <button className="btn ghost sm" onClick={() => loadPeriods(testId)}>Thử lại</button></div>}
      <div className="sg-top-grid">
        <div className="panel">
          <div className="sg-setup-heading">
            <h2 className="panel-title">Thiết lập phân tích</h2>
            <div className="sg-setup-search">
              <input type="search" value={testSearch} onChange={(event) => setTestSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setTestSearch(''); }} placeholder="Tìm nhanh xét nghiệm…" aria-label="Tìm nhanh xét nghiệm" />
            </div>
          </div>
          <div className="row-flex sg-control-row">
            <div className="field sg-test-picker">
              <label>Chọn xét nghiệm</label>
              <select id="sgTestSelect" aria-label="Chọn xét nghiệm" value={selectedVisible ? testId : ''} onChange={(event) => { setTestId(event.target.value); setTestSearch(''); }}>
                {!visibleSigmaTests.length && <option value="" disabled>Không tìm thấy xét nghiệm phù hợp</option>}
                {visibleSigmaTests.map((item) => <option key={item.id} value={item.id}>{sigmaTestLabel(item)}</option>)}
              </select>
            </div>
            <div className="field sg-unit-field"><label>Đơn vị</label><input value={test?.unit || ''} aria-label="Đơn vị" readOnly /></div>
            <div className="field sg-instrument-field"><label>Thiết bị</label><input value={instrumentName} readOnly placeholder="Bấm để chọn / quản lý thiết bị" /></div>
          </div>
          <div className="sg-setup-fields sg-analysis-fields">
            <div className="field sg-tea-source">
              <label>Nguồn TEa</label>
              <select aria-label="Nguồn TEa" disabled={!writable} value={teaSource} onChange={(e) => saveTeaConfig({ source: e.target.value })}>
                {TEA_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label} · {teaSourceValueText(s.value)}</option>)}
              </select>
            </div>
            <div className="field sg-tea-input">
              <label>{teaSource === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu'}</label>
              <input key={`tea-${test?.id || 'none'}-${teaSource}-${test?.eflm_tea ?? ''}`} type={teaSource === 'eflm' ? 'number' : 'text'} step="any" aria-label={teaSource === 'clia' ? 'Tiêu chí CLIA' : 'TEa% tham chiếu'} defaultValue={teaSource === 'eflm' ? (test?.eflm_tea != null ? String(test.eflm_tea) : '') : teaSourceValueText(teaSource)} disabled={teaSource !== 'eflm' || !writable} readOnly={teaSource !== 'eflm'} placeholder={teaSource === 'eflm' ? 'Nhập TEa%' : undefined} onBlur={(e) => { if (teaSource === 'eflm' && e.currentTarget.value !== String(test?.eflm_tea ?? '')) saveTeaConfig({ tea: e.currentTarget.value }); }} />
            </div>
          </div>
          {teaSource === 'eflm' && test && <div className="sg-eflm-box">
            <div className="field sg-eflm-field"><label>Xét nghiệm trên EFLM</label><input disabled={!writable} defaultValue={test.eflm_analyte || test.name} placeholder="VD: Glucose" onBlur={(e) => saveTeaConfig({ eflmAnalyte: e.currentTarget.value })} /></div>
            <div className="field sg-eflm-field"><label>Mức APS</label><select disabled={!writable} value={test.eflm_aps || 'desirable'} onChange={(e) => saveTeaConfig({ eflmAps: e.target.value })}><option value="minimum">minimum</option><option value="desirable">desirable</option><option value="optimum">optimum</option></select></div>
            <div className="field sg-eflm-field"><label htmlFor="sg-eflm-lookup-date">Ngày tra cứu</label><DateField id="sg-eflm-lookup-date" value={test.eflm_lookup_date || ''} disabled={!writable} onChange={(value) => { if (value !== (test.eflm_lookup_date || '')) saveTeaConfig({ eflmLookupDate: value }); }} /></div>
            <div className="field sg-eflm-field"><label>Link/tài liệu EFLM</label><input disabled={!writable} defaultValue={test.eflm_ref} placeholder="biologicalvariation.eu / bản in PDF" onBlur={(e) => saveTeaConfig({ eflmRef: e.currentTarget.value })} /></div>
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
                        <div className="grade">{lv.sigma ? `${sigmaDesignEligible(lv) ? '' : 'Ước tính · '}${zone.label}` : ''}</div>
                        <div className="sub">
                          {lv.sigma
                            ? <>CV IQC {lv.cv != null ? lv.cv.toFixed(2) : '—'}% · {lv.eqaRounds.length ? 'Bias RMS EQA/EQC' : 'Bias EQA/EQC'} {lv.biasEqa != null ? lv.biasEqa.toFixed(2) : '—'}%{lv.eqaRounds.length > 1 && lv.biasMean != null ? ` · TB có dấu ${lv.biasMean.toFixed(2)}%` : ''}<br />DPMO {formatDpmo(lv.sigma.dpmo)} · Yield {lv.sigma.yieldPercent.toFixed(4)}%</>
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
                  <div className="sg-level-matrix-head" role="row"><span>Mức QC</span><span>CV IQC</span><span>Bias RMS EQA/EQC</span><span>Sigma</span></div>
                  {displayPeriod.levels.map((lv) => {
                    const zone = sigmaZone(lv.sigma?.sigma);
                    const cvSource = lv.cvSource === 'iqc-cohort' ? `Lô ${lv.sourceLot || '—'} · n=${lv.cohortN ?? 0}` : 'Nhập tay';
                    const biasSource = lv.eqaRounds.length ? `${lv.eqaRounds.length} vòng EQA · RMS` : 'Nhập tay';
                    return <div className="sg-level-row" role="row" key={lv.level}>
                      <div className="sg-level-identity" role="cell"><b>Mức {lv.level}</b><span>TEa {lv.tea != null ? `${lv.tea.toFixed(2)}%` : 'chưa có'}</span></div>
                      <div className="sg-level-cell" role="cell">
                        <div className="sg-level-input-row"><input key={`cv-${displayPeriod.id}-${lv.level}-${lv.cv ?? ''}`} className="sg-number" type="number" step="0.01" defaultValue={editablePercent(lv.cv)} placeholder="CV%" disabled={!writable} aria-label={`CV IQC mức ${lv.level}`} onBlur={async (e) => {
                          const input = e.currentTarget;
                          if (!(await commitCv(displayPeriod, lv.level, input.value))) input.value = editablePercent(lv.cv);
                        }} />{writable && <button className="btn ghost" title={`Chọn CV IQC theo lô cho ${vnPeriod(displayPeriod.period)}`} onClick={() => openCohorts(displayPeriod)}><DownloadIcon />Nạp lô</button>}</div>
                        <span className="sg-level-source" title={lv.cvSource === 'iqc-cohort' ? `CV lấy từ lô ${lv.sourceLot}, ${lv.cohortN ?? 0} điểm (${vnDate(lv.sourceStart)}–${vnDate(lv.sourceEnd)})` : undefined}>{cvSource}</span>
                        {lv.cvSource === 'iqc-cohort' && <span className="sg-level-source">{lv.cohortStale ? 'Dữ liệu nền đã đổi — cần nạp lại' : lv.cohortReviewed ? `Đã rà soát: ${lv.cohortReviewBy}` : 'Chưa xác nhận rà soát IQC'}</span>}
                      </div>
                      <div className="sg-level-cell" role="cell">
                        <div className="sg-level-input-row"><input key={`bias-${displayPeriod.id}-${lv.level}-${lv.biasEqa ?? ''}`} className="sg-number" type="number" step="any" defaultValue={editablePercent(lv.biasEqa)} disabled={!writable} placeholder="Bias RMS%" aria-label={`Bias RMS EQA mức ${lv.level}`} onBlur={async (e) => {
                          const input = e.currentTarget;
                          if (!(await commitBias(displayPeriod, lv.level, input.value))) input.value = editablePercent(lv.biasEqa);
                        }} />{writable && <button className="btn ghost" title={`Nhập hoặc rà soát các vòng EQA/EQC cho mức ${lv.level}`} onClick={() => setBiasModal({ period: displayPeriod, level: lv })}><CalcIcon />Chi tiết</button>}</div>
                        <span className="sg-level-source">{biasSource}</span>
                        {lv.eqaRounds.length > 1 && lv.biasMean != null && <span className="sg-level-source">TB có dấu: {lv.biasMean.toFixed(2)}%</span>}
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
          </div> : <EmptyState
            title={operationalLevels.length > 0 ? 'Chưa có kỳ đánh giá' : 'Chưa có mức QC đang vận hành'}
            action={writable && operationalLevels.length > 0 && <button className="btn teal" onClick={() => setAddPeriodOpen(true)}>+ Thêm kỳ</button>}
          >{operationalLevels.length === 0
            ? 'Cần cấu hình ít nhất một mức QC đang vận hành trước khi thêm kỳ đánh giá.'
            : writable
              ? 'Thêm kỳ đánh giá để ghi nhận CV IQC, Bias EQA/EQC và theo dõi Sigma.'
              : 'Liên hệ người có quyền ghi để thêm kỳ đánh giá.'}
          </EmptyState>}
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
                const eligible = sigmaDesignEligible(lv);
                const design = eligible ? lv.qualityDesign : null;
                return <tr key={lv.level}><td>Mức {lv.level}</td><td className="num" style={{ color: sigmaZone(lv.sigma?.sigma).c }}>{lv.sigma?.sigma.toFixed(2) ?? '—'}</td>
                  {!lv.sigma ? <><td>—</td><td>Chưa đủ CV/Bias</td><td>Chưa đánh giá</td></>
                    : hasSingleOperationalLevel ? <><td><span className="hint">Chưa áp dụng</span></td><td>Cần tối thiểu 2 mức QC đang vận hành</td><td>Không đưa gợi ý Sigma Rules</td></>
                    : !eligible ? <><td><span className="hint">Chưa đủ điều kiện</span></td><td>{lv.cvSource !== 'iqc-cohort' ? 'CV nhập tay' : lv.cohortStale ? 'Cần nạp và rà soát lại' : !lv.cohortReviewed ? 'Chưa xác nhận rà soát' : cohortStatusLabel(lv.cohortStatus)}</td><td>Không dùng để đề xuất QC</td></>
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
            ) : <div className="hint sg-governing-rule">{hasSingleOperationalLevel ? 'Chưa đề xuất QC dùng chung: cần tối thiểu 2 mức QC đang vận hành để áp dụng bảng Westgard Sigma Rules.' : 'Chưa đề xuất QC dùng chung: cần đủ đầu vào và xác nhận rà soát IQC cho tất cả mức; không bỏ qua mức thiếu dữ liệu hoặc mất kiểm soát.'}</div>}
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
                      <td className="num">{lv.mu?.uc != null ? <>{lv.mu.uc.toFixed(4)}{!lv.mu.complete && <small className="hint"> · tạm tính</small>}</> : '—'}</td>
                      <td className="num">{lv.mu?.U != null ? <>{lv.mu.U.toFixed(4)}{!lv.mu.complete && <small className="hint"> · tạm tính</small>}</> : '—'}</td>
                      <td className="num">{lv.mu?.complete && lv.mu.absoluteU != null ? `${lv.mu.absoluteU.toFixed(4)}${test?.unit ? ` ${test.unit}` : ''}` : '—'}</td>
                      <td className="num">{lv.mu?.teaRatio != null ? <b className={lv.mu.withinTea ? 'sg-mu-within' : 'sg-mu-over'}>{(lv.mu.teaRatio * 100).toFixed(0)}%</b> : '—'}</td>
                      <td>{!lv.mu ? <span className="hint">Chưa có CV IQC</span> : !lv.mu.complete ? <span className="tag warn">Chưa đủ</span> : lv.mu.withinTea === false ? <span className="tag rej">U vượt TEa</span> : <span className="tag ok">Đủ thành phần</span>}</td>
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
            const result = await saveOwnedPeriod(biasModal.period,
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
            const result = await saveOwnedPeriod(muModal.period,
              levelsPayloadFrom(muModal.period, muModal.level.level, { uCref, uCal, muBiasMode }));
            if (result.ok) setMuModal(null);
            return result;
          }}
        />
      )}
      {cohortModal && (
        <CohortModal period={cohortModal.period} cohorts={cohortModal.cohorts} onClose={() => setCohortModal(null)} onSubmit={async (choices, cohortReviewed) => {
          const levels = levelsPayloadFrom(cohortModal.period, -1, {}).map((level) => {
            const cohort = choices[level.level];
            return cohort && cohort.cv != null && cohort.cv > 0
              ? { ...level, refreshCohort: true, cohortReviewed, cohortFingerprint: cohort.fingerprint, targetMean: cohort.targetMean ?? undefined, cv: cohort.cv, cvSource: 'iqc-cohort' as const, cohortN: cohort.n, sourceLot: cohort.lot, sourceStart: cohort.start, sourceEnd: cohort.end, cohortStatus: cohort.status }
              : level;
          });
          const result = await saveOwnedPeriod(cohortModal.period, levels);
          if (result.ok) setCohortModal(null);
          return result;
        }} />
      )}
    </div>
  );
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

  return <Modal title="Thêm kỳ Sigma" onClose={onClose} size="sm"
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
  const { parsedRounds, hasIncompleteRound } = parseEqaDraft(rounds);
  const biases = parsedRounds.map((round) => (round.lab - round.target) / Math.abs(round.target) * 100);
  const rms = rmsOf(biases);
  const mean = biases.length ? biases.reduce((s, v) => s + v, 0) / biases.length : 0;
  const mixedSigns = biases.some((v) => v > 0) && biases.some((v) => v < 0);

  async function submit() {
    if (hasIncompleteRound) {
      await infoDialog('Mỗi vòng đã nhập cần đủ KQ PXN và Target EQA hợp lệ (Target khác 0).', { title: 'Chưa thể áp dụng Bias%', type: 'warn' });
      return;
    }
    if (!parsedRounds.length) {
      await infoDialog('Nhập ít nhất 1 vòng EQA/EQC.', { title: 'Chưa thể áp dụng Bias%', type: 'warn' });
      return;
    }
    const result = await onSubmit(parsedRounds);
    if (!result.ok) await infoDialog(result.error?.message || 'Lỗi không xác định.', { title: 'Không thể áp dụng Bias%', type: 'warn' });
  }

  return (
    <Modal title="Tính Bias% từ EQA/EQC" onClose={onClose} size="md"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng Bias%</button></>}>
      <div className="sg-eqa-table-wrap">
        <table className="sg-eqa-table">
          <thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th>Thao tác</th></tr></thead>
          <tbody>
            {rounds.map((v, i) => {
                const lab = Number(v.lab), target = Number(v.target);
                const bias = v.lab.trim() !== '' && v.target.trim() !== '' && Number.isFinite(lab) && Number.isFinite(target) && target !== 0 ? (lab - target) / Math.abs(target) * 100 : null;
              return (
                <tr key={i}>
                  <td className="sg-eqa-index">{i + 1}</td>
                  <td><input type="number" step="any" value={v.lab} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? { ...x, lab: e.target.value } : x)))} /></td>
                  <td><input type="number" step="any" value={v.target} onChange={(e) => setRounds((r) => r.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} /></td>
                  <td className="sg-eqa-bias" style={{ color: bias != null ? (Math.abs(bias) > 10 ? 'var(--danger-text)' : 'var(--accent)') : undefined }}>{bias != null ? `${bias.toFixed(2)}%` : '—'}</td>
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
  onSubmit: (choices: Record<number, SigmaCohortView | undefined>, cohortReviewed: boolean) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const byLevel = useMemo(() => new Map(period.levels.map((level) => [level.level, cohorts.filter((cohort) => cohort.level === level.level)])), [period.levels, cohorts]);
  const [choices, setChoices] = useState<Record<number, string>>(() => Object.fromEntries(period.levels.map((level) => [level.level, level.sourceLot || byLevel.get(level.level)?.at(-1)?.lot || ''])));
  async function submit() {
    const selected: Record<number, SigmaCohortView | undefined> = {};
    for (const level of period.levels) selected[level.level] = byLevel.get(level.level)?.find((cohort) => cohort.lot === choices[level.level]);
    const confirmed = await confirmDialog(
      'Xác nhận bạn đã rà soát biểu đồ IQC/Westgard, xử lý các sự cố liên quan và chọn các lô đại diện theo SOP. Hệ thống sẽ lưu tên và thời điểm xác nhận.',
      { title: 'Xác nhận rà soát IQC', confirmLabel: 'Xác nhận và dùng dữ liệu', cancelLabel: 'Quay lại', danger: false },
    );
    if (!confirmed) return;
    const result = await onSubmit(selected, true);
    if (!result.ok) await infoDialog(result.error?.message || 'Không thể nạp CV từ IQC.', { title: 'Không thể dùng dữ liệu IQC', type: 'warn' });
  }
  return <Modal title={`Chọn dữ liệu CV IQC theo lô — ${vnPeriod(period.period)}`} onClose={onClose} size="xl"
    footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Dùng dữ liệu đã chọn</button></>}>
    <div className="sg-cohort-table-wrap"><table className="sg-cohort-table"><thead><tr><th className="sg-cohort-level">Mức</th><th>Lô QC</th><th>Khoảng dữ liệu</th><th className="num">n</th><th className="num">CV</th><th>Trạng thái</th></tr></thead><tbody>
      {period.levels.flatMap((level) => {
        const rows = byLevel.get(level.level) || [];
        if (!rows.length) return <tr key={level.level}><td>Mức {level.level}</td><td colSpan={5} className="hint">Chưa có điểm IQC hợp lệ theo lô trong kỳ này.</td></tr>;
        return rows.map((cohort, index) => <tr key={`${level.level}:${cohort.lot}:${cohort.start}`}><td className="sg-cohort-level">{index === 0 ? `Mức ${level.level}` : ''}</td><td><label><input type="radio" name={`cohort-${level.level}`} checked={choices[level.level] === cohort.lot} onChange={() => setChoices((old) => ({ ...old, [level.level]: cohort.lot }))} /> Lô {cohort.lot || '—'}</label></td><td>{vnDate(cohort.start)}–{vnDate(cohort.end)}</td><td className="num">{cohort.n}</td><td className="num">{cohort.cv != null ? `${cohort.cv.toFixed(2)}%` : '—'}</td><td><span className={`tag ${cohortStatusTone(cohort.status)}`}>{cohortStatusLabel(cohort.status)}</span>{cohort.issues.length ? <div className="sg-cohort-issue">{cohort.issues.join(' · ')}</div> : null}</td></tr>);
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
  const [includeBias, setIncludeBias] = useState(level.muBiasMode ? level.muBiasMode !== 'exclude' : level.mu?.includeBias !== false);
  const [err, setErr] = useState<string | null>(null);
  const preview = uncertaintyBudget({ cv: level.cv, bias: level.biasEqa, uCref, uCal, includeBias, tea: level.tea, target: level.targetMean });

  async function submit() {
    const result = await onSubmit(uCref === '' ? undefined : Number(uCref), uCal === '' ? undefined : Number(uCal), includeBias ? 'include' : 'exclude');
    if (!result.ok) setErr(result.error?.message || 'Lỗi không xác định.');
  }

  return (
    <Modal title="Ngân sách độ không đảm bảo đo (MU)" onClose={onClose} size="lg" className="sg-mu-modal"
      footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn teal" onClick={submit}>Áp dụng ngân sách MU</button></>}>
      {err && <p className="field-error">{err}</p>}
      <table className="sg-mu-detail-table">
        <thead><tr><th>Thành phần</th><th>Giá trị</th></tr></thead>
        <tbody>
          <tr><td>u(Rw) — từ CV%</td><td>{level.cv != null ? level.cv.toFixed(3) : <span className="tag warn">Chưa có</span>}</td></tr>
          <tr><td>Bias quan sát (RMS các vòng EQA)</td><td>{level.biasEqa != null ? Math.abs(level.biasEqa).toFixed(3) : <span className="tag warn">Chưa có</span>}</td></tr>
          <tr><td>u(Cref)% — giá trị gán EQA/CRM</td><td>{preview?.uCref != null ? preview.uCref.toFixed(3) : <span className="tag warn">Chưa đánh giá / không áp dụng</span>}</td></tr>
          <tr><td>u(bias)% = √(bias² + u(Cref)²)</td><td>{preview?.uBias != null ? preview.uBias.toFixed(3) : <span className="tag warn">Chưa có / không áp dụng</span>}</td></tr>
          <tr><td>u(cal)%</td><td>{preview?.uCal != null ? preview.uCal.toFixed(3) : <span className="tag warn">Chưa đánh giá</span>}</td></tr>
        </tbody>
      </table>
      <label className="sg-mu-bias-toggle">
        <input type="checkbox" checked={includeBias} onChange={(e) => setIncludeBias(e.target.checked)} /> Đưa u(bias) vào ngân sách
      </label>
      <div className="field"><label>u(Cref) % — độ không đảm bảo của giá trị gán, từ báo cáo EQA/chứng chỉ CRM</label><input type="number" step="0.001" min="0" value={uCref} onChange={(e) => setUCref(e.target.value)} /></div>
      <details className="alert info sg-mu-help">
        <summary>Hướng dẫn xác định u(Cref)</summary>
        <p>Nhập độ không đảm bảo chuẩn theo %. Nếu chứng chỉ cho độ không đảm bảo mở rộng U, tính u = U/k với hệ số phủ k trên chứng chỉ; chỉ chia 2 khi k = 2. Nếu u ở đơn vị nồng độ, đổi u% = 100 × u / |giá trị tham chiếu|. Áp dụng cách quy đổi này cho cả u(Cref) và u(cal); không chia lại nếu tài liệu đã cho u chuẩn. Không suy u(Cref) từ độ phân tán các vòng bias{level.biasSem != null ? ` (SEM hiện ${level.biasSem.toFixed(3)}%, chỉ tham khảo)` : ''}. Bỏ trống là chưa đánh giá, không phải 0.</p>
        <p>Mô hình có/không cộng bias phải được người phụ trách phê duyệt; bỏ bias cần chứng cứ xử lý/hiệu chỉnh và tránh tính trùng thành phần.</p>
      </details>
      <div className="field"><label>u(cal)% chuẩn — từ CoA hiệu chuẩn (0 là kết luận hợp lệ, khác với bỏ trống)</label><input type="number" step="0.001" min="0" value={uCal} onChange={(e) => setUCal(e.target.value)} /></div>
      {preview && (
        <p className="sg-mu-preview">
          {preview.complete ? 'Dự tính' : 'Tạm tính chưa đầy đủ'}: u_c = {preview.uc.toFixed(3)}% · U (k=2) = {preview.U.toFixed(3)}%
          {!preview.complete && <span className="field-error sg-mu-incomplete">Thiếu: {preview.missing.join(', ')} — không dùng để kết luận đạt TEa.</span>}
        </p>
      )}
    </Modal>
  );
}


