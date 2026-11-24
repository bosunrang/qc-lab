import { qcRunKey, compareQcRunKey } from '../../main/domain/sort-order';
// Biểu đồ Levey-Jennings và CUSUM dùng chung. Levey-Jennings có dải màu
// ±1/±2/±3SD, nhãn bậc SD bên trái, giá trị thật bên phải và nhãn ngày trục X.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { vnDate, vnDayMonth } from '../lib/format';
import { CHART_TEAL } from '../lib/chart-colors';
import { levelDash, markerShape, markerSize, pickRejectLabels, rejectRuleLabel, traceMarker } from '../lib/qc-marker';

export interface QcChartPoint {
  date: string; runId: string; val: number; z: number;
  verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[];
  /** Điểm có vào Mean/SD/CV thực hay không. `false` khi CẢ lần chạy bị loại. */
  accepted?: boolean;
  /** Mức nào trong cùng lần chạy đã bị loại — lý do một điểm "Đạt" vẫn không
   * vào thống kê. Rỗng/không có nghĩa là không biết lý do nào. */
  runRejectedBy?: number[];
}

/** Cách trình bày chuỗi đối chiếu trên cùng khung vẽ Levey-Jennings.
 * Giá trị, xếp loại và giới hạn do nơi gọi cung cấp; biểu đồ không đánh giá
 * lại nghiệp vụ. Không truyền thì giữ nguyên biểu đồ nội kiểm hiện có. */
export interface QcChartComparison {
  title: string;
  xTitle: string;
  unit: 'z' | '%';
  warning: number | null;
  rejection: number | null;
  labels: readonly string[];
  /** Nhóm (đợt ngoại kiểm) của từng điểm, đánh số 0, 1, 2… tăng dần. Có thì
   * trục X đặt mỗi nhóm một vị trí, điểm cùng nhóm nằm sát nhau và đường chỉ
   * nối điểm cùng thứ tự giữa các nhóm — mẫu khác nồng độ không nối với nhau. */
  groups?: readonly number[];
  /** Nhãn trục X của từng nhóm. */
  groupLabels?: readonly string[];
  /** Nhóm mở đầu một năm mới: vẽ vạch phân cách trước nhóm đó. */
  groupBreaks?: readonly number[];
  limits?: readonly (number | null)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  tooltip: (index: number) => ReactNode;
}

/** Điểm KHÔNG vào thống kê nhưng TỰ NÓ không vi phạm: cả lần chạy bị loại vì
 * một mức khác. Đây là ca dễ hiểu nhầm nhất của biểu đồ — chấm xanh nằm giữa
 * dải mà vẫn bị trừ khỏi n. Điểm tự bị loại đã có màu đỏ riêng nên không gộp
 * vào đây. */
function isRunCollateral(point: QcChartPoint): boolean {
  return point.accepted === false && point.verdict !== 'rej' && !!point.runRejectedBy?.length;
}
/** Màu điểm theo kết luận; Đạt lấy màu của đường (teal ở biểu đồ một mức,
 * màu của mức ở biểu đồ nhiều mức). */
function verdictColor(verdict: QcChartPoint['verdict'], okColor: string): string {
  return verdict === 'rej' ? LJ.rejectPoint : verdict === 'warn' ? LJ.warnPoint : okColor;
}

/** Vẽ một điểm QC: hình theo kết luận (`lib/qc-marker.ts`), viền trắng để
 * tách khỏi đường nối. Điểm không vào thống kê vì CẢ lần chạy bị loại vẽ
 * RỖNG cùng hình: màu và hình vẫn nói kết luận của chính điểm, phần rỗng nói
 * nó không vào Mean/SD/CV. Điểm tự bị loại không bao giờ rỗng — đó là biến
 * cố, không phải hệ quả. */
function drawPoint(ctx: CanvasRenderingContext2D, point: QcChartPoint, px: number, py: number, color: string) {
  const shape = markerShape(point.verdict), radius = markerSize(point.verdict);
  ctx.setLineDash([]); ctx.lineJoin = 'miter';
  traceMarker(ctx, shape, px, py, radius);
  if (isRunCollateral(point)) {
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke();
    return;
  }
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
}

export interface QcChartCusum {
  cPos: number[]; cNeg: number[]; flags: ('ok' | 'warn' | 'rej')[];
  /** Tham số thật của xét nghiệm, được IPC giữ nguyên từ domain CUSUM. */
  k?: number; h?: number; ma?: number[];
}

type LjHover = { left: number; top: number; level?: number; lot?: string; point: QcChartPoint; index?: number };
const VERDICT_TEXT: Record<QcChartPoint['verdict'], string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };

/** Tooltip điểm QC. Canvas không có phần tử điểm riêng để browser
 * tự hover, nên hit-test bằng đúng hình học đang dùng khi vẽ. */
function LjTooltip({ hit, decimals = 2 }: { hit: LjHover | null; decimals?: number }) {
  if (!hit) return null;
  const { point, level } = hit;
  const z = Number.isFinite(point.z) ? `${point.z >= 0 ? '+' : ''}${point.z.toFixed(2)}s` : '—';
  const date = vnDate(point.date, point.date);
  return <div className="qc-chart-tooltip" style={{ left: hit.left, top: hit.top }}>
    <b>{date}{level != null ? ` · Mức ${level}` : ''}</b>
    <div>Lần chạy: <strong>{point.runId || '—'}</strong></div>
    {hit.lot && <div>Lô: <strong>{hit.lot}</strong></div>}
    {/* Số thập phân của CHÍNH xét nghiệm, không phải 2 cố định: một xét
        nghiệm khai 0 hoặc 3 chữ số thì tooltip sẽ nói khác bảng bên cạnh. */}
    <div>Giá trị: {Number.isFinite(point.val) ? point.val.toFixed(decimals) : '—'}</div>
    <div>Z: {z}</div>
    <div className="muted">Kết luận: {VERDICT_TEXT[point.verdict]}</div>
    {isRunCollateral(point) && <div className="muted">Thống kê: không dùng — lần chạy bị loại ở {point.runRejectedBy!.map((level) => `Mức ${level}`).join(', ')}</div>}
    <div className="muted">Luật: {point.rules.length ? point.rules.join(', ') : 'Đạt'}</div>
  </div>;
}

/** Bảng màu chuẩn của biểu đồ Levey-Jennings. */
const LJ = {
  okBand: '#e8f6ef', okMid: '#ffffff', warnBand: '#fff3cf', rejectBand: '#f9d6d5',
  grid: '#5d6b76', mean: '#17212b', line: CHART_TEAL,
  okPoint: CHART_TEAL, warnPoint: '#dd8b1f', rejectPoint: '#c5221f',
} as const;

