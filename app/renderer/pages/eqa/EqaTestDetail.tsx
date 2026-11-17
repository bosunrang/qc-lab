// Danh sách xét nghiệm giữ bên trái để đổi chuỗi mà không mất phạm vi đọc.
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { EmptyState } from '../../components/EmptyState';
import { SearchSelect } from '../../components/SearchSelect';
import { ResizeHandle, useStoredWidth } from '../../components/ResizeHandle';
import type { EqaInstrumentGridRow, EqaSeriesView } from '../../../shared/qc-api';
import { vnDate } from '../../lib/format';
import { normalizeSearchText } from '../../lib/search-options';
import { ClassTag, numText, pctText, rawNum, roundLabel, TrendTags, worstEqaResult } from './shared';
import { EqaSeriesChart } from './EqaSeriesChart';
import { EqaResultFilter, useEqaResultFilter } from './EqaResultFilter';
import { useEqaScope, type EqaNavigationContext } from './useEqaScope';
import { useEqaRead, useEqaRevision } from './useEqaRead';

// Cùng mốc với eqa.css: ở cửa sổ nhỏ, danh sách nằm trên biểu đồ và không
// áp dụng độ rộng mà người dùng đã kéo khi đang xem hai cột.
const STACKED_QUERY = '(max-width:850px)';
function subscribeLayout(listener: () => void) {
  const query = window.matchMedia(STACKED_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function isStacked() { return window.matchMedia(STACKED_QUERY).matches; }

export function EqaTestDetail({ testId, onBack, onOpenTest, onOpenRound }: {
  testId: string; onBack: () => void;
  onOpenTest: (id: string, context?: EqaNavigationContext, replace?: boolean) => void;
  onOpenRound: (id: string, resultId?: string) => void;
}) {
  const series = useEqaStore((s) => s.series);
  const allRounds = useEqaStore((s) => s.rounds);
  const instrumentGrid = useEqaStore((s) => s.instrumentGrid);
  const setAnalysisListScroll = useEqaStore((s) => s.setAnalysisListScroll);
  const rememberAnalysisListScroll = useEqaStore((s) => s.rememberAnalysisListScroll);
  const finishAnalysisListScrollRestore = useEqaStore((s) => s.finishAnalysisListScrollRestore);
  const revision = useEqaRevision();
  const [refresh, setRefresh] = useState(0);
  const invalidate = useCallback(() => setRefresh((n) => n + 1), []);
  useStoreInvalidation(['eqa_rounds', 'tests', 'instruments', 'tea_refs'], undefined, invalidate);
  const read = useCallback(() => series(testId), [series, testId]);
  const result = useEqaRead(`${testId}:${revision}:${refresh}`, read);
  const view = result.data;
  const scope = useEqaScope(view?.instrument_id);
  const { year, instrumentId } = scope;
  // Chương trình của chuỗi: theo URL khi xét nghiệm có kết quả ở đó, nếu không
  // thì chương trình có kết quả mới nhất. Không dùng chương trình mặc định của
  // năm vì xét nghiệm có thể không tham gia chương trình đó.
  const programs = [...(view?.programs ?? [])].sort((a, b) => a.program_name.localeCompare(b.program_name, 'vi'));
  const requestedProgram = scope.params.get('program');
  const seriesProgramId = programs.some((p) => p.program_id === requestedProgram) ? requestedProgram! : view?.points.at(-1)?.program_id ?? '';
  // Danh sách bên trái cùng chương trình với biểu đồ.
  const programId = seriesProgramId || scope.programId;
  const readGrid = useCallback(() => programId && instrumentId ? instrumentGrid(programId, year, instrumentId) : Promise.resolve([]), [instrumentGrid, programId, year, instrumentId]);
  const grid = useEqaRead(`${programId}:${year}:${instrumentId}:${revision}:${refresh}`, readGrid);
  const listRounds = allRounds.filter((r) => r.status === 'open' && r.program_id === programId && r.year === year)
    .sort((a, b) => a.round_no - b.round_no || a.report_date.localeCompare(b.report_date));
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'z' | 'pct'>('z');
  // Biểu đồ mặc định phủ toàn bộ lịch sử của chương trình: tín hiệu chuỗi
  // (6 đợt cùng phía, điểm J, không thành công) tính trên toàn lịch sử, nên
  // người xem phải thấy được các đợt gây ra tín hiệu (N-07).
  const [span, setSpan] = useState<'all' | 'year'>('all');
  const [filter, setFilter] = useEqaResultFilter(`${testId}:${programId}:${year}:${span}`);
  const layoutRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const assayItemsRef = useRef<HTMLDivElement>(null);
  const [storedWidth, setListWidth] = useStoredWidth('qclab.eqaAssayListWidth', 340);
  const listWidth = storedWidth ?? 340;
  const stacked = useSyncExternalStore(subscribeLayout, isStacked);
  // Khôi phục sau khi đúng danh sách đã dựng, kể cả khi quay lại từ kỳ báo cáo.
  useLayoutEffect(() => {
    const node = assayItemsRef.current;
    if (!node) return;
    const saved = useEqaStore.getState();
    node.scrollTop = saved.analysisListScrollTarget ?? saved.analysisListScroll;
    finishAnalysisListScrollRestore();
  }, [grid.data, testId, stacked, finishAnalysisListScrollRestore]);
  const listMaxNow = () => Math.min(480, (layoutRef.current?.clientWidth ?? 1000) * 0.42);
  function resizeList(width: number) {
    setListWidth(Math.round(Math.max(280, Math.min(width, listMaxNow()))));
  }
  function openAssay(id: string) {
    if (id === testId) return;
    const top = assayItemsRef.current?.scrollTop ?? useEqaStore.getState().analysisListScroll;
    rememberAnalysisListScroll(top);
    onOpenTest(id, { ...scope.context, programId }, true);
  }
  const program = programs.find((p) => p.program_id === seriesProgramId);
  const programPoints = (view?.points ?? []).filter((p) => p.program_id === seriesProgramId);
  const spanYears = [...new Set(programPoints.map((p) => p.year))].sort((a, b) => b - a);
  const points = span === 'all' ? programPoints : programPoints.filter((p) => p.year === year);
  function changeProgram(id: string) {
    if (span === 'year' && !(view?.points ?? []).some((p) => p.program_id === id && p.year === year)) setSpan('all');
    scope.change({ programId: id });
  }
  function changeSpan(value: string) {
    if (value === 'all') { setSpan('all'); return; }
    setSpan('year');
    scope.change({ year: Number(value), programId });
  }
  const latestRound = points.filter((p) => p.round_id === points.at(-1)?.round_id);
  const latestWorst = worstEqaResult(latestRound);
  const explicitSelected = points.find((p) => p.result_id === scope.params.get('point'));
  const selected = explicitSelected ?? latestWorst;
  function selectPoint(point: EqaSeriesView['points'][number]) {
    scope.select({ testId, roundId: point.round_id, resultId: point.result_id, sample: point.sample }, { programId });
  }
  const searchKey = normalizeSearchText(search);
  // Kết quả nặng nhất ở đợt mới nhất của năm cho từng xét nghiệm trong danh sách.
  const worstOf = (r: EqaInstrumentGridRow) => {
    const lastRoundId = listRounds.filter((round) => r.cells.some((c) => c.round_id === round.id)).at(-1)?.id;
    return worstEqaResult(r.cells.filter((c) => c.round_id === lastRoundId));
  };
  const list = (grid.data ?? []).filter((r) => normalizeSearchText(`${r.test_name} ${r.unit}`).includes(searchKey));
  // Cửa sổ hẹp: ô chọn có tìm kiếm thay cho danh sách cao 200px chỉ thấy vài dòng;
  // xét nghiệm có cảnh báo hoặc không chấp nhận đứng đầu.
  const assayOptions = (grid.data ?? []).map((r) => {
    const worst = worstOf(r);
    return { value: r.test_id, label: `${r.test_name}${worst ? ` · z ${numText(worst.z)}` : ''}`, keywords: r.unit, flagged: worst?.class === 'warn' || worst?.class === 'rej' };
  });
  const flaggedAssays = assayOptions.filter((o) => o.flagged).map((o) => o.value);
  const ok = points.filter((p) => p.class === 'ok').length;
  const latestSignals = [...new Set(latestRound.flatMap((p) => p.signals))];
  const latestUnsuccessful = latestRound.some((p) => p.unsuccessful);
  const latestHasSignals = latestSignals.length > 0 || latestUnsuccessful;
  const tablePoints = [...points].reverse().filter((p) => filter === 'all' || (filter === 'attention'
    ? p.class !== 'ok' || p.signals.length > 0 || p.unsuccessful || p.within_tea === false
    : p.class === filter));

  return <div className="eqa-test">
    <div className="eqa-round-bar"><button type="button" className="btn ghost sm" onClick={onBack}>← Quay lại</button>
      <div className="eqa-round-title"><h2>{view ? `${view.test_name} · ${view.instrument_name}` : 'Phân tích xét nghiệm'}</h2>{view?.unit && <span className="pill">{view.unit}</span>}</div>
      {/* Phạm vi của chuỗi nằm cùng hàng tiêu đề: hai ô ngắn không cần cả một thẻ. */}
      {view && <div className="eqa-series-scope" role="group" aria-label="Phạm vi chuỗi ngoại kiểm">
        <select id="eqa-series-program" aria-label="Chương trình" title={program ? `${program.program_name} · ${program.rounds} đợt` : undefined} value={seriesProgramId} disabled={programs.length < 2} onChange={(e) => changeProgram(e.target.value)}>
          {!programs.length && <option value="">Chưa có chương trình</option>}
          {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.program_name} · {p.rounds} đợt</option>)}
        </select>
        <select id="eqa-series-span" aria-label="Khoảng xem" value={span === 'all' ? 'all' : String(year)} onChange={(e) => changeSpan(e.target.value)}>
          <option value="all">Toàn bộ lịch sử</option>
          {(spanYears.includes(year) ? spanYears : [year, ...spanYears]).map((y) => <option key={y} value={y}>Năm {y}</option>)}
        </select>
      </div>}
    </div>
    <div ref={layoutRef} className="eqa-analysis-workspace" style={stacked ? undefined : { gridTemplateColumns: `clamp(280px,${listWidth}px,42%) var(--space-2) minmax(0,1fr)` }}>
      <section ref={listRef} className="panel eqa-assay-list" aria-label="Danh sách xét nghiệm"><div className="panel-head"><h2>Xét nghiệm <span className="count">{grid.data?.length ?? 0}</span></h2></div>
        {!stacked && <div className="eqa-assay-search field"><label htmlFor="eqa-assay-search">Tìm xét nghiệm</label><input id="eqa-assay-search" type="search" placeholder="Tên xét nghiệm…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>}
        {grid.error ? <EmptyState size="compact" title="Không tải được danh sách" action={<button className="btn ghost sm" onClick={grid.retry}>Thử lại</button>}>{grid.error}</EmptyState>
          : !grid.data ? <EmptyState size="compact" title="Đang tải danh sách…" />
          : stacked ? <div className="eqa-assay-search field"><label htmlFor="eqa-assay-search">Chọn xét nghiệm</label>
            <SearchSelect id="eqa-assay-search" value={testId} options={assayOptions} suggestedValues={flaggedAssays} onChange={(id) => { if (id && id !== testId) openAssay(id); }} ariaLabel="Chọn xét nghiệm" placeholder="Gõ tên xét nghiệm…" /></div>
          : !list.length ? <EmptyState size="compact" title="Không có xét nghiệm phù hợp" />
          : <div ref={assayItemsRef} className="eqa-assay-items" onScroll={(e) => {
            if (useEqaStore.getState().analysisListScrollTarget === null) setAnalysisListScroll(e.currentTarget.scrollTop);
          }}>{list.map((r) => {
            const worst = worstOf(r);
            return <button type="button" key={r.test_id} data-eqa-test-id={r.test_id} className={`eqa-assay-item${r.test_id === testId ? ' is-selected' : ''}`} aria-pressed={r.test_id === testId}
              onClick={() => openAssay(r.test_id)}>
              <span><b title={r.test_name}>{r.test_name}</b><small>{r.unit || 'Không ghi đơn vị'} · {new Set(r.cells.map((c) => c.round_id)).size} đợt năm {year}</small></span>
              <span className={`eqa-assay-z is-${worst?.class ?? 'none'}`} title={`z nặng nhất ở đợt mới nhất năm ${year}`}>{numText(worst?.z)}</span>
            </button>;
          })}</div>}
      </section>
      <ResizeHandle className="eqa-analysis-resize" targetRef={listRef} label="Độ rộng danh sách xét nghiệm"
        value={listWidth} min={280} max={480} maxNow={listMaxNow} onResize={resizeList} />
      <div className="eqa-analysis-main">
        {result.error ? <section className="panel"><EmptyState title="Không tải được chuỗi ngoại kiểm" action={<button className="btn ghost sm" onClick={result.retry}>Thử lại</button>}>{result.error}</EmptyState></section>
          : view === undefined ? <section className="panel"><EmptyState title="Đang tải chuỗi ngoại kiểm…" /></section>
          : view === null ? <section className="panel"><EmptyState title="Không tìm thấy xét nghiệm" /></section> : <>
        <section className="panel" aria-label="Biểu đồ phân tích xét nghiệm"><div className="panel-head"><div className="eqa-series-chart-heading"><div className="eqa-zmap-heading"><h2>Diễn biến qua các đợt</h2>
          {program && !program.enough && <span className="tag none" title={`Cần ít nhất ${view.min_points} đợt để kết luận về xu hướng. Tín hiệu |z| ≥ ${view.config.z_reject} và không thành công vẫn có hiệu lực.`}>Chưa đủ đợt đánh giá xu hướng · {program.rounds}/{view.min_points}</span>}
          </div><p className="eqa-series-counts">{new Set(points.map((p) => p.round_id)).size} đợt · {points.length} mẫu · Chấp nhận {points.length ? `${ok}/${points.length} (${pctText(ok / points.length * 100)})` : '—'}</p>
          </div>
          <div className="dayseg" role="group" aria-label="Chỉ số biểu đồ"><button type="button" className={mode === 'z' ? 'on' : ''} aria-pressed={mode === 'z'} onClick={() => setMode('z')}>z-score</button><button type="button" className={mode === 'pct' ? 'on' : ''} aria-pressed={mode === 'pct'} onClick={() => setMode('pct')}>% lệch / TEa</button></div>
        </div><div className="eqa-section-body">
          <EqaSeriesChart points={points} selectedId={selected?.result_id} onSelect={selectPoint} mode={mode} config={view.config} unit={view.unit} />
          {latestRound[0] && (program?.enough || latestHasSignals) && <div className="eqa-zmap-legend"><span className="eqa-note">Tín hiệu đợt mới nhất đang xem · {roundLabel(latestRound[0])}:</span>{latestHasSignals ? <TrendTags signals={latestSignals} unsuccessful={latestUnsuccessful} /> : <span className="hint-inline">Không có tín hiệu chuỗi</span>}</div>}
          <details className="eqa-details eqa-series-basis"><summary>Căn cứ đánh giá chuỗi</summary><p className="eqa-note">{mode === 'z' ? `Cảnh báo khi |z| > ${view.config.z_warn}, không chấp nhận khi |z| ≥ ${view.config.z_reject}` : 'Nét đứt: ±TEa của PXN tại từng mẫu; điểm xám: chưa khai TEa'}
            {' · '}{span === 'year' ? `Đang xem năm ${year}; tín hiệu chuỗi vẫn tính trên toàn bộ ${program?.rounds ?? 0} đợt của chương trình` : `Tín hiệu chuỗi tính trên ${program?.rounds ?? 0} đợt của chương trình`}
            {' · '}Ngưỡng điểm J {view.j_limit}.</p></details>
        </div></section>
        <section className="panel" aria-label="Kết quả từng đợt"><div className="panel-head"><h2>Kết quả từng đợt <span className="count">{tablePoints.length}</span></h2>
          <EqaResultFilter value={filter} onChange={setFilter} label="Lọc kết quả từng đợt theo đánh giá" allLabel="Tất cả kết quả" />
        </div>
            <div className="eqa-section-body">{!tablePoints.length ? <EmptyState size="compact" title={filter === 'all' ? 'Chưa có kết quả trong phạm vi này' : 'Không có kết quả phù hợp bộ lọc'} /> : <div className="eqa-table-wrap eqa-results-scroll" tabIndex={0} role="region" aria-label="Vùng cuộn kết quả từng đợt"><table className="eqa-table eqa-center-rest"><thead><tr><th>Đợt / mẫu</th><th>Kết quả<span className="eqa-sub">{view.unit}</span></th><th>Giá trị ấn định<span className="eqa-sub">{view.unit}</span></th><th>z</th><th>Đánh giá</th><th aria-label="Thao tác" /></tr></thead><tbody>
              {tablePoints.map((p) => <tr key={p.result_id} className={p.result_id === selected?.result_id ? 'is-selected' : undefined}>
                <td><button type="button" className="eqa-test-link" aria-pressed={p.result_id === selected?.result_id} onClick={() => selectPoint(p)}>{roundLabel(p)}{p.sample ? ` · ${p.sample}` : ''}</button><span className="eqa-sub">{vnDate(p.report_date, '—')}</span></td>
                <td>{rawNum(p.result)}</td><td>{rawNum(p.assigned)}</td><td>{numText(p.z)}</td><td><ClassTag cls={p.class} /></td><td><button type="button" className="btn ghost sm" onClick={() => onOpenRound(p.round_id, p.result_id)}>Mở đợt báo cáo</button></td>
              </tr>)}
            </tbody></table></div>}</div>
          </section>
        </>}
      </div>
    </div>
  </div>;
}
