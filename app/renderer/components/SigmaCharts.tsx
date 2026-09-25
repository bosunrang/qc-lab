// Biểu đồ Six Sigma/MDC dựng bằng SVG React thuần. Không thao tác DOM toàn
// cục hoặc innerHTML; dữ liệu là SigmaPeriodView từ IPC/SQLite.
import { useMemo, useState } from 'react';
import { mdcRatios } from '../lib/sigma-workflow';
import type { SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';

const LEVEL_COLORS = ['#0e4d4a', '#7a4f9a', '#c47d12'];
const SIGMA_BOUNDS: Array<[number, string]> = [[2, '#c0362c'], [3, '#dd8b1f'], [4, '#b59a00'], [5, '#3f9a55'], [6, '#0e8f8f']];

/** Chỉ kỳ có ít nhất một mức đã tính Sigma mới xuất hiện trên biểu đồ; kỳ mới
 * chưa nhập CV/Bias không tạo một biểu đồ trống. */
function validPeriods(periods: SigmaPeriodView[]): SigmaPeriodView[] {
  return [...periods]
    .sort((a, b) => a.period.localeCompare(b.period))
    .filter((period) => period.levels.some((level) => Number.isFinite(level.sigma?.sigma)));
}

function levelsOf(periods: SigmaPeriodView[]): number[] {
  return Array.from(new Set(periods.flatMap((period) => period.levels
    .filter((level) => Number.isFinite(level.sigma?.sigma))
    .map((level) => level.level)))).sort((a, b) => a - b);
}

function periodLabel(period: string): string { return period.split('-').reverse().join('/'); }
function periodTitle(period: string): string { return `Kỳ ${period.slice(5)}/${period.slice(0, 4)}`; }

function EmptyChart({ kind }: { kind: 'trend' | 'mdc' }) {
  const trend = kind === 'trend';
  return <div className="sg-chart-empty" role="status">
    <div className={`sg-chart-empty-icon ${trend ? 'trend' : 'mdc'}`} aria-hidden="true">
      {trend
        ? <svg viewBox="0 0 28 28" fill="none"><path d="M4 21.5h20M5.5 18l5-5 4 3 7-8" /><circle cx="5.5" cy="18" r="1.3" /><circle cx="10.5" cy="13" r="1.3" /><circle cx="14.5" cy="16" r="1.3" /><circle cx="21.5" cy="8" r="1.3" /></svg>
        : <svg viewBox="0 0 28 28" fill="none"><path d="M4 22V5m0 17h20M6 6l15 14M9 6l12 11M13 6l8 7" /><circle cx="14" cy="14" r="2.2" /></svg>}
    </div>
    <div className="sg-chart-empty-copy">
      <span className="sg-chart-empty-kicker">Chờ dữ liệu đánh giá</span>
      <b>{trend ? 'Chưa có kỳ Sigma đủ điều kiện để vẽ xu hướng' : 'Chưa đủ dữ liệu để xác định vị trí MDC'}</b>
      <p>{trend
        ? 'Nhập CV IQC và Bias EQA/EQC cho cùng một mức QC trong mục “Số liệu theo kỳ”.'
        : 'MDC cần TEa, CV IQC và Bias EQA/EQC đầy đủ trong cùng một kỳ và mức QC.'}</p>
      <div className="sg-chart-empty-steps"><span className="pill">1. Nhập CV IQC</span><span className="pill">2. Nhập Bias EQA/EQC</span></div>
    </div>
  </div>;
}

function Legend({ level, index }: { level: number; index: number }) {
  const color = LEVEL_COLORS[index % LEVEL_COLORS.length];
  const x = 48 + index * 72;
  return <g><rect x={x} y="9" width="12" height="3" rx="1.5" fill={color} /><text x={x + 17} y="13" fontSize="10.5" fill={color} fontWeight="700">Mức {level}</text></g>;
}

export function SigmaTrendChart({ periods }: { periods: SigmaPeriodView[] }) {
  const rows = useMemo(() => validPeriods(periods), [periods]);
  const levels = useMemo(() => levelsOf(rows), [rows]);
  if (!rows.length) return <EmptyChart kind="trend" />;

  const values = rows.flatMap(period => period.levels.flatMap(level => Number.isFinite(level.sigma?.sigma) ? [level.sigma!.sigma] : []));
  const minSigma = Math.min(0, Math.floor(Math.min(...values))), maxSigma = Math.max(8, Math.ceil(Math.max(...values)));
  const ticks = Array.from({ length: 5 }, (_, index) => minSigma + (maxSigma - minSigma) * index / 4);
  const W = 1000, H = 245, L = 42, R = 16, T = 23, B = 34, chartPad = 34;
  const px = (index: number) => rows.length <= 1 ? L + (W - L - R) / 2 : L + chartPad + index / (rows.length - 1) * (W - L - R - chartPad * 2);
  const py = (sigma: number) => T + (maxSigma - sigma) / (maxSigma - minSigma) * (H - T - B);
  const width = W - L - R;
  const height = H - T - B;
  const band = (from: number, to: number, fill: string) => <rect key={`${from}-${to}`} x={L} y={py(to)} width={width} height={py(from) - py(to)} fill={fill} />;

  return <div className="sg-svg-chart"><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Xu hướng Sigma theo kỳ">
    <rect x={L} y={T} width={width} height={height} fill="#fff" stroke="#dce3e9" />
    {band(6, maxSigma, '#edf5ef')}{band(4, 6, '#f6faf6')}{band(3, 4, '#fff6df')}{band(minSigma, 3, '#fdebea')}
    {ticks.map((sigma) => <g key={sigma}><line x1={L} y1={py(sigma)} x2={W - R} y2={py(sigma)} stroke="#dde5e9" strokeWidth=".7" /><text x={L - 7} y={py(sigma) + 3} fontSize="10.5" fill="#70818d" textAnchor="end">{Number(sigma.toFixed(1))}</text></g>)}
    {[3, 6].map((sigma) => <g key={`reference-${sigma}`}><line x1={L} y1={py(sigma)} x2={W - R} y2={py(sigma)} stroke={sigma === 3 ? '#cf5a52' : '#2f7d5b'} strokeWidth=".85" strokeDasharray="4 4" /><text x={W - R - 4} y={py(sigma) - 4} fontSize="10.5" fill={sigma === 3 ? '#b83b33' : '#216b4a'} textAnchor="end" fontWeight="700">{sigma}σ</text></g>)}
    {levels.map((level, levelIndex) => {
      const color = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length];
      const points = rows.flatMap((period, index) => {
        const sigma = period.levels.find((item) => item.level === level)?.sigma?.sigma;
        return Number.isFinite(sigma) ? [{ x: px(index), y: py(Number(sigma)), sigma: Number(sigma), period: period.period }] : [];
      });
      return <g key={level}>
        {points.length > 1 && <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((point, pointIndex) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r={pointIndex === points.length - 1 ? 3.7 : 3} fill={color} stroke="#fff" strokeWidth="1.2"><title>{`${periodTitle(point.period)} · Mức ${level} · Sigma ${point.sigma.toFixed(2)}`}</title></circle>)}
        <Legend level={level} index={levelIndex} />
      </g>;
    })}
    {rows.map((period, index) => (rows.length <= 6 || index === 0 || index === rows.length - 1) && <text key={period.id} x={px(index)} y={H - B + 14} fontSize="10.5" fill="#70818d" textAnchor="middle">{periodLabel(period.period)}</text>)}
    <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#42515b" strokeWidth=".9" /><line x1={L} y1={T} x2={L} y2={H - B} stroke="#42515b" strokeWidth=".9" />
    <text transform={`translate(13,${(T + H - B) / 2}) rotate(-90)`} fontSize="10.5" fill="#40515c" textAnchor="middle" fontWeight="700">Sigma</text>
  </svg></div>;
}