/** Chú giải hình điểm dưới biểu đồ Levey-Jennings, viết bằng HTML để trình
 * đọc màn hình đọc được (canvas thì không). Hình trùng `drawPoint()`.
 * Nhãn nói theo LUẬT chứ không theo khoảng SD: kết luận do bộ luật Westgard
 * đang bật của xét nghiệm quyết định (`westgard-engine.ts`). Một điểm trong
 * ±3SD vẫn bị loại theo 2-2s hay R-4s; 1-2s có thể cấu hình thành luật loại
 * hoặc tắt hẳn. Trước 02/11/2026 nhãn ghi "Trong ±2SD", "Cảnh báo 2–3SD",
 * "Loại bỏ ngoài 3SD". */
export function QcChartLegend() {
  return <ul className="qc-legend" aria-label="Chú giải biểu đồ Levey-Jennings">
    <li><span className="qc-mark ok" aria-hidden="true" />Đạt · không vi phạm luật đang bật</li>
    <li><span className="qc-mark warn" aria-hidden="true" />Cảnh báo · vi phạm luật chỉ cảnh báo (thường là 1-2s)</li>
    <li><span className="qc-mark rej" aria-hidden="true" />Loại bỏ theo luật Westgard · kèm tên luật</li>
    <li><span className="qc-mark excluded" aria-hidden="true" />Hình rỗng · lần chạy bị loại, không vào thống kê</li>
  </ul>;
}

/** Dải nền theo bậc SD — `leveyJenningsBandRects`, đúng thứ tự vẽ (dải sau
 * phủ lên dải trước, nên ±1SD trắng nằm cuối). */
const BANDS: { low: number; high: number; color: keyof typeof LJ }[] = [
  { low: 3, high: 3.25, color: 'rejectBand' },
  { low: -3.25, high: -3, color: 'rejectBand' },
  { low: 2, high: 3, color: 'warnBand' },
  { low: -3, high: -2, color: 'warnBand' },
  { low: -2, high: 2, color: 'okBand' },
  { low: -1, high: 1, color: 'okMid' },
];

const CUSUM_COLORS = { pos: CHART_TEAL, neg: '#4f789d', warn: '#dd8b1f', rej: '#c5221f' };

/** Chiều cao vẽ: mốc `height`; bật `responsiveHeight` thì giữ cùng tỷ lệ hình
 * học so với mốc 1180px, nhưng chỉ cho tăng tối đa 20% — ở trang Nhập QC, ẩn
 * sidebar/cây danh mục làm chiều rộng tăng hơn 40%, biểu đồ không được đẩy
 * các bảng phía dưới xuống quá xa. */
function renderHeightFor(width: number, height: number, responsiveHeight: boolean): number {
  return responsiveHeight ? Math.round(Math.max(height, Math.min(height * 1.2, (width / 1180) * height))) : height;
}

/**
 * Khung vẽ canvas dùng chung cho ba biểu đồ (kế hoạch kiến trúc D.8): đặt độ
 * phân giải bitmap theo `devicePixelRatio`, vẽ lại khi dữ liệu đổi và khi
 * khung chứa đổi kích thước. `paint` chỉ lo phần hình.
 *
 * - `draw` giữ MỘT tham chiếu suốt vòng đời (đọc props mới nhất qua ref):
 *   nếu `draw` đổi mỗi lần cha render (mảng `points`/`series` thường là tham
 *   chiếu mới dù nội dung không đổi), effect gắn `ResizeObserver` sẽ gỡ và
 *   gắn lại observer liên tục, có khoảng hở giữa hai lần.
 * - CHỈ đặt thuộc tính `width`/`height` của canvas (độ phân giải bitmap), không
 *   gán `style.width`: kích thước hiển thị do CSS `width:100%` quyết định nên
 *   canvas vẫn co giãn theo khung chứa.
 * - Vẽ lại theo CẢ `ResizeObserver` (khung chứa đổi vì layout xung quanh, vd
 *   thu/mở thanh điều hướng) LẪN `resize` của `window` (đổi cỡ cửa sổ thật):
 *   hai nguồn khác nhau; lỡ một nguồn không kích hoạt thì ô vẽ vẫn co giãn
 *   đúng, chỉ tạm kém sắc nét.
 */
function useCanvasDraw(
  height: number, responsiveHeight: boolean,
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  dataDeps: readonly unknown[],
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ height, responsiveHeight, paint });
  latest.current = { height, responsiveHeight, paint };
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { height, responsiveHeight, paint } = latest.current;
    const width = wrap.clientWidth || 600;
    const renderHeight = renderHeightFor(width, height, responsiveHeight);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(renderHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, renderHeight);
    paint(ctx, width, renderHeight);
  }, []);
  // Vẽ lại khi DỮ LIỆU đổi; mỗi biểu đồ khai đúng các prop dữ liệu của nó.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { draw(); }, [...dataDeps, height, responsiveHeight, draw]);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    window.addEventListener('resize', draw);
    return () => { observer.disconnect(); window.removeEventListener('resize', draw); };
  }, [draw]);
  return { canvasRef, wrapRef };
}

