// Phân tích Westgard — viết lại theo đúng bố cục app cũ (professional-westgard.css
// + WestgardPage.tsx cũ): KHÔNG có bảng "Tổng quan tất cả xét nghiệm" phẳng
// (bản cũ không có khái niệm đó) — panel "Thiết lập phân tích" (chọn xét
// nghiệm + bật/tắt luật + hướng dẫn luật + tab LJ/CUSUM) rồi 1 panel riêng
// cho MỖI mức của xét nghiệm đang chọn (bảng điểm đúng 7 cột, tiêu đề mức +
// Mean/SD/n điểm). Tab "Nhóm lô đã dừng" đọc lại `lotGroups` đã có (không
// domain mới), đúng nguyên tắc "không domain mới nếu đã có API phù hợp".
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useManageStore } from '../store/manage-store';
import { useWestgardStore } from '../store/westgard-store';
import { useStoreInvalidation } from '../lib/useStoreInvalidation';
import { useAuthStore } from '../store/auth-store';
import { canWrite } from '../lib/permissions';
import { QcChart, QcMultiChart, type QcMultiLevelSeries } from '../components/QcChart';
import { PageHeader } from '../components/PageHeader';
import { exportTableXlsx, printHtmlToPdf } from '../lib/export';
import { infoDialog } from '../state/dialog-store';
import { DownloadIcon, PrintIcon } from '../components/BtnIcons';
import { vnDate as formatVnDate } from '../lib/format';
import type { ArchivedBlock } from '../../shared/qc-api';

const VERDICT_LABEL: Record<string, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };
/** `vnDate()` app cũ. */
const vnDate = (iso: string) => formatVnDate(iso, '—');