interface MdcPoint { x: number; y: number; index: number; level: number; period: string; levelData: SigmaLevelResult; cvRatio: number; biasRatio: number; color: string }

export function SigmaMdcChart({ periods }: { periods: SigmaPeriodView[] }) {
  const rows = useMemo(() => validPeriods(periods), [periods]);
  const levels = useMemo(() => levelsOf(rows), [rows]);
  const [tip, setTip] = useState<MdcPoint | null>(null);
  if (!rows.length) return <EmptyChart kind="mdc" />;

  const W = 1000, H = 275, L = 45, R = 16, T = 23, B = 42;
  // Thang THÍCH ỨNG, không kẹp điểm về mép. Bản trước vẽ tại
  // `min(60, cvRatio)` / `min(100, biasRatio)`, nên một phương pháp
  // CV/TEa 95% · |Bias|/TEa 130% (Sigma −0,32) nằm đúng trên đường 0σ của
  // hình — đọc ra một Sigma khác hẳn Sigma thật. Biểu đồ xu hướng đã bỏ kẹp
  // thang từ lượt trước; đây là chỗ còn sót.
  const ratioRows = rows.flatMap((period) => period.levels.flatMap((level) => {
    const value = mdcRatios(level);
    return value ? [value] : [];
  }));
  const axis = (observed: number, floor: number) => {
    const target = Math.max(floor, observed);
    const raw = target / 6;
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((candidate) => candidate >= raw) ?? 10 * pow;
    return { max: Math.ceil(target / step) * step, step };
  };
  const x = axis(Math.max(0, ...ratioRows.map((item) => item.cvRatio)), 60);
  const y = axis(Math.max(0, ...ratioRows.map((item) => item.biasRatio)), 100);
  const xMax = x.max, yMax = y.max;
  const ticks = ({ max, step }: { max: number; step: number }) => Array.from({ length: Math.round(max / step) + 1 }, (_, index) => Number((index * step).toFixed(4)));
  const px = (value: number) => L + value / xMax * (W - L - R);
  const py = (value: number) => H - B - value / yMax * (H - T - B);
  const pointGroups = levels.map((level, levelIndex) => ({
    level, color: LEVEL_COLORS[levelIndex % LEVEL_COLORS.length], points: rows.flatMap((period, index): MdcPoint[] => {
      const levelData = period.levels.find((item) => item.level === level);
      const ratios = levelData ? mdcRatios(levelData) : null;
      if (!levelData || !ratios) return [];
      const { cvRatio, biasRatio } = ratios;
      return [{ x: px(cvRatio), y: py(biasRatio), index, level, period: period.period, levelData, cvRatio, biasRatio, color: LEVEL_COLORS[levelIndex % LEVEL_COLORS.length] }];
    }),
  }));

  return <div className="sg-svg-chart"><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Biểu đồ quyết định phương pháp MDC">
    <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#fff" stroke="#dce3e9" />
    {ticks(y).map((value) => <g key={value}><line x1={L} y1={py(value)} x2={W - R} y2={py(value)} stroke="#e5ecef" strokeWidth=".7" /><text x={L - 7} y={py(value) + 3} fontSize="10.5" fill="#70818d" textAnchor="end">{value}</text></g>)}
    {ticks(x).map((value) => <text key={value} x={px(value)} y={H - B + 15} fontSize="10.5" fill="#70818d" textAnchor="middle">{value}</text>)}
    {SIGMA_BOUNDS.map(([sigma, color]) => {
      const x2 = Math.min(xMax, 100 / sigma), y2 = 100 - sigma * x2;
      return <g key={sigma}><line x1={px(0)} y1={py(100)} x2={px(x2)} y2={py(y2)} stroke={color} strokeWidth="1" strokeLinecap="round" opacity=".88" /><text x={px(x2) + 3} y={py(y2) - 6} fontSize="10.5" fill="#fff" stroke="#fff" strokeWidth="3" strokeLinejoin="round" fontWeight="700">{sigma}σ</text><text x={px(x2) + 3} y={py(y2) - 6} fontSize="10.5" fill={color} fontWeight="700">{sigma}σ</text></g>;
    })}
    {pointGroups.map(({ level, color, points }, levelIndex) => <g key={level}>
      {points.length > 1 && <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeOpacity=".3" strokeWidth=".9" strokeDasharray="3 3" />}
      {points.map((point) => <circle key={`${point.period}-${point.level}`} cx={point.x} cy={point.y} r={point.index === rows.length - 1 ? 4.8 : 3.2} fill={color} fillOpacity={point.index === rows.length - 1 ? .95 : .62} stroke="#fff" strokeWidth="1.2" className="sg-mdc-point" onMouseEnter={() => setTip(point)} onMouseLeave={() => setTip(null)} />)}
      <Legend level={level} index={levelIndex} />
    </g>)}
    <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#42515b" strokeWidth=".9" /><line x1={L} y1={T} x2={L} y2={H - B} stroke="#42515b" strokeWidth=".9" />
    <text x={(L + W - R) / 2} y={H - 7} fontSize="10.5" fill="#40515c" textAnchor="middle" fontWeight="700">CV / TEA (%)</text>
    <text transform={`translate(13,${(T + H - B) / 2}) rotate(-90)`} fontSize="10.5" fill="#40515c" textAnchor="middle" fontWeight="700">|BIAS| / TEA (%)</text>
  </svg>
  {tip && <div className="sg-chart-tooltip" style={{ left: `${tip.x / W * 100}%`, top: `${tip.y / H * 100}%` }}><b>{periodTitle(tip.period)} · Mức {tip.level}</b><div>Sigma: <strong style={{ color: tip.color }}>{Number(tip.levelData.sigma?.sigma).toFixed(2)}</strong></div><div>CV/TEa: {tip.cvRatio.toFixed(1)}% · |Bias|/TEa: {tip.biasRatio.toFixed(1)}%</div><div className="muted">CV {Number(tip.levelData.cv).toFixed(2)}% · Bias {Number(tip.levelData.biasEqa).toFixed(2)}%</div></div>}
  </div>;
}


