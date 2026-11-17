// Một kỳ ngoại kiểm: thông tin kỳ, tổng hợp theo máy, bảng kết quả (z, z nhà
// cung cấp, % lệch, xu hướng; dòng mở rộng có nhóm đồng đẳng và lưu ý) và
// lịch sử nhập/bổ sung/huỷ.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { useAuthStore } from '../../store/auth-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { canWrite } from '../../lib/permissions';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { errorDialog } from '../../state/dialog-store';
import type { EqaResultRow, EqaRoundView } from '../../../shared/qc-api';
import { eqaCounts, EQA_PEER_LABEL, EQA_PROVIDER_CHECK_LABEL } from '../../../main/domain/eqa/evaluation';
import { EqaImportModal } from './EqaImportModal';
import { ClassTag, Facts, numText, pctText, rawNum, roundLabel, RoundStatusTag, TrendTags } from './shared';
import { EqaResultsSummary } from './EqaResultsSummary';
import { EqaResultFilter, useEqaResultFilter } from './EqaResultFilter';
import type { EqaNavigationContext } from './useEqaScope';

const DECISION_LABEL: Readonly<Record<string, string>> = {
  import: 'Nhập đợt', append: 'Bổ sung máy vào đợt', reimport: 'Nhập lại (phiên bản mới)', cancel: 'Huỷ đợt',
  preliminary_review: 'Xem xét sơ khởi', analysis_review: 'Xem xét phân tích', system_review: 'Xem xét hệ thống',
};
const SOURCE_LABEL: Readonly<Record<string, string>> = { pdf: 'Báo cáo PDF của trung tâm ngoại kiểm' };

/** Phạm vi của một lần ký xem xét: xem xét hệ thống và bản ký riêng một máy
 * cũng lưu dưới đợt đầu của phạm vi, nên lịch sử phải ghi rõ phạm vi đã ký. */
function reviewScope(type: string, payloadJson: string, view: EqaRoundView): string {
  if (!type.endsWith('_review')) return '';
  let scope: { roundId?: string; instrumentId?: string; year?: number } = {};
  try { scope = (JSON.parse(payloadJson || '{}') as { scope?: typeof scope }).scope ?? {}; } catch { /* hồ sơ cũ không có phạm vi */ }
  const machine = scope.instrumentId ? view.instruments.find((i) => i.instrument_id === scope.instrumentId)?.instrument_name ?? 'một máy' : 'tất cả máy';
  return scope.roundId ? machine : `cả năm ${scope.year ?? view.round.year} · ${machine}`;
}

function decisionDetail(type: string, payloadJson: string): string {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(payloadJson || '{}') as Record<string, unknown>; } catch { /* hiển thị trống */ }
  if (type === 'cancel') return String(p.reason ?? '');
  if (type.endsWith('_review')) return String((p.draft as Record<string, unknown> | undefined)?.conclusion ?? '');
  const replaced = Array.isArray(p.replaces) && p.replaces.length ? ` · thay kết quả ${p.replaces.join(', ')}` : '';
  const head = `${String(p.rows ?? 0)} kết quả nhập, phiên bản ${String(p.version ?? 1)}${replaced}`;
  return p.reason ? `${head} · ${String(p.reason)}` : head;
}

/** Tên nhóm trên báo cáo: nhóm phương pháp và nhóm thiết bị. */
function peerGroupName(row: EqaResultRow, level: EqaResultRow['peer'][number]['level']): string {
  if (level === 'method') return row.method;
  if (level === 'instrument') return row.peer_group;
  return '';
}

function notes(row: EqaResultRow): string[] {
  const out: string[] = [];
  const check = row.assigned_check;
  if (check?.uncertain) out.push(`Giá trị ấn định kém chắc chắn: u(x_pt) = ${check.ratio.toFixed(2)}·σp > 0,3·σp (N = ${check.n}); z′ = ${check.z_prime.toFixed(2)}`);
  if (row.provider_check === 'mismatch' || row.provider_check === 'swapped') out.push(EQA_PROVIDER_CHECK_LABEL[row.provider_check]);
  return [...out, ...row.warnings];
}