export function WestgardPage() {
  const { tests, lots, levelsByTestId, loadTests, loadLevels, loadLots, lotGroups, loadLotGroups } = useManageStore();
  const { summaries, loadSummaries, ruleSettings, loadRuleSettings, saveRuleSetting, resetRuleSettings, analysisByLevel, loadAnalysis } = useWestgardStore();
  // Bật/tắt luật ghi vào cấu hình CHUNG (`app_meta.westgardRules`) — vai trò
  // chỉ-xem thấy đúng trạng thái luật nhưng không đổi được (checkbox
  // disabled, không ẩn, để bảng hướng dẫn giữ nguyên bố cục như app cũ).
  const writable = canWrite(useAuthStore((s) => s.user)?.role);
  const [view, setView] = useState<'current' | 'archived'>('current');
  const [testId, setTestId] = useState('');
  const [query, setQuery] = useState('');
  const [chartMode, setChartMode] = useState<'lj' | 'cusum'>('lj');
  const [archivedGroupId, setArchivedGroupId] = useState('');
  const [archivedTestId, setArchivedTestId] = useState('');
  const [archivedTests, setArchivedTests] = useState<{ id: string; label: string }[]>([]);
  const [archivedBlocks, setArchivedBlocks] = useState<ArchivedBlock[]>([]);

  useEffect(() => { loadTests(); loadLots(); loadLotGroups(); loadSummaries(); loadRuleSettings(); }, [loadTests, loadLots, loadLotGroups, loadSummaries, loadRuleSettings]);
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
  useStoreInvalidation(['tests', 'qc_points'], testId || undefined, () => {
    loadSummaries();
    loadAnalysis(testId, levelNums);
  });

  const archivedGroups = lotGroups.filter((g) => g.active === 0 || g.status === 'stopped');

  // Nhóm lô đã dừng/lưu trữ: nạp danh sách xét nghiệm THẬT SỰ có lô của
  // nhóm này (không phải mọi xét nghiệm trong hệ thống), rồi phân tích
  // Westgard thật cho xét nghiệm+nhóm đang chọn — port `wgLotBlockModel()`
  // app cũ, thay bảng metadata phẳng trước đây.
  useEffect(() => {
    setArchivedTestId('');
    setArchivedBlocks([]);
    if (!archivedGroupId) { setArchivedTests([]); return; }
    window.qcApi.listArchivedGroupTests(archivedGroupId).then(setArchivedTests);
  }, [archivedGroupId]);
  useEffect(() => {
    if (!archivedGroupId || !archivedTestId) { setArchivedBlocks([]); return; }
    window.qcApi.listArchivedBlocks(archivedTestId, archivedGroupId).then(setArchivedBlocks);
  }, [archivedGroupId, archivedTestId]);
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

  const currentSummary = summaries.find((s) => s.testId === testId);
  const lotLabelFor = (level: number) => {
    const lv = levels.find((l) => l.level === level);
    const lot = lv?.qc_lot_id ? lots.find((l) => l.id === lv.qc_lot_id) : null;
    return lot?.lot_no || '—';
  };
  const navigate = useNavigate();
  /** Biểu đồ "Levey-Jennings tổng hợp" là MỘT biểu đồ DUY NHẤT quy đổi mọi
   * mức về Z-score chung 1 trục — KHÔNG phải mỗi mức 1 biểu đồ riêng (đúng
   * `MultiChart`/`showMultiChart = wgMultiViews(t).length>=2` app cũ: hiện khi
   * xét nghiệm có ≥2 mức đang vận hành, không phụ thuộc mức đó đã có điểm hay
   * chưa). Mỗi panel mức chỉ còn tiêu đề + bảng, không tự vẽ biểu đồ riêng. */
  const showMultiChart = levels.length >= 2;
  const multiSeries: QcMultiLevelSeries[] = useMemo(
    () => levels.map((l) => ({ level: l.level, points: analysisByLevel[l.level]?.points || [] })),
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
  }

  /** Xuất Excel / In PDF phần đang xem — dùng chung cơ chế Giai đoạn C1. */
  async function exportXlsx() {
    const rows = levels.flatMap((lv) => (analysisByLevel[lv.level]?.points || []).map((p) => [
      `Mức ${lv.level}`, p.date, p.runId, p.val, Number(p.z.toFixed(2)), VERDICT_LABEL[p.verdict], p.rules.join(', '),
    ]));
    const error = await exportTableXlsx('Westgard', ['Mức', 'Ngày', 'Lần chạy', 'Giá trị', 'Z', 'Kết luận', 'Luật'], rows,
      `westgard-${currentSummary?.testName || 'xet-nghiem'}.xlsx`);
    if (error) await infoDialog(error, { type: 'warn' });
  }
  async function printPdf() {
    const body = levels.flatMap((lv) => (analysisByLevel[lv.level]?.points || []).map((p) => `<tr><td>Mức ${lv.level}</td><td>${vnDate(p.date)}</td><td>${p.val}</td><td>${p.z.toFixed(2)}s</td><td>${VERDICT_LABEL[p.verdict]}</td><td>${p.rules.join(', ')}</td></tr>`)).join('');
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
  }

  return (
    <div>
      <PageHeader title="Phân tích Westgard" subtitle={view === 'archived' ? 'Xem lại Westgard theo nhóm lô đã dừng/lưu trữ' : 'Đối chiếu luật theo mức QC, lô và lần chạy'} />

      <div className="panel">
        <h2 className="panel-title">Thiết lập phân tích</h2>
        {archivedGroups.length > 0 && (
          <div className="dayseg wg-view-mode" style={{ margin: 'var(--panel-content-gap) var(--space-panel) 0' }}>
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

                <div className="dayseg wg-view-mode" style={{ margin: '12px var(--space-panel) 0' }}>
                  <button className={chartMode === 'lj' ? 'on' : ''} onClick={() => setChartMode('lj')}>Levey-Jennings</button>
                  <button className={chartMode === 'cusum' ? 'on' : ''} onClick={() => setChartMode('cusum')}>Xu hướng CUSUM</button>
                </div>
              </>
            )}
          </>
        )}

        {view === 'archived' && (
          <div className="wg-test-picker wg-test-picker-3">
            <div className="field"><label>Nhóm lô đã dừng/lưu trữ</label>
              <select value={archivedGroupId} onChange={(e) => setArchivedGroupId(e.target.value)}>
                <option value="">Chọn nhóm lô</option>
                {archivedGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Xét nghiệm</label>
              <select value={archivedTestId} disabled={!archivedTests.length} onChange={(e) => setArchivedTestId(e.target.value)}>
                <option value="">{archivedGroupId ? (archivedTests.length ? 'Chọn xét nghiệm' : 'Nhóm lô này chưa dùng cho xét nghiệm nào') : 'Chọn nhóm lô trước'}</option>
                {archivedTests.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <p className="hint flow-item">Đánh giá dưới đây dùng bộ luật Westgard đang bật hiện nay, không phải cấu hình luật tại thời điểm nhóm lô này còn hoạt động.</p>
          </div>
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
      {view === 'current' && testId && chartMode === 'cusum' && cusumOn && levels.map((l) => {
        const analysis = analysisByLevel[l.level];
        const pointCount = analysis?.points.length || 0;
        return (
          <div className="panel" key={l.level}>
            <h3><div className="wg-level-title"><span>Mức {l.level}</span><span className="wg-lot-name">Lô {lotLabelFor(l.level)}</span></div></h3>
            {!pointCount ? (
              <div className="empty"><div className="empty-title">Chưa có dữ liệu</div><div>LOT đang dùng chưa có điểm QC.</div></div>
            ) : (
              <>
                <div className="hint wg-panel-intro">Đường CUSUM+ (teal)/CUSUM− (xanh tím) cộng dồn độ lệch z-score qua từng điểm; vượt vạch đứt ±h là dấu hiệu trôi/shift kéo dài.</div>
                <div className="chart-scroll"><QcChart className="cusumChart" mode="cusum" points={analysis?.points || []} cusum={analysis?.cusum} height={430} /></div>
              </>
            )}
          </div>
        );
      })}

      {/* Tab Levey-Jennings: MỘT biểu đồ tổng hợp duy nhất (quy đổi mọi mức
          về Z-score chung 1 trục, hiện khi ≥2 mức đang vận hành), rồi mỗi
          mức 1 panel CHỈ tiêu đề+bảng — KHÔNG có biểu đồ riêng từng mức. */}
      {view === 'current' && testId && chartMode === 'lj' && showMultiChart && (
        <div className="panel">
          <h2 className="panel-title">Levey-Jennings tổng hợp</h2>
          {/* Câu app cũ còn nhắc công tắc "Xem lô cũ" (thêm đường của lô đã
              chuyển tiếp vào biểu đồ) — app-v2 CHƯA có tính năng đó (cần cột
              phân biệt điểm thuộc lô nào, cùng nhóm "song song 2 lô" đã hoãn
              từ B2), nên câu ở đây chỉ nói phần THẬT SỰ làm, không hứa suông. */}
          <div className="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm.</div>
          <div className="chart-scroll"><QcMultiChart className="wgLJMulti" series={multiSeries} height={430} /></div>
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
              <div className="empty">
                <div className="empty-title">Chưa có dữ liệu</div>
                <div>LOT đang dùng chưa có điểm QC. Bạn có thể nhập điểm mới.</div>
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
                          <td className="num">{`${p.z >= 0 ? '+' : ''}${p.z.toFixed(2)}s`}</td>
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
        );
      })}

      {view === 'archived' && archivedGroupId && !archivedTestId && (
        <div className="panel"><p className="empty-state">Chọn 1 xét nghiệm ở panel phía trên để xem lại phân tích Westgard.</p></div>
      )}

      {view === 'archived' && archivedTestId && !archivedBlocks.length && (
        <div className="panel"><p className="empty-state">Không có lô nào của nhóm này có Mean/SD hợp lệ cho xét nghiệm đã chọn.</p></div>
      )}

      {view === 'archived' && archivedTestId && archivedBlocks.length >= 2 && (
        <div className="panel">
          <h2 className="panel-title">Levey-Jennings tổng hợp</h2>
          <div className="hint wg-panel-intro">Biểu đồ quy đổi các mức QC về Z-score để so sánh trên cùng trục; kết luận Đạt/Cảnh báo/Loại bỏ được tính theo bộ luật Westgard đang bật cho xét nghiệm.</div>
          <div className="chart-scroll">
            <QcMultiChart className="wgLJMultiArchived" height={430}
              series={archivedBlocks.map((b) => ({ level: b.level, points: b.analysis.points }))} />
          </div>
        </div>
      )}

      {view === 'archived' && archivedTestId && archivedBlocks.map((b) => (
        <div className="panel" key={`${b.level}-${b.lotId}`}>
          <h3>
            <div className="wg-level-title"><span>Mức {b.level}</span><span className="wg-lot-name">Lô {b.lotNo}</span></div>
            <div className="wg-level-meta"><span className="tag rej">Đã dừng</span><span>Mean {b.mean.toFixed(2)}</span><span>SD {b.sd.toFixed(2)}</span><span>{b.analysis.points.length} điểm</span></div>
          </h3>
          {!b.analysis.points.length ? (
            <div className="empty"><div className="empty-title">Chưa có dữ liệu</div><div>Không tìm thấy điểm QC nào cho lô này.</div></div>
          ) : (
            <div className="chart-scroll">
              <table className="wg-table">
                <thead><tr><th>#</th><th>Ngày</th><th className="num">Giá trị</th><th className="num">Z</th><th>Kết luận</th><th>Luật / bằng chứng</th><th>Loại sai số</th></tr></thead>
                <tbody>
                  {b.analysis.points.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td><td>{vnDate(p.date)}</td>
                      <td className="num">{p.val.toFixed(archivedDecimals)}</td>
                      <td className="num">{`${p.z >= 0 ? '+' : ''}${p.z.toFixed(2)}s`}</td>
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
          )}
        </div>
      ))}
    </div>
  );
}
