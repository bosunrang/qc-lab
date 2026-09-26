// Six Sigma — thiết lập nguồn TEa, trạng thái cấu hình, không gian làm việc
// theo kỳ (CV/Bias có nguồn gốc theo từng mức QC), modal Bias% RMS có cảnh
// báo lệch dấu và modal MU ba thành phần. Hộp thoại, khối hiển thị và hàm
// thuần nằm ở `pages/sigma/`. Bộ chọn luôn lấy toàn bộ danh mục
// Cấu hình chung — không tạo hay bật/tắt xét nghiệm riêng trong Sigma.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useSigmaStore, type SigmaLevelSaveInput } from '../store/sigma-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { CalcIcon, DownloadIcon, PrintIcon } from '../components/BtnIcons';
import { RowActionButton } from '../components/RowActionButton';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { DateField } from '../components/DateField';
import { printHtmlToPdf } from '../lib/export';
import { exportSigmaReportXlsx } from '../lib/sigma-summary-export';
import { buildSigmaComparisonPrintHtml, buildSigmaPeriodPrintHtml } from '../lib/sigma-print-report';
import { confirmDialog, infoDialog } from '../state/dialog-store';
import type { SigmaCohortView, SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';
import { resolveSigmaTea, teaCriterionText, type SigmaTeaSource } from '../lib/sigma-tea';
import { governingSigmaLevel } from '../lib/sigma-workflow';
import { AddSigmaPeriodModal } from './sigma/AddSigmaPeriodModal';
import { BiasModal } from './sigma/BiasModal';
import { CohortModal } from './sigma/CohortModal';
import { MuModal } from './sigma/MuModal';
import { SigmaChartsPanel, SigmaMuPanel, SigmaOpspecsPanel, SigmaStatusPanel } from './sigma/SigmaPanels';
import { TEA_SOURCES, editablePercent, isKnownTeaSource, missingSigmaInputs, sigmaZone, vnDate, vnPeriod } from './sigma/shared';

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
  const displayPeriodId = displayPeriod?.id;
  useEffect(() => {
    if (displayPeriodId && selectedPeriodId !== displayPeriodId) setSelectedPeriodId(displayPeriodId);
  }, [displayPeriodId, selectedPeriodId]);
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
        <SigmaStatusPanel period={displayPeriod} testName={test?.name || ''} teaText={displayPeriod ? periodTeaText(displayPeriod) : '—'} />
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

      {testId && displayPeriod && <SigmaOpspecsPanel period={displayPeriod} governingLevel={governingLevel} hasSingleOperationalLevel={hasSingleOperationalLevel} />}

      {testId && displayPeriod && <SigmaMuPanel period={displayPeriod} unit={test?.unit || ''} writable={writable} onEdit={(level) => setMuModal({ period: displayPeriod, level })} />}

      {testId && periods.length > 0 && <SigmaChartsPanel periods={periods} hasChartData={hasChartData} />}

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
