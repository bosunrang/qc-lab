// Một kỳ ngoại kiểm: thông tin kỳ, tổng hợp theo máy, bảng kết quả (z, z nhà
// cung cấp, % lệch, nhóm đồng đẳng) và lịch sử nhập/đảo cột/huỷ.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { useAuthStore } from '../../store/auth-store';
import { useStoreInvalidation } from '../../lib/useStoreInvalidation';
import { canWrite } from '../../lib/permissions';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import type { EqaClassView, EqaResultRow, EqaRoundView } from '../../../shared/qc-api';
import { EQA_PEER_LABEL, EQA_PROVIDER_CHECK_LABEL } from '../../../main/domain/eqa/evaluation';
import { EqaImportModal } from './EqaImportModal';
import { ClassTag, numText, pctText, rawNum, roundLabel, StatCard } from './shared';

const DECISION_LABEL: Readonly<Record<string, string>> = {
  import: 'Nhập đợt', append: 'Bổ sung máy vào đợt', reimport: 'Nhập lại (phiên bản mới)', cancel: 'Huỷ đợt',
};
const SOURCE_LABEL: Readonly<Record<string, string>> = { pdf: 'Báo cáo PDF của trung tâm ngoại kiểm' };

type ClassFilter = 'all' | 'attention' | EqaClassView;
const CLASS_FILTERS: { key: ClassFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' }, { key: 'attention', label: 'Cần xem' }, { key: 'rej', label: 'Không chấp nhận' },
];

function decisionDetail(type: string, payloadJson: string): string {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(payloadJson || '{}') as Record<string, unknown>; } catch { /* hiển thị trống */ }
  if (type === 'cancel') return String(p.reason ?? '');
  const replaced = Array.isArray(p.replaces) && p.replaces.length ? ` · thay kết quả ${p.replaces.join(', ')}` : '';
  const head = `${String(p.rows ?? 0)} kết quả nhập, phiên bản ${String(p.version ?? 1)}${replaced}`;
  return p.reason ? `${head} · ${String(p.reason)}` : head;
}

function notes(row: EqaResultRow): string[] {
  const out: string[] = [];
  if (row.provider_check === 'mismatch' || row.provider_check === 'swapped') out.push(EQA_PROVIDER_CHECK_LABEL[row.provider_check]);
  return [...out, ...row.warnings];
}

