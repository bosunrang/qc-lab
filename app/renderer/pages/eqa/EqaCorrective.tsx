import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { EqaNceEvidence } from '../../../shared/qc-api';
import { canUserAccessPage, canWriteRole } from '../../../main/domain/page-roles';
import { useAuthStore } from '../../store/auth-store';
import { useNceStore } from '../../store/nce-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { nceStatusBadge } from '../../lib/nce-labels';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { ResizeHandle, useStoredWidth } from '../../components/ResizeHandle';
import { CreateNceModal } from '../actions/CreateNceModal';
import { DossierPage } from '../actions/DossierPage';
import { EqaCorrectiveEvidence } from './EqaCorrectiveEvidence';
import { nceSearchText } from '../actions/workflow';
import { useEqaRead, useEqaRevision } from './useEqaRead';
import { useEqaScope } from './useEqaScope';
import { useEqaPanelHeight } from './useEqaPanelHeight';
import { ClassTag, numText } from './shared';

type Filter = 'pending' | 'required' | 'ongoing' | 'closed' | 'warning' | 'all';
const EVIDENCE_MIN_WIDTH = 340, EVIDENCE_MAX_WIDTH = 640, LIST_MIN_WIDTH = 480;
export function EqaCorrective() {
  const scope = useEqaScope();
  const revision = useEqaRevision();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canManage = canWriteRole(user?.role) && canUserAccessPage('actions', user);
  const loadNce = useNceStore(s => s.load);
  const nceError = useNceStore(s => s.error);
  // Đợt/máy trên URL có thể thuộc chương trình khác (mang sang từ tab Báo cáo)
  // hoặc đã bị huỷ: bỏ qua để ô chọn và danh sách cùng một phạm vi.
  const requestedRound = params.get('fixRound') || '', requestedMachine = params.get('fixMachine') || '';
  const roundId = scope.rounds.some(r => r.id === requestedRound) ? requestedRound : '';
  const instrumentId = scope.machines.some(i => i.id === requestedMachine) ? requestedMachine : '';
  const scopeKey = JSON.stringify([scope.programId, scope.year, roundId, instrumentId]);
  const read = useCallback(() => scope.programId ? window.qcApi.listEqaCorrective({ programId: scope.programId, year: scope.year,
    ...(roundId ? { roundId } : {}), ...(instrumentId ? { instrumentId } : {}) }) : Promise.resolve([]), [scope.programId, scope.year, roundId, instrumentId]);
  const view = useEqaRead(`${scopeKey}:${revision}`, read);
  useStoreInvalidation(['nce_records', 'nce_actions', 'nce_decisions', 'qc_points', 'tests', 'instruments', 'eqa_schedule'], undefined, view.retry);
  useEffect(() => { if (canManage) void loadNce(); }, [canManage, loadNce]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const listPanelRef = useRef<HTMLElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLElement>(null);
  const listMaxHeight = useEqaPanelHeight(listPanelRef, view.data !== undefined && !view.error && !(params.get('case') && canManage));
  useEffect(() => { listScrollRef.current?.scrollTo({ top: 0 }); }, [scopeKey, filter, query]);
  const [storedEvidenceWidth, setEvidenceWidth] = useStoredWidth('qclab.eqaCorrectiveEvidenceWidth', 420);
  const evidenceWidth = Math.max(EVIDENCE_MIN_WIDTH, Math.min(EVIDENCE_MAX_WIDTH, storedEvidenceWidth ?? 420));
  const evidenceMaxNow = () => {
    const layout = workspaceRef.current;
    if (!layout) return EVIDENCE_MAX_WIDTH;
    const style = getComputedStyle(layout);
    const gutter = (parseFloat(style.columnGap) || 0) * 2 + (parseFloat(style.getPropertyValue('--space-2')) || 0);
    return Math.max(EVIDENCE_MIN_WIDTH, Math.min(EVIDENCE_MAX_WIDTH, layout.clientWidth - LIST_MIN_WIDTH - gutter));
  };
  function resizeEvidence(width: number) {
    setEvidenceWidth(Math.round(Math.max(EVIDENCE_MIN_WIDTH, Math.min(width, evidenceMaxNow()))));
  }
  const [creating, setCreating] = useState<EqaNceEvidence | null>(null);
  const rows = view.data || [];
  const keyOf = (r: typeof rows[number]) => r.record?.id || r.result.id;
  const counts = { required: rows.filter(r => r.required && !r.record).length, ongoing: rows.filter(r => r.record && r.record.status !== 'closed').length,
    closed: rows.filter(r => r.record?.status === 'closed').length, warning: rows.filter(r => !r.required && !r.record).length };
  const filtered = rows.filter(r => (filter === 'all' || (filter === 'required' ? r.required && !r.record : filter === 'ongoing' ? r.record && r.record.status !== 'closed'
    : filter === 'closed' ? r.record?.status === 'closed' : filter === 'warning' ? !r.required && !r.record : r.record?.status !== 'closed'))
    && nceSearchText(`${r.result.test_name} ${r.result.instrument_name} ${r.round.round} ${r.record?.nce_id || ''} ${r.record?.owner_name || ''}`).includes(nceSearchText(query)));
  const selected = selection?.scope === scopeKey ? filtered.find(r => keyOf(r) === selection.id) : undefined;
  function showEvidence(id: string, trigger: HTMLButtonElement) {
    evidenceTrigger.current = trigger;
    setSelection({ scope: scopeKey, id });
  }
  function closeEvidence() {
    setSelection(null);
    evidenceTrigger.current?.focus();
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params); next.set('view', 'khacphuc'); next.set(key, value); next.delete('case');
    if (key === 'year' || key === 'program') { next.delete('fixRound'); next.delete('fixMachine'); }
    // Đổi phạm vi thay mục lịch sử như Tổng quan, để Quay lại không đi qua từng lần chọn.
    setSelection(null); setParams(next, { replace: true });
  }
  function openCase(id: string) { const next = new URLSearchParams(params); next.set('case', id); setParams(next); }
  const caseId = params.get('case');
  if (caseId && canManage) return <div className="nce-page eqa-corrective-dossier"><DossierPage key={caseId} id={caseId} onBack={() => {
    // Hồ sơ mở từ danh sách thì quay lại đúng mục lịch sử đó; mở thẳng bằng đường dẫn thì về danh sách.
    if (location.key !== 'default') navigate(-1);
    else { const next = new URLSearchParams(params); next.delete('case'); setParams(next, { replace: true }); }
    view.retry();
  }} /></div>;

  return <div className="eqa-corrective">
    <div className="eqa-scope-controls" role="group" aria-label="Phạm vi khắc phục ngoại kiểm">
      <div className="field"><label htmlFor="eqa-fix-year">Năm</label><select id="eqa-fix-year" value={scope.year} onChange={e => change('year', e.target.value)}>{(scope.years.length ? scope.years : [scope.year]).map(y => <option key={y}>{y}</option>)}</select></div>
      <div className="field eqa-scope-program"><label htmlFor="eqa-fix-program">Chương trình</label><select id="eqa-fix-program" value={scope.programId} onChange={e => change('program', e.target.value)}>{!scope.programs.length && <option value="">Chưa có chương trình</option>}{scope.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field eqa-scope-machine"><label htmlFor="eqa-fix-round">Đợt</label><select id="eqa-fix-round" value={roundId} onChange={e => change('fixRound', e.target.value)}><option value="">Tất cả đợt</option>{scope.rounds.map(r => <option key={r.id} value={r.id}>{r.round}/{r.year}</option>)}</select></div>
      <div className="field eqa-scope-machine"><label htmlFor="eqa-fix-machine">Máy xét nghiệm</label><select id="eqa-fix-machine" value={instrumentId} onChange={e => change('fixMachine', e.target.value)}><option value="">Tất cả máy</option>{scope.machines.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
    </div>
    {view.error ? <EmptyState title="Không tải được danh sách khắc phục" action={<button className="btn ghost" onClick={view.retry}>Thử lại</button>}>{view.error}</EmptyState>
      : view.data === undefined ? <EmptyState title="Đang tổng hợp kết quả cần xem xét…" /> : <>
        {/* Cùng kiểu thẻ với trang Khắc phục sự cố; bấm thẻ để lọc danh sách. */}
        <div className="nce-summary eqa-corrective-summary" role="group" aria-label="Tổng hợp khắc phục ngoại kiểm">{([
          ['required', 'danger', 'Cần lập hồ sơ', counts.required, 'Bắt buộc điều tra, chưa có hồ sơ'],
          ['ongoing', 'warning', 'Đang xử lý', counts.ongoing, 'Hồ sơ chưa đóng'],
          ['closed', 'success', 'Đã đóng', counts.closed, 'Hồ sơ đã duyệt đóng'],
          ['warning', 'info', 'Cảnh báo chưa lập hồ sơ', counts.warning, 'Cảnh báo đơn lẻ, ghi nhận khi xem xét đợt'],
        ] as const).map(([value, tone, label, count, detail]) => <button type="button" key={value}
          className={`nce-summary-card is-${tone}${value === 'required' && count > 0 ? ' is-urgent' : ''}${filter === value ? ' is-active' : ''}`}
          aria-pressed={filter === value} onClick={() => setFilter(filter === value ? 'pending' : value)}>
          <span>{label}</span><b>{count}</b><small>{detail}</small>
        </button>)}</div>
        {!canManage && <p className="eqa-note">Bạn có thể xem danh sách và căn cứ ngoại kiểm. Lập hoặc mở hồ sơ cần quyền ghi và quyền dùng phần Khắc phục sự cố.</p>}
        {nceError && canManage && <div className="alert rej" role="alert">{nceError}<button className="btn ghost sm" onClick={() => void loadNce()}>Thử tải thông tin hồ sơ</button></div>}
        <div ref={workspaceRef} className={`eqa-corrective-workspace${selected ? ' has-evidence' : ''}`} style={{ '--eqa-evidence-width': `${evidenceWidth}px` } as CSSProperties}>
          <section ref={listPanelRef} className="panel eqa-corrective-list" aria-label="Danh sách khắc phục ngoại kiểm" style={listMaxHeight === undefined ? undefined : { maxHeight: listMaxHeight }}>
            <div className="panel-head"><h2>Kết quả &amp; hồ sơ khắc phục</h2><span className="tag none">{filtered.length}</span></div>
            <div className="eqa-corrective-toolbar"><select aria-label="Trạng thái khắc phục" value={filter} onChange={e => setFilter(e.target.value as Filter)}><option value="pending">Chưa hoàn tất</option><option value="required">Cần lập hồ sơ</option><option value="ongoing">Đang xử lý</option><option value="closed">Đã đóng</option><option value="warning">Cảnh báo chưa lập hồ sơ</option><option value="all">Tất cả</option></select><input type="search" aria-label="Tìm kết quả hoặc hồ sơ" placeholder="Tìm xét nghiệm, máy, mã hồ sơ…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            {!filtered.length ? <EmptyState size="compact" title={rows.length ? 'Không có kết quả khớp bộ lọc' : 'Chưa có kết quả cần khắc phục'}>{rows.length ? 'Thay đổi bộ lọc để xem các kết quả khác.' : 'Các kết quả không chấp nhận, cảnh báo hoặc có tín hiệu chuỗi sẽ hiển thị tại đây.'}</EmptyState>
              : <div ref={listScrollRef} className="eqa-table-wrap" role="region" aria-label="Vùng cuộn hồ sơ khắc phục" tabIndex={0}><table className="eqa-table eqa-center-rest eqa-corrective-table"><thead><tr><th>Xét nghiệm · máy</th><th>Đợt · mẫu</th><th>Căn cứ</th><th>Hồ sơ · hạn</th><th>Thao tác</th></tr></thead><tbody>{filtered.map(r => {
                const badge = r.record ? nceStatusBadge(r.record) : null;
                return <tr key={keyOf(r)} className={selected && keyOf(selected) === keyOf(r) ? 'is-selected' : undefined}>
                  <td><button type="button" className="eqa-history-open" aria-expanded={!!selected && keyOf(selected) === keyOf(r)} onClick={event => showEvidence(keyOf(r), event.currentTarget)}>{r.result.test_name}</button><span className="eqa-sub">{r.result.instrument_name}</span></td>
                  <td>{r.round.round}/{r.round.year}<span className="eqa-sub">Mẫu {r.result.sample || '—'}{!r.current && ' · Nguồn đã thay đổi'}</span></td>
                  <td><ClassTag cls={r.result.class} /><span className="eqa-sub">z={numText(r.result.z_official)} · {r.required ? 'Bắt buộc điều tra' : 'Cảnh báo đơn lẻ'}</span>{r.reasons.filter(s => r.required && !s.startsWith('Kết quả')).map(s => <span key={s} className="eqa-sub">{s}</span>)}</td>
                  <td>{r.record ? <><b className="eqa-strong">{r.record.nce_id}</b><span className={`tag ${badge!.tone}`}>{badge!.label}</span><span className="eqa-sub">{r.record.owner_name} · {vnDate(r.record.due_date)}{r.record.overdue_days ? ` · Quá hạn ${r.record.overdue_days} ngày` : ''}</span></> : <span className="eqa-sub">Chưa lập hồ sơ</span>}</td>
                  <td>{r.record && canManage ? <button type="button" className="btn ghost sm" onClick={() => openCase(r.record!.id)}>Mở hồ sơ</button> : <button type="button" className="btn ghost sm" aria-expanded={!!selected && keyOf(selected) === keyOf(r)} onClick={event => showEvidence(keyOf(r), event.currentTarget)}>Xem căn cứ</button>}</td>
                </tr>;
              })}</tbody></table></div>}
          </section>
          {selected && <>
            <ResizeHandle key={`resize:${scopeKey}:${keyOf(selected)}`} className="eqa-corrective-resize" targetRef={evidenceRef} edge="left" label="Độ rộng khung căn cứ điều tra"
              value={evidenceWidth} min={EVIDENCE_MIN_WIDTH} max={EVIDENCE_MAX_WIDTH} maxNow={evidenceMaxNow} onResize={resizeEvidence} />
            <EqaCorrectiveEvidence key={`${scopeKey}:${keyOf(selected)}`} panelRef={evidenceRef} row={selected} canCreate={canManage && !nceError} onCreate={setCreating} onClose={closeEvidence} />
          </>}
        </div>
      </>}
    {creating && <CreateNceModal prefill={null} eqaPrefill={creating} onClose={() => { setCreating(null); view.retry(); }} onCreated={dossier => { setCreating(null); view.retry(); openCase(dossier.record.id); }} />}
  </div>;
}