export function QcChart({ mode, points, cusum, mean, sd, lot, decimals = 2, height = 220, responsiveHeight = false, className, comparison }: {
  mode: 'lj' | 'cusum'; points: QcChartPoint[]; cusum?: QcChartCusum;
  /** Mean/SD đích của mức, dùng để in giá trị thật ở trục Y bên phải. */
  mean?: number | null; sd?: number | null; lot?: string; decimals?: number;
  height?: number; responsiveHeight?: boolean; className?: string;
  comparison?: QcChartComparison;
}) {
  const [ljHover, setLjHover] = useState<LjHover | null>(null);
  const { canvasRef, wrapRef } = useCanvasDraw(height, responsiveHeight, (ctx, width, renderHeight) => {
    if (mode === 'lj') drawLJ(ctx, width, renderHeight, points, mean, sd, decimals, comparison);
    else drawCusum(ctx, width, renderHeight, cusum || { cPos: [], cNeg: [], flags: [] });
  }, [mode, points, cusum, mean, sd, decimals, comparison]);
  // Tooltip đọc props mới nhất qua ref để hàm xử lý giữ một tham chiếu.
  const argsRef = useRef({ mode, points, cusum, mean, sd, lot, comparison });
  argsRef.current = { mode, points, cusum, mean, sd, lot, comparison };

  /** CUSUM là canvas nên không có từng điểm DOM để browser tự hiện title.
   * Tìm điểm gần con trỏ theo cùng hình học x của hàm vẽ, sau đó đặt native
   * tooltip (hỗ trợ cả chuột lẫn bàn phím/trình đọc màn hình qua `title`). */
  const updateCusumTooltip = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { mode, points, cusum } = argsRef.current;
    if (!canvas || mode !== 'cusum' || !points.length || !cusum?.cPos.length) return;
    const rect = canvas.getBoundingClientRect();
    const padL = 56, padR = 78, markPad = 10;
    const chartWidth = Math.max(1, rect.width - padL - padR - markPad * 2);
    const rawIndex = Math.round(((event.clientX - rect.left - padL - markPad) / chartWidth) * (points.length - 1));
    const index = Math.max(0, Math.min(points.length - 1, rawIndex));
    const number = (value: number | undefined) => Number.isFinite(value) ? (value as number).toFixed(2) : '—';
    canvas.title = `${vnDate(points[index].date, points[index].date)}\nCUSUM+: ${number(cusum.cPos[index])}\nCUSUM−: ${number(cusum.cNeg[index])}\nMA(5): ${number(cusum.ma?.[index])}${cusum.flags[index] === 'rej' ? '\nVượt ngưỡng h' : '\nTrong tầm kiểm soát'}`;
  }, [canvasRef]);

  const updateLjTooltip = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { mode, points, mean, sd, lot, comparison } = argsRef.current;
    if (!canvas || mode !== 'lj' || !points.length) { setLjHover(null); return; }
    const rect = canvas.getBoundingClientRect();
    const hasTarget = mean != null && sd != null && sd > 0;
    const targetMean = hasTarget ? (mean as number) : 0, targetSd = hasTarget ? (sd as number) : 1;
    const { x: plainX, clampY, padL, padT, cw, ch, markPad } = geometry(rect.width, rect.height, points.length, targetMean, targetSd,
      comparison ? comparisonScale(points, comparison).limit : undefined, comparison ? COMPARISON_PAD_R : undefined);
    const x = groupLayout(points.length, comparison, padL, cw, markPad)?.x ?? plainX;
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    let hit: QcChartPoint | null = null;
    let hitIndex = -1;
    let closest = 14;
    points.forEach((point, index) => {
      // Cùng `plotValue()` mà `drawLJ()` dùng — hai công thức riêng thì vùng
      // bắt hover trôi khỏi chấm đang vẽ.
      const value = plotValue(point, hasTarget, targetMean, targetSd);
      if (!Number.isFinite(value)) return;
      const radius = markerSize(point.verdict);
      const pointY = Math.max(padT + radius, Math.min(padT + ch - radius, clampY(value)));
      const distance = Math.hypot(px - x(index), py - pointY);
      if (distance <= closest) { closest = distance; hit = point; hitIndex = index; }
    });
    if (!hit) { setLjHover(null); return; }
    const left = Math.min(window.innerWidth - 248, event.clientX + 14);
    const top = Math.min(window.innerHeight - 142, event.clientY + 14);
    setLjHover({ left: Math.max(12, left), top: Math.max(12, top), lot, point: hit, index: hitIndex });
  }, [canvasRef]);

  const chartAriaLabel = comparison ? `${comparison.title}, ${points.filter((p) => Number.isFinite(p.z)).length} kết quả. Dùng phím mũi tên để chọn mẫu.` : mode === 'lj'
    ? `Biểu đồ Levey-Jennings${lot ? ` lô ${lot}` : ''}, ${points.length} điểm QC trong khoảng xem.`
    : `Biểu đồ CUSUM, ${points.length} điểm QC trong khoảng xem.`;

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} className={className} role="img" aria-label={chartAriaLabel} tabIndex={comparison ? 0 : undefined}
        onClick={() => { if (comparison && ljHover?.index !== undefined && points[ljHover.index] === ljHover.point) comparison.onSelect(ljHover.index); }}
        onKeyDown={(event) => {
          if (!comparison) return;
          const available = points.flatMap((p, i) => Number.isFinite(p.z) ? [i] : []);
          if (!available.length) return;
          const current = Math.max(0, available.indexOf(comparison.selectedIndex));
          const next = event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1)!
            : event.key === 'ArrowLeft' ? available[Math.max(0, current - 1)] : event.key === 'ArrowRight' ? available[Math.min(available.length - 1, current + 1)]
            : event.key === 'Enter' || event.key === ' ' ? available[current] : undefined;
          if (next !== undefined) { event.preventDefault(); comparison.onSelect(next); }
        }}
        onPointerMove={(event) => { updateCusumTooltip(event); updateLjTooltip(event); }}
        onPointerDown={comparison ? updateLjTooltip : undefined}
        onPointerLeave={() => { if (canvasRef.current) canvasRef.current.title = ''; setLjHover(null); }}
        style={{ width: '100%', height: responsiveHeight ? 'auto' : height, display: 'block' }} />
      {comparison ? <>
        <span className="sr-only" aria-live="polite">{comparison.labels[comparison.selectedIndex] ?? ''}</span>
        {ljHover?.index !== undefined && points[ljHover.index] === ljHover.point && <div className="qc-chart-tooltip" style={{ left: ljHover.left, top: ljHover.top }}>{comparison.tooltip(ljHover.index)}</div>}
      </> : <LjTooltip hit={ljHover} decimals={decimals} />}
    </div>
  );
}

/** Hình học biểu đồ: chừa 56px bên trái cho bậc SD,
 * 78px bên phải cho giá trị thật, 34px trên cho tiêu đề, 48px dưới cho ngày;
 * trục Y phủ ±3.25SD (rộng hơn ±3 để dải "ngoài 3SD" có chỗ hiện). */
function geometry(width: number, height: number, count: number, mean: number, sd: number, extent = 3.25, padR = 78) {
  const padL = 56, padT = 34, padB = 48;
  const cw = width - padL - padR, ch = height - padT - padB, markPad = 10;
  const top = mean + extent * sd, bottom = mean - extent * sd;
  const y = (value: number) => padT + ((top - value) / (top - bottom)) * ch;
  const clampY = (value: number) => Math.max(padT, Math.min(padT + ch, y(value)));
  const x = (index: number) => (count <= 1 ? padL + cw / 2 : padL + markPad + (index / (count - 1)) * (cw - markPad * 2));
  return { padL, padT, cw, ch, markPad, y, clampY, x };
}

/** Biểu đồ đối chiếu không in giá trị thật bên phải (trùng nhãn bên trái),
 * nên chỉ chừa lề phải đủ cho nhãn điểm. */
const COMPARISON_PAD_R = 24;

/** Trục X gom theo nhóm: mỗi nhóm một khoảng bằng nhau, điểm cùng nhóm đặt
 * sát nhau quanh tâm khoảng. `null` khi không gom. */
function groupLayout(n: number, comparison: QcChartComparison | undefined, padL: number, cw: number, markPad: number) {
  const groups = comparison?.groups;
  if (!groups || groups.length !== n || !n) return null;
  const count = Math.max(...groups) + 1;
  const sizes = new Array<number>(count).fill(0);
  const order = groups.map((g) => sizes[g]++);
  const widest = Math.max(...sizes);
  const inner = cw - markPad * 2, pitch = inner / count;
  const step = widest > 1 ? Math.min(14, (pitch * 0.5) / (widest - 1)) : 0;
  const center = (g: number) => padL + markPad + (g + 0.5) * pitch;
  return {
    count, order, widest, center,
    boundary: (g: number) => padL + markPad + g * pitch,
    x: (i: number) => center(groups[i]) + (order[i] - (sizes[groups[i]] - 1) / 2) * step,
  };
}

