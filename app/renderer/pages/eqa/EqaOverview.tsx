// Tổng quan đặt bảng tổng hợp z-score và bằng chứng cạnh nhau; phạm vi đọc theo URL.
import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useAuthStore } from '../../store/auth-store';
import { canWrite } from '../../lib/permissions';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { EqaImportModal } from './EqaImportModal';
import { EqaZMap } from './EqaZMap';
import { ClassTag, numText, roundLabel, RoundStatusTag, TrendTags } from './shared';
import { needsAction } from '../../../main/domain/eqa/schedule';
import { daysLeftText } from './EqaSchedule';
import { EqaScopeControls, useEqaScope, type EqaNavigationContext } from './useEqaScope';
import { useEqaRead, useEqaRevision } from './useEqaRead';
import { EqaResultInspector } from './EqaResultInspector';
import { EqaOverviewSummary } from './EqaOverviewSummary';
import { filterOverviewRows, overviewRoundRows, overviewSelection, type EqaOverviewFilter } from './overview-model';

export function EqaOverview({ onOpen, onOpenSchedule, onOpenTest }: {
  onOpen: (id: string, resultId?: string, context?: EqaNavigationContext) => void; onOpenSchedule: () => void;
  onOpenTest: (testId: string, context?: EqaNavigationContext) => void;
}) {
  const { rounds, schedule, loaded, error, load, instrumentGrid } = useEqaStore(useShallow((s) => ({
    rounds: s.rounds, schedule: s.schedule, loaded: s.loaded, error: s.error, load: s.load, instrumentGrid: s.instrumentGrid,
  })));
  const scope = useEqaScope();
  const [, setParams] = useSearchParams();
  const { year, programId, instrumentId } = scope;
  const revision = useEqaRevision();
  const read = useCallback(() => programId && instrumentId ? instrumentGrid(programId, year, instrumentId) : Promise.resolve([]), [instrumentGrid, programId, year, instrumentId]);
  const grid = useEqaRead(`${programId}:${year}:${instrumentId}:${revision}`, read);
  const readAttention = useCallback(() => programId && instrumentId ? window.qcApi.listEqaAttention({ programId, year, instrumentId }) : Promise.resolve([]), [programId, year, instrumentId]);
  const attentionView = useEqaRead(`${programId}:${year}:${instrumentId}:${revision}`, readAttention);
  const attentionRef = useRef<HTMLElement>(null);
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const [importing, setImporting] = useState(false);
  const requestedCancelled = scope.params.get('roundCancelled') === '1';
  // Checkbox phản hồi ngay khi bấm, đồng thời nhận lại giá trị khi URL đổi.
  const [cancelledState, setCancelledState] = useState({ requested: requestedCancelled, value: requestedCancelled });
  if (cancelledState.requested !== requestedCancelled) setCancelledState({ requested: requestedCancelled, value: requestedCancelled });
  const showCancelled = cancelledState.requested === requestedCancelled ? cancelledState.value : requestedCancelled;
  const scopeKey = `${programId}:${year}:${instrumentId}`;
  const [filterState, setFilterState] = useState<{ key: string; value: EqaOverviewFilter }>({ key: scopeKey, value: 'all' });
  // Ghi nhận cả phạm vi mới để quay về phạm vi cũ không khôi phục bộ lọc đã bỏ.
  if (filterState.key !== scopeKey) setFilterState({ key: scopeKey, value: 'all' });
  const filter = filterState.key === scopeKey ? filterState.value : 'all';
  const dueRows = schedule.filter(needsAction);
  const rows = grid.data ?? [];
  const unavailable = !loaded || !!error || !!grid.error || grid.data === undefined;
  const selected = unavailable ? undefined : overviewSelection(rows, scope.rounds, scope.params);
  const filteredRows = filterOverviewRows(rows, filter);
  function changeFilter(value: EqaOverviewFilter) {
    setFilterState({ key: scopeKey, value });
    if (selected) scope.clearSelection();
  }
  const requestedRoundMachine = scope.params.get('roundMachine') ?? '';
  const roundMachine = scope.machines.some((machine) => machine.id === requestedRoundMachine) ? requestedRoundMachine : '';
  const roundOptions = rounds.filter((round) => round.year === year && round.program_id === programId && (showCancelled || round.status === 'open'));
  const requestedRound = scope.params.get('roundFilter') ?? '';
  const roundFilter = roundOptions.some((round) => round.id === requestedRound) ? requestedRound : '';
  function changeRoundFilter(key: 'roundFilter' | 'roundMachine' | 'roundCancelled', value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      // Khi ẩn các đợt đã huỷ, không giữ một đợt đã huỷ trong bộ lọc ẩn.
      if (key === 'roundCancelled' && !value && rounds.some((round) => round.id === next.get('roundFilter') && round.status === 'cancelled')) next.delete('roundFilter');
      return next;
    }, { replace: true });
  }
  const machineRounds = overviewRoundRows(rounds, year, programId, roundMachine);
  const visible = machineRounds.filter(({ round }) => (showCancelled || round.status === 'open') && (!roundFilter || round.id === roundFilter));
  const cancelledCount = machineRounds.filter(({ round }) => round.status !== 'open').length;
  const openScopedRound = (id: string, resultId?: string) => onOpen(id, resultId, scope.context);
  const scopedAttention = attentionView.data ?? [];
  const chainAttention = scopedAttention.filter((item) => item.latest.unsuccessful || item.latest.signals.some((signal) => signal !== 'reject'));
  const chainUnsuccessful = chainAttention.filter((item) => item.latest.unsuccessful).length;
  const actionTone = dueRows.some((r) => r.status === 'overdue') ? 'rej' : 'warn';

  return <div className="eqa-overview">
    <EqaScopeControls scope={scope} action={writable && <button type="button" className="btn" onClick={() => setImporting(true)}>Nhập báo cáo PDF</button>} />
    {loaded && !error && dueRows.length > 0 && <div className={`alert ${actionTone} eqa-action-alert`} role="status">
      <b>Việc cần xử lý</b>
      <ul className="eqa-action-list">
        <li><span>{dueRows.length} lịch cần nộp: {dueRows.slice(0, 2).map((r) => `${r.program_name} ${r.round}/${r.year}${r.sample_type ? ` · ${r.sample_type}` : ''} (${daysLeftText(r).toLowerCase()})`).join('; ')}{dueRows.length > 2 ? '; …' : ''}</span>
          <button type="button" className="btn ghost sm" onClick={onOpenSchedule}>Mở lịch</button></li>
      </ul>
    </div>}
    <EqaOverviewSummary rows={rows} rounds={scope.rounds} loading={!grid.data || !loaded} failed={!!grid.error || !!error}
      filter={filter} onFilter={changeFilter} />
    <div className={`eqa-review-workspace${selected ? '' : ' is-empty'}`}>
      <section className="panel eqa-zmap-panel" aria-label="Bảng tổng hợp z-score">
        <div className="panel-head"><div className="eqa-zmap-heading"><h2>Bảng tổng hợp z-score <span className="count">{unavailable ? '—' : filter === 'all' ? rows.length : `${filteredRows.length}/${rows.length}`}</span></h2>
          {!unavailable && chainAttention.length > 0 && <button type="button" className="tag warn"
            title={`Tín hiệu ở đợt mới nhất trong phạm vi, đánh giá trên toàn bộ lịch sử chương trình.${chainUnsuccessful ? ` ${chainUnsuccessful} xét nghiệm không thành công.` : ''} Xem chi tiết tín hiệu.`}
            onClick={() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{chainAttention.length} xét nghiệm cần xem xét chuỗi</button>}
          </div>
          <select className="eqa-map-filter" aria-label="Lọc xét nghiệm trong bảng tổng hợp z-score" value={filter} onChange={(event) => changeFilter(event.target.value as EqaOverviewFilter)}>
            <option value="all">Tất cả xét nghiệm</option><option value="attention">Có cảnh báo / không chấp nhận</option>
            <option value="rej">Có kết quả không chấp nhận</option><option value="warn">Có kết quả cảnh báo</option><option value="ok">Có kết quả chấp nhận</option>
          </select>
        </div>
        <div className="eqa-section-body">
          {error ? <EmptyState title="Không tải được ngoại kiểm" action={<button className="btn ghost sm" onClick={() => void load()}>Thử lại</button>}>{error}</EmptyState>
            : grid.error ? <EmptyState title="Không tải được bảng tổng hợp z-score" action={<button className="btn ghost sm" onClick={grid.retry}>Thử lại</button>}>{grid.error}</EmptyState>
            : grid.data === undefined || !loaded ? <EmptyState title="Đang tải bảng tổng hợp z-score…" />
            : filter !== 'all' && !filteredRows.length ? <EmptyState size="compact" title="Không có xét nghiệm phù hợp bộ lọc" action={<button className="btn ghost sm" onClick={() => changeFilter('all')}>Hiện tất cả</button>} />
            : <EqaZMap rounds={scope.rounds} rows={grid.data} visibleRows={filteredRows} selected={selected} onSelect={scope.select} onOpenTest={(id) => onOpenTest(id, scope.context)} />}
          <ul className="qc-legend eqa-zmap-key" aria-label="Chú giải bảng tổng hợp z-score">
            <li><span className="eqa-zswatch is-ok" aria-hidden="true" />Chấp nhận</li>
            <li><span className="eqa-zswatch is-warn" aria-hidden="true" />Cảnh báo</li>
            <li><span className="eqa-zswatch is-rej" aria-hidden="true" />Không chấp nhận</li>
            <li>— Chưa có kết quả</li>
          </ul>
        </div>
      </section>
      {selected && <EqaResultInspector selection={selected} onOpenRound={openScopedRound} onClose={scope.clearSelection} onOpenTest={() => onOpenTest(selected.testId, { ...scope.context, resultId: selected.resultId, roundId: selected.roundId })} />}
    </div>
    {loaded && !error && rounds.length > 0 && <section ref={attentionRef} className="panel eqa-attention-panel" aria-label="Xét nghiệm cần chú ý">
      <div className="panel-head"><h2>Tín hiệu ở đợt mới nhất <span className="count">{attentionView.data === undefined ? '—' : scopedAttention.length}</span></h2></div>
      <div className="eqa-section-body">
        {attentionView.error ? <EmptyState size="compact" title="Không tải được tín hiệu chuỗi" action={<button className="btn ghost sm" onClick={attentionView.retry}>Thử lại</button>}>{attentionView.error}</EmptyState>
          : attentionView.data === undefined ? <EmptyState size="compact" title="Đang tải tín hiệu chuỗi…" />
          : !scopedAttention.length ? <EmptyState size="compact" title="Không có tín hiệu ở đợt mới nhất của phạm vi này">Đánh giá trên lịch sử cùng chương trình của máy đang chọn.</EmptyState>
          : <>
            <p className="eqa-note">Tín hiệu của đợt mới nhất trong phạm vi, đánh giá trên lịch sử cùng chương trình. Chưa phải kết luận nguyên nhân hay trạng thái xử lý.</p>
            <div className="eqa-table-wrap"><table className="eqa-table"><thead><tr><th>Xét nghiệm</th><th>Đợt / mẫu</th><th className="eqa-center">z</th><th className="eqa-center">Đánh giá</th><th className="eqa-center">Tín hiệu</th><th aria-label="Thao tác" /></tr></thead><tbody>
              {scopedAttention.map((a) => <tr key={`${a.test_id}|${a.latest.program_id}`}><td><b>{a.test_name}</b></td><td>{roundLabel(a.latest)}{a.latest.sample && <span className="eqa-sub">Mẫu {a.latest.sample}</span>}</td><td className="eqa-center">{numText(a.latest.z)}</td><td className="eqa-center"><ClassTag cls={a.latest.class} /></td><td className="eqa-center"><TrendTags signals={a.latest.signals} unsuccessful={a.latest.unsuccessful} /></td><td><button className="btn ghost sm" onClick={() => onOpenTest(a.test_id, scope.context)}>Phân tích</button></td></tr>)}
            </tbody></table></div>
          </>}
      </div>
    </section>}
    <section className="panel" aria-label="Danh sách đợt ngoại kiểm"><div className="panel-head"><h2>Đợt báo cáo <span className="count">{!loaded || error ? '—' : visible.length}</span></h2>
      <div className="eqa-filters">
        {cancelledCount > 0 && <label className="eqa-toggle"><input type="checkbox" checked={showCancelled} onChange={(e) => {
          const value = e.target.checked;
          setCancelledState({ requested: requestedCancelled, value });
          changeRoundFilter('roundCancelled', value ? '1' : '');
        }} />Hiện đợt đã huỷ</label>}
        <select className="eqa-round-list-filter" aria-label="Lọc đợt trong danh sách đợt báo cáo" value={roundFilter} onChange={(event) => changeRoundFilter('roundFilter', event.target.value)}>
          <option value="">Tất cả đợt</option>
          {roundOptions.map((round) => <option key={round.id} value={round.id}>{roundLabel(round)}{round.status === 'cancelled' ? ' · Đã huỷ' : ''}</option>)}
        </select>
        <select className="eqa-round-list-filter" aria-label="Lọc máy trong danh sách đợt báo cáo" value={roundMachine} onChange={(event) => changeRoundFilter('roundMachine', event.target.value)}>
          <option value="">Tất cả máy</option>
          {scope.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
        </select>
      </div>
    </div><div className="eqa-section-body">
      {error ? <EmptyState size="compact" title="Không tải được danh sách đợt" action={<button className="btn ghost sm" onClick={() => void load()}>Thử lại</button>}>{error}</EmptyState>
        : !loaded ? <EmptyState size="compact" title="Đang tải danh sách đợt…" />
        : !visible.length ? <EmptyState title={rounds.length ? 'Chưa có đợt ngoại kiểm trong phạm vi này' : 'Chưa có đợt ngoại kiểm nào'} action={writable ? <button className="btn sm" onClick={() => setImporting(true)}>Nhập báo cáo PDF</button> : undefined}>Nhập báo cáo của trung tâm để bắt đầu đối chiếu.</EmptyState>
        : <div className="eqa-table-wrap"><table className="eqa-table eqa-center-rest"><thead><tr><th>Chương trình / đợt</th><th>Máy</th><th>Kết quả</th><th>Chấp nhận</th><th>Cảnh báo</th><th>Không chấp nhận</th><th>Ngày báo cáo</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead><tbody>
          {visible.map(({ round: r, instrument: i }) => <tr key={`${r.id}:${i.instrument_id}`}><td><b className="eqa-strong">{roundLabel(r)}</b><span className="eqa-sub">{r.program_name}</span></td><td className="eqa-wrap">{i.instrument_name}</td><td>{i.total}</td><td>{i.ok}</td><td>{i.warn}</td><td>{i.rej}</td><td>{vnDate(r.report_date, '—')}</td><td><RoundStatusTag status={r.status} /></td><td><button className="btn ghost sm" onClick={() => onOpen(r.id, undefined, { year, programId, instrumentId: i.instrument_id })}>Xem</button></td></tr>)}
        </tbody></table></div>}
    </div></section>
    {importing && <EqaImportModal onClose={() => setImporting(false)} onImported={(id) => { setImporting(false); onOpen(id); }} />}
  </div>;
}
