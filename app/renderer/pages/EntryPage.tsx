// Trang Nhập QC: điều phối dữ liệu và trạng thái chung, còn từng khối hiển
// thị nằm ở `pages/entry/`. Tách ngày 2026-09-26 (kế hoạch kiến trúc D.6):
// trước đó một component 1.070 dòng giữ 35 state, nên gõ một ký tự vào ô lý
// do huỷ điểm là vẽ lại cả bảng 31 ngày và mọi biểu đồ. Nay hộp thoại tự giữ
// form của mình, còn bảng nhập và biểu đồ bọc `memo` và chỉ nhận props ổn
// định (cột dựng bằng `useMemo`, callback bằng `useCallback`).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';
import { useEntryStore } from '../store/entry-store';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { confirmDialog } from '../state/dialog-store';
import { extremeQcPointDeviation } from '../../main/domain/entry-validation';
import type { QcChartPoint } from '../components/QcChart';
import type { QcPointView, TestLevel } from '../../shared/qc-api';
import { createOperationalCatalog } from './entry/operational';
import { EntryTree, TreeToggleIcon } from './entry/EntryTree';
import { EntrySheet, type SheetMessages } from './entry/EntrySheet';
import { EntryLjPanel } from './entry/EntryLjPanel';
import { EntryPointsPanel } from './entry/EntryPointsPanel';
import { EntryRangePanel } from './entry/EntryRangePanel';
import { VoidPointModal } from './entry/VoidPointModal';
import { RangeWorkflowModal, type RangeMode } from './entry/RangeWorkflowModal';
import { formatQcValue, pad2, vnDate, type DisplayColumn, type EntryColumn } from './entry/shared';