/** Toạ độ theo trục giá trị của MỘT điểm trên biểu đồ Levey-Jennings.
 *
 * Luôn đặt điểm theo `z` của chính nó, quy về thang của dải đang hiển thị —
 * KHÔNG phải theo `val` trên Mean/SD hiện hành. `z` do main tính qua
 * `pointTarget()`, tức theo Mean/SD đã CHỐT lúc nhập (`qc_mean`/`qc_sd`), y
 * hệt cái đã quyết định màu Đạt/Cảnh báo/Loại bỏ của điểm.
 *
 * Nếu đặt theo `val` thì sau một lần "Thiết lập dải PXN"/"Hoàn dải NSX" (hoặc
 * sửa Mean/SD ở Cấu hình chung), toàn bộ điểm cũ bị vẽ lại trên dải MỚI trong
 * khi kết luận vẫn giữ theo dải CŨ: chấm đỏ nằm gọn trong ±2SD, chấm xanh lại
 * ra ngoài ±3SD — hình vẽ nói ngược bảng ngay bên cạnh. Chính lớp lỗi mà
 * snapshot Mean/SD từng điểm được sinh ra để chặn (xem `pointTarget()`).
 *
 * Đánh đổi có chủ đích: nhãn giá trị thật ở trục Y bên phải chỉ đúng cho dải
 * đang dùng, nên một điểm thuộc dải cũ không nằm đúng vạch giá trị của nó.
 * Tooltip vẫn in giá trị thật và z thật của điểm. */
function plotValue(point: QcChartPoint, hasTarget: boolean, mean: number, sd: number): number {
  if (!hasTarget) return point.z;
  return Number.isFinite(point.z) ? mean + point.z * sd : point.val;
}

/** Nhãn trục X: tối đa 5 mốc, định dạng dd/mm. */
function ticksOf(points: QcChartPoint[], maxTicks = 5) {
  const count = points.length;
  if (!count) return [] as { index: number; label: string }[];
  const total = Math.min(maxTicks, count);
  const indices = total === 1 ? [0] : [...new Set(Array.from({ length: total }, (_, i) => Math.round((i * (count - 1)) / (total - 1))))];
  return indices.map((index) => {
    const raw = String(points[index].date || '');
    const label = vnDayMonth(raw, raw.slice(0, 5));
    return { index, label };
  });
}

/** Chỉ chọn thang vẽ đối xứng quanh 0; không tính lại kết luận của điểm.
 * Thang phần trăm giữ đơn vị thật và TEa riêng của mỗi mẫu. */
function comparisonScale(points: QcChartPoint[], comparison: QcChartComparison) {
  const peak = Math.max(0, ...points.map((p) => Number.isFinite(p.z) ? Math.abs(p.z) : 0), ...(comparison.limits ?? []).map((v) => v ?? 0));
  if (comparison.unit === 'z') {
    const rejection = comparison.rejection ?? 3, warning = comparison.warning ?? 2;
    // Chừa ít nhất 0,5 đơn vị z trên điểm cao nhất: viền chọn và nhãn của điểm
    // không chấp nhận không dính mép vùng vẽ.
    const limit = Math.max(rejection + 0.25, peak * 1.12, peak + 0.5);
    const ticks = [...new Set([-rejection, -warning, -1, 0, 1, warning, rejection])].filter((v) => Math.abs(v) <= limit).sort((a, b) => b - a);
    return { limit, ticks };
  }
  const rough = Math.max(peak, 1) / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((n) => n * power).find((n) => n >= rough) ?? power * 10;
  const limit = Math.ceil(Math.max(peak, 1) * 1.12 / step) * step;
  const ticks = Array.from({ length: Math.round(2 * limit / step) + 1 }, (_, i) => Number((limit - i * step).toPrecision(8)));
  return { limit, ticks };
}

