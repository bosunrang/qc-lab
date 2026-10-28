// Chuỗi ngoại kiểm của một xét nghiệm qua các đợt (EQA-REVIEW N-06, N-07):
// biểu đồ z (dùng chung biểu đồ Levey-Jennings theo z của app) và bảng điểm J,
// tín hiệu, trạng thái "không thành công". Mọi tín hiệu do main tính.
import { useEffect, useState } from 'react';
import { useEqaStore } from '../../store/eqa-store';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { QcChart, type QcChartPoint } from '../../components/QcChart';
import { vnDate } from '../../lib/format';
import type { EqaSeriesView } from '../../../shared/qc-api';
import { EQA_SIGNAL_LABEL } from '../../../main/domain/eqa/series';
import { ClassTag, numText, pctText, roundLabel, rowTone, TrendTags } from './shared';

export function EqaSeriesModal({ testId, onClose }: { testId: string; onClose: () => void }) {
  const series = useEqaStore((s) => s.series);
  const [view, setView] = useState<EqaSeriesView | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    series(testId).then((data) => { if (alive) setView(data); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Không tải được chuỗi ngoại kiểm.'); });
    return () => { alive = false; };
  }, [series, testId]);

  const title = view ? `Chuỗi ngoại kiểm · ${view.test_name} · ${view.instrument_name}` : 'Chuỗi ngoại kiểm';
  // Biểu đồ không truyền Mean/SD nên trục Y là z, dải ±1/±2/±3 như nội kiểm.
  const points: QcChartPoint[] = (view?.points ?? []).map((p) => ({
    date: p.report_date || `${p.year}-01-01`, runId: `${p.round}${p.sample ? ` · mẫu ${p.sample}` : ''}`,
    val: p.z, z: p.z, verdict: p.class, rules: p.signals.map((s) => EQA_SIGNAL_LABEL[s]),
  }));

  return (
    <Modal title={title} size="xl" onClose={onClose} footer={<button type="button" className="btn ghost" onClick={onClose}>Đóng</button>}>
      {error ? <EmptyState size="compact" title="Không tải được chuỗi ngoại kiểm">{error}</EmptyState>
        : view === undefined ? <EmptyState size="compact" title="Đang tải chuỗi ngoại kiểm…" />
        : !view || !view.points.length ? <EmptyState size="compact" title="Chưa có kết quả ngoại kiểm cho xét nghiệm này" />
        : (
          <div className="eqa-series">
            {!view.enough && <div className="alert info">Mới có {view.points.length} kết quả; cần ít nhất {view.min_points} đợt để kết luận về xu hướng. Tín hiệu |z| ≥ 3 và "không thành công" vẫn có hiệu lực.</div>}
            <div className="chart-scroll"><QcChart mode="lj" points={points} height={260} /></div>
            <p className="eqa-note">Trục dọc là z của nhà cung cấp; dải ±2 cảnh báo, ±3 không chấp nhận. Điểm J: 0/2/4/8 theo |z| &lt; 1 / &lt; 2 / &lt; 3 / ≥ 3, cộng dồn cùng dấu, đổi dấu thì đặt lại, báo khi |J| ≥ {view.j_limit}.</p>
            <div className="eqa-table-wrap">
              <table className="eqa-table">
                <thead><tr><th>Đợt</th><th>Mẫu</th><th>Ngày báo cáo</th><th className="num">z</th><th className="num">% lệch</th><th>Đánh giá</th><th className="num">J</th><th>Tín hiệu</th></tr></thead>
                <tbody>
                  {[...view.points].reverse().map((p) => (
                    <tr key={p.result_id} className={rowTone(p.class)}>
                      <td><b className="eqa-strong">{roundLabel(p)}</b></td>
                      <td>{p.sample || '—'}</td>
                      <td>{vnDate(p.report_date, '—')}</td>
                      <td className="num">{numText(p.z)}</td>
                      <td className="num">{pctText(p.pct)}</td>
                      <td><ClassTag cls={p.class} /></td>
                      <td className="num">{p.j}</td>
                      <td><TrendTags signals={p.signals} unsuccessful={p.unsuccessful} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </Modal>
  );
}
