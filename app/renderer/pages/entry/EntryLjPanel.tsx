// Biểu đồ Levey-Jennings theo từng cột (mức, lô song song, lô cũ đang mở) và
// bộ chọn khoảng xem. Bọc `memo`: vẽ lại canvas tốn kém, chỉ vẽ khi dữ liệu
// hoặc khoảng xem đổi.
import { memo } from 'react';
import { observedStats } from '../../../main/domain/observed-stats';
import { QcChart } from '../../components/QcChart';
import { DateField } from '../../components/DateField';
import { formatQcValue, inLjWindow, vnDate, type DisplayColumn } from './shared';
import type { LevelAnalysis, PreviousLotSeries, QcPointView } from '../../../shared/qc-api';

export const EntryLjPanel = memo(function EntryLjPanel({
  displayColumns, levelCount, pointsByLevel, analysisByLevel, previousLotSeries, decimals,
  ljFrom, ljTo, ljDays, onFrom, onTo, onPreset, onTogglePreviousLot,
}: {
  displayColumns: DisplayColumn[];
  levelCount: number;
  pointsByLevel: Record<number, QcPointView[]>;
  analysisByLevel: Record<number, LevelAnalysis>;
  previousLotSeries: PreviousLotSeries[];
  decimals: number;
  ljFrom: string;
  ljTo: string;
  ljDays: number;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onPreset: (days: number) => void;
  onTogglePreviousLot: (level: number) => void;
}) {
  const valText = (val: number) => formatQcValue(val, decimals);

  /** Điểm ĐƯỢC CHẤP NHẬN (cờ `accepted` do `analyzeLevel` tính qua
   * `acceptedRunPoints()` — loại CẢ lần chạy khi một mức bị loại; không phải
   * `acceptedPoints()`, hàm đó đã `@deprecated` và chỉ còn test đối chiếu
   * dùng) và nằm trong khoảng xem — giữ đúng tập này cho số điểm và thống kê
   * Mean/SD/CV thực. Biểu đồ vẽ thêm điểm bị loại để biến cố QC không biến
   * mất khỏi hình. */
  function acceptedInWindow(level: number): QcPointView[] {
    const ids = new Set((analysisByLevel[level]?.points || []).filter((p) => p.accepted).map((p) => p.id));
    return inLjWindow((pointsByLevel[level] || []).filter((p) => !p.voided && ids.has(p.id)), ljFrom, ljTo);
  }

  return (
    <div className="panel">
      <div className="lj-toolbar">
        <h2 className="panel-title">Biểu đồ Levey-Jennings</h2>
        <div className="lj-filter">
          <label className="lj-date-field"><span className="hint">Từ ngày</span><DateField value={ljFrom} onChange={onFrom} /></label>
          <label className="lj-date-field"><span className="hint">Đến ngày</span><DateField value={ljTo} onChange={onTo} /></label>
          <div className="dayseg">
            {[7, 14, 30, 60, 90].map((d) => (
              <button key={d} className={ljDays === d ? 'on' : ''} onClick={() => onPreset(d)}>{d} ngày</button>
            ))}
          </div>
        </div>
      </div>
      <div className="hint lj-range">Khoảng xem: {vnDate(ljFrom)} – {vnDate(ljTo)} · {levelCount} mức QC</div>
      <div className="lj-stack">
        {displayColumns.map((column) => {
          const chartPoints = inLjWindow(column.chartPoints, ljFrom, ljTo);
          const acceptedCount = chartPoints.filter((p) => p.accepted).length;
          const chartPointSummary = acceptedCount === chartPoints.length
            ? `${acceptedCount} điểm`
            : `${acceptedCount}/${chartPoints.length} dùng thống kê`;
          // Lô cũ và lô song song đều đã có cờ `accepted` do main tính
          // trên cùng bộ đánh giá ghép; chỉ cột chính mới phải tra lại
          const acceptedPoints = column.previous || column.parallel
            ? inLjWindow(column.points.filter((point) => !point.voided && point.accepted === true), ljFrom, ljTo)
            : acceptedInWindow(column.level);
          const previousChoices = column.parallel ? [] : previousLotSeries.filter((series) => series.level === column.level);
          const st = observedStats(acceptedPoints.filter((p) => !p.voided));
          return (
            <section className={`lj-mini${column.parallel ? ' lj-mini-parallel' : ''}`} key={column.key} aria-labelledby={`lj-chart-${column.key}`}>
              <div className="lj-mini-h">
                <h3 id={`lj-chart-${column.key}`}>Mức {column.level} · {column.previous ? 'Lô cũ ' : 'Lô '}{column.lot}{column.parallel && <span className="qc-parallel-label">Song song</span>}<span className="lj-point-count">{chartPointSummary}</span></h3>
                {previousChoices.length ? (
                  <button type="button" className="btn ghost sm qc-old-lot-toggle" onClick={() => onTogglePreviousLot(column.level)}>
                    {column.previous ? 'Xem lô mới' : 'Xem lô cũ'}
                  </button>
                ) : <span className="hint">{column.parallel ? 'Đang đánh giá' : column.applied === 'lab' ? 'Dải PXN' : 'Dải NSX'}</span>}
              </div>
              <div className="lj-qc-strip">
                <div className="lj-qc-stat"><span className="k">Mean thực</span><span className="v">{st.mean != null ? st.mean.toFixed(decimals) : '—'}</span></div>
                <div className="lj-qc-stat"><span className="k">SD thực</span><span className="v">{st.sd != null ? st.sd.toFixed(4) : '—'}</span></div>
                <div className="lj-qc-stat"><span className="k">CV thực</span><span className="v">{st.cv != null ? st.cv.toFixed(2) + '%' : '—'}</span></div>
                <div className="lj-qc-stat control"><span className="k">Mean mục tiêu</span><span className="v">{column.mean != null ? valText(column.mean) : '—'}</span></div>
                <div className="lj-qc-stat control"><span className="k">SD mục tiêu</span><span className="v">{column.sd != null ? column.sd.toFixed(4) : '—'}</span></div>
              </div>
              <div className="chart-scroll">
                <QcChart className="entryLJStack" mode="lj" mean={column.mean} sd={column.sd} lot={column.lot} responsiveHeight
                  decimals={decimals} height={300}
                  points={chartPoints} />
              </div>
            </section>
          );
        })}
      </div>
      <div className="legend">
        <span><span className="dot qc-legend-ok" />Trong ±2SD</span>
        <span><span className="dot qc-legend-warn" />Cảnh báo 2–3SD</span>
        <span><span className="dot qc-legend-rej" />Loại bỏ ngoài 3SD</span>
        <span><span className="dot qc-legend-excluded" />Vòng rỗng · lần chạy bị loại, không vào thống kê</span>
      </div>
    </div>
  );
});