function drawLJ(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  points: QcChartPoint[], meanIn?: number | null, sdIn?: number | null, decimals = 2,
  comparison?: QcChartComparison,
) {
  // Không có Mean/SD đích thì vẽ theo thang z (mean 0, sd 1).
  const hasTarget = meanIn != null && sdIn != null && sdIn > 0;
  const mean = hasTarget ? (meanIn as number) : 0;
  const sd = hasTarget ? (sdIn as number) : 1;
  const n = points.length;
  const scale = comparison ? comparisonScale(points, comparison) : null;
  const { padL, padT, cw, ch, markPad, y, clampY, x: plainX } = geometry(width, height, n, mean, sd, scale?.limit, comparison ? COMPARISON_PAD_R : undefined);
  const layout = groupLayout(n, comparison, padL, cw, markPad);
  const x = layout?.x ?? plainX;
  const gridLevels = scale?.ticks ?? [3, 2, 1, 0, -1, -2, -3];
  const bands = comparison ? comparison.unit === 'z' ? [
    { low: comparison.rejection ?? 3, high: scale!.limit, color: 'rejectBand' as const },
    { low: -scale!.limit, high: -(comparison.rejection ?? 3), color: 'rejectBand' as const },
    { low: comparison.warning ?? 2, high: comparison.rejection ?? 3, color: 'warnBand' as const },
    { low: -(comparison.rejection ?? 3), high: -(comparison.warning ?? 2), color: 'warnBand' as const },
    { low: -(comparison.warning ?? 2), high: comparison.warning ?? 2, color: 'okBand' as const },
    { low: -Math.min(1, comparison.warning ?? 2), high: Math.min(1, comparison.warning ?? 2), color: 'okMid' as const },
  ] : [] : BANDS;

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = comparison?.unit === '%' ? LJ.okMid : LJ.okBand; ctx.fillRect(padL, padT, cw, ch);
  ctx.save();
  ctx.beginPath(); ctx.rect(padL - markPad, padT, cw + markPad * 2, ch); ctx.clip();
  for (const band of bands) {
    const bandTop = y(mean + band.high * sd);
    ctx.fillStyle = LJ[band.color];
    ctx.fillRect(padL, bandTop, cw, y(mean + band.low * sd) - bandTop);
  }
  // Dải TEa thay đổi theo mẫu: mỗi đoạn nằm trên đúng khoảng của mẫu đó,
  // không nối qua mẫu thiếu TEa và không đổi phần trăm thành z hay SD.
  comparison?.limits?.forEach((limit, i) => {
    if (limit === null || !Number.isFinite(limit)) return;
    const left = i === 0 ? padL : (x(i - 1) + x(i)) / 2;
    const right = i === n - 1 ? padL + cw : (x(i) + x(i + 1)) / 2;
    ctx.fillStyle = LJ.okBand; ctx.fillRect(left, y(limit), right - left, y(-limit) - y(limit));
  });
  // Đường kẻ theo bậc SD; bậc 0 (Mean) đậm hơn — `leveyJenningsGridLines`.
  for (const z of gridLevels) {
    const gy = y(mean + z * sd);
    ctx.strokeStyle = z === 0 ? LJ.mean : LJ.grid;
    ctx.lineWidth = z === 0 ? 1.8 : 1.15;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + cw, gy); ctx.stroke();
  }
  // Vạch đứt phân cách năm, nằm dưới điểm và đường TEa.
  if (layout) for (const g of comparison?.groupBreaks ?? []) {
    if (g <= 0 || g >= layout.count) continue;
    const bx = layout.boundary(g);
    ctx.strokeStyle = LJ.mean; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(bx, padT); ctx.lineTo(bx, padT + ch); ctx.stroke();
    ctx.setLineDash([]);
  }
  comparison?.limits?.forEach((limit, i) => {
    if (limit === null || !Number.isFinite(limit)) return;
    const left = i === 0 ? padL : (x(i - 1) + x(i)) / 2;
    const right = i === n - 1 ? padL + cw : (x(i) + x(i + 1)) / 2;
    ctx.strokeStyle = LJ.rejectPoint; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    for (const sign of [-1, 1]) { ctx.beginPath(); ctx.moveTo(left, y(sign * limit)); ctx.lineTo(right, y(sign * limit)); ctx.stroke(); }
    ctx.setLineDash([]);
  });
  ctx.restore();

  ctx.font = '700 13.5px Manrope,system-ui,sans-serif';
  ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(comparison?.title ?? 'Levey-Jennings', padL + cw / 2, padT - 8);

  // Trục Y: bậc SD bên trái ('> +3'/'< -3' ở hai đầu), giá trị thật bên phải.
  // Biểu đồ đối chiếu chỉ có nhãn bên trái: bên phải sẽ lặp đúng giá trị đó.
  ctx.font = '700 13px Manrope,system-ui,sans-serif';
  ctx.textBaseline = 'middle';
  for (const z of gridLevels) {
    const yy = y(mean + z * sd);
    const left = comparison ? `${z > 0 ? '+' : ''}${z}${comparison.unit === '%' ? '%' : ''}` : z === 3 ? '> +3' : z === -3 ? '< -3' : String(z);
    ctx.fillStyle = '#17212b';
    ctx.textAlign = 'right'; ctx.fillText(left, padL - 9, yy);
    if (comparison) continue;
    ctx.textAlign = 'left';
    ctx.fillText(hasTarget ? (mean + z * sd).toFixed(decimals) : `${z > 0 ? '+' : ''}${z}SD`, padL + cw + 10, yy);
  }

  if (!n) {
    ctx.fillStyle = '#7b838e'; ctx.font = '600 14px Manrope,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Chưa có điểm QC trong khoảng xem', padL + cw / 2, padT + ch / 2);
    return;
  }

  const valueOf = (p: QcChartPoint) => plotValue(p, hasTarget, mean, sd);
  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
  // Đường biểu đồ nối toàn bộ quan sát theo thời gian, kể cả điểm bị loại, để
  // diễn biến dẫn tới vi phạm không bị đứt đoạn. Việc loại khỏi Mean/SD/CV do
  // tầng trình bày bên ngoài xử lý bằng cờ `accepted`.
  if (points.length > 1) {
    ctx.strokeStyle = LJ.line; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    // Gom theo nhóm: mỗi thứ tự trong nhóm (mẫu 1, mẫu 2…) là một đường riêng.
    for (let lane = 0; lane < (layout?.widest ?? 1); lane++) {
      let connected = false;
      points.forEach((point, i) => {
        if (layout && layout.order[i] !== lane) return;
        const value = valueOf(point);
        if (!Number.isFinite(value)) { connected = false; return; }
        const px = x(i), py = clampY(value);
        if (connected) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        connected = true;
      });
    }
    ctx.stroke();
  }
  const marks = points.flatMap((p, i) => {
    if (!Number.isFinite(valueOf(p))) return [];
    const radius = markerSize(p.verdict);
    // Giữ trọn marker trong vùng vẽ khi giá trị nằm ngoài ±3.25SD.
    const px = x(i), py = Math.max(padT + radius, Math.min(padT + ch - radius, clampY(valueOf(p))));
    if (comparison?.selectedIndex === i) {
      traceMarker(ctx, markerShape(p.verdict), px, py, radius + 4);
      ctx.strokeStyle = LJ.line; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
    }
    drawPoint(ctx, p, px, py, comparison && p.verdict === 'none' ? '#7b838e' : verdictColor(p.verdict, LJ.okPoint));
    return [{ p, px, py, radius }];
  });
  ctx.restore();

  // Tên luật cạnh điểm Loại, đặt về phía giữa biểu đồ để không ra khỏi vùng vẽ.
  ctx.font = '700 13px Manrope,system-ui,sans-serif';
  ctx.textAlign = 'center';
  const rejects = marks.filter((m) => m.p.verdict === 'rej' && m.p.rules.length);
  // Tâm nhãn kẹp trong vùng vẽ: điểm sát hai đầu trục không đẩy nhãn đè lên
  // nhãn trục Y ở hai bên.
  const labels = rejects.map((m) => {
    const text = comparison ? m.p.rules[0] : rejectRuleLabel(m.p.rules);
    const width = ctx.measureText(text).width;
    return { text, width, x: Math.min(padL + cw - width / 2, Math.max(padL + width / 2, m.px)), above: m.py > padT + ch / 2 };
  });
  const picked = pickRejectLabels(labels.map(({ x, above, width }) => ({ x, above, width })));
  for (const i of picked) {
    const m = rejects[i], { text, above, x: tx } = labels[i];
    ctx.textBaseline = above ? 'bottom' : 'top';
    const ty = above ? m.py - m.radius - 3 : m.py + m.radius + 3;
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.strokeText(text, tx, ty);
    ctx.fillStyle = LJ.rejectPoint; ctx.fillText(text, tx, ty);
  }

  ctx.fillStyle = '#536772'; ctx.font = '700 13px Manrope,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  if (layout) {
    // Giãn nhãn theo chiều rộng chữ thực tế; tự bớt nhãn khi khung hẹp.
    const labelWidth = Math.max(0, ...(comparison?.groupLabels ?? []).map((label) => ctx.measureText(label).width));
    const pitch = layout.count > 1 ? layout.center(1) - layout.center(0) : cw;
    const step = Math.max(1, Math.ceil(Math.max(60, labelWidth + 16) / Math.max(1, pitch)));
    const picks = Array.from({ length: Math.ceil(layout.count / step) }, (_, i) => i * step);
    const last = layout.count - 1;
    if (picks.at(-1) !== last) {
      // Giữ nhãn đợt cuối, bỏ nhãn sát nó nếu không còn đủ khoảng trống.
      if (last - picks[picks.length - 1] < step) picks.pop();
      picks.push(last);
    }
    for (const g of picks) ctx.fillText(comparison?.groupLabels?.[g] ?? '', layout.center(g), padT + ch + 10);
  } else for (const tick of ticksOf(points, comparison ? Math.max(1, Math.floor(cw / 140)) : 5)) {
    const label = comparison ? comparison.labels[tick.index] ?? '' : tick.label;
    ctx.fillText(label, x(tick.index), padT + ch + 10);
  }
  if (comparison) { ctx.textBaseline = 'bottom'; ctx.fillText(comparison.xTitle, padL + cw / 2, height - 2); }
}

