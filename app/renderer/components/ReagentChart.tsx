import type { ReactNode } from 'react';
import type { ReagentComparisonResult } from '../../shared/qc-api';

// Footprint gọn như app ban đầu, nhưng giữ đầy đủ trục/lưới của hệ thống.
// Ở desktop, mỗi biểu đồ rộng gần bằng một cột và cao xấp xỉ 280px.
const SIZE = { width: 760, height: 280 };
// Chừa đủ lề cho nhãn trục dọc và các tick có nhiều chữ số (vd. 143.17).
const PAD = { left: 72, right: 18, top: 18, bottom: 46 };
const COLOR = {
  teal: '#0c6f78',
  ink: '#172833',
  muted: '#667b89',
  line: '#d4dde3',
  grid: '#e9eff3',
  red: '#a43a33',
  amber: '#a36f15',
};

type Mode = 'scatter' | 'bland';
type Range = [number, number];
type Scale = { px: (value: number) => number; py: (value: number) => number };

export function ReagentChart({
  mode,
  result,
  lotOld,
  lotNew,
}: {
  mode: Mode;
  result: ReagentComparisonResult;
  lotOld?: string;
  lotNew?: string;
}) {
  const content = mode === 'scatter'
    ? scatterContent(result, lotOld, lotNew)
    : blandContent(result);

  return (
    <svg
      className="rc-chart-svg"
      viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      role="img"
      aria-label={mode === 'scatter' ? 'Biểu đồ tương quan hai lô hoá chất' : 'Biểu đồ Bland-Altman hai lô hoá chất'}
    >
      {content}
    </svg>
  );
}

function chartRange(minimum: number, maximum: number): Range {
  // Khớp reagentChartRange() của hệ thống: 8% dải dữ liệu, kể cả khi mọi điểm
  // bằng nhau thì vẫn có một dải để trục và đường tham chiếu đọc được.
  const spread = (maximum - minimum) || Math.abs(maximum) || 1;
  const padding = spread * 0.08;
  return [minimum - padding, maximum + padding];
}

function makeScale(xRange: Range, yRange: Range): Scale {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const innerWidth = SIZE.width - PAD.left - PAD.right;
  const innerHeight = SIZE.height - PAD.top - PAD.bottom;
  return {
    px: (value) => PAD.left + ((value - xMin) / (xMax - xMin)) * innerWidth,
    py: (value) => SIZE.height - PAD.bottom - ((value - yMin) / (yMax - yMin)) * innerHeight,
  };
}

function minOf(values: number[]): number {
  return values.reduce((minimum, value) => Math.min(minimum, value), values[0]);
}

function maxOf(values: number[]): number {
  return values.reduce((maximum, value) => Math.max(maximum, value), values[0]);
}

function tick(value: number): string {
  return String(+value.toFixed(2));
}

function statistic(value: number): string {
  return String(+value.toFixed(3));
}

function Axis({ xRange, yRange, xLabel, yLabel, scale }: {
  xRange: Range;
  yRange: Range;
  xLabel: string;
  yLabel: string;
  scale: Scale;
}) {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const grid: ReactNode[] = [];
  for (let index = 0; index <= 5; index += 1) {
    const xValue = xMin + ((xMax - xMin) * index) / 5;
    const yValue = yMin + ((yMax - yMin) * index) / 5;
    grid.push(
      <g key={index}>
        <line x1={scale.px(xValue)} y1={PAD.top} x2={scale.px(xValue)} y2={SIZE.height - PAD.bottom} stroke={COLOR.grid} />
        <line x1={PAD.left} y1={scale.py(yValue)} x2={SIZE.width - PAD.right} y2={scale.py(yValue)} stroke={COLOR.grid} />
        <text x={scale.px(xValue)} y={SIZE.height - PAD.bottom + 15} className="rc-chart-tick" fill={COLOR.muted} textAnchor="middle">{tick(xValue)}</text>
        <text x={PAD.left - 7} y={scale.py(yValue) + 3} className="rc-chart-tick" fill={COLOR.muted} textAnchor="end">{tick(yValue)}</text>
      </g>,
    );
  }

  return (
    <>
      {grid}
      <line x1={PAD.left} y1={SIZE.height - PAD.bottom} x2={SIZE.width - PAD.right} y2={SIZE.height - PAD.bottom} stroke={COLOR.ink} strokeWidth="1.3" />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={SIZE.height - PAD.bottom} stroke={COLOR.ink} strokeWidth="1.3" />
      <text x={(PAD.left + SIZE.width - PAD.right) / 2} y={SIZE.height - 7} className="rc-chart-axis-label" fill={COLOR.ink} textAnchor="middle">{xLabel}</text>
      <text transform={`translate(13, ${(PAD.top + SIZE.height - PAD.bottom) / 2}) rotate(-90)`} className="rc-chart-axis-label" fill={COLOR.ink} textAnchor="middle">{yLabel}</text>
    </>
  );
}