export function EqaRoundDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { get, cancel } = useEqaStore.getState();
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const [view, setView] = useState<EqaRoundView | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [instrument, setInstrument] = useState('');
  const [filter, setFilter] = useState<ClassFilter>('all');
  const [reimport, setReimport] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const reload = useCallback(() => {
    get(id).then((data) => { setView(data); setError(''); }).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được kỳ ngoại kiểm.'));
  }, [get, id]);
  useEffect(reload, [reload]);
  useStoreInvalidation(['eqa_rounds', 'tests', 'instruments'], undefined, reload);

  const results = useMemo(() => (view?.results ?? []).filter((r) => (!instrument || r.instrument_id === instrument)
    && (filter === 'all' || (filter === 'attention' ? r.class !== 'ok' || r.provider_check === 'mismatch' : r.class === filter))), [view, instrument, filter]);

  if (error) return <section className="panel"><EmptyState title="Không tải được kỳ ngoại kiểm" action={<button type="button" className="btn ghost sm" onClick={reload}>Thử lại</button>}>{error}</EmptyState></section>;
  if (view === undefined) return <section className="panel"><EmptyState title="Đang tải kỳ ngoại kiểm…" /></section>;
  if (view === null) return <section className="panel"><EmptyState title="Không tìm thấy kỳ ngoại kiểm" action={<button type="button" className="btn ghost sm" onClick={onBack}>Về danh sách</button>}>Kỳ có thể đã bị xoá khi phục hồi dữ liệu.</EmptyState></section>;

  const { round, config } = view;
  const open = round.status === 'open';
  const ptLow = round.pt_score !== null && round.pt_score < config.pt_min;

  return (
    <div className="eqa-round">
      <div className="eqa-round-bar">
        <button type="button" className="btn ghost sm" onClick={onBack}>← Danh sách kỳ</button>
        <div className="eqa-round-title">
          <h2>{round.program_name} · {roundLabel(round)}</h2>
          {open ? <span className="tag ok">Đang dùng</span> : <span className="tag none">Đã huỷ</span>}
          {round.version > 1 && <span className="pill">Phiên bản {round.version}</span>}
        </div>
        {writable && open && (
          <div className="eqa-intro-actions">
            <button type="button" className="btn ghost sm" onClick={() => setReimport(true)}>Bổ sung / nhập lại PDF</button>
            <button type="button" className="btn ghost sm" onClick={() => setCancelOpen(true)}>Huỷ kỳ</button>
          </div>
        )}
      </div>

      <div className="eqa-stats is-five">
        <StatCard tone="neutral" label="Kết quả" value={round.total} />
        <StatCard tone="success" label="Chấp nhận" value={round.ok} detail={`|z| ≤ ${numText(config.z_warn, 1)}`} />
        <StatCard tone="warning" label="Cảnh báo" value={round.warn} detail={`${numText(config.z_warn, 1)} < |z| < ${numText(config.z_reject, 1)}`} />
        <StatCard tone="danger" label="Không chấp nhận" value={round.rej} detail={`|z| ≥ ${numText(config.z_reject, 1)}`} />
        <StatCard tone={ptLow ? 'danger' : 'info'} label="PT score" value={pctText(round.pt_score)} detail={`% chấp nhận · ngưỡng tạm ${config.pt_min}%`} />
      </div>

      <section className="panel" aria-label="Thông tin kỳ">
        <div className="panel-head"><h2>Thông tin kỳ</h2></div>
        <div className="eqa-section-body">
          <dl className="eqa-facts">
            {([
              ['Đơn vị tổ chức', round.provider], ['Mã chương trình', round.program_code], ['Mã đơn vị', round.unit_code],
              ['Mã báo cáo', round.report_code], ['Cấp nhóm làm giá trị ấn định', round.assigned_level], ['Ngày nhận mẫu', vnDate(round.received_date, '')], ['Ngày báo cáo', vnDate(round.report_date, '')],
              ['Người nhập dữ liệu (theo file)', round.entered_by],
              ['Nguồn', `${SOURCE_LABEL[round.source] ?? round.source}${round.source_name ? ` · ${round.source_name}` : ''}`],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value || <span className="hint-inline">Chưa ghi nhận.</span>}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {view.instruments.length > 1 && (
        <section className="panel" aria-label="Tổng hợp theo máy">
          <div className="panel-head"><h2>Tổng hợp theo máy</h2></div>
          <div className="eqa-section-body">
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>Máy</th><th className="num">Kết quả</th><th className="num">Chấp nhận</th><th className="num">Cảnh báo</th><th className="num">Không CN</th><th className="num">PT score</th></tr></thead>
                <tbody>
                  {view.instruments.map((i) => (
                    <tr key={i.instrument_id}>
                      <td><b className="eqa-strong">{i.instrument_name}</b></td>
                      <td className="num">{i.total}</td><td className="num">{i.ok}</td><td className="num">{i.warn}</td><td className="num">{i.rej}</td>
                      <td className="num">{pctText(i.pt_score)}</td>
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
            <div className="dayseg" role="group" aria-label="Lọc theo đánh giá">
              {CLASS_FILTERS.map((f) => <button type="button" key={f.key} className={filter === f.key ? 'on' : ''} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>)}
            </div>
          </div>
        </div>
        <div className="eqa-section-body">
          {!results.length ? <EmptyState size="compact" title="Không có kết quả phù hợp bộ lọc" /> : (
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead>
                  <tr>
                    <th>Máy</th><th>Xét nghiệm</th><th>Mẫu</th><th className="num">KQ PXN</th><th className="num">Giá trị ấn định</th>
                    <th className="num">σp</th><th className="num">z</th><th className="num">z NCC</th><th className="num">% lệch</th>
                    <th>Đánh giá</th><th>SSC</th><th>Nhóm đồng đẳng (SDI / % lệch)</th><th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const flags = notes(r);
                    return (
                      <tr key={r.id} className={r.class === 'rej' ? 'is-rej' : r.class === 'warn' ? 'is-warn' : undefined}>
                        <td>{r.instrument_name}</td>
                        <td><b className="eqa-strong">{r.test_name}</b><span className="eqa-sub">{r.code}{r.level_label ? ` · ${r.level_label}` : ''}</span></td>
                        <td>{r.sample || '—'}</td>
                        <td className="num">{rawNum(r.result)} <span className="eqa-unit">{r.unit}</span></td>
                        <td className="num">{rawNum(r.assigned)}</td>
                        <td className="num">{rawNum(r.sigma_p)}</td>
                        <td className="num">{numText(r.z)}</td>
                        <td className="num">{numText(r.z_provider)}</td>
                        <td className="num">{pctText(r.pct)}</td>
                        <td><ClassTag cls={r.class} /></td>
                        <td>{r.within_tolerance === null ? '—' : <span className={`tag ${r.within_tolerance ? 'ok' : 'rej'}`}>{r.within_tolerance ? 'Đạt' : 'Vượt'} {numText(r.tolerance_pct, 1)}%</span>}</td>
                        <td className="eqa-wrap">{r.peer.length ? r.peer.map((p) => `${EQA_PEER_LABEL[p.level]}: ${numText(p.sdi)} / ${pctText(p.pct)}`).join(' · ') : '—'}</td>
                        <td className="eqa-wrap">{flags.length ? flags.join('; ') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="eqa-note">Đánh giá chính thức theo z của nhà cung cấp khi có (cột z NCC); z do app tính để kiểm tra chéo. SSC: sai số cho phép (%) của thông số nếu file có khai báo.</p>
        </div>
      </section>

      <section className="panel" aria-label="Lịch sử kỳ">
        <div className="panel-head"><h2>Lịch sử</h2></div>
        <div className="eqa-section-body">
          <ol className="eqa-history">
            {view.decisions.map((d) => (
              <li key={d.id}>
                <div><b>{DECISION_LABEL[d.type] ?? d.type}</b><span className="eqa-sub">{d.actor_name} · {new Date(d.decided_at).toLocaleString('vi-VN')}</span></div>
                <p>{decisionDetail(d.type, d.payload_json)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {reimport && <EqaImportModal onClose={() => setReimport(false)} onImported={() => setReimport(false)} />}
      {cancelOpen && <CancelRoundModal view={view} onClose={() => setCancelOpen(false)} cancel={cancel} />}
    </div>
  );
}

function CancelRoundModal({ view, onClose, cancel }: { view: EqaRoundView; onClose: () => void; cancel: (id: string, version: number, reason: string) => ReturnType<ReturnType<typeof useEqaStore.getState>['cancel']> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    const result = await cancel(view.round.id, view.round.row_version, reason);
    setBusy(false);
    if (result.ok) onClose(); else setError(result.error.message);
  }
  return (
    <Modal title="Huỷ kỳ ngoại kiểm" size="sm" onClose={onClose}
      footer={<><button type="button" className="btn ghost" onClick={onClose}>Quay lại</button><button type="button" className="btn danger" disabled={busy || reason.trim().length < 10} onClick={() => void submit()}>Huỷ kỳ</button></>}>
      <p className="eqa-note">Kỳ đã huỷ vẫn được lưu để truy xuất nhưng không tính vào thống kê. Dùng khi nhập nhầm kỳ hoặc trùng dữ liệu.</p>
      <div className="field">
        <label htmlFor="eqaCancelReason">Lý do huỷ (ít nhất 10 ký tự)</label>
        <textarea id="eqaCancelReason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <div className="alert rej" role="alert">{error}</div>}
    </Modal>
  );
}