/** Màu theo mức cho biểu đồ tổng hợp nhiều mức. */
const MULTI_COLORS = [CHART_TEAL, '#7a4f9a', '#c47d12', '#2f7d5b', '#5369a6', '#9a5b3c'];
const MULTI_CUSUM_COLORS = [
  [CHART_TEAL, '#5369a6'], ['#7a4f9a', '#c47d12'], ['#2f7d5b', '#9a5b3c'],
] as const;

/** `label` chỉ cần khi một mức có NHIỀU đường (mức hiện hành + lô cũ khi bật
 * "Xem lô cũ"): thiếu nó chú giải in "Mức 1" hai lần với hai màu. */
export interface QcMultiLevelSeries { level: number; lot?: string; label?: string; points: QcChartPoint[] }

/** Biểu đồ "Levey-Jennings tổng hợp" — quy đổi mọi mức về Z-score để so sánh
 * trên cùng trục, mỗi mức một màu. Trục X dùng ngày chung của mọi mức.
 * Chỉ hiện khi có ≥2 mức (trang gọi component này có điều kiện đó). */
export function QcMultiChart({ series, height = 220, responsiveHeight = false, className, decimals = 2 }: { series: QcMultiLevelSeries[]; height?: number; responsiveHeight?: boolean; className?: string; decimals?: number }) {
  const [ljHover, setLjHover] = useState<LjHover | null>(null);
  const { canvasRef, wrapRef } = useCanvasDraw(height, responsiveHeight, (ctx, width, renderHeight) => drawMulti(ctx, width, renderHeight, series), [series]);
  const argsRef = useRef({ series });
  argsRef.current = { series };

  const updateLjTooltip = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { series } = argsRef.current;
    const dates = Array.from(new Set(series.flatMap((item) => item.points.map(qcRunKey)))).sort(compareQcRunKey);
    if (!dates.length) { setLjHover(null); return; }
    const rect = canvas.getBoundingClientRect();
    const dateIndex = new Map(dates.map((date, index) => [date, index]));
    const { x, clampY } = geometry(rect.width, rect.height, dates.length, 0, 1);
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    const candidates = series.flatMap((item) => item.points.flatMap((point) => {
      const index = dateIndex.get(qcRunKey(point));
      if (index == null || !Number.isFinite(point.z)) return [];
      return [{ point, level: item.level, lot: item.lot, distance: Math.hypot(px - x(index), py - clampY(point.z)) }];
    }));
    const hit = candidates.reduce<{ point: QcChartPoint; level: number; lot?: string; distance: number } | null>(
      (closest, candidate) => candidate.distance <= 14 && (!closest || candidate.distance < closest.distance) ? candidate : closest,
      null,
    );
    if (!hit) { setLjHover(null); return; }
    const left = Math.min(window.innerWidth - 248, event.clientX + 14);
    const top = Math.min(window.innerHeight - 142, event.clientY + 14);
    setLjHover({ left: Math.max(12, left), top: Math.max(12, top), level: hit.level, lot: hit.lot, point: hit.point });
  }, [canvasRef]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} className={className} onPointerMove={updateLjTooltip} onPointerLeave={() => setLjHover(null)}
        style={{ width: '100%', height: responsiveHeight ? 'auto' : height, display: 'block' }} />
      <LjTooltip hit={ljHover} decimals={decimals} />
    </div>
  );
}

/** Vẽ "Levey-Jennings tổng hợp" ra ảnh PNG (data URL) để chèn vào bản in PDF.
 * Dùng đúng `drawMulti()` của biểu đồ trên màn hình, vẽ ở độ phân giải gấp
 * `scale` lần để bản in không nhoè: 1100 × 3 = 3300 điểm ảnh trải trên khoảng
 * 277 mm bề ngang A4 nằm ngang, tức khoảng 300 DPI, ngưỡng in sắc nét. Bảng
 * màu cố định nên ảnh luôn nền sáng, kể cả khi ứng dụng đang ở chế độ tối. */
export function renderQcMultiChartPng(series: QcMultiLevelSeries[], width = 1100, height = 320, scale = 3): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawMulti(ctx, width, height, series);
  return canvas.toDataURL('image/png');
}

