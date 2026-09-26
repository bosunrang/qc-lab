// Phân tích Westgard theo xét nghiệm và từng mức QC, gồm cấu hình luật,
// hướng dẫn, biểu đồ Levey-Jennings/CUSUM và lịch sử nhóm lô. Tab nhóm lô đã
// dừng/lưu trữ và bảng điểm dùng chung nằm ở `pages/westgard/`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite, isAdmin } from '../lib/permissions';
import { QcChart, QcMultiChart, QcMultiCusumChart, type QcMultiLevelSeries, type QcMultiCusumSeries } from '../components/QcChart';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { infoDialog } from '../state/dialog-store';
import { DownloadIcon, PrintIcon, RestoreIcon } from '../components/BtnIcons';
import { observedStats } from '../../main/domain/observed-stats';
import { displayedWestgardBlocks, statText, westgardExportRows, WESTGARD_EXPORT_HEADERS, escapeHtml } from '../lib/westgard-view';
import { WestgardPointTable } from './westgard/shared';
import { useArchivedWestgard } from './westgard/useArchivedWestgard';
import { ArchivedGroupPicker, ArchivedGroupResults } from './westgard/ArchivedGroupView';

export function WestgardPage() {
  const { tests, instruments, lots, levelsByTestId, loadTests, loadInstruments, loadLevels, loadLots, lotGroups, loadLotGroups } = useManageStore(useShallow((s) => ({
    tests: s.tests, instruments: s.instruments, lots: s.lots, levelsByTestId: s.levelsByTestId, lotGroups: s.lotGroups,
    loadTests: s.loadTests, loadInstruments: s.loadInstruments, loadLevels: s.loadLevels, loadLots: s.loadLots, loadLotGroups: s.loadLotGroups,
  })));
  const { summaries, loadSummaries, ruleSettings, loadRuleSettings, saveRuleSetting, resetRuleSettings, analysisByLevel: loadedAnalysis, loadAnalysis, previousLotBlocks: loadedPrevious, analysisTestId, analysisLoading, analysisError } = useWestgardStore(useShallow((s) => ({
    summaries: s.summaries, loadSummaries: s.loadSummaries, ruleSettings: s.ruleSettings, loadRuleSettings: s.loadRuleSettings,
    saveRuleSetting: s.saveRuleSetting, resetRuleSettings: s.resetRuleSettings, analysisByLevel: s.analysisByLevel, loadAnalysis: s.loadAnalysis,
    previousLotBlocks: s.previousLotBlocks, analysisTestId: s.analysisTestId, analysisLoading: s.analysisLoading, analysisError: s.analysisError,
  })));
  // Bật/tắt luật ghi vào cấu hình CHUNG (`app_meta.westgardRules`) — vai trò
  // chỉ-xem thấy đúng trạng thái luật nhưng không thay đổi được.
  const role = useAuthStore((s) => s.user)?.role;
  const writable = canWrite(role);
  const admin = isAdmin(role);
  const [view, setView] = useState<'current' | 'archived'>('current');
  const [testId, setTestId] = useState('');
  const selectedTestRef = useRef(testId);
  selectedTestRef.current = testId;
  const [query, setQuery] = useState('');
  const [chartMode, setChartMode] = useState<'lj' | 'cusum'>('lj');
  // Công tắc "Xem lô cũ" theo từng mức; khoá `testId|level` để lựa chọn của xét nghiệm này
  // không dính sang xét nghiệm khác cùng số mức.
  const [prevOpen, setPrevOpen] = useState<ReadonlySet<string>>(new Set());
  // Khi có từ hai mức, CUSUM có thể xem chung để so sánh hoặc tách theo mức
  // để rà soát. Dù ở cách xem nào, chuỗi CUSUM luôn được tính độc lập ở main.
  const [cusumView, setCusumView] = useState<'summary' | 'levels'>('summary');

  useEffect(() => { loadTests(); loadInstruments(); loadLots(); loadLotGroups(); loadSummaries(); loadRuleSettings(); }, [loadTests, loadInstruments, loadLots, loadLotGroups, loadSummaries, loadRuleSettings]);
  // Tự chọn xét nghiệm đầu tiên khi lựa chọn hiện tại không hợp lệ; để rỗng
  // thì cả trang chỉ hiện vỏ.
  useEffect(() => {
    if (!summaries.length) return;
    if (testId && summaries.some((s) => s.testId === testId)) return;
    setTestId(summaries[0].testId);
  }, [summaries, testId]);
  const currentSummary = summaries.find((s) => s.testId === testId);
  // Ghi nhớ các mảng/đối tượng dẫn xuất: chúng là phụ thuộc của useMemo dựng
  // dữ liệu biểu đồ bên dưới. Tạo mới mỗi lần render thì biểu đồ bị dựng lại
  // ở mọi lần render (ESLint exhaustive-deps phát hiện).
  const levels = useMemo(() => (levelsByTestId[testId] || []).filter(level => currentSummary?.levels.some(active => active.level === level.level)), [levelsByTestId, testId, currentSummary]);
  const analysisByLevel = useMemo(() => (analysisTestId === testId ? loadedAnalysis : {}), [analysisTestId, testId, loadedAnalysis]);
  const previousLotBlocks = useMemo(() => (analysisTestId === testId ? loadedPrevious : []), [analysisTestId, testId, loadedPrevious]);
  const analysisReady = analysisTestId === testId && !analysisLoading && !analysisError;
  const levelNums = useMemo(() => levels.map((l) => l.level), [levels]);
  useEffect(() => { if (testId) loadLevels(testId); }, [testId, loadLevels]);
  useEffect(() => { loadAnalysis(testId, levelNums); }, [testId, levelNums.join(','), loadAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cấu hình dải hoặc đổi lô ở trang Cấu hình chung cũng làm thay z-score,
  // tập điểm đang vận hành và nhãn LOT. Không chỉ nghe `qc_points`: nếu không
  // thẻ này sẽ tiếp tục hiện phân tích cũ cho đến khi người dùng tự đổi trang.
  useStoreInvalidation(['tests', 'test_levels', 'qc_points', 'qc_lots', 'lot_groups', 'actions', 'app_meta', 'qc_panels', 'qc_panel_tests', 'lot_transitions'], undefined, () => {
    void loadSummaries();
    void loadTests();
    void loadRuleSettings();
    void loadLots();
    void loadLotGroups();
    // Lọc theo cờ `operational` đúng như tập mức đang render: `listTestLevels()`
    // cố ý trả về đủ mọi mức (Bảng Mean/SD và Lịch sử cần mức đã dừng), nên
    // truyền thẳng danh sách thô vào đây là gọi `analyzeLevel` cho cả những
    // mức không bao giờ được vẽ, và nhét vào `analysisByLevel` các khoá không
    // ai đọc.
    if (testId) void loadLevels(testId).then(() => {
      if (selectedTestRef.current !== testId) return;
      const operational = (useManageStore.getState().levelsByTestId[testId] || []).filter(level => level.operational !== 0);
      return loadAnalysis(testId, operational.map(level => level.level));
    });
  });

  const archived = useArchivedWestgard({ active: view === 'archived', lotGroups, lots, tests, instruments });
  const { archivedGroups } = archived;
  /** Nhãn xét nghiệm trong ô chọn: LOT phân biệt dải QC, còn tên máy phân biệt
   * cùng một xét nghiệm được gán cho nhiều máy. */
  const testPickerLabel = (s: typeof summaries[number]) => {
    const lots = Array.from(new Set(s.levels.map((lv) => lv.lot).filter(Boolean)));
    const label = lots.length ? `${s.testName} · LOT ${lots.join('/')}` : s.testName;
    return s.instrumentName ? `${label} · ${s.instrumentName}` : label;
  };
  /** Lọc theo ô "Tìm nhanh": tên xét nghiệm, LOT hoặc máy. */
  const matchedTests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((s) => [s.testName, s.instrumentName, ...s.levels.map((lv) => lv.lot)]
      .filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [summaries, query]);
  // Khi gõ tìm nhanh, giá trị của <select> phải luôn là một xét nghiệm ĐANG
  // có trong danh sách đã lọc. Nếu không, select nhìn trống nhưng bảng lại
  // vẫn phân tích xét nghiệm cũ — một trạng thái mâu thuẫn dễ gây nhầm lẫn.
  useEffect(() => {
    if (!matchedTests.length || matchedTests.some((summary) => summary.testId === testId)) return;
    setTestId(matchedTests[0].testId);
  }, [matchedTests, testId]);

  const lotLabelFor = useCallback((level: number) => {
    const lv = levels.find((l) => l.level === level);
    const lot = lv?.qc_lot_id ? lots.find((l) => l.id === lv.qc_lot_id) : null;
    return lot?.lot_no || '—';
  }, [levels, lots]);
  const navigate = useNavigate();
  // Vẫn là MỘT biểu đồ tổng hợp hai mức: dữ liệu quy đổi về Z-score chung,
  // chỉ đồng bộ kích thước/co giãn với biểu đồ ở trang Nhập QC.
  const prevBlocksFor = (level: number) => previousLotBlocks.filter((b) => b.level === level);
  const isPrevOpen = (level: number) => prevOpen.has(`${testId}|${level}`);
  const togglePrevLot = (level: number) => setPrevOpen((current) => {
    const next = new Set(current), key = `${testId}|${level}`;
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // Bật "Xem lô cũ" thêm một đường cho lô đã chuyển tiếp (không thay đường
  // hiện hành); riêng bảng của mức thì
  // THAY hẳn sang lô cũ. Hai hành vi khác nhau có chủ đích.
  const multiSeries: QcMultiLevelSeries[] = useMemo(
    () => levels.flatMap((l) => {
      const current = { level: l.level, lot: lotLabelFor(l.level), points: analysisByLevel[l.level]?.points || [] };
      if (!prevOpen.has(`${testId}|${l.level}`)) return [current];
      return [current, ...previousLotBlocks.filter((b) => b.level === l.level).map((b) => ({
        level: l.level, lot: b.lotNo, label: `M${l.level}·cũ ${b.lotNo}`, points: b.analysis.points,
      }))];
    }),
    [levels, lotLabelFor, analysisByLevel, prevOpen, previousLotBlocks, testId],
  );
  // Đếm số đường chứ không đếm số mức — một xét nghiệm một mức đang
  // mở lô cũ cũng có 2 đường để so sánh.
  const showMultiChart = multiSeries.length >= 2;
  // Chuỗi CUSUM của từng mức đã được main tính ĐỘC LẬP. Cấu trúc này chỉ
  // ghép chúng vào một khung vẽ chung, không trộn dữ liệu giữa các mức.
  const multiCusumSeries: QcMultiCusumSeries[] = useMemo(
    () => levels.map((l) => ({ level: l.level, points: analysisByLevel[l.level]?.points || [], cusum: analysisByLevel[l.level]?.cusum || { cPos: [], cNeg: [], flags: [], k: 0.5, h: 4, ma: [] } })),
    [levels, analysisByLevel],
  );
  // CUSUM là cấu hình CHUNG của cả xét nghiệm (`tests.cusum_on`), không theo
  // từng mức — mọi mức cùng trả về đúng 1 giá trị `cusumOn`.
  const cusumOn = !!analysisByLevel[levels[0]?.level]?.cusumOn;

  /** Khôi phục đúng trạng thái mặc định của từng luật theo `WG_RULE_REGISTRY`.
   * Đây là cấu hình
   * CHUNG (toàn phòng xét nghiệm), không riêng xét nghiệm đang chọn. */
  async function resetRules() {
    try {
      await resetRuleSettings();
      if (selectedTestRef.current === testId) await loadAnalysis(testId, levelNums);
    } catch (error) { await infoDialog(error instanceof Error ? error.message : 'Không lưu được cấu hình.', { type: 'warn' }); }
  }

  const displayBlocks = displayedWestgardBlocks(
    levels.map(level => ({ ...level, lot: lotLabelFor(level.level) })),
    analysisByLevel, previousLotBlocks, isPrevOpen,
  );

  /** Excel và PDF lấy cùng lô, cùng điểm như bảng đang hiển thị. */
  async function exportXlsx() {
    if (!analysisReady) return;
    const error = await exportTableXlsx('Westgard', WESTGARD_EXPORT_HEADERS, westgardExportRows(displayBlocks),
      `westgard-${currentSummary?.testName || 'xet-nghiem'}.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function printPdf() {
    if (!analysisReady) return;
    const rows = westgardExportRows(displayBlocks);
    const body = rows.map(row => '<tr>' + row.map(cell => '<td>' + escapeHtml(cell) + '</td>').join('') + '</tr>').join('');
    const title = `Phân tích Westgard — ${currentSummary?.testName || ''}`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>@page{size:A4 landscape}body{font:11px system-ui,sans-serif;color:#163541;padding:12px}h1{font-size:17px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d9e0;padding:5px;text-align:left;overflow-wrap:anywhere}
      tr{break-inside:avoid}th{background:#eef4f7;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head>
      <body><h1>${escapeHtml(title)}</h1><p>Kết luận được đánh giá theo cấu hình luật hiện tại. Thống kê chỉ dùng các lần chạy được chấp nhận.</p>
      <table><thead><tr>${WESTGARD_EXPORT_HEADERS.map(header => '<th>' + escapeHtml(header) + '</th>').join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const error = await printHtmlToPdf(html, `westgard-${currentSummary?.testName || 'xet-nghiem'}.pdf`);
    if (error) await infoDialog(error, { type: 'warn' });
  }

  async function onToggleRule(ruleId: string, on: boolean) {
    try {
      await saveRuleSetting(ruleId, on);
      if (selectedTestRef.current === testId) await loadAnalysis(testId, levelNums);
    } catch (error) { await infoDialog(error instanceof Error ? error.message : 'Không lưu được cấu hình.', { type: 'warn' }); }
  }

  // Khi chưa có bất kỳ xét nghiệm nào, không dựng một panel thiết lập toàn
  // ô disabled rồi thêm dòng nhắc mỏng bên dưới. Giữ cùng cấu trúc trạng
  // thái rỗng của trang Sigma để hai màn phân tích có một ngôn ngữ UI.
  if (!summaries.length && !archivedGroups.length) {
    return <>
      <PageHeader title="Phân tích Westgard" subtitle="Đối chiếu luật theo mức QC, lô và lần chạy" />
      <div className="panel"><EmptyState
        title="Chưa có xét nghiệm nào để phân tích Westgard"
        action={admin && <button className="btn teal" onClick={() => navigate('/manage', { state: { tab: 'tests' } })}>Mở Cấu hình chung</button>}
      >{admin ? 'Hãy thêm xét nghiệm trong Cấu hình chung để bắt đầu phân tích.' : 'Liên hệ quản trị viên để thêm xét nghiệm từ Cấu hình chung.'}</EmptyState></div>
    </>;
  }

  return (
    <div>
      <PageHeader title="Phân tích Westgard" subtitle={view === 'archived' ? 'Xem lại Westgard theo nhóm lô đã dừng/lưu trữ' : 'Đối chiếu luật theo mức QC, lô và lần chạy'} />

      <div className="panel wg-setup-panel">
        <h2 className="panel-title">Thiết lập phân tích</h2>
        {archivedGroups.length > 0 && (
          <div className="dayseg wg-archive-view-mode">
            <button className={view === 'current' ? 'on' : ''} onClick={() => setView('current')}>Xét nghiệm đang vận hành</button>
            <button className={view === 'archived' ? 'on' : ''} onClick={() => setView('archived')}>Nhóm lô đã dừng/lưu trữ ({archivedGroups.length})</button>
          </div>
        )}

        {view === 'current' && (
          <>
            <div className={`wg-test-picker${chartMode === 'lj' ? ' wg-test-picker-3' : ''}`}>
              <div className="field">
                <label>Tìm nhanh</label>
                <input id="wgTestSearch" type="search" placeholder="Tên xét nghiệm, LOT hoặc máy..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="field">
                <label>Chọn xét nghiệm <span id="wgTestCount" className="hint">({matchedTests.length}/{summaries.length})</span></label>
                <select id="wgTestSelect" aria-label="Chọn xét nghiệm" disabled={!matchedTests.length} value={testId} onChange={(e) => setTestId(e.target.value)}>
                  {matchedTests.length
                    ? matchedTests.map((s) => <option key={s.testId} value={s.testId}>{testPickerLabel(s)}</option>)
                    : <option value="">Không tìm thấy xét nghiệm phù hợp</option>}
                </select>
              </div>
              {chartMode === 'lj' && (
                <div>
                  <label>&nbsp;</label>
                  <div className="wg-export-actions">
                    <button className="btn teal" disabled={!analysisReady} title="Xuất bảng điểm, lô, Mean/SD và bằng chứng đang xem" onClick={exportXlsx}><DownloadIcon />Xuất Excel</button>
                    <button className="btn teal" disabled={!analysisReady} title="In bảng điểm, lô, Mean/SD và bằng chứng đang xem" onClick={printPdf}><PrintIcon />In PDF</button>
                  </div>
                </div>
              )}
            </div>

            {testId && (
              <>
                <div className="wg-rules">
                  <b>Cấu hình chung của luật</b>
                  <div className="flow-note">
                    {ruleSettings.map((r) => (
                      <span className="wg-rule-item" key={r.id}>
                        <label><input type="checkbox" checked={r.on} disabled={!writable} onChange={(e) => onToggleRule(r.id, e.target.checked)} /><span className="pill">{r.id}</span></label>
                      </span>
                    ))}
                    {writable && <span className="wg-rule-reset"><button className="btn ghost sm" title="Khôi phục mặc định" aria-label="Khôi phục mặc định" onClick={resetRules}><RestoreIcon />Khôi phục</button></span>}
                  </div>
                </div>

                <details className="wg-guide">
                  <summary>Hướng dẫn nhanh luật Westgard</summary>
                  <div className="alert info" style={{ margin: '10px 12px 18px' }}>
                    <span>Ký hiệu ↩ trong bảng là điểm lịch sử cấu thành quy tắc. Điểm này chỉ là bằng chứng; trạng thái cảnh báo/loại được gắn cho lần chạy phát hiện hiện tại, không đổi hồi tố kết luận cũ.</span>
                  </div>
                  <div className="chart-scroll">
                    <table>
                      <thead><tr><th>Luật</th><th>Điều kiện</th><th>Kết luận</th><th>Gợi ý xử lý</th></tr></thead>
                      <tbody>
                        {ruleSettings.map((r) => (
                          <tr key={r.id}><td>{r.id}</td><td>{r.desc}</td><td>{r.alert ? <span className="warn">Cảnh báo</span> : <span className="rej">Loại bỏ</span>}</td><td>{r.fix}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <div className="wg-chart-control">
                  <span className="wg-chart-mode-label">Chế độ biểu đồ</span>
                  <div className="dayseg wg-chart-mode">
                    <button className={chartMode === 'lj' ? 'on' : ''} onClick={() => setChartMode('lj')}>Levey-Jennings</button>
                    <button className={chartMode === 'cusum' ? 'on' : ''} onClick={() => setChartMode('cusum')}>Xu hướng CUSUM</button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {view === 'archived' && <ArchivedGroupPicker state={archived} />}
      </div>

      {view === 'current' && !testId && <div className="panel"><EmptyState>Chọn 1 xét nghiệm ở panel phía trên.</EmptyState></div>}

      {view === 'current' && testId && !analysisReady && <div className="panel"><EmptyState action={analysisError ? <button className="btn ghost sm" onClick={() => loadAnalysis(testId, levelNums)}>Thử lại</button> : undefined}>{analysisError || 'Đang tải phân tích…'}</EmptyState></div>}

      {/* CUSUM vẫn tính riêng từng mức (không quy đổi chung một trục như LJ)
          và chỉ hiện khi xét nghiệm đã bật CUSUM. */}
      {view === 'current' && testId && analysisReady && chartMode === 'cusum' && !cusumOn && (
        <div className="panel"><EmptyState
          title="Chưa bật CUSUM cho xét nghiệm này"
          action={writable && <button className="btn teal" onClick={() => navigate('/manage', { state: { tab: 'tests', editTestId: testId } })}>Mở cấu hình xét nghiệm</button>}
        >Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.</EmptyState></div>
      )}
      {view === 'current' && testId && chartMode === 'cusum' && cusumOn && levels.length >= 2 && cusumView === 'summary' && (
        <div className="panel wg-multi-panel">
          <div className="wg-cusum-heading">
            <h2 className="panel-title">Xu hướng CUSUM tổng hợp</h2>
            <div className="dayseg wg-cusum-view-mode" aria-label="Cách xem biểu đồ CUSUM">
              <button className="on" onClick={() => setCusumView('summary')}>Tổng hợp</button>
              <button onClick={() => setCusumView('levels')}>Từng mức</button>
            </div>
          </div>
          <div className="hint wg-panel-intro">Mỗi mức được tính CUSUM riêng theo Mean/SD của chính mức đó; biểu đồ chỉ dùng chung trục để so sánh. Màu có dấu +/− trong chú giải cho biết nhánh CUSUM của từng mức.</div>
          <div className="chart-scroll"><QcMultiCusumChart className="wgCusumMulti" series={multiCusumSeries} height={300} responsiveHeight /></div>
        </div>
      )}
      {view === 'current' && testId && chartMode === 'cusum' && cusumOn && levels.length >= 2 && cusumView === 'levels' && (
        <div className="panel wg-multi-panel wg-cusum-switch-panel">
          <div className="wg-cusum-heading">
            <h2 className="panel-title">Xu hướng CUSUM theo từng mức</h2>
            <div className="dayseg wg-cusum-view-mode" aria-label="Cách xem biểu đồ CUSUM">
              <button onClick={() => setCusumView('summary')}>Tổng hợp</button>
              <button className="on" onClick={() => setCusumView('levels')}>Từng mức</button>
            </div>
          </div>
        </div>
      )}
      {view === 'current' && testId && chartMode === 'cusum' && cusumOn && (levels.length < 2 || cusumView === 'levels') && levels.map((l) => {
        const analysis = analysisByLevel[l.level];
        const pointCount = analysis?.points.length || 0;
        return (
          <div className="panel wg-level-panel" key={l.level}>
            <h3><div className="wg-level-title"><span>Mức {l.level}</span><span className="wg-lot-name is-current">Lô {lotLabelFor(l.level)}</span></div></h3>
            {!pointCount ? (
              <EmptyState title="Chưa có dữ liệu">LOT đang dùng chưa có điểm QC.</EmptyState>
            ) : (
              <>
                <div className="hint wg-panel-intro">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score; đường xám nét đứt là trung bình động 5 điểm để tham khảo xu hướng. Vượt vạch đỏ đứt ±h là dấu hiệu trôi/shift kéo dài.</div>
                <div className="chart-scroll"><QcChart className="cusumChart" mode="cusum" points={analysis?.points || []} cusum={analysis?.cusum} height={300} responsiveHeight /></div>
              </>
            )}
          </div>
        );
      })}

      {/* Một biểu đồ tổng hợp hai mức — giữ nguyên nghiệp vụ Westgard. Chỉ
          chiều cao/co giãn được đồng bộ với biểu đồ trang Nhập QC. */}
      {view === 'current' && testId && chartMode === 'lj' && showMultiChart && (
        <div className="panel wg-multi-panel">
          <h2 className="panel-title">Levey-Jennings tổng hợp</h2>
          <div className="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm. Bật "Xem lô cũ" ở mức tương ứng để thêm đường của lô đã chuyển tiếp.</div>
          <div className="chart-scroll"><QcMultiChart className="wgLJMulti" series={multiSeries} height={300} responsiveHeight decimals={currentSummary?.decimalPlaces ?? 2} /></div>
        </div>
      )}
      {view === 'current' && testId && chartMode === 'lj' && levels.map((l) => {
        // Mở "Xem lô cũ" thì bảng của mức THAY hẳn sang lô đã chuyển tiếp
        // (Mean/SD, điểm và kết luận đều của lô đó). Chỉ lấy lô gần nhất;
        // các lô xa hơn vẫn nằm ở tab
        // "Nhóm lô đã dừng".
        const prevBlocks = prevBlocksFor(l.level);
        const prevBlock = prevBlocks.length && isPrevOpen(l.level) ? prevBlocks[0] : null;
        const block = displayBlocks.find(item => item.level === l.level)!;
        const analysis = block.analysis;
        const noTarget = !prevBlock && (l.mean == null || l.sd == null);
        const pointCount = analysis?.points.length || 0;
        const meanText = statText(block.mean, currentSummary?.decimalPlaces);
        const sdText = statText(block.sd, currentSummary?.decimalPlaces);
        // Chỉ điểm main đã chấp nhận mới vào thống kê quan sát.
        const observed = observedStats((analysis?.points || []).filter((point) => point.accepted));
        return (
          <div className={`panel${prevBlock ? ' wg-level-panel wg-prev-lot' : ''}`} key={l.level}>
            <h3>
              <div className="wg-level-title"><span>Mức {l.level}</span><span className={`wg-lot-name${prevBlock ? '' : ' is-current'}`}>{prevBlock ? `Lô cũ ${prevBlock.lotNo}` : `Lô ${lotLabelFor(l.level)}`}</span></div>
              <div className="wg-level-meta">
                {prevBlock && <span className="tag rej">Đã chuyển tiếp</span>}
                <span>Mean {meanText}</span><span>SD {sdText}</span><span>{pointCount} điểm</span>
                <span className="wg-observed-meta" title="Thống kê mô tả trên các lần chạy được chấp nhận; không tự thay Mean/SD đích. Mẫu dưới 20 điểm hoặc 10 ngày chỉ là tạm tính.">Thực tế (n={observed.n}{observed.n < 2 ? ', chưa đủ tính SD' : observed.provisional ? ', tạm tính' : ''}): Mean {statText(observed.mean, currentSummary?.decimalPlaces)} · SD {statText(observed.sd, currentSummary?.decimalPlaces)} · CV {observed.cv == null ? '—' : `${statText(observed.cv)}%`}</span>
                {!!prevBlocks.length && (
                  <button className="btn ghost sm wg-prev-toggle" onClick={() => togglePrevLot(l.level)}>
                    {prevBlock ? 'Xem lô mới' : 'Xem lô cũ'}
                  </button>
                )}
              </div>
            </h3>
            {!pointCount ? (
              <EmptyState
                title="Chưa có dữ liệu"
                action={<button className="btn teal" onClick={() => navigate('/entry', { state: { testId } })}>Nhập QC</button>}
              >LOT đang dùng chưa có điểm QC. Bạn có thể {prevBlocks.length ? 'chọn LOT cũ hoặc nhập điểm mới' : 'nhập điểm mới'}.</EmptyState>
            ) : (
              <>
                {analysis?.evaluationNote && <div className="alert warn wg-target-warning">{analysis.evaluationNote}</div>}
                {noTarget && <div className="alert warn wg-target-warning"><b>Mức {l.level} chưa có Mean/SD hợp lệ</b> — điểm QC mức này không được đánh giá Westgard.</div>}
                <WestgardPointTable points={analysis?.points || []} decimals={currentSummary?.decimalPlaces ?? 2} />
              </>
            )}
          </div>
        );
      })}

      {view === 'archived' && <ArchivedGroupResults state={archived} />}
    </div>
  );
}


