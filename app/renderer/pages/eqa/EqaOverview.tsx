// Danh sách đợt ngoại kiểm và lối vào nhập báo cáo PDF của trung tâm ngoại
// kiểm. Số liệu từng đợt do main tính.
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEqaStore } from '../../store/eqa-store';
import { useAuthStore } from '../../store/auth-store';
import { canWrite } from '../../lib/permissions';
import { vnDate } from '../../lib/format';
import { EmptyState } from '../../components/EmptyState';
import { EqaImportModal } from './EqaImportModal';
import { EqaSeriesModal } from './EqaSeriesModal';
import { ClassTag, numText, pctText, roundLabel, StatCard, TrendTags } from './shared';

export function EqaOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const { rounds, attention, loading, error, load } = useEqaStore(useShallow((s) => ({ rounds: s.rounds, attention: s.attention, loading: s.loading, error: s.error, load: s.load })));
  const [seriesTest, setSeriesTest] = useState('');
  const writable = canWrite(useAuthStore((s) => s.user?.role));
  const [importing, setImporting] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const active = useMemo(() => rounds.filter((r) => r.status === 'open'), [rounds]);
  const visible = showCancelled ? rounds : active;
  const totals = useMemo(() => active.reduce((sum, r) => ({ total: sum.total + r.total, warn: sum.warn + r.warn, rej: sum.rej + r.rej }), { total: 0, warn: 0, rej: 0 }), [active]);
  const cancelledCount = rounds.length - active.length;

  return (
    <div className="eqa-overview">
      <div className="eqa-intro">
        <div>
          <h2>Các kỳ ngoại kiểm</h2>
          <p>Mỗi kết quả được đánh giá theo z-score (ISO 13528) và đối chiếu với z do nhà cung cấp báo.</p>
        </div>
        {writable && (
          <div className="eqa-intro-actions">
            <button type="button" className="btn" onClick={() => setImporting(true)}>Nhập báo cáo PDF</button>
          </div>
        )}
      </div>

      <div className="eqa-stats">
        <StatCard tone="info" label="Kỳ đang theo dõi" value={active.length} detail={cancelledCount ? `${cancelledCount} kỳ đã huỷ` : 'Không tính kỳ đã huỷ'} />
        <StatCard tone="neutral" label="Kết quả" value={totals.total} detail="Tổng số kết quả của các kỳ" />
        <StatCard tone="warning" label="Cảnh báo" value={totals.warn} detail="2,0 < |z| < 3,0" />
        <StatCard tone="danger" label="Không chấp nhận" value={totals.rej} detail="|z| ≥ 3,0 — cần điều tra" />
      </div>

      {attention.length > 0 && (
        <section className="panel" aria-label="Xét nghiệm cần chú ý">
          <div className="panel-head"><h2>Xét nghiệm cần chú ý <span className="count">{attention.length}</span></h2></div>
          <div className="eqa-section-body">
            <p className="eqa-note">Tín hiệu ở đợt mới nhất của từng xét nghiệm: không chấp nhận, không thành công (2 đợt liên tiếp hoặc 2 trong 3 đợt không chấp nhận) hoặc xu hướng. Đây là việc cần xem xét, chưa phải kết luận nguyên nhân.</p>
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>Xét nghiệm</th><th>Máy</th><th>Đợt mới nhất</th><th className="num">z</th><th>Đánh giá</th><th>Tín hiệu</th><th aria-label="Thao tác" /></tr></thead>
                <tbody>
                  {attention.map((a) => (
                    <tr key={a.test_id} className={a.latest.unsuccessful || a.latest.class === 'rej' ? 'is-rej' : 'is-warn'}>
                      <td><b className="eqa-strong">{a.test_name}</b></td>
                      <td>{a.instrument_name}</td>
                      <td>{a.latest.round} / {a.latest.year}</td>
                      <td className="num">{numText(a.latest.z)}</td>
                      <td><ClassTag cls={a.latest.class} /></td>
                      <td><TrendTags signals={a.latest.signals} unsuccessful={a.latest.unsuccessful} /></td>
                      <td><button type="button" className="btn ghost sm" onClick={() => setSeriesTest(a.test_id)}>Biểu đồ</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="panel" aria-label="Danh sách kỳ ngoại kiểm">
        <div className="panel-head">
          <h2>Danh sách kỳ</h2>
          {cancelledCount > 0 && (
            <label className="eqa-toggle"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Hiện kỳ đã huỷ</label>
          )}
        </div>
        <div className="eqa-section-body">
          {error ? <EmptyState title="Không tải được danh sách kỳ" action={<button type="button" className="btn ghost sm" onClick={() => void load()}>Thử lại</button>}>{error}</EmptyState>
            : loading && !rounds.length ? <EmptyState title="Đang tải các kỳ ngoại kiểm…" />
            : !visible.length ? (
              <EmptyState title="Chưa có kỳ ngoại kiểm nào"
                action={writable ? <button type="button" className="btn sm" onClick={() => setImporting(true)}>Nhập báo cáo PDF</button> : undefined}>
                Nhập file PDF <b>Bản phân tích kết quả ngoại kiểm tra</b> do trung tâm ngoại kiểm gửi; app tự lấy kết quả, giá trị ấn định, σp, z-score và nhóm so sánh.
              </EmptyState>
            ) : (
              <div className="eqa-table-wrap">
                <table className="eqa-table">
                  <thead>
                    <tr>
                      <th>Chương trình</th><th>Đợt / năm</th><th>Máy</th><th className="num">Kết quả</th>
                      <th className="num">Chấp nhận</th><th className="num">Cảnh báo</th><th className="num">Không CN</th>
                      <th className="num">Tỷ lệ chấp nhận</th><th>Ngày báo cáo</th><th>Trạng thái</th><th aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id}>
                        <td><b className="eqa-strong">{r.program_name}</b><span className="eqa-sub">{r.provider || '—'}</span></td>
                        <td>{roundLabel(r)}</td>
                        <td className="eqa-wrap">{r.instruments.join(', ') || '—'}</td>
                        <td className="num">{r.total}</td>
                        <td className="num">{r.ok}</td>
                        <td className="num">{r.warn}</td>
                        <td className="num">{r.rej}</td>
                        <td className="num">{pctText(r.accept_pct)}</td>
                        <td>{vnDate(r.report_date, '—')}</td>
                        <td>{r.status === 'open' ? <span className="tag ok">Đang dùng</span> : <span className="tag none">Đã huỷ</span>}</td>
                        <td><button type="button" className="btn ghost sm" onClick={() => onOpen(r.id)}>Xem</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </section>

      {seriesTest && <EqaSeriesModal testId={seriesTest} onClose={() => setSeriesTest('')} />}
      {importing && <EqaImportModal onClose={() => setImporting(false)} onImported={(id) => { setImporting(false); onOpen(id); }} />}
    </div>
  );
}