function drawMulti(ctx: CanvasRenderingContext2D, width: number, height: number, series: QcMultiLevelSeries[]) {
  const dates = Array.from(new Set(series.flatMap((s) => s.points.map(qcRunKey)))).sort(compareQcRunKey);
  const n = dates.length;
  const dateIndex = new Map(dates.map((d, i) => [d, i]));
  const { padL, padT, cw, ch, markPad, y, clampY, x } = geometry(width, height, n, 0, 1);

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LJ.okBand; ctx.fillRect(padL, padT, cw, ch);
  ctx.save();
  ctx.beginPath(); ctx.rect(padL - markPad, padT, cw + markPad * 2, ch); ctx.clip();
  for (const band of BANDS) {
    const bandTop = y(band.high);
    ctx.fillStyle = LJ[band.color];
    ctx.fillRect(padL, bandTop, cw, y(band.low) - bandTop);
  }
  for (const z of [3, 2, 1, 0, -1, -2, -3]) {
    const gy = y(z);
    ctx.strokeStyle = z === 0 ? LJ.mean : LJ.grid;
    ctx.lineWidth = z === 0 ? 1.8 : 1.15;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + cw, gy); ctx.stroke();
  }
  ctx.restore();

  ctx.font = '700 13.5px Manrope,system-ui,sans-serif';
  ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Levey-Jennings tổng hợp', padL + cw / 2, padT - 8);

  ctx.font = '700 13px Manrope,system-ui,sans-serif'; ctx.textBaseline = 'middle';
  for (const z of [3, 2, 1, 0, -1, -2, -3]) {
    const yy = y(z);
    const left = z === 3 ? '> +3' : z === -3 ? '< -3' : String(z);
    ctx.fillStyle = '#17212b';
    ctx.textAlign = 'right'; ctx.fillText(left, padL - 9, yy);
    ctx.textAlign = 'left'; ctx.fillText(`${z > 0 ? '+' : ''}${z}SD`, padL + cw + 10, yy);
  }

  if (!n) {
    ctx.fillStyle = '#7b838e'; ctx.font = '600 14px Manrope,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Chưa có điểm QC trong khoảng xem', padL + cw / 2, padT + ch / 2);
    return;
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
  series.forEach((s, li) => {
    const color = MULTI_COLORS[li % MULTI_COLORS.length];
    const pts = s.points.filter((p) => dateIndex.has(qcRunKey(p)));
    if (pts.length > 1) {
      // Mỗi mức một kiểu nét (liền/gạch/chấm) kèm màu: in đen trắng vẫn tách được mức.
      ctx.strokeStyle = color; ctx.lineWidth = 2.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(levelDash(li));
      ctx.beginPath();
      pts.forEach((p, j) => { const px = x(dateIndex.get(qcRunKey(p))!), py = clampY(p.z); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
    // Cùng quy ước với `drawLJ()`. Điểm rỗng là điểm không vào thống kê vì cả
    // lần chạy bị loại. Bảng ngay dưới biểu đồ đã ghi "Lần chạy bị loại ở Mức N"
    // cho đúng những điểm đó, nên biểu đồ và bảng phải nói cùng một chuyện.
    pts.forEach((p) => {
      const radius = markerSize(p.verdict);
      const px = x(dateIndex.get(qcRunKey(p))!), py = Math.max(padT + radius, Math.min(padT + ch - radius, clampY(p.z)));
      drawPoint(ctx, p, px, py, verdictColor(p.verdict, color));
    });
  });
  ctx.restore();

  ctx.fillStyle = '#536772'; ctx.font = '700 13px Manrope,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const maxTicks = 5, total = Math.min(maxTicks, n);
  const tickIdx = total === 1 ? [0] : [...new Set(Array.from({ length: total }, (_, i) => Math.round((i * (n - 1)) / (total - 1))))];
  for (const i of tickIdx) { const raw = dates[i].split('\u0000')[0]; ctx.fillText(vnDayMonth(raw, raw.slice(0, 5)), x(i), padT + ch + 10); }

  // Chú giải theo mức: đoạn nét cùng màu và kiểu nét của đường.
  let lx = padL + 8; const ly = 10;
  ctx.font = '700 13.5px Manrope,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  series.forEach((s, li) => {
    const color = MULTI_COLORS[li % MULTI_COLORS.length];
    const label = s.label || `Mức ${s.level}`;
    ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineCap = 'butt'; ctx.setLineDash(levelDash(li));
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 22, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#17212b'; ctx.fillText(label, lx + 29, ly);
    lx += 29 + ctx.measureText(label).width + 18;
  });
}