function scatterContent(result: ReagentComparisonResult, lotOld?: string, lotNew?: string) {
  const values = result.o.concat(result.n);
  const range = chartRange(minOf(values), maxOf(values));
  const scale = makeScale(range, range);
  const [low, high] = range;

  return (
    <>
      <Axis
        xRange={range}
        yRange={range}
        scale={scale}
        xLabel={`Lô cũ (${lotOld || 'cũ'})`}
        yLabel={`Lô mới (${lotNew || 'mới'})`}
      />
      <line x1={scale.px(low)} y1={scale.py(low)} x2={scale.px(high)} y2={scale.py(high)} stroke={COLOR.muted} strokeWidth="1.4" strokeDasharray="5 4" />
      <line x1={scale.px(low)} y1={scale.py(result.pb.a + result.pb.b * low)} x2={scale.px(high)} y2={scale.py(result.pb.a + result.pb.b * high)} stroke={COLOR.teal} strokeWidth="2" />
      {result.o.map((value, index) => (
        <circle key={index} cx={scale.px(value)} cy={scale.py(result.n[index])} r="4.5" fill={COLOR.teal} fillOpacity="0.78" stroke="#fff" strokeWidth="1.2" />
      ))}
    </>
  );
}

function blandContent(result: ReagentComparisonResult) {
  const averages = result.o.map((value, index) => (value + result.n[index]) / 2);
  const upper = result.md + 1.96 * result.sdd;
  const lower = result.md - 1.96 * result.sdd;
  const xRange = chartRange(minOf(averages), maxOf(averages));
  const yRange = chartRange(minOf(result.d.concat(lower)), maxOf(result.d.concat(upper)));
  const scale = makeScale(xRange, yRange);
  const [xLow, xHigh] = xRange;

  const referenceLine = (value: number, color: string, dashed: boolean, label: string) => (
    <g key={label}>
      <line x1={scale.px(xLow)} y1={scale.py(value)} x2={scale.px(xHigh)} y2={scale.py(value)} stroke={color} strokeWidth="1.6" strokeDasharray={dashed ? '5 4' : undefined} />
      <text x={scale.px(xHigh)} y={scale.py(value) - 4} className="rc-chart-tick" fill={color} textAnchor="end">{label} {statistic(value)}</text>
    </g>
  );

  return (
    <>
      <Axis xRange={xRange} yRange={yRange} scale={scale} xLabel="Trung bình (cũ + mới)/2" yLabel="Hiệu số (cũ − mới)" />
      <line x1={scale.px(xLow)} y1={scale.py(0)} x2={scale.px(xHigh)} y2={scale.py(0)} stroke={COLOR.line} />
      {referenceLine(result.md, COLOR.amber, false, 'Bias')}
      {referenceLine(upper, COLOR.red, true, '+1.96SD')}
      {referenceLine(lower, COLOR.red, true, '−1.96SD')}
      {averages.map((value, index) => (
        <circle key={index} cx={scale.px(value)} cy={scale.py(result.d[index])} r="4.5" fill={COLOR.amber} fillOpacity="0.8" stroke="#fff" strokeWidth="1.2" />
      ))}
    </>
  );
}


