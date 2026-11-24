// Hình thu nhỏ dùng z chính thức, tách đường theo mẫu và giữ chỗ đợt thiếu.
import type { EqaInstrumentGridRow, EqaRoundRow } from '../../../shared/qc-api';
import { overviewSparkline } from './overview-model';

export function EqaRowTrend({ row, rounds, extent, onOpen }: {
  row: EqaInstrumentGridRow; rounds: readonly EqaRoundRow[]; extent: number; onOpen: () => void;
}) {
  return <button type="button" className="eqa-row-trend" onClick={onOpen} aria-label={`Phân tích diễn biến z của ${row.test_name}`}
    title="Mở phân tích xét nghiệm. Các dòng dùng cùng thang z; mỗi mẫu một đường, đợt thiếu không nối.">
    <svg viewBox="0 0 112 40" aria-hidden="true">
      <line className="eqa-spark-zero" x1="4" x2="108" y1="20" y2="20" />
      {overviewSparkline(row, rounds, extent).map((series, index) => <g key={series.sample} data-eqa-sample={series.sample}>
        <path className={`eqa-spark-line${index ? ' is-secondary' : ''}`} d={series.path} />
        {series.points.map((point) => <circle key={point.result_id} className={`eqa-spark-point is-${point.class}`} cx={point.x} cy={point.y} r={point.class === 'ok' ? 1.8 : 2.7} />)}
      </g>)}
    </svg>
  </button>;
}
