// Tổng quan đặt bản đồ z và bằng chứng cạnh nhau; phạm vi đọc theo URL.
import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useAuthStore } from '../../store/auth-store';
import { canWrite } from '../../lib/permissions';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { EqaImportModal } from './EqaImportModal';
import { EqaZMap } from './EqaZMap';
import { ClassTag, numText, roundLabel, RoundStatusTag, StatCard, TrendTags, worstEqaResult } from './shared';
import { needsAction } from '../../../main/domain/eqa/schedule';
import { daysLeftText } from './EqaSchedule';
import { EqaScopeControls, useEqaScope, type EqaNavigationContext, type EqaSelection } from './useEqaScope';
import { useEqaRead, useEqaRevision } from './useEqaRead';
import { EqaResultInspector } from './EqaResultInspector';

export function EqaOverview({ onOpen, onOpenSchedule, onOpenTest }: {
  onOpen: (id: string, resultId?: string) => void; onOpenSchedule: () => void;
  onOpenTest: (testId: string, context?: EqaNavigationContext) => void;
}) {
  const { rounds, schedule, loaded, error, load, instrumentGrid } = useEqaStore(useShallow((s) => ({
    rounds: s.rounds, schedule: s.schedule, loaded: s.loaded, error: s.error, load: s.load, instrumentGrid: s.instrumentGrid,
  })));
  const scope = useEqaScope();
  const { year, programId, instrumentId } = scope;
  const revision = useEqaRevision();
  const read = useCallback(() => programId && instrumentId ? instrumentGrid(programId, year, instrumentId) : Promise.resolve([]), [instrumentGrid, programId, year, instrumentId]);
  const grid = useEqaRead(`${programId}:${year}:${instrumentId}:${revision}`, read);
  const readAttention = useCallback(() => programId && instrumentId ? window.qcApi.listEqaAttention({ programId, year, instrumentId }) : Promise.resolve([]), [programId, year, instrumentId]);
  const attentionView = useEqaRead(`${programId}:${year}:${instrumentId}:${revision}`, readAttention);
  // Toàn bộ máy và chương trình: tín hiệu ngoài phạm vi đang xem vẫn phải lộ
  // ra, vì N-09 bắt buộc điều tra dù người dùng đang xem máy khác.
  const readAllAttention = useCallback(() => window.qcApi.listEqaAttention(), []);
  const allAttention = useEqaRead(`all:${revision}`, readAllAttention);
  const attentionRef = useRef<HTMLElement>(null);
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const [importing, setImporting] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const dueRows = schedule.filter(needsAction);
  const cells = (grid.data ?? []).flatMap((r) => r.cells);
  const totals = { total: cells.length, warn: cells.filter((c) => c.class === 'warn').length, rej: cells.filter((c) => c.class === 'rej').length };
  const selectedRow = grid.data?.find((r) => r.test_id === scope.params.get('assay'));
  const selectedCell = selectedRow?.cells.find((c) => c.result_id === scope.params.get('point'));
  const fallbackCell = worstEqaResult(grid.data?.flatMap((r) => r.cells) ?? []);
  const fallbackRow = fallbackCell ? grid.data?.find((r) => r.cells.some((c) => c.result_id === fallbackCell.result_id)) : undefined;
  const selected: EqaSelection | undefined = selectedRow && scope.rounds.some((r) => r.id === scope.params.get('round'))
    ? { testId: selectedRow.test_id, roundId: scope.params.get('round')!, resultId: selectedCell?.result_id, sample: selectedCell?.sample ?? scope.params.get('sample') ?? '' }
    : fallbackRow && fallbackCell ? { testId: fallbackRow.test_id, roundId: fallbackCell.round_id, resultId: fallbackCell.result_id, sample: fallbackCell.sample } : undefined;
  const visible = rounds.filter((r) => r.year === year && r.program_id === programId && (showCancelled || r.status === 'open'));
  const cancelledCount = rounds.filter((r) => r.year === year && r.program_id === programId && r.status !== 'open').length;
  const scopedAttention = attentionView.data ?? [];
  // Mỗi dòng là một xét nghiệm trong một chương trình; dòng thuộc phạm vi đang
  // xem đã có ở bảng trên, kể cả khi năm đang xem không phải năm mới nhất.
  const scopedKeys = new Set(scopedAttention.map((a) => `${a.test_id}|${a.latest.round_id}`));
  const otherAttention = (allAttention.data ?? []).filter((a) => !scopedKeys.has(`${a.test_id}|${a.latest.round_id}`)
    && !(a.instrument_id === instrumentId && a.latest.program_id === programId && a.latest.year === year));
  const otherUnsuccessful = otherAttention.filter((a) => a.latest.unsuccessful).length;
  // Một khối việc cần xử lý thay cho nhiều dải báo rời; màu theo việc nặng nhất.
  const actionTone = dueRows.some((r) => r.status === 'overdue') || otherUnsuccessful || otherAttention.some((a) => a.latest.class === 'rej') ? 'rej' : 'warn';

  return <div className="eqa-overview">
    <div className="eqa-intro"><div><h2>Hiệu năng ngoại kiểm</h2><p>Rà soát theo xét nghiệm, đối chiếu từng mẫu và theo dõi qua các đợt.</p></div>
      {writable && <button type="button" className="btn" onClick={() => setImporting(true)}>Nhập báo cáo PDF</button>}
    </div>
    {(dueRows.length > 0 || otherAttention.length > 0) && <div className={`alert ${actionTone} eqa-action-alert`} role="status">
      <b>Việc cần xử lý</b>
      <ul className="eqa-action-list">
        {dueRows.length > 0 && <li><span>{dueRows.length} đợt cần nộp: {dueRows.slice(0, 2).map((r) => `${r.program_name} ${r.round}/${r.year} (${daysLeftText(r).toLowerCase()})`).join('; ')}{dueRows.length > 2 ? '; …' : ''}</span>
          <button type="button" className="btn ghost sm" onClick={onOpenSchedule}>Mở lịch</button></li>}
        {otherAttention.length > 0 && <li><span>{otherAttention.length} xét nghiệm có tín hiệu ở máy, chương trình hoặc năm khác{otherUnsuccessful ? `, trong đó ${otherUnsuccessful} không thành công` : ''}.</span>
          <button type="button" className="btn ghost sm" onClick={() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Xem danh sách</button></li>}
      </ul>
    </div>}
    <EqaScopeControls scope={scope} />
    <div className="eqa-stats">
      <StatCard tone="info" label="Đợt trong phạm vi" value={scope.rounds.length} detail={`${year} · ${scope.machines.find((m) => m.id === instrumentId)?.name ?? 'Chưa có máy'}`} />
      <StatCard tone="neutral" label="Kết quả đã nhập" value={grid.data ? totals.total : '—'} detail={`${grid.data?.length ?? 0} xét nghiệm`} />
      <StatCard tone="warning" label="Cảnh báo" value={grid.data ? totals.warn : '—'} detail="Theo đánh giá từng mẫu" />
      <StatCard tone="danger" label="Không chấp nhận" value={grid.data ? totals.rej : '—'} detail="Cần xem xét và điều tra" />
    </div>
    <div className={`eqa-review-workspace${selected ? '' : ' is-empty'}`}>
      <section className="panel eqa-zmap-panel" aria-label="Bản đồ z">
        <div className="panel-head"><h2>Bản đồ z <span className="count">{grid.data?.length ?? 0}</span></h2></div>
        <div className="eqa-section-body">
          {error ? <EmptyState title="Không tải được ngoại kiểm" action={<button className="btn ghost sm" onClick={() => void load()}>Thử lại</button>}>{error}</EmptyState>
            : grid.error ? <EmptyState title="Không tải được bản đồ z" action={<button className="btn ghost sm" onClick={grid.retry}>Thử lại</button>}>{grid.error}</EmptyState>
            : grid.data === undefined || !loaded ? <EmptyState title="Đang tải bản đồ z…" />
            : <EqaZMap rounds={scope.rounds} rows={grid.data} selected={selected} onSelect={scope.select} onOpenTest={(id) => onOpenTest(id, scope.context)} />}
          <ul className="qc-legend eqa-zmap-key" aria-label="Chú giải bản đồ z">
            <li><span className="eqa-zswatch is-ok" aria-hidden="true" />Chấp nhận</li>
            <li><span className="eqa-zswatch is-warn" aria-hidden="true" />Cảnh báo</li>
            <li><span className="eqa-zswatch is-rej" aria-hidden="true" />Không chấp nhận</li>
            <li>— Chưa có kết quả</li>
          </ul>
        </div>
      </section>
      {selected ? <EqaResultInspector selection={selected} onOpenRound={onOpen} onOpenTest={() => onOpenTest(selected.testId, { ...scope.context, resultId: selected.resultId, roundId: selected.roundId })} />
        : <section className="panel eqa-inspector eqa-inspector-empty" aria-label="Chi tiết kết quả">
          <div className="panel-head"><h2>Chi tiết kết quả</h2></div>
          <div className="eqa-section-body"><EmptyState size="compact" title="Chưa chọn kết quả">Chọn một ô trên bản đồ để xem chi tiết mẫu và nguồn báo cáo.</EmptyState></div>
        </section>}
    </div>
    {rounds.length > 0 && <section ref={attentionRef} className="panel eqa-attention-panel" aria-label="Xét nghiệm cần chú ý">
      <div className="panel-head"><h2>Tín hiệu ở đợt mới nhất <span className="count">{scopedAttention.length}</span></h2></div>
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
        {allAttention.error ? <EmptyState size="compact" title="Không tải được tín hiệu của máy và chương trình khác" action={<button className="btn ghost sm" onClick={allAttention.retry}>Thử lại</button>}>{allAttention.error}</EmptyState>
          : otherAttention.length > 0 && <>
            <h3 className="eqa-subhead">Ngoài phạm vi đang xem <span className="count">{otherAttention.length}</span></h3>
            <div className="eqa-table-wrap"><table className="eqa-table"><thead><tr><th>Xét nghiệm</th><th>Máy</th><th>Chương trình / đợt</th><th className="eqa-center">z</th><th className="eqa-center">Đánh giá</th><th className="eqa-center">Tín hiệu</th><th aria-label="Thao tác" /></tr></thead><tbody>
              {otherAttention.map((a) => <tr key={`${a.test_id}|${a.latest.program_id}`}><td><b>{a.test_name}</b></td><td>{a.instrument_name}</td><td>{roundLabel(a.latest)}<span className="eqa-sub">{a.latest.program_name}{a.latest.sample ? ` · ${a.latest.sample}` : ''}</span></td><td className="eqa-center">{numText(a.latest.z)}</td><td className="eqa-center"><ClassTag cls={a.latest.class} /></td><td className="eqa-center"><TrendTags signals={a.latest.signals} unsuccessful={a.latest.unsuccessful} /></td>
                <td><button className="btn ghost sm" onClick={() => onOpenTest(a.test_id, { year: a.latest.year, programId: a.latest.program_id, instrumentId: a.instrument_id, roundId: a.latest.round_id })}>Phân tích</button></td></tr>)}
            </tbody></table></div>
          </>}
      </div>
    </section>}
    <section className="panel" aria-label="Danh sách kỳ ngoại kiểm"><div className="panel-head"><h2>Kỳ báo cáo <span className="count">{visible.length}</span></h2>
      {cancelledCount > 0 && <label className="eqa-toggle"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />Hiện kỳ đã huỷ</label>}
    </div><div className="eqa-section-body">
      {!loaded ? <EmptyState size="compact" title="Đang tải danh sách kỳ…" />
        : !visible.length ? <EmptyState title={rounds.length ? 'Chưa có kỳ ngoại kiểm trong phạm vi này' : 'Chưa có kỳ ngoại kiểm nào'} action={writable ? <button className="btn sm" onClick={() => setImporting(true)}>Nhập báo cáo PDF</button> : undefined}>Nhập báo cáo của trung tâm để bắt đầu đối chiếu.</EmptyState>
        : <div className="eqa-table-wrap"><table className="eqa-table eqa-center-rest"><thead><tr><th>Chương trình / đợt</th><th>Máy</th><th>Kết quả</th><th>Chấp nhận</th><th>Cảnh báo</th><th>Không CN</th><th>Ngày báo cáo</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead><tbody>
          {visible.map((r) => <tr key={r.id}><td><b className="eqa-strong">{roundLabel(r)}</b><span className="eqa-sub">{r.program_name}</span></td><td className="eqa-wrap">{r.instruments.join(', ') || '—'}</td><td>{r.total}</td><td>{r.ok}</td><td>{r.warn}</td><td>{r.rej}</td><td>{vnDate(r.report_date, '—')}</td><td><RoundStatusTag status={r.status} /></td><td><button className="btn ghost sm" onClick={() => onOpen(r.id)}>Xem</button></td></tr>)}
        </tbody></table></div>}
      <p className="eqa-note">Số liệu kỳ báo cáo gồm tất cả máy trong kỳ; bản đồ phía trên theo máy đang chọn.</p>
    </div></section>
    {importing && <EqaImportModal onClose={() => setImporting(false)} onImported={(id) => { setImporting(false); onOpen(id); }} />}
  </div>;
}