function drawCusum(ctx: CanvasRenderingContext2D, width: number, height: number, cs: QcChartCusum) {
  const padL = 56, padR = 78, padT = 34, padB = 32, markPad = 10;
  const cw = width - padL - padR, ch = height - padT - padB;
  const k = cs.k ?? 0.5;
  const h = cs.h ?? 4;
  const ma = cs.ma || [];
  const yMax = Math.max(h * 1.15, 1, ...cs.cPos.map(Math.abs), ...cs.cNeg.map(Math.abs), ...ma.filter(Number.isFinite).map(Math.abs));
  const yOf = (v: number) => padT + ch * (1 - (v + yMax) / (2 * yMax));
  const clampY = (v: number) => Math.max(padT, Math.min(padT + ch, yOf(v)));

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.font = '700 13.5px Manrope,system-ui,sans-serif';
  ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`CUSUM xu hướng (k=${k.toFixed(2)}, h=${h.toFixed(2)})`, padL + cw / 2, padT - 8);

  ctx.font = '700 13px Manrope,system-ui,sans-serif'; ctx.textBaseline = 'middle';
  for (const v of [h, 0, -h]) {
    const gy = yOf(v);
    ctx.strokeStyle = v === 0 ? LJ.mean : '#e2a8a2';
    ctx.lineWidth = v === 0 ? 1.8 : 1.15;
    ctx.setLineDash(v === 0 ? [] : [4, 3]);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + cw, gy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#17212b'; ctx.textAlign = 'right';
    ctx.fillText(v === 0 ? '0' : `h=${v > 0 ? '+' : ''}${v}`, padL - 9, gy);
  }

  const n = cs.cPos.length;
  if (!n) {
    ctx.fillStyle = '#7b838e'; ctx.font = '600 14px Manrope,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Chưa có dữ liệu CUSUM', padL + cw / 2, padT + ch / 2);
    return;
  }
  const x = (i: number) => (n <= 1 ? padL + cw / 2 : padL + markPad + (i / (n - 1)) * (cw - markPad * 2));
  // Khi có nhiều tháng dữ liệu, giữ biểu đồ nhẹ nhưng không bao giờ bỏ điểm
  // vượt ngưỡng.
  const maxPoints = Math.max(80, Math.floor(Math.max(240, cw / 2) / 3));
  const sampled = n <= maxPoints ? Array.from({ length: n }, (_, i) => i) : (() => {
    const keep = new Set<number>([0, n - 1]);
    const step = Math.ceil(n / maxPoints);
    for (let i = 0; i < n; i += step) keep.add(i);
    cs.flags.forEach((flag, i) => { if (flag === 'rej') keep.add(i); });
    return [...keep].sort((a, b) => a - b);
  })();

  ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
  const series = (values: number[], color: string, dash: number[] = []) => {
    const visible = sampled.filter((i) => Number.isFinite(values[i]));
    if (visible.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash);
    ctx.beginPath();
    visible.forEach((i, order) => { const px = x(i), py = clampY(values[i]); if (order) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
  };
  series(ma, '#9aa7b0', [3, 3]);
  series(cs.cPos, CUSUM_COLORS.pos);
  series(cs.cNeg, CUSUM_COLORS.neg);
  ctx.setLineDash([]);
  sampled.forEach((i) => {
    const rejected = cs.flags[i] === 'rej';
    for (const [value, color] of [[cs.cPos[i], CUSUM_COLORS.pos], [cs.cNeg[i], CUSUM_COLORS.neg]] as const) {
      if (!Number.isFinite(value)) continue;
      const exceeds = rejected && Math.abs(value) >= h - 1e-9;
      ctx.fillStyle = exceeds ? CUSUM_COLORS.rej : color;
      // Vượt ngưỡng h là tín hiệu loại: vuông đỏ như điểm Loại trên L-J.
      traceMarker(ctx, exceeds ? 'square' : 'circle', x(i), clampY(value), exceeds ? 5 : 3); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
    }
  });
  ctx.restore();
}

export interface QcMultiCusumSeries { level: number; points: QcChartPoint[]; cusum: QcChartCusum }

/** CUSUM tổng hợp: MỖI mức vẫn cộng dồn độc lập theo Mean/SD của chính mức
 * đó; biểu đồ này chỉ dùng chung trục thời gian/giá trị để đối chiếu, tuyệt
 * đối không gộp hai chuỗi vào cùng một phép tính CUSUM. */
export function QcMultiCusumChart({ series, height = 300, responsiveHeight = false, className }: { series: QcMultiCusumSeries[]; height?: number; responsiveHeight?: boolean; className?: string }) {
  const { canvasRef, wrapRef } = useCanvasDraw(height, responsiveHeight, (ctx, width, renderHeight) => drawMultiCusum(ctx, width, renderHeight, series), [series]);
  return <div ref={wrapRef} style={{ width: '100%' }}><canvas ref={canvasRef} className={className} style={{ width: '100%', height: responsiveHeight ? 'auto' : height, display: 'block' }} /></div>;
}

function drawMultiCusum(ctx: CanvasRenderingContext2D, width: number, height: number, series: QcMultiCusumSeries[]) {
  const padL = 56, padR = 78, padT = 34, padB = 48, markPad = 10;
  const cw = width - padL - padR, ch = height - padT - padB;
  const keyOf = qcRunKey;
  const runKeys = Array.from(new Set(series.flatMap((s) => s.points.map(keyOf)))).sort(compareQcRunKey);
  const indexOf = new Map(runKeys.map((key, index) => [key, index]));
  const h = series.find((s) => s.cusum.h != null)?.cusum.h ?? 4;
  const k = series.find((s) => s.cusum.k != null)?.cusum.k ?? 0.5;
  const values = series.flatMap((s) => [...s.cusum.cPos, ...s.cusum.cNeg, ...(s.cusum.ma || [])]).filter(Number.isFinite).map(Math.abs);
  // Khi mọi nhánh bằng 0, vẽ tuần tự bốn đường tại đúng một toạ độ làm màu
  // của nhánh cuối che toàn bộ nhánh trước (như thể chỉ còn M2−). Không dời
  // đường để "nhìn thấy đủ màu" vì sẽ bịa ra độ lệch CUSUM không tồn tại.
  // Thay bằng thông báo rõ ràng: đường 0 đã có sẵn ở grid đại diện cho cả 4.
  const cusumValues = series.flatMap((s) => [...s.cusum.cPos, ...s.cusum.cNeg]).filter(Number.isFinite);
  const allBranchesAtZero = cusumValues.length > 0 && cusumValues.every((value) => Math.abs(value) < 1e-9);
  const yMax = Math.max(h * 1.15, 1, ...values);
  const y = (value: number) => padT + ch * (1 - (value + yMax) / (2 * yMax));
  const clampY = (value: number) => Math.max(padT, Math.min(padT + ch, y(value)));
  const x = (index: number) => runKeys.length <= 1 ? padL + cw / 2 : padL + markPad + (index / (runKeys.length - 1)) * (cw - markPad * 2);

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.font = '700 13.5px Manrope,system-ui,sans-serif'; ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`CUSUM tổng hợp theo mức (k=${k.toFixed(2)}, h=${h.toFixed(2)})`, padL + cw / 2, padT - 8);
  ctx.font = '700 13px Manrope,system-ui,sans-serif'; ctx.textBaseline = 'middle';
  for (const value of [h, 0, -h]) {
    const yy = y(value); ctx.strokeStyle = value === 0 ? LJ.mean : '#e2a8a2'; ctx.lineWidth = value === 0 ? 1.8 : 1.15;
    ctx.setLineDash(value === 0 ? [] : [4, 3]); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + cw, yy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#17212b'; ctx.textAlign = 'right'; ctx.fillText(value === 0 ? '0' : `h=${value > 0 ? '+' : ''}${value}`, padL - 9, yy);
  }
  if (!runKeys.length) { ctx.fillStyle = '#7b838e'; ctx.font = '600 14px Manrope,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Chưa có dữ liệu CUSUM', padL + cw / 2, padT + ch / 2); return; }

  ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
  if (allBranchesAtZero) {
    ctx.fillStyle = '#536772'; ctx.font = '700 13px Manrope,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('Các nhánh CUSUM đang trùng tại 0.00 — chưa có độ lệch vượt k để cộng dồn', padL + cw / 2, y(0) - 10);
  } else series.forEach((item, levelIndex) => {
    const [positive, negative] = MULTI_CUSUM_COLORS[levelIndex % MULTI_CUSUM_COLORS.length];
    const points = item.points.map((point, index) => ({ x: x(indexOf.get(keyOf(point))!), pos: item.cusum.cPos[index], neg: item.cusum.cNeg[index], flag: item.cusum.flags[index] }));
    const line = (field: 'pos' | 'neg', color: string) => {
      const visible = points.filter((point) => Number.isFinite(point[field])); if (visible.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]); ctx.beginPath();
      visible.forEach((point, index) => { if (index) ctx.lineTo(point.x, clampY(point[field])); else ctx.moveTo(point.x, clampY(point[field])); }); ctx.stroke();
    };
    line('pos', positive); line('neg', negative);
    points.forEach((point) => {
      for (const [value, color] of [[point.pos, positive], [point.neg, negative]] as const) {
        if (!Number.isFinite(value)) continue;
        const reject = point.flag === 'rej' && Math.abs(value) >= h - 1e-9;
        ctx.fillStyle = reject ? CUSUM_COLORS.rej : color; traceMarker(ctx, reject ? 'square' : 'circle', point.x, clampY(value), reject ? 5 : 3); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    });
  });
  ctx.restore();
  ctx.fillStyle = '#536772'; ctx.font = '700 13px Manrope,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const ticks = Math.min(5, runKeys.length);
  const tickIndices = ticks === 1 ? [0] : [...new Set(Array.from({ length: ticks }, (_, i) => Math.round((i * (runKeys.length - 1)) / (ticks - 1))))];
  for (const index of tickIndices) { const date = runKeys[index].split('\u0000')[0]; ctx.fillText(vnDayMonth(date, date.slice(0, 5)), x(index), padT + ch + 10); }
  let lx = padL + 8; const ly = 10; ctx.font = '700 13.5px Manrope,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  series.forEach((item, index) => {
    const [positive, negative] = MULTI_CUSUM_COLORS[index % MULTI_CUSUM_COLORS.length];
    for (const [label, color] of [[`M${item.level}+`, positive], [`M${item.level}−`, negative]] as const) { ctx.fillStyle = color; ctx.fillRect(lx, ly - 2, 14, 4); ctx.fillStyle = '#17212b'; ctx.fillText(label, lx + 20, ly); lx += 20 + ctx.measureText(label).width + 12; }
  });
}


