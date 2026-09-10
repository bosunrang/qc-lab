// Phân tích Westgard — viết lại theo đúng bố cục app cũ (professional-westgard.css
// + WestgardPage.tsx cũ): KHÔNG có bảng "Tổng quan tất cả xét nghiệm" phẳng
// (bản cũ không có khái niệm đó) — panel "Thiết lập phân tích" (chọn xét
// nghiệm + bật/tắt luật + hướng dẫn luật + tab LJ/CUSUM) rồi 1 panel riêng
// cho MỖI mức của xét nghiệm đang chọn (bảng điểm đúng 7 cột, tiêu đề mức +
// Mean/SD/n điểm). Tab "Nhóm lô đã dừng" đọc lại `lotGroups` đã có (không
// domain mới), đúng nguyên tắc "không domain mới nếu đã có API phù hợp".
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite } from '../lib/permissions';
import { QcChart, QcMultiChart, QcMultiCusumChart, type QcMultiLevelSeries, type QcMultiCusumSeries } from '../components/QcChart';
import { PageHeader } from '../components/PageHeader';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { infoDialog } from '../state/dialog-store';
import { DownloadIcon, PrintIcon } from '../components/BtnIcons';
import { vnDate as formatVnDate } from '../lib/format';
import type { ArchivedBlock } from '../../shared/qc-api';

const VERDICT_LABEL: Record<string, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };
/** `vnDate()` app cũ. */
const vnDate = (iso: string) => formatVnDate(iso, '—');
/** `none` không có Mean/SD nên z-score là NaN: tuyệt đối không đưa chuỗi
 * "NaNs" vào bảng, Excel hoặc PDF vì dễ bị hiểu là một kết quả xét nghiệm. */
const zText = (z: number) => Number.isFinite(z) ? `${z >= 0 ? '+' : ''}${z.toFixed(2)}s` : '—';
const zCell = (z: number) => Number.isFinite(z) ? Number(z.toFixed(2)) : '—';

