// Ngoại kiểm chỉ ánh xạ dữ liệu sang QcChart dùng ở Nhập QC. Toàn bộ khung
// canvas, dải nền, đường nối, hình điểm và xử lý kích thước dùng chung.
import type { EqaSeriesView } from '../../../shared/qc-api';
import { QcChart, type QcChartPoint } from '../../components/QcChart';
import { EmptyState } from '../../components/EmptyState';
import { vnDate } from '../../lib/format';
import { EQA_CLASS_LABEL } from '../../../main/domain/eqa/evaluation';
import { EQA_SIGNAL_LABEL } from '../../../main/domain/eqa/series';
import { numText, pctText, rawNum, roundLabel } from './shared';

type EqaSeriesPoint = EqaSeriesView['points'][number];

export function EqaSeriesChart({ points, selectedId, onSelect, mode = 'z', config, unit = '' }: {
  points: readonly EqaSeriesPoint[]; selectedId?: string; onSelect: (point: EqaSeriesPoint) => void;
  mode?: 'z' | 'pct'; config: EqaSeriesView['config']; unit?: string;
}) {
  const chartPoints: QcChartPoint[] = points.map((p) => ({
    date: p.report_date, runId: p.result_id, val: p.result,
    // QcChart vẽ chuỗi đối chiếu theo giá trị trục; % lệch giữ nguyên đơn vị %.
    // NaN giữ vị trí mẫu thiếu dữ liệu để đường nối ngắt đúng chỗ.
    z: mode === 'z' ? p.z : p.pct ?? NaN,
    verdict: mode === 'z' ? p.class : p.within_tea === null ? 'none' : p.within_tea ? 'ok' : 'rej',
    rules: mode === 'z' ? [EQA_CLASS_LABEL[p.class]] : p.within_tea === false ? ['Vượt TEa'] : [],
  }));
  const hasValues = chartPoints.some((p) => Number.isFinite(p.z));
  // Mỗi đợt một vị trí trên trục X; điểm đã xếp theo đợt rồi mẫu nên các mẫu
  // của một đợt đứng liền nhau. Vạch năm đặt trước đợt đầu tiên của năm mới.
  const groups: number[] = [], groupLabels: string[] = [], groupBreaks: number[] = [];
  points.forEach((p, i) => {
    if (i && p.round_id === points[i - 1].round_id) { groups.push(groups[i - 1]); return; }
    const g = groupLabels.length;
    groups.push(g); groupLabels.push(roundLabel(p));
    if (i && p.year !== points[i - 1].year) groupBreaks.push(g);
  });
  return <div className="eqa-series-plot" role="group" aria-label={`${mode === 'z' ? 'z-score' : '% lệch'} qua các đợt ngoại kiểm`} data-eqa-chart={mode}>
    {!hasValues ? <EmptyState size="compact" title={mode === 'z' ? 'Chưa có điểm z trong phạm vi này' : 'Chưa có phần trăm lệch trong phạm vi này'} /> : <>
      <QcChart mode="lj" height={340} responsiveHeight points={chartPoints} comparison={{
        title: mode === 'z' ? 'Biểu đồ z-score ngoại kiểm' : 'Phần trăm lệch so với TEa',
        xTitle: 'Đợt / mẫu ngoại kiểm', unit: mode === 'z' ? 'z' : '%',
        warning: mode === 'z' ? config.z_warn : null, rejection: mode === 'z' ? config.z_reject : null,
        // Có năm vì biểu đồ mặc định phủ nhiều năm và tên đợt lặp lại mỗi năm.
        labels: points.map((p) => `${roundLabel(p)}${p.sample ? ` · ${p.sample}` : ''}`),
        groups, groupLabels, groupBreaks,
        limits: mode === 'pct' ? points.map((p) => p.tea_pct) : undefined,
        selectedIndex: points.findIndex((p) => p.result_id === selectedId),
        onSelect: (index) => { if (points[index]) onSelect(points[index]); },
        tooltip: (index) => {
          const p = points[index];
          if (!p) return null;
          return <>
            <b>{p.round} / {p.year}{p.sample ? ` · Mẫu ${p.sample}` : ''}</b>
            <div>Ngày báo cáo: {vnDate(p.report_date, '—')}</div>
            <div>Kết quả: <strong>{rawNum(p.result)} {unit}</strong></div>
            <div>Giá trị ấn định: {rawNum(p.assigned)} {unit}</div>
            <div>z-score: <strong>{numText(p.z)}</strong></div>
            <div>% lệch: {pctText(p.pct)} · TEa: {pctText(p.tea_pct)}</div>
            <div>Đánh giá ngoại kiểm: {EQA_CLASS_LABEL[p.class]}</div>
            {mode === 'pct' && <div>Đối chiếu TEa: {p.within_tea === null ? 'Chưa có TEa' : p.within_tea ? 'Trong TEa' : 'Vượt TEa'}</div>}
            {!!p.signals.length && <div className="muted">Tín hiệu: {p.signals.map((s) => EQA_SIGNAL_LABEL[s]).join('; ')}</div>}
          </>;
        },
      }} />
      <ul className="qc-legend eqa-chart-legend" aria-label="Chú giải hình điểm ngoại kiểm">
        <li><span className="qc-mark ok" aria-hidden="true" />{mode === 'z' ? 'Chấp nhận' : 'Trong TEa'}</li>
        {mode === 'z' && <li><span className="qc-mark warn" aria-hidden="true" />Cảnh báo</li>}
        <li><span className="qc-mark rej" aria-hidden="true" />{mode === 'z' ? 'Không chấp nhận' : 'Vượt TEa'}</li>
      </ul>
    </>}
  </div>;
}
