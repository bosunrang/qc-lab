import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';
import { useEntryStore } from '../store/entry-store';
import { useAuthStore } from '../store/auth-store';
import { initialsFromName } from '../../main/domain/name-initials';
import { canWrite, isAdmin } from '../lib/permissions';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { QcChart, type QcChartPoint } from '../components/QcChart';
import { Modal } from '../components/Modal';
import { DateField } from '../components/DateField';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { confirmDialog, reauthDialog } from '../state/dialog-store';
import { extremeQcPointDeviation, voidNceChoice, type VoidKind } from '../../main/domain/entry-validation';
import type { QcPointView, TestLevel, TestSummary } from '../../shared/qc-api';
import { handleSheetKeyDown } from '../lib/entry-sheet-navigation';
import { handleTreeKeyDown } from '../lib/entry-tree-navigation';
import { nextSharedRunId } from '../lib/entry-run-id';
import { vnDate as formatVnDate } from '../lib/format';

/** Nhãn ngắn dùng riêng cho cây điều hướng ('Loại', không phải 'Loại bỏ'). */
const TREE_STATE: Record<string, string> = { rej: 'Loại', warn: 'Cảnh báo', ok: 'Đạt', none: 'Chưa có' };
/** Lớp CSS của một hàng ngày trong bảng nhập: `today` cho hôm nay; `missing`
 * khi ngày đã qua (hoặc chính hôm nay)
 * mà CHƯA nhập đủ mọi mức đang vận hành (vệt cam bên trái ô Ngày, CSS loại
 * trừ `.today`); `has-data` khi ngày có ít nhất một điểm. */
function rowClass(date: string, today: string, doneLevels: number, liveLevels: number, hasPoint: boolean): string {
  return [date === today ? 'today' : '', date <= today && doneLevels < liveLevels ? 'missing' : '', hasPoint ? 'has-data' : '']
    .filter(Boolean).join(' ');
}

const VERDICT_LABEL: Record<string, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };

/** Nhãn phụ cho điểm KHÔNG vào Mean/SD/CV thực mà TỰ NÓ không vi phạm: cả
 * lần chạy bị loại vì một mức khác (`acceptedRunPoints()` loại theo run).
 * Không có nhãn này thì điểm hiện "Đạt" rồi lặng lẽ bị trừ khỏi n — người
 * dùng đếm 11 chấm trên hình mà thống kê ghi n=9 và không có cách nào biết
 * vì sao. Điểm tự bị loại đã có nhãn "Loại bỏ" nên không lặp lại ở đây. */
function runExcludedNote(point: QcPointView): string | null {
  const by = point.runRejectedBy || [];
  if (point.accepted !== false || point.verdict === 'rej' || !by.length) return null;
  return `Lần chạy bị loại ở ${by.map((level) => `Mức ${level}`).join(', ')}`;
}
const vnDate = (iso: string) => formatVnDate(iso, iso || '—');
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const EMPTY_LEVELS: TestLevel[] = [];

type EntryColumn = {
  key: string; level: number; lot: string; mean: number | null; sd: number | null; exp: string;
  parallel: boolean; applied: 'mfg' | 'lab'; points: QcPointView[]; chartPoints: QcChartPoint[];
};

function daysInMonth(year: number, month: number): number { return new Date(year, month, 0).getDate(); }
function pad2(n: number): string { return String(n).padStart(2, '0'); }

/** Cùng hình chevron và hướng xoay với nút thu gọn thanh điều hướng. */
function TreeToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** Dấu mở/đóng của từng nhánh cây: SVG giữ nét +/− sắc, đối xứng và không
 * chịu ảnh hưởng baseline của font như ký tự văn bản. */
function TreeNodeToggleIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M3 8h10" />
      {!open && <path d="M8 3v10" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6.5 7 .8 13h9.4l.8-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

const ENTRY_TREE_COLLAPSE_KEY = 'qclab-entry-tree-collapsed';

export function EntryPage() {
  const { instruments, lots, lotGroups, tests, panels, levelsByTestId, loadInstruments, loadLevels, loadLots, loadLotGroups, loadTests, loadPanels } = useManageStore();
  const { summaries, loadSummaries } = useWestgardStore();
  const { pointsByLevel, analysisByLevel, parallelColumns, previousLotSeries, voidedPoints, rangeCandidate, rangeError, loadTestData, resetTestData, loadRangeCandidate, applyLabRange, revertManufacturerRange, addPoint, voidPoint, setDayNote } = useEntryStore();
  // Vai trò "chỉ xem" vẫn mở được trang này nhưng không
  // thấy ô nhập/nút huỷ — main process cũng chặn (requireWrite), đây chỉ để
  // không hiện nút rồi mới báo lỗi.
  const role = useAuthStore((s) => s.user)?.role;
  const writable = canWrite(role);
  const admin = isAdmin(role);

  const [machineFilter, setMachineFilter] = useState('');
  const [search, setSearch] = useState('');
  // Máy mặc định mở; chỉ giữ các máy người dùng đã chủ động thu gọn để cây
  // vẫn hiển thị đủ dữ liệu ngay lần đầu vào trang.
  const [closedMachines, setClosedMachines] = useState<Set<string>>(new Set());
  const [openTests, setOpenTests] = useState<Set<string>>(new Set());
  /** Mức của "Thống kê toàn bộ & Dải kiểm soát". Thẻ biểu đồ là các khối
   * thông tin đồng thời, không giả làm lựa chọn rồi âm thầm không đổi dữ liệu. */
  const [rangeLevel, setRangeLevel] = useState<number | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(() => {
    try { return localStorage.getItem(ENTRY_TREE_COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [testId, setTestId] = useState('');
  const today = new Date();
  // Hiển thị 11 năm, từ năm hiện tại trừ 5 năm.
  const YEARS = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [voiding, setVoiding] = useState<QcPointView | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidErr, setVoidErr] = useState<string | null>(null);

  function setTreeVisibility(collapsed: boolean) {
    setTreeCollapsed(collapsed);
    try { localStorage.setItem(ENTRY_TREE_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }
  // Hai kind đầu khoá cứng openNce; chỉ 'other' cho phép người dùng bật/tắt.
  // Modal mặc định dùng nguyên nhân 'analytical'.
  const [voidKind, setVoidKind] = useState<VoidKind>('analytical');
  const [voidOpenNce, setVoidOpenNce] = useState(true);
  const [voidMsg, setVoidMsg] = useState<string | null>(null);
  const voidChoice = voidNceChoice(voidKind);
  // Ngày đã có điểm chỉ mở lần chạy bổ sung khi người dùng bấm "＋ Thêm".
  // Trạng thái mở này thuần UI,
  // khoá theo `mức|ngày`, không lưu xuống DB.
  const [extraRuns, setExtraRuns] = useState<Set<string>>(new Set());
  // Mỗi mức chỉ mở một chuỗi lô cũ trên biểu đồ/bảng chi tiết. Worksheet vẫn
  // hiện mọi điểm lô cũ theo ngày ở dạng chỉ đọc để lịch sử tháng liền mạch.
  const [previousLotOpen, setPreviousLotOpen] = useState<Record<number, string>>({});
  const [ljDays, setLjDays] = useState(30);
  const [ljFrom, setLjFrom] = useState('');
  const [ljTo, setLjTo] = useState('');
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [pointErr, setPointErr] = useState<string | null>(null);
  const [pointFeedback, setPointFeedback] = useState<{ kind: 'ok' | 'warn' | 'rej'; message: string } | null>(null);
  const [rangeMode, setRangeMode] = useState<'apply' | 'revert' | null>(null);
  const [rangeReason, setRangeReason] = useState('');
  const [rangeSubmitError, setRangeSubmitError] = useState<string | null>(null);
  const [rangeCauseConfirmed, setRangeCauseConfirmed] = useState(false);
  const [rangeBias, setRangeBias] = useState('');
  const [rangeSelection, setRangeSelection] = useState<'proposed' | 'manual'>('proposed');
  const [rangeManualMean, setRangeManualMean] = useState('');
  const [rangeManualSd, setRangeManualSd] = useState('');

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

  const currentSummary = summaries.find((s) => s.testId === testId);
  const testName = currentSummary?.testName || '';

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
    const first = summaries.find((s) => isOperationalTest(s));
    if (first) selectLeaf(first.testId);
  }, [summaries, navState?.testId, tests, panels, lots, lotGroups]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const wantedLevel = Number(navState?.level);
    if (navState?.testId === testId && Number.isFinite(wantedLevel) && levelNums.includes(wantedLevel)) setRangeLevel(wantedLevel);
  }, [testId, levelNums, navState?.testId, navState?.level]);

  /** Nhóm lô có đang hoạt động không: `active!==false && status!=='stopped' &&
   * status!=='planned'`. Nhóm
   * đã dừng/dự kiến, và nhóm "Đã lưu trữ" (`active=0`, do CHẤP NHẬN chuyển
   * tiếp lô tạo ra) đều KHÔNG được tính — lô của các nhóm đó không còn xuất
   * hiện trong cây điều hướng Nhập QC, dù cột `qc_lots.group_id` cũ trong DB
   * vẫn còn trỏ tới chúng. */
  const isOperationalGroup = (group: (typeof lotGroups)[number] | undefined): boolean =>
    !!group && group.active !== 0 && group.status !== 'stopped' && group.status !== 'planned';

  /** Nhóm lô đang hoạt động mà một lô thuộc về: lô
   * thuộc nhóm đã dừng/dự kiến/lưu trữ trả về `null`, coi như KHÔNG có nhóm,
   * không phải "để tên số lô" như trước — số lô trần chỉ tự sinh khi CHÍNH
   * nhóm đó chưa được đặt tên, không phải khi nhóm không operational. */
  const operationalGroupOfLot = (lotId: string | null | undefined) => {
    if (!lotId) return null;
    const lot = lots.find((l) => l.id === lotId);
    if (!lot?.group_id) return null;
    const group = lotGroups.find((g) => g.id === lot.group_id);
    return isOperationalGroup(group) ? group! : null;
  };

  /** Xét nghiệm có sẵn sàng nhập không: còn hoạt động, nằm trong một Panel QC
   * đang hoạt động và có ít nhất một mức
   * gán lô thuộc nhóm đang hoạt động. Chỉ những xét nghiệm này mới xuất hiện
   * trong cây điều hướng. Xét nghiệm chưa đủ điều kiện không hiển thị trong
   * cây để tránh trộn với xét nghiệm hợp lệ. */
  const isOperationalTest = (summary: TestSummary): boolean => {
    const test = tests.find((t) => t.id === summary.testId);
    if (!test || test.active === 0) return false;
    if (!panels.some((p) => p.active !== 0 && p.testIds.includes(summary.testId))) return false;
    return summary.levels.some((l) => !!operationalGroupOfLot(l.qcLotId));
  };

  /** Nhãn nhóm lô của một xét nghiệm: lấy nhóm lô đang hoạt động của mức QC
   * đầu tiên có gán. Chỉ gọi cho
   * xét nghiệm đã qua `isOperationalTest()` nên luôn tìm được 1 nhóm. */
  const lotGroupOf = (summary: TestSummary): { key: string; name: string } => {
    for (const level of summary.levels) {
      const group = operationalGroupOfLot(level.qcLotId);
      if (group) {
        const nos = group.lotIds.map((id) => lots.find((l) => l.id === id)?.lot_no).filter(Boolean);
        return { key: 'grp:' + group.id, name: group.name || `Nhóm lô ${nos.join('/')}` };
      }
    }
    return { key: 'none', name: 'Chưa gán nhóm lô' };
  };

  /** Verdict của điểm cuối trên mọi mức, không phải điểm xấu nhất từng có. */
  const latestOf = (summary: TestSummary): 'ok' | 'warn' | 'rej' | 'none' => {
    let worst: 'ok' | 'warn' | 'rej' | 'none' = 'none';
    const rank = { none: -1, ok: 0, warn: 1, rej: 2 } as const;
    for (const level of summary.levels) {
      if (!level.latest) continue;
      if (rank[level.latestVerdict] > rank[worst]) worst = level.latestVerdict;
    }
    return worst;
  };

  const tree = useMemo(() => {
    const bySearch = (s: TestSummary) => !search || s.testName.toLowerCase().includes(search.toLowerCase());
    const machines = new Map<string, Map<string, { name: string; tests: TestSummary[] }>>();
    for (const s of summaries) {
      if (!isOperationalTest(s)) continue;
      if (!bySearch(s)) continue;
      const inst = instruments.find((i) => i.name === s.instrumentName);
      if (machineFilter && inst?.id !== machineFilter) continue;
      const byGroup = machines.get(s.instrumentName) || new Map();
      const g = lotGroupOf(s);
      const bucket = byGroup.get(g.key) || { name: g.name, tests: [] as TestSummary[] };
      bucket.tests.push(s); byGroup.set(g.key, bucket); machines.set(s.instrumentName, byGroup);
    }
    return Array.from(machines.entries()).map(([machine, byGroup]) => [machine, Array.from(byGroup.entries())] as const);
  }, [summaries, search, machineFilter, instruments, lots, lotGroups, tests, panels]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Tới hôm nay": về tháng hiện tại rồi cuộn tới đúng hàng hôm nay. */
  function goToday() {
    setViewYear(today.getFullYear()); setViewMonth(today.getMonth() + 1);
    requestAnimationFrame(() => document.querySelector('.qc-sheet tr.today')?.scrollIntoView({ block: 'center' }));
  }

  /** Giá trị QC in theo số thập phân của xét nghiệm, không dùng định dạng mặc định của JS. */
  const decimals = currentSummary?.decimalPlaces ?? 2;
  const valText = (val: number) => val.toFixed(decimals);

  /** z-score của một điểm: `+0.40s` / `-1.20s` (có dấu, hậu tố 's').
   *
   * Ưu tiên Mean/SD đã CHỐT lúc nhập (`qc_mean`/`qc_sd`) đúng thứ tự mà
   * `pointTarget()` ở domain dùng, rồi mới tới Mean/SD đang gán của mức. Lấy
   * thẳng Mean/SD hiện hành thì sau một lần đổi dải, cùng một điểm hiện
   * "Z = +3,80s · Đạt" — Z nói theo dải mới còn kết luận vẫn theo dải cũ.
   * `HistoryTab` đã đọc đúng cặp cột này từ đầu. */
  function zText(point: QcPointView, level: { mean: number | null; sd: number | null }): string {
    const hasSnapshot = point.qc_mean != null && point.qc_sd != null && point.qc_sd > 0;
    const mean = hasSnapshot ? (point.qc_mean as number) : Number(level.mean);
    const sd = hasSnapshot ? (point.qc_sd as number) : Number(level.sd);
    if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) return '—';
    const z = (point.val - mean) / sd;
    return `${z >= 0 ? '+' : ''}${z.toFixed(2)}s`;
  }

  /** Preset "N ngày": đặt Đến = hôm nay, Từ = hôm nay − (N−1) ngày. */
  function applyDayPreset(days: number) {
    setLjDays(days);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    setLjFrom(iso(start)); setLjTo(iso(end));
  }

  // Cửa sổ mặc định 30 ngày để khoảng xem luôn có hai mốc ngày.
  useEffect(() => { if (!ljFrom && !ljTo) applyDayPreset(30); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Điểm ĐƯỢC CHẤP NHẬN (cờ `accepted` do `analyzeLevel` tính qua
   * `acceptedRunPoints()` — loại CẢ lần chạy khi một mức bị loại; không phải
   * `acceptedPoints()`, hàm đó đã `@deprecated` và chỉ còn test đối chiếu
   * dùng) và nằm trong khoảng xem — giữ đúng tập này cho số điểm và thống kê
   * Mean/SD/CV thực. Biểu đồ vẽ thêm điểm bị loại để biến cố QC không biến
   * mất khỏi hình. */
  function acceptedInWindow(level: number): QcPointView[] {
    const ids = new Set((analysisByLevel[level]?.points || []).filter((p) => p.accepted).map((p) => p.id));
    return inLjWindow((pointsByLevel[level] || []).filter((p) => !p.voided && ids.has(p.id)));
  }

  /** Thống kê QUAN SÁT ĐƯỢC của các điểm còn hiệu lực (SD mẫu, n-1) — dùng
   * cho panel "Thống kê toàn bộ", khác Mean/SD ĐÍCH đang gán cho mức. */
  function observedStats(points: QcPointView[]): { n: number; mean: number; sd: number; cv: number } {
    const vals = points.filter((p) => !p.voided).map((p) => p.val);
    const n = vals.length;
    if (!n) return { n: 0, mean: 0, sd: 0, cv: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    return { n, mean, sd, cv: mean ? (sd / Math.abs(mean)) * 100 : 0 };
  }

  async function saveDayNote(date: string, note: string) {
    const result = await setDayNote(testId, date, note);
    setNoteErr(result.ok ? null : result.error.message);
  }

  /** Lọc điểm theo cửa sổ Từ/Đến của biểu đồ. Ô trống = không giới hạn đầu tương ứng. */
  function inLjWindow<T extends { date: string }>(points: T[]): T[] {
    return points.filter((p) => (!ljFrom || p.date >= ljFrom) && (!ljTo || p.date <= ljTo));
  }

  function selectLeaf(id: string) {
    // Xét nghiệm đang chọn và nhóm lô đang MỞ là hai trạng thái độc lập:
    // người dùng vẫn cần thu gọn được nhóm chứa xét nghiệm đang xem. Bản đầu
    // vô tình dùng `testId` để ép nhóm đó mở mãi, nên bấm dấu − không có tác
    // dụng. Khi chọn một xét nghiệm (kể cả khi mở trang từ Dashboard), chỉ
    // mở nhóm chứa nó một lần; sau đó nút nhóm toàn quyền đóng/mở.
    setTestId(id);
    setOpenTests((current) => {
      const next = new Set(current);
      for (const [, groups] of tree) {
        for (const [groupKey, group] of groups) {
          if (group.tests.some((test) => test.testId === id)) {
            next.add(groupKey);
            return next;
          }
        }
      }
      return next;
    });
    setViewYear(today.getFullYear()); setViewMonth(today.getMonth() + 1);
  }

  // Chỉ xoá ô nhập khi lưu thành công; nếu thất bại thì hiển thị lỗi trả về.
  async function commitRun(column: EntryColumn, date: string, runId: string, val: number): Promise<boolean> {
    const deviation = extremeQcPointDeviation(val, column.mean, column.sd);
    if (deviation != null) {
      const confirmed = await confirmDialog(
        `Giá trị ${valText(val)} lệch ${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}SD, vượt ngưỡng ±5SD so với Mean/SD hiện tại. Hãy kiểm tra đơn vị, dấu thập phân và mức QC trước khi lưu.`,
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
  }

  function pointsForDay(level: number, date: string): QcPointView[] {
    return (pointsByLevel[level] || []).filter((p) => p.date === date && !p.voided);
  }

  const rangeSummaryText = (() => {
    const p = rangeCandidate?.proposed;
    if (!p) return 'Chưa có dữ liệu của lô đang vận hành';
    return `N=${p.n} · Mean thực=${p.mean.toFixed(decimals)} · SD thực=${p.sd.toFixed(4)} · CV=${p.cv.toFixed(2)}%`;
  })();

  async function submitRangeWorkflow() {
    if (!testId || rangeLevel == null || !rangeMode) return;
    const minimum = rangeMode === 'apply' ? 10 : 5;
    if (rangeReason.trim().length < minimum) { setRangeSubmitError(`Cần ghi lý do tối thiểu ${minimum} ký tự.`); return; }
    const manual = rangeMode === 'apply' && rangeSelection === 'manual';
    const manualMean = Number(rangeManualMean), manualSd = Number(rangeManualSd);
    if (manual && (!rangeManualMean.trim() || !rangeManualSd.trim() || !Number.isFinite(manualMean) || !Number.isFinite(manualSd) || manualSd <= 0)) {
      setRangeSubmitError('Nhập Mean hợp lệ và SD lớn hơn 0.'); return;
    }
    const verified = await reauthDialog({ title: 'Xác thực thay đổi dải QC', message: 'Nhập lại mật khẩu để xác nhận thay đổi Mean/SD đang dùng.' });
    if (!verified) return;
    const result = rangeMode === 'apply'
      ? await applyLabRange(testId, rangeLevel, rangeReason.trim(), rangeCauseConfirmed, rangeBias === '' ? undefined : Number(rangeBias), manual ? manualMean : undefined, manual ? manualSd : undefined)
      : await revertManufacturerRange(testId, rangeLevel, rangeReason.trim());
    if (!result.ok) { setRangeSubmitError(result.error.message); return; }
    await Promise.all([loadLevels(testId), loadTestData(testId, levelNums), loadSummaries()]);
    setRangeMode(null); setRangeReason(''); setRangeSubmitError(null); setRangeSelection('proposed'); setRangeManualMean(''); setRangeManualSd('');
  }

  function openRangeWorkflow() {
    const proposed = rangeCandidate?.proposed;
    setRangeMode('apply'); setRangeReason(''); setRangeCauseConfirmed(false); setRangeBias(''); setRangeSubmitError(null);
    setRangeSelection('proposed');
    setRangeManualMean(proposed ? proposed.mean.toFixed(decimals) : '');
    setRangeManualSd(proposed ? proposed.sd.toFixed(4) : '');
  }

  const days = Array.from({ length: daysInMonth(viewYear, viewMonth) }, (_, i) => i + 1)
    .map((d) => `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`);
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const lotLabelFor = (level: number) => {
    const lv = levels.find((l) => l.level === level);
    const lot = lv?.qc_lot_id ? lots.find((l) => l.id === lv.qc_lot_id) : null;
    return lot?.lot_no || '—';
  };

  /** Cột nhập được xếp theo mức: lô đang vận hành trước, lô chuyển tiếp ngay
   * sau nó. Lô song song dùng Mean/SD của hồ sơ chuyển lô và chuỗi Westgard
   * riêng do main process trả về; renderer chỉ dựng hình từ kết quả đó. */
  const entryColumns: EntryColumn[] = levels.flatMap((level) => {
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

  type DisplayColumn = EntryColumn & { previous: boolean };
  const displayColumns: DisplayColumn[] = entryColumns.map((column) => {
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
  });

  function togglePreviousLot(level: number) {
    setPreviousLotOpen((current) => {
      if (current[level]) { const next = { ...current }; delete next[level]; return next; }
      const previous = previousLotSeries.find((series) => series.level === level);
      return previous ? { ...current, [level]: previous.lot } : current;
    });
  }

  function pointsForColumnDay(column: EntryColumn, date: string): QcPointView[] {
    return column.points.filter((point) => point.date === date && !point.voided);
  }

  /** Lấp vào lần chạy đang thiếu của mức này trước, để cùng đợt chạy có cùng
   * runId giữa các mức và engine ghép được các luật Westgard liên mức. Lô
   * song song là chuỗi độc lập, không được trộn với lô đang vận hành. */
  function sharedRunIdFor(column: EntryColumn, date: string): string {
    const cohort = entryColumns.filter((item) => item.parallel === column.parallel);
    return nextSharedRunId(
      date,
      pointsForColumnDay(column, date).map((point) => point.run_id),
      cohort.flatMap((item) => pointsForColumnDay(item, date).map((point) => point.run_id)),
    );
  }

  async function submitVoid() {
    if (!voiding) return;
    if (voidChoice.reasonRequired && voidReason.trim().length < 5) { setVoidErr('Cần ghi lý do hủy tối thiểu 5 ký tự.'); return; }
    const openNce = voidChoice.forced ? voidChoice.openNce : voidOpenNce;
    const result = await voidPoint(voiding.id, voidReason.trim(), voidKind, openNce, voiding.test_id, voiding.level);
    if (!result.ok) { setVoidErr(result.error.message); return; }
    const followup = result.data.nceId
      ? (result.data.reusedAction ? ' Đã giữ liên kết với hồ sơ NCE đang mở.' : ` Đã mở hồ sơ ${result.data.nceId} để tiếp tục điều tra.`)
      : ' Không yêu cầu NCE/QC chạy lại.';
    setVoidMsg(`Đã hủy điểm QC ngày ${vnDate(voiding.date)}. Điểm không còn tham gia tính toán.${followup}`);
    setPointFeedback(null);
    setVoiding(null); setVoidReason('');
  }

  // Hai trạng thái rỗng thay toàn bộ thân trang: chưa khai báo xét nghiệm và
  // đã có xét nghiệm nhưng chưa sẵn sàng nhập (thiếu Panel QC, nhóm lô đang
  // hoạt động hoặc Mean/SD). Mỗi trạng thái có hướng dẫn riêng.
  const emptyState = !tests.length
    ? { title: 'Chưa có xét nghiệm', message: 'Cần khai báo xét nghiệm và mức QC trước khi nhập kết quả.', linkLabel: 'Thêm xét nghiệm', tab: 'tests' }
    : !summaries.some((s) => isOperationalTest(s))
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

        <div className="tree" id="entryTreePanel">
          <div className="entry-tree-head">
            <h4>Danh mục nội kiểm</h4>
            <button type="button" className="btn ghost entry-tree-toggle" onClick={() => setTreeVisibility(true)}
              title="Ẩn danh mục nội kiểm" aria-label="Ẩn danh mục nội kiểm" aria-controls="entryTreePanel" aria-expanded={!treeCollapsed}><TreeToggleIcon /></button>
          </div>
          <div className="tree-tools">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm test, máy..." />
            <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
              <option value="">Tất cả máy</option>
              {instruments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div role="tree">
            {tree.map(([machine, groups]) => {
              const machineKey = `machine:${machine}`;
              const machineOpen = !closedMachines.has(machineKey);
              return (
              <div key={machine}>
                <div className="tnode tn-machine" role="treeitem" aria-expanded={machineOpen}
                  tabIndex={0} onKeyDown={handleTreeKeyDown}
                  onClick={() => setClosedMachines((current) => { const next = new Set(current); next.has(machineKey) ? next.delete(machineKey) : next.add(machineKey); return next; })}>
                  <span className="caret" aria-hidden="true"><TreeNodeToggleIcon open={machineOpen} /></span>{machine}
                </div>
                {machineOpen && groups.map(([groupKey, group]) => {
                  const open = openTests.has(groupKey);
                  const rank = { none: -1, ok: 0, warn: 1, rej: 2 } as const;
                  const groupWorst = group.tests.reduce<'ok' | 'warn' | 'rej' | 'none'>((acc, s) => rank[latestOf(s)] > rank[acc] ? latestOf(s) : acc, 'none');
                  return (
                    <div key={groupKey}>
                      <div className={`tnode tn-test${open ? ' open' : ''}`} role="treeitem" aria-expanded={open}
                        tabIndex={0} onKeyDown={handleTreeKeyDown}
                        onClick={() => setOpenTests((s) => { const next = new Set(s); next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey); return next; })}>
                        <span className="caret" aria-hidden="true"><TreeNodeToggleIcon open={open} /></span>{group.name}
                        <span className={`tag ${groupWorst}`}>{TREE_STATE[groupWorst]}</span>
                      </div>
                      {open && group.tests.map((s) => {
                        const state = latestOf(s);
                        return (
                          <div key={s.testId} className={`tnode tn-config${testId === s.testId ? ' on' : ''}`} role="treeitem"
                            tabIndex={0} onKeyDown={handleTreeKeyDown}
                            aria-current={testId === s.testId ? 'true' : 'false'} onClick={() => selectLeaf(s.testId)}>
                            <span className="config-name">{s.testName}</span>
                            <span className={`tag ${state}`}>{TREE_STATE[state]}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              );
            })}
            {!tree.length && <div className="tree-empty">Không có xét nghiệm phù hợp.</div>}
          </div>
        </div>

        <div className="entry-main" key={testId}>
          {!testId && <div className="panel"><p className="empty-state">Chọn 1 xét nghiệm ở danh mục bên trái.</p></div>}
          {testId && (
            <>
              <div className="panel qc-sheet-panel">
                <div className="qc-sheet-heading">
                  <div className="qc-sheet-title"><span>Bảng nhập QC</span><strong>{testName}</strong><small>Lô {entryColumns.map((column) => `${column.lot}${column.parallel ? ' (song song)' : ''}`).join(' / ') || '—'}</small></div>
                  <div className="qc-month-area">
                    <div className="qc-month-picker">
                      <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))}>{MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}</select>
                      <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))}>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                      <button className="btn ghost sm qc-current-month" onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth() + 1); }}>Tháng hiện tại</button>
                      <button className="btn teal sm qc-today-jump" onClick={goToday}>Tới hôm nay</button>
                    </div>
                  </div>
                </div>
                <div className="qc-sheet-wrap">
                  <table className="qc-sheet">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        {entryColumns.map((column) => {
                          const limits = column.mean != null && column.sd != null ? `${valText(column.mean - 2 * column.sd)} – ${valText(column.mean + 2 * column.sd)}` : '—';
                          const tooltip = `Mean ${column.mean != null ? valText(column.mean) : '—'} · SD ${column.sd != null ? column.sd.toFixed(4) : '—'} · ±2SD ${limits}`;
                          return (
                            <th key={column.key} className={`qc-level-head${column.parallel ? ' qc-parallel-cell' : ''}`} tabIndex={0} data-qc-tooltip={tooltip} aria-label={`Mức ${column.level} · Lô ${column.lot}${column.parallel ? ' · Song song' : ''} · ${tooltip}`}>
                              Mức {column.level} · Lô {column.lot}{column.parallel && <span className="qc-parallel-label">Song song</span>}
                            </th>
                          );
                        })}
                        <th>NV thực hiện</th><th>Vi phạm cảnh báo</th><th>Vi phạm loại bỏ</th><th>Chấp nhận</th><th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((date) => {
                        const oldDayPoints = previousLotSeries.flatMap((series) => series.points.filter((point) => point.date === date && !point.voided));
                        const dayPoints = [...oldDayPoints, ...entryColumns.flatMap((column) => pointsForColumnDay(column, date))];
                        const staff = Array.from(new Set(dayPoints.map((p) => p.operator_code || initialsFromName(p.operator_name)).filter(Boolean)));
                        // Kết luận NGÀY tính theo lần chạy CUỐI CÙNG ĐƯỢC
                        // CHẤP NHẬN của MỖI mức — không phải "tệ nhất trong
                        // mọi lần chạy". Sau khi chạy lại đạt, ngày đó không
                        // còn coi là vi phạm dù lần chạy đầu từng bị loại.
                        //
                        // Mốc là `accepted` (lần chạy), KHÔNG phải verdict
                        // riêng của điểm. Westgard/CLSI: lần chạy bị loại thì
                        // MỌI mức trong lần chạy đó phải chạy lại, vì hệ
                        // thống không ổn định trong suốt lần chạy. Lấy theo
                        // verdict riêng thì chạy lại MỘT mức là đủ để ngày
                        // đóng dấu "Chấp nhận", trong khi mức còn lại vẫn
                        // chưa có kết quả hợp lệ nào.
                        //
                        // Mức CHƯA nhập gì thì bỏ qua: "chưa nhập" đã có vệt
                        // cam của `rowClass()` lo, không được biến thành
                        // "vi phạm".
                        const dayReps = levels.flatMap((l) => {
                          const runs = pointsForDay(l.level, date);
                          if (!runs.length) return [];
                          const settled = [...runs].reverse().find((p) => p.accepted !== false);
                          // Chưa có lần chạy nào đạt thì vẫn lấy lần chạy
                          // cuối làm đại diện để còn hiện luật đã vi phạm.
                          return [{ level: l.level, point: settled || runs[runs.length - 1], settled: !!settled }];
                        });
                        const levelReps = dayReps.map((item) => item.point);
                        const pendingLevels = dayReps.filter((item) => !item.settled).map((item) => `Mức ${item.level}`);
                        // Một điểm bị loại thường mang KÈM luật cảnh báo:
                        // z=2,5 nổ `2-2s` thì `rules` là `['1-2s','2-2s']`.
                        // Chia theo `rejectRules` (main phân giải qua bảng
                        // hành động 3 lớp) để `1-2s` không bị in vào cột "Vi
                        // phạm loại bỏ" chỉ vì đứng cùng điểm với `2-2s`.
                        const rejRules = Array.from(new Set(levelReps.flatMap((p) => (p.verdict === 'rej' ? p.rejectRules ?? p.rules : []))));
                        const rejRuleSet = new Set(rejRules);
                        const warnRules = Array.from(new Set(levelReps.flatMap((p) => p.rules.filter((rule) => !rejRuleSet.has(rule)))));
                        const worst = !dayReps.length ? null
                          : pendingLevels.length ? 'rej'
                          : levelReps.some((p) => p.verdict === 'warn') ? 'warn' : 'ok';
                        const dayNote = dayPoints.find((p) => p.note)?.note || '';
                        const isToday = date === todayStr;
                        return (
                          <tr key={date} className={rowClass(date, todayStr, levels.filter((l) => pointsForDay(l.level, date).length).length, levels.length, dayPoints.length > 0)}>
                            <td><div>{Number(date.slice(8, 10))}</div>{isToday && <div><b>Hôm nay</b></div>}</td>
                            {entryColumns.map((column, columnIndex) => {
                              const runs = pointsForColumnDay(column, date);
                              const previousRuns = column.parallel ? [] : previousLotSeries
                                .filter((series) => series.level === column.level)
                                .flatMap((series) => series.points.filter((point) => point.date === date && !point.voided).map((point) => ({ point, lot: series.lot, mean: series.mean, sd: series.sd })))
                                .sort((a, b) => a.point.run_id.localeCompare(b.point.run_id, 'vi', { numeric: true }));
                              const slotKey = `${column.key}|${date}`;
                              // Tự mở sẵn ô nhập lần chạy kế tiếp khi lần chạy
                              // gần nhất bị loại bỏ để nhắc chạy lại ngay.
                              const lastRun = runs[runs.length - 1];
                              // Mở sẵn ô chạy lại khi lần chạy cuối của mức
                              // này THUỘC một lần chạy đã bị loại — kể cả khi
                              // chính điểm này đạt và mức khác mới là mức vi
                              // phạm. `runRejectedBy` rỗng khi mức chưa có
                              // Mean/SD, nên không mở ô vô hạn cho mức đó.
                              const autoOpen = !!lastRun && (lastRun.runRejectedBy?.length ?? 0) > 0;
                              const extraOpen = extraRuns.has(slotKey) || autoOpen;
                              const showInput = writable && (!runs.length || extraOpen);
                              const showAddBtn = writable && runs.length > 0 && !extraOpen;
                              return (
                                <td key={column.key} className={`num qc-run-cell${runs.length ? ' has-data' : ''}${column.parallel ? ' qc-parallel-cell' : ''}`}>
                                  <div className={`qc-run-grid${showAddBtn ? ' has-add-btn' : ''}`}>
                                    {previousRuns.map(({ point, lot, mean, sd }) => (
                                      <div className="qc-run-slot prev-lot-slot" key={`previous:${lot}:${point.id}`} title={`Lô cũ ${lot} · đã chuyển tiếp · chỉ đọc`}>
                                        <b className="qc-value-cell prev">{valText(point.val)}</b>
                                        <small>{zText(point, { mean, sd })} · Lô {lot}</small>
                                      </div>
                                    ))}
                                    {runs.map((p) => {
                                      // Ô này quá hẹp để thêm chữ, nên trạng
                                      // thái "không vào thống kê" hiện bằng
                                      // NÉT ĐỨT — cùng ngữ nghĩa với vòng
                                      // rỗng trên biểu đồ: màu vẫn nói kết
                                      // luận thật của điểm, phần đứt/rỗng nói
                                      // nó không vào Mean/SD/CV. Lý do đầy đủ
                                      // nằm ở tooltip.
                                      const excluded = runExcludedNote(p);
                                      return (
                                        <div className="qc-run-slot" key={p.id} title={excluded || undefined}>
                                          <b className={`qc-value-cell${p.verdict !== 'ok' ? ' ' + p.verdict : ''}${excluded ? ' run-excluded' : ''}`}>{valText(p.val)}</b>
                                          <small>{zText(p, column)} · {VERDICT_LABEL[p.verdict]}</small>
                                        </div>
                                      );
                                    })}
                                    {showInput && <RunSlot date={date} level={column.level} columnKey={column.key} columnOrder={columnIndex} onCommit={async (val) => {
                                      const saved = await commitRun(column, date, sharedRunIdFor(column, date), val);
                                      if (saved) setExtraRuns((s) => { const next = new Set(s); next.delete(slotKey); return next; });
                                      return saved;
                                    }} />}
                                  </div>
                                  {showAddBtn && (
                                    <button type="button" className="qc-add-run-btn" title="Thêm lần chạy bổ sung"
                                      onClick={() => setExtraRuns((s) => new Set(s).add(slotKey))}>
                                      <span className="qc-add-run-icon" aria-hidden="true">+</span><span className="qc-add-run-label">Thêm</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                            <td className="qc-staff-cell">{staff.length
                              ? staff.map((s, i) => <span key={s}>{i > 0 ? <span className="qc-staff-sep">/</span> : null}<span className="pill qc-staff" title={s}>{s}</span></span>)
                              : '—'}</td>
                            <td>{warnRules.join(', ') || '—'}</td>
                            <td>{rejRules.join(', ') || '—'}</td>
                            <td>{worst == null ? '—' : worst === 'rej'
                              ? <span className="tag rej" title={pendingLevels.length ? `${pendingLevels.join(', ')} chưa có lần chạy nào được chấp nhận trong ngày. Lần chạy bị loại thì mọi mức trong lần chạy đó phải chạy lại.` : undefined}>R</span>
                              : worst === 'warn' ? <span className="tag warn">W(A)</span> : <span className="tag ok">A</span>}</td>
                            <td>{!dayPoints.length ? '—' : writable
                              ? <textarea key={`note:${testId}:${date}:${dayNote}`} className="qc-note-input" rows={1} placeholder="Ghi chú" defaultValue={dayNote}
                                  onBlur={(e) => saveDayNote(date, e.target.value)} />
                              : (dayNote || '—')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(noteErr || pointErr || pointFeedback || voidMsg) && (
                  <div className="entry-sheet-message" role="status" aria-live="polite">
                    {noteErr && <div className="alert warn">{noteErr}</div>}
                    {pointErr && <div className="alert warn">{pointErr}</div>}
                    {pointFeedback && <div className={`alert ${pointFeedback.kind}`}>{pointFeedback.message}</div>}
                    {voidMsg && <div className="alert warn">{voidMsg}</div>}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="lj-toolbar">
                  <h2 className="panel-title">Biểu đồ Levey-Jennings</h2>
                  <div className="lj-filter">
                    <label className="lj-date-field"><span className="hint">Từ ngày</span><DateField value={ljFrom} onChange={setLjFrom} /></label>
                    <label className="lj-date-field"><span className="hint">Đến ngày</span><DateField value={ljTo} onChange={setLjTo} /></label>
                    <div className="dayseg">
                      {[7, 14, 30, 60, 90].map((d) => (
                        <button key={d} className={ljDays === d ? 'on' : ''} onClick={() => applyDayPreset(d)}>{d} ngày</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="hint lj-range">Khoảng xem: {vnDate(ljFrom)} – {vnDate(ljTo)} · {levels.length} mức QC</div>
                <div className="lj-stack">
                  {displayColumns.map((column) => {
                    const chartPoints = inLjWindow(column.chartPoints);
                    const acceptedCount = chartPoints.filter((p) => p.accepted).length;
                    const chartPointSummary = acceptedCount === chartPoints.length
                      ? `${acceptedCount} điểm`
                      : `${acceptedCount}/${chartPoints.length} dùng thống kê`;
                    // Lô cũ và lô song song đều đã có cờ `accepted` do main tính
                    // trên cùng bộ đánh giá ghép; chỉ cột chính mới phải tra lại
                    const acceptedPoints = column.previous || column.parallel
                      ? inLjWindow(column.points.filter((point) => !point.voided && point.accepted === true))
                      : acceptedInWindow(column.level);
                    const previousChoices = column.parallel ? [] : previousLotSeries.filter((series) => series.level === column.level);
                    return (
                      <section className={`lj-mini${column.parallel ? ' lj-mini-parallel' : ''}`} key={column.key} aria-labelledby={`lj-chart-${column.key}`}>
                        <div className="lj-mini-h">
                          <h3 id={`lj-chart-${column.key}`}>Mức {column.level} · {column.previous ? 'Lô cũ ' : 'Lô '}{column.lot}{column.parallel && <span className="qc-parallel-label">Song song</span>}<span className="lj-point-count">{chartPointSummary}</span></h3>
                          {previousChoices.length ? (
                            <button type="button" className="btn ghost sm qc-old-lot-toggle" onClick={() => togglePreviousLot(column.level)}>
                              {column.previous ? 'Xem lô mới' : 'Xem lô cũ'}
                            </button>
                          ) : <span className="hint">{column.parallel ? 'Đang đánh giá' : column.applied === 'lab' ? 'Dải PXN' : 'Dải NSX'}</span>}
                        </div>
                        <div className="lj-qc-strip">
                          {(() => {
                            const st = observedStats(acceptedPoints);
                            return (
                              <>
                                <div className="lj-qc-stat"><span className="k">Mean thực</span><span className="v">{st.n ? st.mean.toFixed(decimals) : '—'}</span></div>
                                <div className="lj-qc-stat"><span className="k">SD thực</span><span className="v">{st.n > 1 ? st.sd.toFixed(4) : '—'}</span></div>
                                <div className="lj-qc-stat"><span className="k">CV thực</span><span className="v">{st.n > 1 && st.mean ? st.cv.toFixed(2) + '%' : '—'}</span></div>
                                <div className="lj-qc-stat control"><span className="k">Mean mục tiêu</span><span className="v">{column.mean != null ? valText(column.mean) : '—'}</span></div>
                                <div className="lj-qc-stat control"><span className="k">SD mục tiêu</span><span className="v">{column.sd != null ? column.sd.toFixed(4) : '—'}</span></div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="chart-scroll">
                          <QcChart className="entryLJStack" mode="lj" mean={column.mean} sd={column.sd} lot={column.lot} responsiveHeight
                            decimals={decimals} height={300}
                            points={chartPoints} />
                        </div>
                      </section>
                    );
                  })}
                </div>
                <div className="legend">
                  <span><span className="dot qc-legend-ok" /> Trong ±2SD</span>
                  <span><span className="dot qc-legend-warn" /> Cảnh báo 2–3SD</span>
                  <span><span className="dot qc-legend-rej" /> Loại bỏ ngoài 3SD</span>
                  <span><span className="dot qc-legend-excluded" /> Vòng rỗng · lần chạy bị loại, không vào thống kê</span>
                </div>
              </div>

              <section className="panel entry-secondary-panel qc-points-panel">
                <div className="entry-secondary-summary"><span>Điểm trong khoảng xem</span><small>Tra cứu chi tiết, luật vi phạm và điểm đã hủy</small></div>
                <div className="entry-secondary-body">
                  <div className="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT trên các lần chạy được chấp nhận; bảng bên dưới hiển thị theo khoảng xem {vnDate(ljFrom)} – {vnDate(ljTo)}.</div>
                  <div className="qc-table-grid">
                    {displayColumns.map((column) => {
                      const all = column.points;
                      const active = inLjWindow(all.filter((p) => !p.voided));
                      // Mean/SD/CV tích lũy chỉ tính trên LẦN CHẠY ĐƯỢC CHẤP
                      // NHẬN. Gộp cả dữ liệu mất kiểm soát vào thì chính sự
                      // cố đó nống SD lên, và lần sau cùng một sự cố không
                      // còn vượt ngưỡng nữa — hệ QC tự làm mù mình. Con số
                      // "đã ghi nhận bao nhiêu" vẫn giữ riêng cho truy vết
                      // ISO 15189, không trộn vào phép thống kê.
                      const recorded = all.filter((p) => !p.voided && (!ljTo || p.date <= ljTo));
                      const cumulative = recorded.filter((p) => p.accepted !== false);
                      const excluded = recorded.length - cumulative.length;
                      const vals = cumulative.map((p) => p.val);
                      const n = vals.length;
                      const mean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
                      const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
                      const cv = mean ? (sd / Math.abs(mean)) * 100 : 0;
                      return (
                        <div className={`qc-table-card${column.parallel ? ' qc-parallel-card' : ''}${column.previous ? ' qc-previous-card' : ''}`} key={column.key}>
                          <h4><span>Mức {column.level} · {column.previous ? 'Lô cũ ' : 'Lô '}{column.lot}{column.parallel && <span className="qc-parallel-label">Song song</span>}<span className="hint qc-table-count">{active.length} điểm trong khoảng</span></span></h4>
                          <div className="qc-cumulative">
                            <div><span>N dùng thống kê</span><b>{n}</b></div>
                            <div><span>Mean tích lũy</span><b>{n ? mean.toFixed(decimals) : '—'}</b></div>
                            <div><span>SD tích lũy</span><b>{n > 1 ? sd.toFixed(4) : '—'}</b></div>
                            <div><span>CV tích lũy</span><b>{n && mean ? cv.toFixed(2) + '%' : '—'}</b></div>
                          </div>
                          <div className="hint qc-cumulative-source">Tổng ghi nhận {recorded.length}{excluded ? ` · ${excluded} điểm thuộc lần chạy bị loại, không vào thống kê` : ''}</div>
                          {active.length ? (
                            <table>
                              <thead><tr><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật</th><th>Thao tác</th></tr></thead>
                              <tbody>
                                {active.map((p) => (
                                  <tr key={p.id} className={p.verdict === 'rej' ? 'qc-point-rej' : p.verdict === 'warn' ? 'qc-point-warn' : ''}>
                                    <td>{vnDate(p.date)}</td><td className="num"><b>{valText(p.val)}</b></td><td className="num">{zText(p, column)}</td>
                                    <td>
                                      <span className={`tag ${p.verdict}`}>{VERDICT_LABEL[p.verdict]}</span>
                                      {runExcludedNote(p) && <span className="qc-run-excluded" title="Lần chạy bị loại thì mọi mức trong lần chạy đó phải chạy lại; kết quả cũ không vào Mean/SD/CV thực.">{runExcludedNote(p)}</span>}
                                    </td>
                                    <td>{p.rules.length ? p.rules.map((r) => <span className="pill" key={r}>{r}</span>) : '—'}</td>
                                    <td className="qc-row-actions">{writable ? <button type="button" className="qc-row-void" title="Hủy điểm QC" aria-label={`Hủy điểm QC ngày ${vnDate(p.date)}`} onClick={() => { setVoidErr(null); setVoidReason(''); setVoidKind('analytical'); setVoidOpenNce(true); setVoiding(p); }}><TrashIcon /></button> : <span className="hint">—</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : <EmptyState className="qc-table-empty">Chưa có điểm nào trong mức này.</EmptyState>}
                        </div>
                      );
                    })}
                  </div>
                  {inLjWindow(voidedPoints).length > 0 && (
                    <div className="qc-voided-box">
                      <h4>Điểm đã hủy trong khoảng</h4>
                      <table className="qc-voided-table">
                        <thead><tr><th>Ngày</th><th>Mức / lô</th><th className="num">Giá trị</th><th>Lần chạy</th><th>Người hủy</th><th>Lý do</th></tr></thead>
                        <tbody>{inLjWindow(voidedPoints).map((point) => (
                          <tr key={point.id}>
                            <td>{vnDate(point.date)}</td><td>Mức {point.level} · Lô {point.lot || '—'}</td>
                            <td className="num">{valText(point.val)}</td><td>{point.run_id || '—'}</td>
                            <td>{point.voided_by || '—'}</td><td>{point.void_reason || '—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <section className="panel entry-secondary-panel range-summary-panel">
                <div className="entry-secondary-summary range-summary-header">
                  <span>Thống kê toàn bộ &amp; Dải kiểm soát</span>
                  <small>{rangeSummaryText}</small>
                  {levelNums.length > 1 && (
                    <div className="dayseg" role="tablist" aria-label="Chọn mức QC cho thống kê và dải kiểm soát">
                      {levelNums.map((level) => <button type="button" key={level} role="tab" aria-selected={rangeLevel === level}
                        className={rangeLevel === level ? 'on' : ''} onClick={() => setRangeLevel(level)}>Mức {level}</button>)}
                    </div>
                  )}
                </div>
                <div className="entry-secondary-body">
                  {rangeCandidate ? (
                    <>
                      <div className="range-band-note">
                        <div className="range-band-copy">
                          <div className="range-band-label">Dải đang dùng:</div>
                          <div className="range-band-source">{rangeCandidate.source === 'lab' ? 'PXN tự xây dựng' : 'Nhà sản xuất'}</div>
                          <div className="range-band-body">· Mức {rangeCandidate.level}: Mean={rangeCandidate.current.mean != null ? rangeCandidate.current.mean.toFixed(decimals) : '—'} SD={rangeCandidate.current.sd != null ? rangeCandidate.current.sd.toFixed(4) : '—'}.
                            {rangeCandidate.proposed
                              ? rangeCandidate.eligible
                                ? ` Đủ điều kiện lập dải mới (${rangeCandidate.proposed.n} kết quả / ${rangeCandidate.proposed.days} ngày độc lập). Dải đề xuất: Mean=${rangeCandidate.proposed.mean.toFixed(decimals)} SD=${rangeCandidate.proposed.sd.toFixed(4)} CV=${rangeCandidate.proposed.cv.toFixed(2)}%.`
                                : ` Cần ≥20 kết quả trên ≥20 ngày độc lập và không lần chạy nào bị loại — hiện ${rangeCandidate.proposed.n} kết quả / ${rangeCandidate.proposed.days} ngày, ${rangeCandidate.proposed.rejected} điểm thuộc lần chạy bị loại.`
                              : ' Chưa có dữ liệu của lô đang vận hành.'}
                          </div>
                        </div>
                        {rangeCandidate.eligible && writable && <button type="button" className="btn teal range-band-action" onClick={openRangeWorkflow}>Thiết lập dải PXN</button>}
                      </div>
                      {rangeCandidate.canRevert && writable && (
                        <div className="range-workflow-actions">
                          <button type="button" className="btn ghost" onClick={() => { setRangeMode('revert'); setRangeReason(''); setRangeSubmitError(null); }}>↶ Hoàn dải nhà sản xuất</button>
                        </div>
                      )}
                    </>
                  ) : <EmptyState className="qc-table-empty">{rangeError || 'Đang kiểm tra điều kiện dải kiểm soát…'}</EmptyState>}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      )}

      {voiding && (
        <Modal title="Hủy điểm QC" onClose={() => setVoiding(null)}
          footer={<><button className="btn ghost" onClick={() => setVoiding(null)}>Đóng</button><button className="btn danger" onClick={submitVoid}>Hủy điểm này</button></>}>
          <div className="hint">Ngày {vnDate(voiding.date)} · Mức {voiding.level} · Giá trị {valText(voiding.val)}</div>
          <div className="field">
            <label htmlFor="voidKindInput">Loại hủy</label>
            <select id="voidKindInput" aria-label="Loại hủy điểm QC" value={voidKind}
              onChange={(e) => { const k = e.target.value as VoidKind; setVoidKind(k); setVoidOpenNce(voidNceChoice(k).openNce); }}>
              <option value="analytical">Kết quả QC thực tế không hợp lệ</option>
              <option value="data-entry">Nhập sai dữ liệu</option>
              <option value="other">Lý do khác</option>
            </select>
          </div>
          <div className="void-nce-choice">
            <label><input type="checkbox" checked={voidChoice.forced ? voidChoice.openNce : voidOpenNce} disabled={voidChoice.forced}
              onChange={(e) => setVoidOpenNce(e.target.checked)} /> Lập hồ sơ NCE và yêu cầu chạy lại QC</label>
            <div className="hint">{voidKind === 'analytical'
              ? 'Hệ thống sẽ lập hồ sơ NCE mới, hoặc dùng lại hồ sơ đang mở của điểm này, rồi chờ một kết quả QC chạy lại được chấp nhận.'
              : voidKind === 'data-entry' ? 'Chỉ lưu dấu vết hủy; không mở NCE và không yêu cầu chạy lại QC.'
              : 'Chọn mục này nếu sự việc cần điều tra và xác nhận QC chạy lại.'}</div>
          </div>
          <div className="field">
            <label htmlFor="voidReasonInput">{voidChoice.reasonRequired ? 'Lý do hủy (bắt buộc, tối thiểu 5 ký tự)' : 'Ghi chú / bằng chứng (khuyến nghị)'}</label>
            <textarea id="voidReasonInput" autoFocus value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3}
              placeholder="VD: Máy báo lỗi hút mẫu lúc 08:15, đã ghi nhận trong sổ bảo trì..." />
            {voidErr && <p className="field-error">{voidErr}</p>}
          </div>
        </Modal>
      )}
      {rangeMode && rangeCandidate && (
        <Modal title={rangeMode === 'apply' ? 'Thiết lập dải QC mới' : 'Hoàn dải QC nhà sản xuất'} onClose={() => setRangeMode(null)} size="lg" className="range-workflow-modal"
          footer={<><button className="btn ghost" onClick={() => setRangeMode(null)}>Đóng</button><button className={`btn ${rangeMode === 'apply' ? 'teal' : 'danger'}`} disabled={rangeMode === 'apply' && !rangeCandidate.eligible} onClick={submitRangeWorkflow}>{rangeMode === 'apply' ? (rangeSelection === 'manual' ? 'Áp dụng dải chỉnh tay' : 'Áp dụng dải đề xuất') : 'Hoàn dải'}</button></>}>
          {rangeMode === 'apply' && rangeCandidate.proposed && (
            <>
              <p className="range-workflow-meta">{testName || 'Xét nghiệm'} · Mức {rangeCandidate.level}{rangeCandidate.lot ? ` · Lô ${rangeCandidate.lot}` : ''}</p>
              <section className="range-workflow-table-section" aria-labelledby="range-conditions-title">
                <h3 id="range-conditions-title">Điều kiện</h3>
                <div className="range-workflow-table-wrap"><table className="range-workflow-table">
                  <thead><tr><th>Điều kiện</th><th>Hiện tại</th><th>Chuẩn kiểm tra</th><th>Kết quả</th></tr></thead>
                  <tbody>
                    <tr><td>Tổng số kết quả</td><td><b>{rangeCandidate.proposed.n}</b></td><td>≥20</td><td><span className={`tag ${rangeCandidate.proposed.n >= 20 ? 'ok' : 'rej'}`}>{rangeCandidate.proposed.n >= 20 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                    <tr><td>Số ngày độc lập</td><td><b>{rangeCandidate.proposed.days}</b></td><td>≥20 ngày</td><td><span className={`tag ${rangeCandidate.proposed.days >= 20 ? 'ok' : 'rej'}`}>{rangeCandidate.proposed.days >= 20 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                    <tr><td>Điểm thuộc lần chạy bị loại</td><td><b>{rangeCandidate.proposed.rejected}</b></td><td>Phải bằng 0</td><td><span className={`tag ${rangeCandidate.proposed.rejected === 0 ? 'ok' : 'rej'}`}>{rangeCandidate.proposed.rejected === 0 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                    <tr><td>Cảnh báo 1-2s</td><td><b>{rangeCandidate.proposed.warnings}</b></td><td>Thông tin, không chặn</td><td>{rangeCandidate.proposed.warnings ? <span className="tag warn">Theo dõi</span> : <span className="tag none">Không có</span>}</td></tr>
                    <tr><td>SD đề xuất hợp lệ</td><td><b>{rangeCandidate.proposed.sd.toFixed(4)}</b></td><td>&gt;0</td><td><span className={`tag ${rangeCandidate.proposed.sd > 0 ? 'ok' : 'rej'}`}>{rangeCandidate.proposed.sd > 0 ? 'Đạt' : 'Chưa đạt'}</span></td></tr>
                  </tbody>
                </table></div>
              </section>
              <section className="range-workflow-table-section" aria-labelledby="range-comparison-title">
                <h3 id="range-comparison-title">So sánh dải kiểm soát</h3>
                <div className="range-workflow-table-wrap"><table className="range-workflow-table range-comparison-table">
                  <thead><tr><th>Dải</th><th>Mean</th><th>SD</th><th>CV%</th><th>±2SD</th></tr></thead>
                  <tbody>
                    <tr><td>Đang dùng ({rangeCandidate.source === 'lab' ? 'PXN' : 'NSX'})</td><td><b>{rangeCandidate.current.mean?.toFixed(decimals) ?? '—'}</b></td><td><b>{rangeCandidate.current.sd?.toFixed(4) ?? '—'}</b></td><td><b>{rangeCandidate.current.cv?.toFixed(2) ?? '—'}</b></td><td>{rangeCandidate.current.mean != null && rangeCandidate.current.sd != null ? `${(rangeCandidate.current.mean - 2 * rangeCandidate.current.sd).toFixed(decimals)} – ${(rangeCandidate.current.mean + 2 * rangeCandidate.current.sd).toFixed(decimals)}` : '—'}</td></tr>
                    <tr className="range-proposed-row"><td><b>Đề xuất PXN</b></td><td><b>{rangeCandidate.proposed.mean.toFixed(decimals)}</b></td><td><b>{rangeCandidate.proposed.sd.toFixed(4)}</b></td><td><b>{rangeCandidate.proposed.cv.toFixed(2)}</b></td><td><b>{(rangeCandidate.proposed.mean - 2 * rangeCandidate.proposed.sd).toFixed(decimals)} – {(rangeCandidate.proposed.mean + 2 * rangeCandidate.proposed.sd).toFixed(decimals)}</b></td></tr>
                  </tbody>
                </table></div>
              </section>
              <div className="range-workflow-note">Mean/SD đề xuất được tính trên toàn bộ tập dữ liệu đang xét; hệ thống không tự loại điểm để làm đẹp SD.</div>
              <div className="range-apply-choice" role="group" aria-label="Chọn cách áp dụng dải">
                <span>Giá trị áp dụng</span>
                <div className="dayseg"><button type="button" className={rangeSelection === 'proposed' ? 'on' : ''} aria-pressed={rangeSelection === 'proposed'} onClick={() => setRangeSelection('proposed')}>Dải đề xuất</button><button type="button" className={rangeSelection === 'manual' ? 'on' : ''} aria-pressed={rangeSelection === 'manual'} onClick={() => setRangeSelection('manual')}>Chỉnh thủ công</button></div>
              </div>
              {rangeSelection === 'manual' && <div className="range-manual-fields">
                <label className="field"><span>Mean chốt <b>*</b></span><input aria-label="Mean chốt thủ công" type="number" inputMode="decimal" step="any" value={rangeManualMean} onChange={(e) => setRangeManualMean(e.target.value)} /></label>
                <label className="field"><span>SD chốt <b>*</b></span><input aria-label="SD chốt thủ công" type="number" inputMode="decimal" min="0" step="any" value={rangeManualSd} onChange={(e) => setRangeManualSd(e.target.value)} /></label>
              </div>}
              {rangeCandidate.safety.needed && (
                <div className="alert warn range-safety-gate">
                  <b>Cổng an toàn sai số hệ thống {rangeCandidate.safety.nceId ? `· ${rangeCandidate.safety.nceId}` : ''}</b>
                  <label><input type="checkbox" checked={rangeCauseConfirmed} onChange={(e) => setRangeCauseConfirmed(e.target.checked)} /> Đã xác nhận và xử lý nguyên nhân hệ thống</label>
                  <label className="field"><span>Bias đo được (%) · yêu cầu trong ±{rangeCandidate.safety.biasThreshold?.toFixed(2) ?? '—'}% (TEa/4)</span><input type="number" step="any" value={rangeBias} onChange={(e) => setRangeBias(e.target.value)} /></label>
                </div>
              )}
            </>
          )}
          {rangeMode === 'revert' && <p>Khôi phục Mean={rangeCandidate.manufacturer.mean?.toFixed(decimals) ?? '—'} và SD={rangeCandidate.manufacturer.sd?.toFixed(4) ?? '—'} của nhà sản xuất.</p>}
          <label className="field"><span>Lý do <b>*</b></span><textarea rows={3} value={rangeReason} onChange={(e) => setRangeReason(e.target.value)} placeholder={rangeMode === 'apply' ? 'Tối thiểu 10 ký tự' : 'Tối thiểu 5 ký tự'} /></label>
          {rangeSubmitError && <div className="alert warn">{rangeSubmitError}</div>}
        </Modal>
      )}
    </div>
  );
}

/** Ô nhập một lần chạy trong worksheet — không kiểm soát (uncontrolled),
 * commit khi mất focus. Chỉ xoá ô khi lưu thành công để giá trị vừa gõ không
 * bị mất nếu kỳ đã khoá hoặc mức không còn vận hành.
 * `data-focus-date`/`data-focus-column` cùng `handleSheetKeyDown` điều hướng
 * ArrowLeft/Right/Tab giữa các mức cùng ngày, ArrowUp/Down/Enter giữa các
 * ngày cùng mức; Enter xuống hàng dưới và quay vòng về đầu cột. */
function RunSlot({ date, level, columnKey, columnOrder, onCommit }: {
  date: string; level: number; columnKey: string; columnOrder: number;
  onCommit: (val: number) => Promise<boolean>;
}) {
  const [val, setVal] = useState('');
  return (
    <div className="qc-run-slot">
      <input className="qc-inline-input is-empty" type="text" inputMode="decimal" placeholder="--" value={val}
        data-focus-date={date} data-focus-level={level} data-focus-column={columnKey} data-focus-column-order={columnOrder}
        onChange={(e) => setVal(e.target.value)}
        onBlur={async () => { const n = Number(val); if (val.trim() !== '' && !Number.isNaN(n) && await onCommit(n)) setVal(''); }}
        onKeyDown={handleSheetKeyDown} />
    </div>
  );
}