/** Dòng cần xem: chưa chấp nhận, vượt TEa nội bộ, có tín hiệu hoặc có lưu ý. */
function needsReview(row: EqaResultRow): boolean {
  return row.class !== 'ok' || row.within_tea === false || !!row.trend?.signals.length || !!row.trend?.unsuccessful || notes(row).length > 0;
}

export function EqaRoundDetail({ id, focusedResultId, onBack, onOpenTest }: { id: string; focusedResultId?: string; onBack: () => void; onOpenTest: (testId: string, context?: EqaNavigationContext) => void }) {
  const get = useEqaStore((s) => s.get);
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const [view, setView] = useState<EqaRoundView | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [requestedInstrument, setInstrument] = useState('');
  const instrument = view && !view.instruments.some((item) => item.instrument_id === requestedInstrument) ? '' : requestedInstrument;
  if (view && requestedInstrument && !instrument) setInstrument('');
  const [filter, setFilter] = useEqaResultFilter(`${id}:${instrument}`);
  const [reimport, setReimport] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Nhóm đồng đẳng và lưu ý ít khi cần đọc nên mở theo từng dòng, giữ bảng gọn.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(focusedResultId ? [focusedResultId] : []));
  const request = useRef({ sequence: 0 });

  const reload = useCallback(() => {
    const current = ++request.current.sequence;
    get(id).then((data) => { if (current === request.current.sequence) { setView(data); setError(''); } })
      .catch((e) => { if (current === request.current.sequence) setError(e instanceof Error && e.message ? e.message : 'Không tải được đợt ngoại kiểm.'); });
  }, [get, id]);
  useEffect(() => {
    const pending = request.current;
    reload();
    // Phản hồi cũ không được ghi đè lượt tải mới hoặc màn đã đóng.
    return () => { pending.sequence++; };
  }, [reload]);
  useStoreInvalidation(['eqa_rounds', 'tests', 'instruments', 'tea_refs'], undefined, reload);

  const scopedResults = useMemo(() => (view?.results ?? []).filter((r) => !instrument || r.instrument_id === instrument), [view, instrument]);
  const results = useMemo(() => scopedResults.filter((r) => filter === 'all' || (filter === 'attention' ? needsReview(r) : r.class === filter)), [scopedResults, filter]);
  // Mở từ tổng quan hoặc chuỗi xét nghiệm: cuộn dòng được chọn vào khung một
  // lần sau khi tải, không giật lại khi dữ liệu tự làm mới.
  const scrolled = useRef('');
  const focusVisible = !!focusedResultId && results.some((r) => r.id === focusedResultId);
  useEffect(() => {
    if (!focusVisible || scrolled.current === focusedResultId) return;
    scrolled.current = focusedResultId!;
    document.querySelector(`[data-eqa-result="${CSS.escape(focusedResultId!)}"]`)?.scrollIntoView({ block: 'center' });
  }, [focusVisible, focusedResultId]);

  const toggle = useCallback((rowId: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (!next.delete(rowId)) next.add(rowId);
    return next;
  }), []);

  if (error) return <section className="panel"><EmptyState title="Không tải được đợt ngoại kiểm" action={<button type="button" className="btn ghost sm" onClick={reload}>Thử lại</button>}>{error}</EmptyState></section>;
  if (view === undefined) return <section className="panel"><EmptyState title="Đang tải đợt ngoại kiểm…" /></section>;
  if (view === null) return <section className="panel"><EmptyState title="Không tìm thấy đợt ngoại kiểm" action={<button type="button" className="btn ghost sm" onClick={onBack}>Về danh sách</button>}>Đợt có thể đã bị xoá khi phục hồi dữ liệu.</EmptyState></section>;

  const { round } = view;
  const totals = eqaCounts(scopedResults.map((r) => r.class));
  const summaryScope = instrument ? view.instruments.find((item) => item.instrument_id === instrument)?.instrument_name ?? 'Máy đang chọn' : 'Tất cả máy';
  const open = round.status === 'open';
  // Cột Máy, Mẫu chỉ hiện khi kỳ có nhiều giá trị; một giá trị thì đã nằm ở Thông tin kỳ.
  const samples = [...new Set(view.results.map((r) => r.sample).filter(Boolean))];
  const showInstrument = view.instruments.length > 1;
  const showSample = samples.length > 1;
  const columns = 11 + Number(showInstrument) + Number(showSample);

  return (
    <div className="eqa-round">
      <div className="eqa-round-bar">
        <button type="button" className="btn ghost sm" onClick={onBack}>← Quay lại</button>
        <div className="eqa-round-title">
          <h2>{round.program_name} · {roundLabel(round)}</h2>
          <RoundStatusTag status={round.status} />
          {round.version > 1 && <span className="pill">Phiên bản {round.version}</span>}
        </div>
        {writable && open && (
          <div className="eqa-intro-actions">
            <button type="button" className="btn ghost sm" onClick={() => setReimport(true)}>Bổ sung / nhập lại PDF</button>
            <button type="button" className="btn ghost sm" onClick={() => setCancelOpen(true)}>Huỷ đợt</button>
          </div>
        )}
      </div>

      <EqaResultsSummary totals={totals} filter={filter} onFilter={setFilter}
        description={`${summaryScope} · Chỉ số tổng hợp theo từng mẫu`} />

      <section className="panel" aria-label="Thông tin đợt">
        <div className="panel-head"><h2>Thông tin đợt</h2></div>
        <div className="eqa-section-body">
          <Facts items={[
            ['Đơn vị tổ chức', round.provider], ['Mã chương trình', round.program_code], ['Mã đơn vị', round.unit_code],
            ['Máy', view.instruments.map((i) => i.instrument_name).join(', ')], ['Mẫu', samples.join(', ')], ['Mã báo cáo', round.report_code],
            ['Cấp nhóm làm giá trị ấn định', round.assigned_level], ['Ngày báo cáo', vnDate(round.report_date, '')],
            ['Nguồn', `${SOURCE_LABEL[round.source] ?? round.source}${round.source_name ? ` · ${round.source_name}` : ''}`],
          ]} />
        </div>
      </section>

      {view.instruments.length > 1 && (
        <section className="panel" aria-label="Tổng hợp theo máy">
          <div className="panel-head"><h2>Tổng hợp theo máy</h2></div>
          <div className="eqa-section-body">
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>Máy</th><th className="num">Kết quả</th><th className="num">Chấp nhận</th><th className="num">Cảnh báo</th><th className="num">Không chấp nhận</th><th className="num">Tỷ lệ chấp nhận</th></tr></thead>
                <tbody>
                  {view.instruments.map((i) => (
                    <tr key={i.instrument_id}>
                      <td><b className="eqa-strong">{i.instrument_name}</b></td>
                      <td className="num">{i.total}</td><td className="num">{i.ok}</td><td className="num">{i.warn}</td><td className="num">{i.rej}</td>
                      <td className="num">{pctText(i.accept_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="panel" aria-label="Kết quả ngoại kiểm">
        <div className="panel-head">
          <h2>Kết quả</h2>
          <div className="eqa-filters">
            {view.instruments.length > 1 && (
              <div className="field eqa-inline-field">
                <label htmlFor="eqaInstrument">Máy</label>
                <select id="eqaInstrument" value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                  <option value="">Tất cả máy</option>
                  {view.instruments.map((i) => <option key={i.instrument_id} value={i.instrument_id}>{i.instrument_name}</option>)}
                </select>
              </div>
            )}
            <EqaResultFilter value={filter} onChange={setFilter} label="Lọc xét nghiệm theo đánh giá" allLabel="Tất cả xét nghiệm" />
          </div>
        </div>
        <div className="eqa-section-body">
          {!results.length ? <EmptyState size="compact" title="Không có kết quả phù hợp bộ lọc" /> : (
            <div className="eqa-table-wrap eqa-results-scroll" tabIndex={0} role="region" aria-label="Vùng cuộn kết quả ngoại kiểm">
              <table className="eqa-table eqa-results-table">
                <thead>
                  <tr>
                    {showInstrument && <th>Máy</th>}<th className="eqa-test-cell">Xét nghiệm</th>{showSample && <th>Mẫu</th>}<th className="num">KQ PXN</th><th className="num">Giá trị ấn định</th>
                    <th className="num">σp</th><th className="num">z</th><th className="num">z NCC</th><th className="num">% lệch</th>
                    <th>Đánh giá</th><th className="eqa-trend-cell">Xu hướng</th><th>So TEa PXN</th><th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const flags = notes(r);
                    const isOpen = expanded.has(r.id);
                    return (
                      <Fragment key={r.id}>
                        <tr className={r.id === focusedResultId ? 'is-selected' : undefined} data-eqa-result={r.id}>
                          {showInstrument && <td>{r.instrument_name}</td>}
                          <td className="eqa-test-cell"><b className="eqa-strong">{r.test_name}</b><span className="eqa-sub">{[r.code, r.unit].filter(Boolean).join(' · ')}</span></td>
                          {showSample && <td>{r.sample || '—'}</td>}
                          <td className="num">{rawNum(r.result)}</td>
                          <td className="num">{rawNum(r.assigned)}</td>
                          <td className="num">{rawNum(r.sigma_p)}</td>
                          <td className="num">{numText(r.z)}</td>
                          <td className="num">{numText(r.z_provider)}</td>
                          <td className="num">{pctText(r.pct)}</td>
                          <td><span className="eqa-tags"><ClassTag cls={r.class} />{flags.length > 0 && <span className="tag warn">Có lưu ý</span>}</span></td>
                          <td className="eqa-trend-cell">{r.trend && (r.trend.signals.length || r.trend.unsuccessful) ? <TrendTags signals={r.trend.signals} unsuccessful={r.trend.unsuccessful} /> : '—'}</td>
                          <td>{r.within_tea === null ? '—' : <span className={`tag ${r.within_tea ? 'ok' : 'warn'}`}>{r.within_tea ? 'Trong' : 'Vượt'} TEa {numText(r.tea_pct, 1)}%</span>}</td>
                          <td>
                            <div className="eqa-row-actions">
                              <button type="button" className="btn ghost sm" onClick={() => onOpenTest(r.test_id, { year: round.year, programId: round.program_id, instrumentId: r.instrument_id, resultId: r.id, roundId: round.id })}>Xem chuỗi</button>
                              <button type="button" className="btn ghost sm" aria-expanded={isOpen} onClick={() => toggle(r.id)}>{isOpen ? 'Thu gọn' : 'Chi tiết'}</button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="eqa-detail-row">
                            <td colSpan={columns}>
                              <ResultDetail row={r} flags={flags} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="eqa-note">Đánh giá chính thức theo z của nhà cung cấp (cột z NCC); z do app tính để kiểm tra chéo. Xu hướng tính trên chuỗi các đợt của xét nghiệm tới đợt này. So TEa PXN là thông tin nội bộ theo TEa trong Cấu hình chung, không thay tiêu chí của nhà cung cấp.</p>
        </div>
      </section>

      <section className="panel" aria-label="Lịch sử đợt">
        <div className="panel-head"><h2>Lịch sử</h2></div>
        <div className="eqa-section-body">
          <ol className="eqa-history">
            {view.decisions.map((d) => (
              <li key={d.id}>
                <div><b>{DECISION_LABEL[d.type] ?? d.type}{reviewScope(d.type, d.payload_json, view) && ` · ${reviewScope(d.type, d.payload_json, view)}`}</b><span className="eqa-sub">{d.actor_name} · {new Date(d.decided_at).toLocaleString('vi-VN')}</span></div>
                <p>{decisionDetail(d.type, d.payload_json)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {reimport && <EqaImportModal onClose={() => setReimport(false)} onImported={() => setReimport(false)} />}
      {cancelOpen && <CancelRoundModal view={view} onClose={() => setCancelOpen(false)} />}
    </div>
  );
}

/** Dòng mở rộng của một kết quả: so với các nhóm đồng đẳng và lưu ý. */
function ResultDetail({ row, flags }: { row: EqaResultRow; flags: readonly string[] }) {
  return (
    <div className="eqa-detail">
      <div>
        <h3>So với nhóm đồng đẳng</h3>
        {row.peer.length ? (
          <table className="eqa-peer">
            <thead>
              <tr><th>Nhóm</th><th className="num">Số PXN</th><th className="num">Trung bình</th><th className="num">SD</th><th className="num">CV</th><th className="num">SDI</th><th className="num">% lệch</th></tr>
            </thead>
            <tbody>
              {row.peer.map((p) => {
                const groupName = peerGroupName(row, p.level);
                return (
                  <tr key={p.level}>
                    <td>
                      <span className="eqa-peer-name">{EQA_PEER_LABEL[p.level]}{row.assigned_check?.level === p.level && <span className="pill">Giá trị ấn định</span>}</span>
                      {groupName && <span className="eqa-sub">{groupName}</span>}
                    </td>
                    <td className="num">{p.n ?? '—'}</td>
                    <td className="num">{rawNum(p.mean)}</td>
                    <td className="num">{rawNum(p.sd)}</td>
                    <td className="num">{pctText(p.cv)}</td>
                    <td className="num">{numText(p.sdi)}</td>
                    <td className="num">{pctText(p.pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <span className="hint-inline">Báo cáo không có số liệu nhóm.</span>}
        <p className="eqa-note">SDI = (KQ PXN − trung bình nhóm) / SD nhóm; % lệch so với trung bình nhóm.</p>
      </div>
      <div>
        <h3>Lưu ý</h3>
        {flags.length ? <ul className="eqa-list">{flags.map((f) => <li key={f}>{f}</li>)}</ul> : <span className="hint-inline">Không có.</span>}
      </div>
    </div>
  );
}

function CancelRoundModal({ view, onClose }: { view: EqaRoundView; onClose: () => void }) {
  const cancel = useEqaStore((s) => s.cancel);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const result = await cancel(view.round.id, view.round.row_version, reason);
      setBusy(false);
      if (result.ok) onClose(); else await errorDialog(result.error.message, { title: 'Chưa huỷ được đợt ngoại kiểm' });
    } catch (e) {
      setBusy(false);
      await errorDialog(e instanceof Error ? e.message : 'Không huỷ được đợt ngoại kiểm.', { title: 'Chưa huỷ được đợt ngoại kiểm' });
    }
  }
  return (
    <Modal title="Huỷ đợt ngoại kiểm" size="sm" busy={busy} onClose={onClose}
      footer={<><button type="button" className="btn ghost" disabled={busy} onClick={onClose}>Quay lại</button><button type="button" className="btn danger" disabled={busy || reason.trim().length < 10} onClick={() => void submit()}>Huỷ đợt</button></>}>
      <p className="eqa-note">Đợt đã huỷ vẫn được lưu để truy xuất nhưng không tính vào thống kê. Dùng khi nhập nhầm đợt hoặc trùng dữ liệu.</p>
      <div className="field">
        <label htmlFor="eqaCancelReason">Lý do huỷ (ít nhất 10 ký tự)</label>
        <textarea id="eqaCancelReason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