const EMPTY_LEVELS: TestLevel[] = [];
const ENTRY_TREE_COLLAPSE_KEY = 'qclab-entry-tree-collapsed';

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function EntryPage() {
  const { instruments, lots, lotGroups, tests, panels, levelsByTestId, loadInstruments, loadLevels, loadLots, loadLotGroups, loadTests, loadPanels } = useManageStore(useShallow((s) => ({
    instruments: s.instruments, lots: s.lots, lotGroups: s.lotGroups, tests: s.tests, panels: s.panels, levelsByTestId: s.levelsByTestId,
    loadInstruments: s.loadInstruments, loadLevels: s.loadLevels, loadLots: s.loadLots, loadLotGroups: s.loadLotGroups, loadTests: s.loadTests, loadPanels: s.loadPanels,
  })));
  const { summaries, loadSummaries } = useWestgardStore(useShallow((s) => ({ summaries: s.summaries, loadSummaries: s.loadSummaries })));
  const { pointsByLevel, analysisByLevel, parallelColumns, previousLotSeries, voidedPoints, rangeCandidate, rangeError, loadTestData, resetTestData, loadRangeCandidate, addPoint, setDayNote } = useEntryStore(useShallow((s) => ({
    pointsByLevel: s.pointsByLevel, analysisByLevel: s.analysisByLevel, parallelColumns: s.parallelColumns, previousLotSeries: s.previousLotSeries,
    voidedPoints: s.voidedPoints, rangeCandidate: s.rangeCandidate, rangeError: s.rangeError,
    loadTestData: s.loadTestData, resetTestData: s.resetTestData, loadRangeCandidate: s.loadRangeCandidate, addPoint: s.addPoint, setDayNote: s.setDayNote,
  })));
  // Vai trò "chỉ xem" vẫn mở được trang này nhưng không
  // thấy ô nhập/nút huỷ — main process cũng chặn (requireWrite), đây chỉ để
  // không hiện nút rồi mới báo lỗi.
  const role = useAuthStore((s) => s.user)?.role;
  const writable = canWrite(role);
  const admin = isAdmin(role);

  /** Mức của "Thống kê toàn bộ & Dải kiểm soát". Thẻ biểu đồ là các khối
   * thông tin đồng thời, không giả làm lựa chọn rồi âm thầm không đổi dữ liệu. */
  const [rangeLevel, setRangeLevel] = useState<number | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(() => {
    try { return localStorage.getItem(ENTRY_TREE_COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [testId, setTestId] = useState('');
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [voiding, setVoiding] = useState<QcPointView | null>(null);
  const [voidMsg, setVoidMsg] = useState<string | null>(null);
  // Mỗi mức chỉ mở một chuỗi lô cũ trên biểu đồ/bảng chi tiết. Worksheet vẫn
  // hiện mọi điểm lô cũ theo ngày ở dạng chỉ đọc để lịch sử tháng liền mạch.
  const [previousLotOpen, setPreviousLotOpen] = useState<Record<number, string>>({});
  const [ljDays, setLjDays] = useState(30);
  const [ljFrom, setLjFrom] = useState('');
  const [ljTo, setLjTo] = useState('');
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [pointErr, setPointErr] = useState<string | null>(null);
  const [pointFeedback, setPointFeedback] = useState<{ kind: 'ok' | 'warn' | 'rej'; message: string } | null>(null);

  function setTreeVisibility(collapsed: boolean) {
    setTreeCollapsed(collapsed);
    try { localStorage.setItem(ENTRY_TREE_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }
  const collapseTree = useCallback(() => setTreeVisibility(true), []);

  useEffect(() => { loadInstruments(); loadLots(); loadLotGroups(); loadSummaries(); loadTests(); loadPanels(); }, [loadInstruments, loadLots, loadLotGroups, loadSummaries, loadTests, loadPanels]);
  // `listTestLevels()` CỐ Ý trả về đủ mọi mức kèm cờ `operational` (Bảng
  // Mean/SD và Lịch sử dữ liệu cần thấy cả mức đã dừng). Thẻ Nhập QC thì chỉ
  // được dựng cột cho mức ĐANG VẬN HÀNH — cùng tập mà `listOperationalLevels()`
  // gác ở main. Thiếu bộ lọc này thì một mức gắn lô thuộc nhóm đã dừng vẫn
  // hiện ô nhập (gõ vào luôn bị `level-not-operational` chặn), cột luôn trống
  // vì `queryPoints()` không trả điểm nào, và nặng nhất là `rowClass()` lấy
  // `levels.length` làm số mức phải nhập đủ nên MỌI ngày quá khứ trong tháng
  // bị kẻ vệt cam "còn thiếu" dù đã nhập đủ.
  //
  // Phải memo: `levelNums` là dependency của effect nạp dữ liệu, mảng mới mỗi
  // lần render sẽ thành vòng lặp nạp vô hạn.
  const allLevels = levelsByTestId[testId] || EMPTY_LEVELS;
  const levels = useMemo(() => allLevels.filter((l) => l.operational !== 0), [allLevels]);
  const levelNums = useMemo(() => levels.map((l) => l.level), [levels]);
  useEffect(() => { if (testId) loadLevels(testId); }, [testId, loadLevels]);
  // Đổi xét nghiệm thì dải QC đang xem rơi về mức đầu tiên còn vận hành.
  useEffect(() => {
    if (!levelNums.length) { setRangeLevel(null); return; }
    setRangeLevel((cur) => (cur != null && levelNums.includes(cur) ? cur : levelNums[0]));
  }, [testId, levelNums]);
  useEffect(() => { setPreviousLotOpen({}); }, [testId]);
  useEffect(() => {
    if (testId) loadTestData(testId, levelNums);
    else resetTestData();
  }, [testId, levelNums, loadTestData, resetTestData]);
  useEffect(() => { if (testId && rangeLevel != null) loadRangeCandidate(testId, rangeLevel); }, [testId, rangeLevel, loadRangeCandidate]);
  useStoreInvalidation(['qc_points', 'test_levels', 'lot_transitions'], testId || undefined, () => {
    if (testId && levelNums.length) loadTestData(testId, levelNums);
    if (testId && rangeLevel != null) loadRangeCandidate(testId, rangeLevel);
  });
  // Nhãn Đạt/Cảnh báo/Loại trên cây lấy từ `summaries` của MỌI xét nghiệm, nên
  // không lọc theo testId. Trước đây chỉ bảng của xét nghiệm đang mở được nạp
  // lại: nhập một điểm bị loại xong, cây vẫn ghi "Đạt" tới khi rời trang.
  useStoreInvalidation(['qc_points', 'test_levels', 'lot_transitions', 'tests'], undefined, loadSummaries);

  const catalog = useMemo(() => createOperationalCatalog(tests, panels, lots, lotGroups), [tests, panels, lots, lotGroups]);
  const currentSummary = summaries.find((s) => s.testId === testId);
  const testName = currentSummary?.testName || '';
  const decimals = currentSummary?.decimalPlaces ?? 2;

  const selectLeaf = useCallback((id: string) => {
    // Nhóm lô chứa xét nghiệm được mở một lần trong `EntryTree` khi `testId`
    // đổi; ở đây chỉ chọn xét nghiệm và đưa bảng về tháng hiện tại.
    const now = new Date();
    setTestId(id);
    setViewYear(now.getFullYear()); setViewMonth(now.getMonth() + 1);
  }, []);

  // Tự chọn xét nghiệm đầu tiên khi lựa chọn hiện tại không hợp lệ để mở trang
  // là có ngay bảng nhập. `location.state.testId` cho phép điều hướng chéo từ
  // Tổng quan đến đúng xét nghiệm.
  const navState = useLocation().state as { testId?: string; level?: number } | null;
  useEffect(() => {
    if (!summaries.length) return;
    const wanted = navState?.testId;
    if (wanted && wanted !== testId && summaries.some((s) => s.testId === wanted)) { selectLeaf(wanted); return; }
    if (testId && summaries.some((s) => s.testId === testId)) return;
    // Chỉ tự chọn xét nghiệm đã sẵn sàng nhập — không rơi vào một xét nghiệm
    // chưa có nhóm lô hoạt động, thứ
    // vốn còn không hiện trong cây để mà chọn.
    const first = summaries.find((s) => catalog.isOperationalTest(s));
    if (first) selectLeaf(first.testId);
  }, [summaries, navState?.testId, catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const wantedLevel = Number(navState?.level);
    if (navState?.testId === testId && Number.isFinite(wantedLevel) && levelNums.includes(wantedLevel)) setRangeLevel(wantedLevel);
  }, [testId, levelNums, navState?.testId, navState?.level]);

  /** Preset "N ngày": đặt Đến = hôm nay, Từ = hôm nay − (N−1) ngày. */
  const applyDayPreset = useCallback((days: number) => {
    setLjDays(days);
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    setLjFrom(isoDay(start)); setLjTo(isoDay(end));
  }, []);
  // Cửa sổ mặc định 30 ngày để khoảng xem luôn có hai mốc ngày.
  useEffect(() => { if (!ljFrom && !ljTo) applyDayPreset(30); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cột nhập được xếp theo mức: lô đang vận hành trước, lô chuyển tiếp ngay
   * sau nó. Lô song song dùng Mean/SD của hồ sơ chuyển lô và chuỗi Westgard
   * riêng do main process trả về; renderer chỉ dựng hình từ kết quả đó. */
  const entryColumns: EntryColumn[] = useMemo(() => {
    const lotLabelFor = (level: number) => {
      const lv = levels.find((l) => l.level === level);
      const lot = lv?.qc_lot_id ? lots.find((l) => l.id === lv.qc_lot_id) : null;
      return lot?.lot_no || '—';
    };
    return levels.flatMap((level) => {
      const analysis = analysisByLevel[level.level];
      const rows = pointsByLevel[level.level] || [];
      // `analyzeLevel` mang z + `accepted`; `queryPoints` mang LÝ DO lần chạy bị
      // loại. Ghép theo id để biểu đồ nói được vì sao một chấm xanh không vào
      // thống kê, thay vì chỉ âm thầm bớt nó khỏi n.
      const runRejectedById = new Map(rows.map((point) => [point.id, point.runRejectedBy || []]));
      const main: EntryColumn = {
        key: `main:${level.level}:${lotLabelFor(level.level)}`,
        level: level.level, lot: lotLabelFor(level.level), mean: level.mean, sd: level.sd, exp: '',
        parallel: false, applied: level.applied, points: rows,
        chartPoints: (analysis?.points || []).map((point) => ({ ...point, runRejectedBy: runRejectedById.get(point.id) || [] })),
      };
      const candidate = parallelColumns.find((item) => item.level === level.level);
      if (!candidate) return [main];
      const chartPoints: QcChartPoint[] = candidate.points.map((point) => ({
        date: point.date, runId: point.run_id, val: point.val,
        z: (point.val - candidate.mean) / candidate.sd,
        // `accepted` do main tính (loại CẢ lần chạy khi một mức của lô song song
        // bị loại), không phải cờ theo từng điểm — cùng ngữ nghĩa với cột chính.
        verdict: point.verdict, rules: point.rules, accepted: point.accepted === true,
        runRejectedBy: point.runRejectedBy || [],
      }));
      return [main, {
        key: `parallel:${candidate.transitionId}:${candidate.level}:${candidate.lot}`,
        level: candidate.level, lot: candidate.lot, mean: candidate.mean, sd: candidate.sd,
        exp: candidate.exp, parallel: true, applied: 'mfg' as const,
        points: candidate.points, chartPoints,
      }];
    });
  }, [levels, lots, analysisByLevel, pointsByLevel, parallelColumns]);

  const displayColumns: DisplayColumn[] = useMemo(() => entryColumns.map((column) => {
    if (column.parallel) return { ...column, previous: false };
    const previous = previousLotSeries.find((series) => series.level === column.level && series.lot === previousLotOpen[column.level]);
    if (!previous) return { ...column, previous: false };
    return {
      ...column,
      key: `previous:${column.level}:${previous.lot}`,
      lot: previous.lot, mean: previous.mean, sd: previous.sd, points: previous.points, previous: true,
      chartPoints: previous.points.map((point) => ({
        date: point.date, runId: point.run_id, val: point.val,
        z: point.qc_mean != null && point.qc_sd != null && point.qc_sd > 0
          ? (point.val - point.qc_mean) / point.qc_sd : (point.val - previous.mean) / previous.sd,
        verdict: point.verdict, rules: point.rules, accepted: point.accepted === true,
        runRejectedBy: point.runRejectedBy || [],
      })),
    };
  }), [entryColumns, previousLotSeries, previousLotOpen]);

  const togglePreviousLot = useCallback((level: number) => {
    setPreviousLotOpen((current) => {
      if (current[level]) { const next = { ...current }; delete next[level]; return next; }
      const previous = previousLotSeries.find((series) => series.level === level);
      return previous ? { ...current, [level]: previous.lot } : current;
    });
  }, [previousLotSeries]);

  // Chỉ xoá ô nhập khi lưu thành công; nếu thất bại thì hiển thị lỗi trả về.
  const commitRun = useCallback(async (column: EntryColumn, date: string, runId: string, val: number): Promise<boolean> => {
    const deviation = extremeQcPointDeviation(val, column.mean, column.sd);
    if (deviation != null) {
      const confirmed = await confirmDialog(
        `Giá trị ${formatQcValue(val, decimals)} lệch ${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}SD, vượt ngưỡng ±5SD so với Mean/SD hiện tại. Hãy kiểm tra đơn vị, dấu thập phân và mức QC trước khi lưu.`,
        { title: 'Giá trị QC bất thường', confirmLabel: 'Vẫn lưu', cancelLabel: 'Kiểm tra lại' },
      );
      if (!confirmed) return false;
    }
    const result = await addPoint({ testId, level: column.level, date, val, runId, lotNo: column.parallel ? column.lot : undefined });
    if (!result.ok) {
      setPointErr(result.error.message);
      setPointFeedback(null);
      return false;
    }
    setPointErr(null);
    setVoidMsg(null);
    const rules = result.data.rules.join(', ');
    const lotSuffix = column.parallel ? ` · lô song song ${column.lot}` : '';
    setPointFeedback(result.data.verdict === 'rej'
      ? { kind: 'rej', message: `⚠ Mức ${column.level}${lotSuffix} vi phạm${rules ? ` — ${rules}` : ''}` }
      : result.data.verdict === 'warn'
        ? { kind: 'warn', message: `Mức ${column.level}${lotSuffix} cảnh báo${rules ? ` — ${rules}` : ''}` }
        : { kind: 'ok', message: `✓ Đã lưu Mức ${column.level}${lotSuffix} ngày ${vnDate(date)}.` });
    return true;
  }, [testId, decimals, addPoint]);

  const saveDayNote = useCallback(async (date: string, note: string) => {
    const result = await setDayNote(testId, date, note);
    setNoteErr(result.ok ? null : result.error.message);
  }, [testId, setDayNote]);

  const messages: SheetMessages = useMemo(() => ({ noteErr, pointErr, pointFeedback, voidMsg }), [noteErr, pointErr, pointFeedback, voidMsg]);
  const openVoid = useCallback((point: QcPointView) => setVoiding(point), []);
  const closeVoid = useCallback(() => setVoiding(null), []);
  const onVoided = useCallback((message: string) => {
    setVoidMsg(message);
    setPointFeedback(null);
    setVoiding(null);
  }, []);
  const closeRange = useCallback(() => setRangeMode(null), []);
  const onRangeApplied = useCallback(async () => {
    await Promise.all([loadLevels(testId), loadTestData(testId, levelNums), loadSummaries()]);
  }, [testId, levelNums, loadLevels, loadTestData, loadSummaries]);

  // Hai trạng thái rỗng thay toàn bộ thân trang: chưa khai báo xét nghiệm và
  // đã có xét nghiệm nhưng chưa sẵn sàng nhập (thiếu Panel QC, nhóm lô đang
  // hoạt động hoặc Mean/SD). Mỗi trạng thái có hướng dẫn riêng.
  const emptyState = !tests.length
    ? { title: 'Chưa có xét nghiệm', message: 'Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.', linkLabel: 'Thêm xét nghiệm', tab: 'tests' }
    : !summaries.some((s) => catalog.isOperationalTest(s))
      ? { title: 'Chưa có xét nghiệm sẵn sàng nhập', message: 'Cần đưa xét nghiệm vào Panel QC, ghép Nhóm lô QC và gán Mean/SD trước khi nhập kết quả.', linkLabel: 'Cấu hình Mean/SD', tab: 'targets' }
      : null;

  return (
    <div>
      <PageHeader title="Nhập QC" subtitle="Ghi nhận kết quả theo ngày, mức QC và lô đang vận hành" />
      {emptyState ? (
        <div className="panel">
          <EmptyState
            title={emptyState.title}
            action={admin && <Link className="btn teal" to="/manage" state={{ tab: emptyState.tab }}>{emptyState.linkLabel}</Link>}
          >{emptyState.message}</EmptyState>
        </div>
      ) : (
      <div className={`entrygrid${treeCollapsed ? ' tree-collapsed' : ''}`}>
        <button type="button" className="btn teal entry-tree-expand" onClick={() => setTreeVisibility(false)}
          title="Hiện danh mục nội kiểm" aria-label="Hiện danh mục nội kiểm" aria-controls="entryTreePanel" aria-expanded={!treeCollapsed}><TreeToggleIcon /></button>

        <EntryTree summaries={summaries} instruments={instruments} catalog={catalog} testId={testId}
          treeCollapsed={treeCollapsed} onSelect={selectLeaf} onCollapse={collapseTree} />

        <div className="entry-main" key={testId}>
          {!testId && <div className="panel"><EmptyState>Chọn 1 xét nghiệm ở danh mục bên trái.</EmptyState></div>}
          {testId && (
            <>
              <EntrySheet testId={testId} testName={testName} entryColumns={entryColumns} levels={levels}
                pointsByLevel={pointsByLevel} previousLotSeries={previousLotSeries} decimals={decimals} writable={writable}
                viewYear={viewYear} viewMonth={viewMonth} onViewYear={setViewYear} onViewMonth={setViewMonth}
                messages={messages} onCommitRun={commitRun} onSaveNote={saveDayNote} />
              <EntryLjPanel displayColumns={displayColumns} levelCount={levels.length} pointsByLevel={pointsByLevel}
                analysisByLevel={analysisByLevel} previousLotSeries={previousLotSeries} decimals={decimals}
                ljFrom={ljFrom} ljTo={ljTo} ljDays={ljDays} onFrom={setLjFrom} onTo={setLjTo} onPreset={applyDayPreset}
                onTogglePreviousLot={togglePreviousLot} />
              <EntryPointsPanel displayColumns={displayColumns} voidedPoints={voidedPoints} decimals={decimals}
                writable={writable} ljFrom={ljFrom} ljTo={ljTo} onVoid={openVoid} />
              <EntryRangePanel rangeCandidate={rangeCandidate} rangeError={rangeError} levelNums={levelNums} rangeLevel={rangeLevel}
                decimals={decimals} writable={writable} onRangeLevel={setRangeLevel} onOpen={setRangeMode} />
            </>
          )}
        </div>
      </div>
      )}

      {voiding && <VoidPointModal point={voiding} decimals={decimals} onClose={closeVoid} onVoided={onVoided} />}
      {rangeMode && rangeCandidate && (
        <RangeWorkflowModal mode={rangeMode} testId={testId} testName={testName} rangeCandidate={rangeCandidate}
          decimals={decimals} onClose={closeRange} onApplied={onRangeApplied} />
      )}
    </div>
  );
}