export function WestgardPage() {
  const { tests, instruments, lots, levelsByTestId, loadTests, loadInstruments, loadLevels, loadLots, lotGroups, loadLotGroups } = useManageStore();
  const { summaries, loadSummaries, ruleSettings, loadRuleSettings, saveRuleSetting, resetRuleSettings, analysisByLevel, loadAnalysis } = useWestgardStore();
  // Bật/tắt luật ghi vào cấu hình CHUNG (`app_meta.westgardRules`) — vai trò
  // chỉ-xem thấy đúng trạng thái luật nhưng không đổi được (checkbox
  // disabled, không ẩn, để bảng hướng dẫn giữ nguyên bố cục như app cũ).
  const writable = canWrite(useAuthStore((s) => s.user)?.role);
  const [view, setView] = useState<'current' | 'archived'>('current');
  const [testId, setTestId] = useState('');
  const [query, setQuery] = useState('');
  const [chartMode, setChartMode] = useState<'lj' | 'cusum'>('lj');
  // Khi có từ hai mức, CUSUM có thể xem chung để so sánh hoặc tách theo mức
  // để rà soát. Dù ở cách xem nào, chuỗi CUSUM luôn được tính độc lập ở main.
  const [cusumView, setCusumView] = useState<'summary' | 'levels'>('summary');
  const [archivedGroupId, setArchivedGroupId] = useState('');
  const [archivedTestId, setArchivedTestId] = useState('');
  const [archivedQuery, setArchivedQuery] = useState('');
  const [archivedTests, setArchivedTests] = useState<{ id: string; label: string }[]>([]);
  const [archivedBlocks, setArchivedBlocks] = useState<ArchivedBlock[]>([]);
  const [archivedTestsLoading, setArchivedTestsLoading] = useState(false);
  const [archivedBlocksLoading, setArchivedBlocksLoading] = useState(false);
  const [archivedRefresh, setArchivedRefresh] = useState(0);
  const loadedArchivedGroupRef = useRef('');

  useEffect(() => { loadTests(); loadInstruments(); loadLots(); loadLotGroups(); loadSummaries(); loadRuleSettings(); }, [loadTests, loadInstruments, loadLots, loadLotGroups, loadSummaries, loadRuleSettings]);
  // Tự chọn xét nghiệm đầu tiên như app cũ (`selTest` rơi về xét nghiệm
  // đầu khi lựa chọn không hợp lệ) — để rỗng thì cả trang chỉ hiện vỏ.
  // Đây là lần thứ 4 cùng lớp lỗi này trong Giai đoạn D (Nhập QC, Six
  // Sigma, So sánh hoá chất, Westgard) — xem ghi chú D3.5.
  useEffect(() => {
    if (!summaries.length) return;
    if (testId && summaries.some((s) => s.testId === testId)) return;
    setTestId(summaries[0].testId);
  }, [summaries, testId]);
  const levels = levelsByTestId[testId] || [];
  const levelNums = useMemo(() => levels.map((l) => l.level), [levels]);
  useEffect(() => { if (testId) loadLevels(testId); }, [testId, loadLevels]);
  useEffect(() => { loadAnalysis(testId, levelNums); }, [testId, levelNums.join(','), loadAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cấu hình dải hoặc đổi lô ở trang Cấu hình chung cũng làm thay z-score,
  // tập điểm đang vận hành và nhãn LOT. Không chỉ nghe `qc_points`: nếu không
  // thẻ này sẽ tiếp tục hiện phân tích cũ cho đến khi người dùng tự đổi trang.
  useStoreInvalidation(['tests', 'test_levels', 'qc_points', 'qc_lots', 'lot_groups'], testId || undefined, () => {
    void loadSummaries();
    void loadLots();
    void loadLotGroups();
    void loadLevels(testId).then(() => loadAnalysis(testId, levelNums));
  });

  const archivedGroups = useMemo(
    () => lotGroups.filter((g) => g.active === 0 || g.status === 'stopped'),
    [lotGroups],
  );
  const archivedNeedle = archivedQuery.trim().toLocaleLowerCase('vi');
  // App cũ tìm nhóm theo tên nhóm hoặc số lô. Nếu không khớp nhóm nào (vd
  // người dùng đang tìm tên xét nghiệm), vẫn giữ toàn bộ danh sách để ô chọn
  // xét nghiệm tự xử lý phần lọc thay vì biến màn hình thành "không có dữ liệu".
  const archivedGroupOptions = useMemo(() => {
    if (!archivedNeedle) return archivedGroups;
    const matched = archivedGroups.filter((group) => [
      group.name,
      ...group.lotIds.map((id) => lots.find((lot) => lot.id === id)?.lot_no || ''),
    ].join(' ').toLocaleLowerCase('vi').includes(archivedNeedle));
    return matched.length ? matched : archivedGroups;
  }, [archivedGroups, archivedNeedle, lots]);

  // Cùng quy ước thứ tự với danh mục/Mean-SD: listTests() đã giữ thứ tự tạo
  // xét nghiệm (Na/K/Cl), còn IPC archived chỉ có nhiệm vụ lọc tập hợp hợp lệ.
  const archivedOrderedTests = useMemo(() => {
    const position = new Map(tests.map((test, index) => [test.id, index]));
    return [...archivedTests].sort((a, b) =>
      (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      || a.label.localeCompare(b.label, 'vi'),
    );
  }, [archivedTests, tests]);
  const archivedMatchedTests = useMemo(() => {
    if (!archivedNeedle) return archivedOrderedTests;
    return archivedOrderedTests.filter((item) => {
      const test = tests.find((candidate) => candidate.id === item.id);
      const instrument = test ? instruments.find((item) => item.id === test.instrument_id)?.name || '' : '';
      // Không dùng lô hiện hành ở đây vì tab này phải chỉ dựa vào lô lịch sử
      // của nhóm đang chọn.
      return `${item.label} ${instrument}`.toLocaleLowerCase('vi').includes(archivedNeedle);
    });
  }, [archivedNeedle, archivedOrderedTests, tests, instruments]);
  const archivedTestOptions = archivedMatchedTests.length ? archivedMatchedTests : archivedOrderedTests;
  const archivedGroup = archivedGroups.find((group) => group.id === archivedGroupId);
  const archivedStatusLabel = archivedGroup?.active === 0 ? 'Đã lưu trữ' : 'Đã dừng';

  // Tab lịch sử phải có một lựa chọn dùng được ngay khi mở, giống app cũ.
  // Không ràng buộc theo chuỗi tìm kiếm rỗng để người dùng vẫn tự đổi nhóm.
  useEffect(() => {
    if (view !== 'archived' || !archivedGroupOptions.length) return;
    if (archivedGroupOptions.some((group) => group.id === archivedGroupId)) return;
    setArchivedGroupId(archivedGroupOptions[0].id);
  }, [view, archivedGroupId, archivedGroupOptions]);

  // Nhóm lô đã dừng/lưu trữ: nạp danh sách xét nghiệm THẬT SỰ có lô của
  // nhóm này (không phải mọi xét nghiệm trong hệ thống), rồi phân tích
  // Westgard thật cho xét nghiệm+nhóm đang chọn — port `wgLotBlockModel()`
  // app cũ, thay bảng metadata phẳng trước đây.
  useEffect(() => {
    setArchivedBlocks([]);
    const groupChanged = loadedArchivedGroupRef.current !== archivedGroupId;
    loadedArchivedGroupRef.current = archivedGroupId;
    if (groupChanged) {
      setArchivedTests([]);
      setArchivedTestId('');
    }
    if (!archivedGroupId) { setArchivedTests([]); return; }
    let active = true;
    setArchivedTestsLoading(true);
    // Dữ liệu CHỈ ĐỌC của nhóm lô đã lưu trữ: không đổi trong lúc xem, và
    // có vòng đời gắn với lựa chọn trong tab này (kèm cờ huỷ) — giữ ở
    // component thay vì store.
    window.qcApi.listArchivedGroupTests(archivedGroupId).then((items) => {
      if (!active) return;
      setArchivedTests(items);
    }).catch(() => {
      if (active) setArchivedTests([]);
    }).finally(() => { if (active) setArchivedTestsLoading(false); });
    return () => { active = false; };
  }, [archivedGroupId, archivedRefresh]);
  // Khi đổi nhóm/lọc, giữ lựa chọn đang hợp lệ; nếu không còn phù hợp thì
  // chọn ngay xét nghiệm đầu tiên. Đây là điểm bản mới từng thiếu nên thẻ
  // lịch sử chỉ hiện hai combobox rỗng như ảnh người dùng gửi.
  useEffect(() => {
    if (!archivedOrderedTests.length) {
      if (archivedTestId) setArchivedTestId('');
      return;
    }
    const selectable = archivedMatchedTests.length ? archivedMatchedTests : archivedOrderedTests;
    if (!selectable.some((test) => test.id === archivedTestId)) setArchivedTestId(selectable[0].id);
  }, [archivedOrderedTests, archivedMatchedTests, archivedTestId]);
  useEffect(() => {
    if (!archivedGroupId || !archivedTestId) { setArchivedBlocks([]); return; }
    let active = true;
    setArchivedBlocksLoading(true);
    window.qcApi.listArchivedBlocks(archivedTestId, archivedGroupId).then((blocks) => {
      if (active) setArchivedBlocks(blocks);
    }).catch(() => {
      if (active) setArchivedBlocks([]);
    }).finally(() => { if (active) setArchivedBlocksLoading(false); });
    return () => { active = false; };
  }, [archivedGroupId, archivedTestId, archivedRefresh]);
  const archivedDecimals = tests.find((t) => t.id === archivedTestId)?.decimal_places ?? 2;
  /** Nhãn xét nghiệm trong ô chọn — app cũ ghép kèm LOT các mức:
   * "Sodium (Na) · LOT 1101/1102". */
  const testPickerLabel = (s: typeof summaries[number]) => {
    const lots = Array.from(new Set(s.levels.map((lv) => lv.lot).filter(Boolean)));
    return lots.length ? `${s.testName} · LOT ${lots.join('/')}` : s.testName;
  };
  /** Lọc theo ô "Tìm nhanh" — tên xét nghiệm, LOT hoặc máy, đúng bộ field
   * app cũ dùng. */
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

  // Tab lưu trữ không dùng `analysisByLevel`, nên phải có nhịp nạp lại riêng
  // khi điểm QC, lô hoặc Mean/SD của xét nghiệm đang xem vừa thay đổi.
  useStoreInvalidation(['tests', 'test_levels', 'qc_points', 'qc_lots', 'lot_groups'], archivedTestId || undefined, () => {
    if (view === 'archived' && archivedGroupId) setArchivedRefresh((revision) => revision + 1);
  });

  const currentSummary = summaries.find((s) => s.testId === testId);
  const lotLabelFor = (level: number) => {
    const lv = levels.find((l) => l.level === level);
    const lot = lv?.qc_lot_id ? lots.find((l) => l.id === lv.qc_lot_id) : null;
    return lot?.lot_no || '—';
  };
  const navigate = useNavigate();
  // Vẫn là MỘT biểu đồ tổng hợp hai mức: dữ liệu quy đổi về Z-score chung,
  // chỉ đồng bộ kích thước/co giãn với biểu đồ ở trang Nhập QC.
  const showMultiChart = levels.length >= 2;
  const multiSeries: QcMultiLevelSeries[] = useMemo(
    () => levels.map((l) => ({ level: l.level, lot: lotLabelFor(l.level), points: analysisByLevel[l.level]?.points || [] })),
    [levels, lots, analysisByLevel],
  );
  // Chuỗi CUSUM của từng mức đã được main tính ĐỘC LẬP. Cấu trúc này chỉ
  // ghép chúng vào một khung vẽ chung, không trộn dữ liệu giữa các mức.
  const multiCusumSeries: QcMultiCusumSeries[] = useMemo(
    () => levels.map((l) => ({ level: l.level, points: analysisByLevel[l.level]?.points || [], cusum: analysisByLevel[l.level]?.cusum || { cPos: [], cNeg: [], flags: [], k: 0.5, h: 4, ma: [] } })),
    [levels, analysisByLevel],
  );
  // CUSUM là cấu hình CHUNG của cả xét nghiệm (`tests.cusum_on`), không theo
  // từng mức — mọi mức cùng trả về đúng 1 giá trị `cusumOn`.
  const cusumOn = !!analysisByLevel[levels[0]?.level]?.cusumOn;

  /** "Khôi phục mặc định": bật lại đúng trạng thái mặc định của từng luật
   * theo `WG_RULE_REGISTRY` — app cũ dùng `wgReset()`. Đây là cấu hình
   * CHUNG (toàn phòng xét nghiệm), không riêng xét nghiệm đang chọn. */
  async function resetRules() {
    await resetRuleSettings();
    // Đổi bộ luật làm verdict của các điểm ĐANG hiện thay đổi ngay. Không
    // chờ người dùng đổi xét nghiệm/rời trang rồi mới phân tích lại.
    await loadAnalysis(testId, levelNums);
  }

  /** Xuất Excel / In PDF phần đang xem — dùng chung cơ chế Giai đoạn C1. */
  async function exportXlsx() {
    const rows = levels.flatMap((lv) => (analysisByLevel[lv.level]?.points || []).map((p) => [
      `Mức ${lv.level}`, p.date, p.runId, p.val, zCell(p.z),
      p.cusumSignal ? `${VERDICT_LABEL[p.verdict]} · Cảnh báo CUSUM` : VERDICT_LABEL[p.verdict],
      [...p.rules, p.cusumSignal].filter(Boolean).join(', '),
    ]));
    const error = await exportTableXlsx('Westgard', ['Mức', 'Ngày', 'Lần chạy', 'Giá trị', 'Z', 'Kết luận', 'Luật'], rows,
      `westgard-${currentSummary?.testName || 'xet-nghiem'}.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function printPdf() {
    const body = levels.flatMap((lv) => (analysisByLevel[lv.level]?.points || []).map((p) => `<tr><td>Mức ${lv.level}</td><td>${vnDate(p.date)}</td><td>${p.val}</td><td>${zText(p.z)}</td><td>${p.cusumSignal ? `${VERDICT_LABEL[p.verdict]} · Cảnh báo CUSUM` : VERDICT_LABEL[p.verdict]}</td><td>${[...p.rules, p.cusumSignal].filter(Boolean).join(', ')}</td></tr>`)).join('');
    const title = `Phân tích Westgard — ${currentSummary?.testName || ''}`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font:13px system-ui,sans-serif;color:#163541;padding:18px}h1{font-size:17px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d9e0;padding:5px 7px;text-align:left}
      th{background:#eef4f7;print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head>
      <body><h1>${title}</h1><table><thead><tr><th>Mức</th><th>Ngày</th><th>Giá trị</th><th>Z</th><th>Kết luận</th><th>Luật</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
    const error = await printHtmlToPdf(html, `westgard-${currentSummary?.testName || 'xet-nghiem'}.pdf`);
    if (error) await infoDialog(error, { type: 'warn' });
  }

  async function onToggleRule(ruleId: string, on: boolean) {
    await saveRuleSetting(ruleId, on);
    // `saveRuleSetting` đã nạp lại danh sách/bộ công tắc chung; bảng và biểu
    // đồ mức đang mở là dữ liệu dẫn xuất riêng nên phải tính lại tức thời.
    await loadAnalysis(testId, levelNums);
  }

  return (
    <div>
      <PageHeader title="Phân tích Westgard" subtitle={view === 'archived' ? 'Xem lại Westgard theo nhóm lô đã dừng/lưu trữ' : 'Đối chiếu luật theo mức QC, lô và lần chạy'} />

      <div className="panel wg-setup-panel">
        <h2 className="panel-title">Thiết lập phân tích</h2>
        {archivedGroups.length > 0 && (
          <div className="dayseg wg-view-mode wg-archive-view-mode">
            <button className={view === 'current' ? 'on' : ''} onClick={() => setView('current')}>Xét nghiệm đang vận hành</button>
            <button className={view === 'archived' ? 'on' : ''} onClick={() => setView('archived')}>Nhóm lô đã dừng/lưu trữ ({archivedGroups.length})</button>
          </div>
        )}

        {view === 'current' && (
          <>
            <div className={`wg-test-picker${chartMode === 'lj' ? ' wg-test-picker-3' : ''}`}>
              <div>
                <label>Tìm nhanh</label>
                <input id="wgTestSearch" type="search" placeholder="Tên xét nghiệm, LOT hoặc máy..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div>
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
                    <button className="btn teal wg-excel-btn" title="Xuất Excel biểu đồ Levey-Jennings, các vi phạm và điểm bằng chứng đang xem" onClick={exportXlsx}><DownloadIcon />Xuất Excel</button>
                    <button className="btn teal wg-print-btn" title="Tạo bản in PDF/HTML biểu đồ Levey-Jennings và các vi phạm đang xem" onClick={printPdf}><PrintIcon />In PDF</button>
                  </div>
                </div>
              )}
            </div>

            {testId && (
              <>
                <div className="wg-rules">
                  <b style={{ fontSize: 'var(--type-body)' }}>Cấu hình chung của luật</b>
                  <div className="flow-note">
                    {ruleSettings.map((r) => (
                      <span className="wg-rule-item" key={r.id}>
                        <label><input type="checkbox" checked={r.on} disabled={!writable} onChange={(e) => onToggleRule(r.id, e.target.checked)} /><span className="pill">{r.id}</span></label>
                      </span>
                    ))}
                    {writable && (
                      <div className="wg-rule-reset">
                        <button className="btn ghost sm" onClick={resetRules}>Khôi phục mặc định</button>
                      </div>
                    )}
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

                <div className="dayseg wg-view-mode wg-chart-mode">
                  <button className={chartMode === 'lj' ? 'on' : ''} onClick={() => setChartMode('lj')}>Levey-Jennings</button>
                  <button className={chartMode === 'cusum' ? 'on' : ''} onClick={() => setChartMode('cusum')}>Xu hướng CUSUM</button>
                </div>
              </>
            )}
          </>
        )}

        {view === 'archived' && (
          <>
            <div className="wg-test-picker wg-test-picker-3">
              <div className="field">
                <label>Tìm nhanh</label>
                <input type="search" placeholder="Tên xét nghiệm hoặc số lô..." value={archivedQuery} onChange={(e) => setArchivedQuery(e.target.value)} />
              </div>
              <div className="field"><label>Chọn xét nghiệm <span className="hint">({archivedMatchedTests.length || archivedOrderedTests.length}/{archivedOrderedTests.length})</span></label>
                <select value={archivedTestId} disabled={archivedTestsLoading || !archivedTestOptions.length} onChange={(e) => setArchivedTestId(e.target.value)}>
                  {!archivedTestOptions.length && <option value="">{archivedTestsLoading ? 'Đang nạp xét nghiệm...' : 'Nhóm lô này chưa dùng cho xét nghiệm nào'}</option>}
                  {archivedTestOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="field"><label>Nhóm lô đã dừng/lưu trữ <span className="hint">({archivedGroupOptions.length}/{archivedGroups.length})</span></label>
                <select value={archivedGroupId} onChange={(e) => setArchivedGroupId(e.target.value)}>
                  {archivedGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.active === 0 ? 'đã lưu trữ' : 'đã dừng'}{g.stopped_at ? ` ${vnDate(g.stopped_at)}` : ''}</option>)}
                </select>
              </div>
            </div>
            <p className="hint wg-archive-note">Dùng Mean/SD đã chốt của từng lô lịch sử; kết luận được đánh giá lại theo bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô còn hoạt động.</p>
          </>
        )}
      </div>

      {view === 'current' && !testId && <div className="panel"><p className="empty-state">Chọn 1 xét nghiệm ở panel phía trên.</p></div>}

      {/* Tab CUSUM: xu hướng CỘNG DỒN vẫn tính RIÊNG từng mức (không quy đổi
          chung 1 trục như LJ), và cả trang chỉ hiện khi xét nghiệm ĐÃ BẬT
          CUSUM (`tests.cusum_on`) — port `CusumPage` app cũ. */}
      {view === 'current' && testId && chartMode === 'cusum' && !cusumOn && (
        <div className="panel"><div className="empty">
          <div className="empty-title">Chưa bật CUSUM cho xét nghiệm này</div>
          <div>Bật trong cấu hình xét nghiệm để xem biểu đồ xu hướng CUSUM.</div>
          {writable && <div className="empty-actions"><button className="btn teal" onClick={() => navigate('/manage', { state: { tab: 'tests', editTestId: testId } })}>Mở cấu hình xét nghiệm</button></div>}
        </div></div>
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
            <h3><div className="wg-level-title"><span>Mức {l.level}</span><span className="wg-lot-name">Lô {lotLabelFor(l.level)}</span></div></h3>
            {!pointCount ? (
              <div className="wg-empty-message"><b>Chưa có dữ liệu</b><span>LOT đang dùng chưa có điểm QC.</span></div>
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
          <div className="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm.</div>
          <div className="chart-scroll"><QcMultiChart className="wgLJMulti" series={multiSeries} height={300} responsiveHeight /></div>
        </div>
      )}
      {view === 'current' && testId && chartMode === 'lj' && levels.map((l) => {
        const analysis = analysisByLevel[l.level];
        const noTarget = l.mean == null || l.sd == null;
        const pointCount = analysis?.points.length || 0;
        return (
          <div className="panel" key={l.level}>
            <h3>
              <div className="wg-level-title"><span>Mức {l.level}</span><span className="wg-lot-name">Lô {lotLabelFor(l.level)}</span></div>
              <div className="wg-level-meta"><span>Mean {l.mean != null ? l.mean.toFixed(2) : '—'}</span><span>SD {l.sd != null ? l.sd.toFixed(2) : '—'}</span><span>{pointCount} điểm</span></div>
            </h3>
            {!pointCount ? (
              <div className="wg-empty-message">
                <b>Chưa có dữ liệu</b>
                <span>LOT đang dùng chưa có điểm QC. Bạn có thể nhập điểm mới.</span>
                <div className="empty-actions"><button className="btn teal" onClick={() => navigate('/entry', { state: { testId } })}>Nhập QC</button></div>
              </div>
            ) : (
              <>
                {noTarget && <div className="alert warn wg-target-warning"><b>Mức {l.level} chưa có Mean/SD hợp lệ</b> — điểm QC mức này không được đánh giá Westgard.</div>}
                <div className="chart-scroll">
                  <table className="wg-table">
                    <thead><tr><th>#</th><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead>
                    <tbody>
                      {(analysis?.points || []).map((p, i) => (
                        <tr key={p.id}>
                          <td>{i + 1}</td><td>{vnDate(p.date)}</td>
                          <td className="num">{p.val.toFixed(currentSummary?.decimalPlaces ?? 2)}</td>
                          <td className="num">{zText(p.z)}</td>
                          <td>
                            <span className={`tag ${p.verdict}`}>{VERDICT_LABEL[p.verdict]}</span>
                            {p.cusumSignal && <span className="tag warn" title="Tín hiệu xu hướng CUSUM; không tự loại điểm QC">Cảnh báo CUSUM</span>}
                          </td>
                          <td>
                            {p.rules.map((r) => <span className="pill" key={r}>{r}</span>)}
                            {p.cusumSignal && <span className="pill warn" title="CUSUM vượt ngưỡng h; cần rà soát xu hướng">{p.cusumSignal}</span>}
                            {p.supportRules.map((r) => <span className="pill hint" key={`s-${r}`} title="Điểm lịch sử cấu thành quy tắc — chỉ là bằng chứng">↩{r}</span>)}
                            {!p.rules.length && !p.cusumSignal && !p.supportRules.length && '—'}
                          </td>
                          <td className="hint">{p.errorType !== '—' ? <div className="wg-error-type"><b>{p.errorType}</b><small>{p.errorDesc}</small></div> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}

      {view === 'archived' && archivedGroupId && archivedTestsLoading && (
        <div className="panel wg-archived-empty"><p className="empty-state">Đang nạp xét nghiệm và dữ liệu lịch sử của nhóm lô...</p></div>
      )}

      {view === 'archived' && archivedGroupId && !archivedTestsLoading && !archivedTestId && !archivedTests.length && (
        <div className="panel wg-archived-empty"><div className="empty"><div className="empty-title">Không tìm thấy xét nghiệm nào</div><div>Nhóm lô này không gắn với xét nghiệm/mức nào có Mean/SD lịch sử hợp lệ.</div></div></div>
      )}

      {view === 'archived' && archivedTestId && archivedBlocksLoading && (
        <div className="panel wg-archived-empty"><p className="empty-state">Đang đánh giá Westgard cho dữ liệu lịch sử...</p></div>
      )}

      {view === 'archived' && archivedTestId && !archivedBlocksLoading && !archivedBlocks.length && (
        <div className="panel wg-archived-empty"><div className="empty"><div className="empty-title">Chưa có dữ liệu phân tích</div><div>Không có lô nào của nhóm này có Mean/SD lịch sử hợp lệ cho xét nghiệm đã chọn.</div></div></div>
      )}

      {view === 'archived' && archivedTestId && archivedBlocks.length >= 2 && (
        <div className="panel wg-multi-panel">
          <h2 className="panel-title">Levey-Jennings tổng hợp</h2>
          <div className="hint wg-panel-intro">Biểu đồ quy đổi từng mức về Z-score theo Mean/SD đã chốt của chính lô để so sánh trên cùng trục; kết luận được đánh giá lại theo bộ luật Westgard đang bật.</div>
          <div className="chart-scroll"><QcMultiChart className="wgLJMultiArchived" height={300} responsiveHeight
            series={archivedBlocks.map((b) => ({ level: b.level, lot: b.lotNo, points: b.analysis.points }))} /></div>
        </div>
      )}

      {view === 'archived' && archivedTestId && archivedBlocks.map((b) => (
        <div className={`panel wg-level-panel${b.analysis.points.length ? ' wg-prev-lot' : ''}`} key={`${b.level}-${b.lotId}`}>
          <h3>
            <div className="wg-level-title"><span>Mức {b.level}</span><span className="wg-lot-name">Lô {b.lotNo}</span></div>
            <div className="wg-level-meta"><span className="tag rej">{archivedStatusLabel}</span><span>Mean {b.mean.toFixed(archivedDecimals)}</span><span>SD {b.sd.toFixed(archivedDecimals)}</span><span>{b.analysis.points.length} điểm</span></div>
          </h3>
          {!b.analysis.points.length ? (
            <div className="wg-empty-message"><b>Chưa có dữ liệu</b><span>Không tìm thấy điểm QC nào cho lô này.</span></div>
          ) : (
            <>
              <div className="chart-scroll">
                <table className="wg-table">
                <thead><tr><th>#</th><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead>
                <tbody>
                  {b.analysis.points.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td><td>{vnDate(p.date)}</td>
                      <td className="num">{p.val.toFixed(archivedDecimals)}</td>
                      <td className="num">{zText(p.z)}</td>
                      <td><span className={`tag ${p.verdict}`}>{VERDICT_LABEL[p.verdict]}</span></td>
                      <td>
                        {p.rules.map((r) => <span className="pill" key={r}>{r}</span>)}
                        {p.supportRules.map((r) => <span className="pill hint" key={`s-${r}`} title="Điểm lịch sử cấu thành quy tắc — chỉ là bằng chứng">↩{r}</span>)}
                        {!p.rules.length && !p.supportRules.length && '—'}
                      </td>
                      <td className="hint">{p.errorType !== '—' ? <div className="wg-error-type"><b>{p.errorType}</b><small>{p.errorDesc}</small></div> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
