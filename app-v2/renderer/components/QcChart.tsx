// Biểu đồ Levey-Jennings + CUSUM dùng chung.
//
// LỊCH SỬ: bản đầu (Giai đoạn A1) cố ý "vẽ lại từ đầu, giống nội dung không
// giống cách vẽ" — chỉ có 7 đường kẻ ±SD và đường nối điểm. Khi đối chiếu
// thật với app cũ ở Giai đoạn D (2026-09-03) thì đó là chỗ lệch hình LỚN NHẤT
// của trang Nhập QC: app cũ có dải màu ±1/±2/±3SD, nhãn trục Y HAI BÊN (bậc SD
// bên trái, GIÁ TRỊ THẬT bên phải), nhãn ngày ở trục X và tiêu đề trong khung
// vẽ. Gate `app-v2:ui-parity` không thấy vì nó chỉ đo class + dòng chữ trong
// DOM, còn toàn bộ biểu đồ nằm trong bitmap canvas.
//
// Bản này port ĐÚNG hình học/màu/nhãn của app cũ (`leveyJenningsGeometry`,
// `leveyJenningsBandRects`, `LEVEY_JENNINGS_COLORS`,
// `createLeveyJenningsYAxisLabels`, `leveyJenningsGridLines`,
// `createLeveyJenningsTicks` trong `src/presentation/chart/`) — vẫn dựng bằng
// canvas ref chuẩn React thay vì thao tác DOM tay như `qc-chart-renderer.ts`,
// nhưng các con số hình học không còn là "tự nghĩ".
import { useCallback, useEffect, useRef, useState } from 'react';

export interface QcChartPoint { date: string; runId: string; val: number; z: number; verdict: 'ok' | 'warn' | 'rej' | 'none'; rules: string[]; accepted?: boolean }
export interface QcChartCusum {
  cPos: number[]; cNeg: number[]; flags: ('ok' | 'warn' | 'rej')[];
  /** Tham số thật của xét nghiệm, được IPC giữ nguyên từ domain CUSUM. */
  k?: number; h?: number; ma?: number[];
}

type LjHover = { left: number; top: number; level?: number; lot?: string; point: QcChartPoint };
const VERDICT_TEXT: Record<QcChartPoint['verdict'], string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };

/** Tooltip điểm QC kiểu app cũ. Canvas không có phần tử điểm riêng để browser
 * tự hover, nên hit-test bằng đúng hình học đang dùng khi vẽ. */
function LjTooltip({ hit }: { hit: LjHover | null }) {
  if (!hit) return null;
  const { point, level } = hit;
  const z = Number.isFinite(point.z) ? `${point.z >= 0 ? '+' : ''}${point.z.toFixed(2)}s` : '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(point.date) ? `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}/${point.date.slice(0, 4)}` : point.date;
  return <div className="qc-chart-tooltip" style={{ left: hit.left, top: hit.top }}>
    <b>{date}{level != null ? ` · Mức ${level}` : ''}</b>
    <div>Lần chạy: <strong>{point.runId || '—'}</strong></div>
    {hit.lot && <div>Lô: <strong>{hit.lot}</strong></div>}
    <div>Giá trị: {Number.isFinite(point.val) ? point.val.toFixed(2) : '—'}</div>
    <div>Z: {z}</div>
    <div className="muted">Kết luận: {VERDICT_TEXT[point.verdict]}</div>
    <div className="muted">Luật: {point.rules.length ? point.rules.join(', ') : 'Đạt'}</div>
  </div>;
}

/** Màu app cũ — `LEVEY_JENNINGS_COLORS`, copy nguyên giá trị. */
const LJ = {
  okBand: '#e8f6ef', okMid: '#ffffff', warnBand: '#fff3cf', rejectBand: '#f9d6d5',
  grid: '#5d6b76', mean: '#17212b', line: '#0e8f8f',
  okPoint: '#0e8f8f', warnPoint: '#dd8b1f', rejectPoint: '#c5221f',
} as const;

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

const CUSUM_COLORS = { pos: '#0b747d', neg: '#4f789d', warn: '#dd8b1f', rej: '#c5221f' };

export function QcChart({ mode, points, cusum, mean, sd, lot, decimals = 2, height = 220, responsiveHeight = false, className }: {
  mode: 'lj' | 'cusum'; points: QcChartPoint[]; cusum?: QcChartCusum;
  /** Mean/SD ĐÍCH của mức — cần để in giá trị thật ở trục Y bên phải như app cũ. */
  mean?: number | null; sd?: number | null; lot?: string; decimals?: number;
  height?: number; responsiveHeight?: boolean; className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ljHover, setLjHover] = useState<LjHover | null>(null);
  // Giữ props MỚI NHẤT trong 1 ref để `draw` có THỂ GIỮ NGUYÊN 1 THAM CHIẾU
  // (deps rỗng) suốt vòng đời component — nếu để `draw` đổi tham chiếu mỗi
  // khi 1 prop đổi (như bản trước), effect gắn `ResizeObserver` bên dưới sẽ
  // gỡ+gắn lại observer trên MỖI LẦN component cha render lại (rất thường
  // xuyên — `points`/`cusum` cha truyền vào thường là mảng/obj MỚI mỗi lần
  // render dù nội dung không đổi), có khoảng hở dù nhỏ giữa gỡ và gắn lại.
  const argsRef = useRef({ mode, points, cusum, mean, sd, lot, decimals, height, responsiveHeight });
  argsRef.current = { mode, points, cusum, mean, sd, lot, decimals, height, responsiveHeight };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { mode, points, cusum, mean, sd, decimals, height, responsiveHeight } = argsRef.current;
    const width = wrap.clientWidth || 600;
    // Ở trang Nhập QC, khi ẩn sidebar/cây danh mục thì chiều rộng có thể tăng
    // hơn 40%. Giữ cùng tỷ lệ hình học so với mốc 1180px, nhưng chỉ cho tăng
    // tối đa 20% để biểu đồ không đẩy các bảng phía dưới xuống quá xa.
    const renderHeight = responsiveHeight
      ? Math.round(Math.max(height, Math.min(height * 1.2, (width / 1180) * height)))
      : height;
    const dpr = window.devicePixelRatio || 1;
    // CHỈ đặt độ phân giải bitmap (thuộc tính `width`/`height`, không phải
    // CSS `style.width/height`) — kích thước HIỂN THỊ do CSS `width:100%`
    // dưới JSX quyết định, KHÔNG phụ thuộc hàm này có chạy lại kịp hay
    // không. Trước đây gán cứng `canvas.style.width='Npx'` mỗi lần vẽ: nếu
    // vì lý do gì đó (ResizeObserver/resize không kích hoạt) hàm này không
    // chạy lại, ô canvas bị KẸT ở đúng bề rộng cũ, để lại khoảng trắng lớn
    // bên cạnh dù khung chứa đã rộng ra thật — đúng lỗi người dùng gặp phải.
    // Giờ nếu lỡ không vẽ lại kịp, canvas vẫn co giãn ĐÚNG THEO CSS (trình
    // duyệt tự giãn bitmap cũ cho khớp khung, có thể hơi mờ tạm thời), không
    // còn bị kẹt nhỏ.
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(renderHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, renderHeight);

    if (mode === 'lj') drawLJ(ctx, width, renderHeight, points, mean, sd, decimals);
    else drawCusum(ctx, width, renderHeight, cusum || { cPos: [], cNeg: [], flags: [] });
  }, []);

  useEffect(() => { draw(); }, [mode, points, cusum, mean, sd, decimals, height, responsiveHeight, draw]);
  // `draw()` ở effect trên chỉ chạy lại khi các PROP DỮ LIỆU đổi — nếu người
  // dùng đơn thuần thu/mở thanh điều hướng hay danh mục xét nghiệm (không
  // đổi điểm/Mean/SD gì), effect đó không tự chạy lại — vẽ lại độ phân giải
  // BITMAP mỗi khi khung chứa thật sự đổi kích thước, độc lập với prop dữ
  // liệu. Gắn CẢ `ResizeObserver` (khung chứa đổi vì layout xung quanh đổi)
  // LẪN `resize` của `window` (đổi kích thước cửa sổ thật) — 2 nguồn kích
  // hoạt khác nhau, không thừa nhau; nhờ safety-net CSS ở trên, dù 1 trong 2
  // (hoặc cả 2) lỡ không kích hoạt được ở môi trường nào đó thì ô vẽ vẫn co
  // giãn đúng kích thước hiển thị, chỉ mất độ sắc nét tạm thời chứ không kẹt
  // nhỏ hẳn.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    window.addEventListener('resize', draw);
    return () => { observer.disconnect(); window.removeEventListener('resize', draw); };
  }, [draw]);

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
    canvas.title = `${points[index].date}\nCUSUM+: ${number(cusum.cPos[index])}\nCUSUM−: ${number(cusum.cNeg[index])}\nMA(5): ${number(cusum.ma?.[index])}${cusum.flags[index] === 'rej' ? '\nVượt ngưỡng h' : '\nTrong tầm kiểm soát'}`;
  }, []);

  const updateLjTooltip = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { mode, points, mean, sd, lot } = argsRef.current;
    if (!canvas || mode !== 'lj' || !points.length) { setLjHover(null); return; }
    const rect = canvas.getBoundingClientRect();
    const hasTarget = mean != null && sd != null && sd > 0;
    const { x, clampY } = geometry(rect.width, rect.height, points.length, hasTarget ? mean : 0, hasTarget ? sd : 1);
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    let hit: QcChartPoint | null = null;
    let closest = 14;
    points.forEach((point, index) => {
      const value = hasTarget ? point.val : point.z;
      if (!Number.isFinite(value)) return;
      const distance = Math.hypot(px - x(index), py - clampY(value));
      if (distance <= closest) { closest = distance; hit = point; }
    });
    if (!hit) { setLjHover(null); return; }
    const left = Math.min(window.innerWidth - 248, event.clientX + 14);
    const top = Math.min(window.innerHeight - 142, event.clientY + 14);
    setLjHover({ left: Math.max(12, left), top: Math.max(12, top), lot, point: hit });
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} className={className} onPointerMove={(event) => { updateCusumTooltip(event); updateLjTooltip(event); }}
        onPointerLeave={() => { if (canvasRef.current) canvasRef.current.title = ''; setLjHover(null); }}
        style={{ width: '100%', height: responsiveHeight ? 'auto' : height, display: 'block' }} />
      <LjTooltip hit={ljHover} />
    </div>
  );
}

/** Hình học app cũ — `leveyJenningsGeometry`: chừa 56px bên trái cho bậc SD,
 * 78px bên phải cho giá trị thật, 34px trên cho tiêu đề, 48px dưới cho ngày;
 * trục Y phủ ±3.25SD (rộng hơn ±3 để dải "ngoài 3SD" có chỗ hiện). */
function geometry(width: number, height: number, count: number, mean: number, sd: number) {
  const padL = 56, padR = 78, padT = 34, padB = 48;
  const cw = width - padL - padR, ch = height - padT - padB, markPad = 10;
  const top = mean + 3.25 * sd, bottom = mean - 3.25 * sd;
  const y = (value: number) => padT + ((top - value) / (top - bottom)) * ch;
  const clampY = (value: number) => Math.max(padT, Math.min(padT + ch, y(value)));
  const x = (index: number) => (count <= 1 ? padL + cw / 2 : padL + markPad + (index / (count - 1)) * (cw - markPad * 2));
  return { padL, padT, cw, ch, markPad, y, clampY, x };
}

/** Nhãn trục X app cũ — `createLeveyJenningsTicks`: tối đa 5 mốc, nhãn dd/mm. */
function ticksOf(points: QcChartPoint[], maxTicks = 5) {
  const count = points.length;
  if (!count) return [] as { index: number; label: string }[];
  const total = Math.min(maxTicks, count);
  const indices = total === 1 ? [0] : [...new Set(Array.from({ length: total }, (_, i) => Math.round((i * (count - 1)) / (total - 1))))];
  return indices.map((index) => {
    const raw = String(points[index].date || '');
    const label = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw.slice(8, 10)}/${raw.slice(5, 7)}` : raw.slice(0, 5);
    return { index, label };
  });
}

function drawLJ(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  points: QcChartPoint[], meanIn?: number | null, sdIn?: number | null, decimals = 2,
) {
  // Không có Mean/SD đích thì vẽ theo thang z (mean 0, sd 1) — cùng cách app cũ
  // vẽ biểu đồ tổng hợp nhiều mức (`drawLJMultiZ`).
  const hasTarget = meanIn != null && sdIn != null && sdIn > 0;
  const mean = hasTarget ? (meanIn as number) : 0;
  const sd = hasTarget ? (sdIn as number) : 1;
  const n = points.length;
  const { padL, padT, cw, ch, markPad, y, clampY, x } = geometry(width, height, n, mean, sd);

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LJ.okBand; ctx.fillRect(padL, padT, cw, ch);
  ctx.save();
  ctx.beginPath(); ctx.rect(padL - markPad, padT, cw + markPad * 2, ch); ctx.clip();
  for (const band of BANDS) {
    const bandTop = y(mean + band.high * sd);
    ctx.fillStyle = LJ[band.color];
    ctx.fillRect(padL, bandTop, cw, y(mean + band.low * sd) - bandTop);
  }
  // Đường kẻ theo bậc SD; bậc 0 (Mean) đậm hơn — `leveyJenningsGridLines`.
  for (const z of [3, 2, 1, 0, -1, -2, -3]) {
    const gy = y(mean + z * sd);
    ctx.strokeStyle = z === 0 ? LJ.mean : LJ.grid;
    ctx.lineWidth = z === 0 ? 1.8 : 1.15;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + cw, gy); ctx.stroke();
  }
  ctx.restore();

  ctx.font = '800 11.5px Manrope,system-ui,sans-serif';
  ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Levey-Jennings', padL + cw / 2, padT - 8);

  // Trục Y: bậc SD bên trái ('> +3'/'< -3' ở hai đầu), giá trị thật bên phải.
  ctx.font = '800 12.5px Manrope,system-ui,sans-serif';
  ctx.textBaseline = 'middle';
  for (const z of [3, 2, 1, 0, -1, -2, -3]) {
    const yy = y(mean + z * sd);
    const left = z === 3 ? '> +3' : z === -3 ? '< -3' : String(z);
    ctx.fillStyle = '#17212b';
    ctx.textAlign = 'right'; ctx.fillText(left, padL - 9, yy);
    ctx.textAlign = 'left';
    ctx.fillText(hasTarget ? (mean + z * sd).toFixed(decimals) : `${z > 0 ? '+' : ''}${z}SD`, padL + cw + 10, yy);
  }

  if (!n) {
    ctx.fillStyle = '#7b838e'; ctx.font = '600 14px Manrope,system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Chưa có điểm QC trong khoảng xem', padL + cw / 2, padT + ch / 2);
    return;
  }

  const valueOf = (p: QcChartPoint) => (hasTarget ? p.val : p.z);
  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
  // Đường biểu đồ nối toàn bộ quan sát theo thời gian, kể cả điểm bị loại, để
  // diễn biến dẫn tới vi phạm không bị đứt đoạn. Việc loại khỏi Mean/SD/CV do
  // tầng trình bày bên ngoài xử lý bằng cờ `accepted`.
  if (points.length > 1) {
    ctx.strokeStyle = LJ.line; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((point, i) => {
      const px = x(i), py = clampY(valueOf(point));
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
  }
  points.forEach((p, i) => {
    const radius = p.verdict === 'ok' ? 4 : 5;
    // Giữ trọn marker trong vùng vẽ khi giá trị nằm ngoài ±3.25SD.
    const px = x(i), py = Math.max(padT + radius, Math.min(padT + ch - radius, clampY(valueOf(p))));
    ctx.fillStyle = p.verdict === 'rej' ? LJ.rejectPoint : p.verdict === 'warn' ? LJ.warnPoint : LJ.okPoint;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
  });
  ctx.restore();

  ctx.fillStyle = '#536772'; ctx.font = '700 11.5px Manrope,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const tick of ticksOf(points)) ctx.fillText(tick.label, x(tick.index), padT + ch + 10);
}

/** Màu theo MỨC cho biểu đồ tổng hợp nhiều mức — `LEVEY_JENNINGS_MULTI_COLORS`
 * app cũ, copy nguyên giá trị (`src/presentation/chart/levey-jennings-multi-colors.ts`). */
const MULTI_COLORS = ['#0e8f8f', '#7a4f9a', '#c47d12', '#2f7d5b', '#5369a6', '#9a5b3c'];
const MULTI_CUSUM_COLORS = [
  ['#0e8f8f', '#5369a6'], ['#7a4f9a', '#c47d12'], ['#2f7d5b', '#9a5b3c'],
] as const;

export interface QcMultiLevelSeries { level: number; lot?: string; points: QcChartPoint[] }

/** Biểu đồ "Levey-Jennings tổng hợp" — quy đổi MỌI mức về Z-score để so sánh
 * trên cùng trục, mỗi mức 1 màu (port `drawLJMultiZ` app cũ, đơn giản hoá
 * trục X: thay vì gộp theo "run" thật, dùng trục theo NGÀY chung của mọi mức
 * — cùng tinh thần "giống nội dung, khác cách vẽ" đã áp dụng cho `drawLJ`).
 * Chỉ hiện khi có ≥2 mức (trang gọi component này có điều kiện đó). */
export function QcMultiChart({ series, height = 220, responsiveHeight = false, className }: { series: QcMultiLevelSeries[]; height?: number; responsiveHeight?: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ljHover, setLjHover] = useState<LjHover | null>(null);
  // Xem chú thích `argsRef` cùng loại ở `QcChart` phía trên — giữ `draw` một
  // tham chiếu DUY NHẤT suốt vòng đời component, tránh gỡ+gắn lại observer
  // mỗi khi component cha render lại (đưa `series` mới object reference).
  const argsRef = useRef({ series, height, responsiveHeight });
  argsRef.current = { series, height, responsiveHeight };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { series, height, responsiveHeight } = argsRef.current;
    const width = wrap.clientWidth || 600;
    // Cùng quy tắc với `QcChart` ở trang Nhập QC: mốc 300px, tăng tối đa
    // 20% theo chiều rộng để biểu đồ không quá thấp ở màn hình lớn.
    const renderHeight = responsiveHeight
      ? Math.round(Math.max(height, Math.min(height * 1.2, (width / 1180) * height)))
      : height;
    const dpr = window.devicePixelRatio || 1;
    // Chỉ đặt độ phân giải bitmap — xem chú thích cùng loại ở `QcChart`.
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(renderHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, renderHeight);
    drawMulti(ctx, width, renderHeight, series);
  }, []);

  useEffect(() => { draw(); }, [series, height, responsiveHeight, draw]);
  // Vẽ lại khi khung chứa thật sự đổi kích thước (kéo giãn cửa sổ / thu-mở
  // thanh điều hướng đổi layout xung quanh) — xem chú thích cùng loại ở
  // `QcChart` phía trên.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    window.addEventListener('resize', draw);
    return () => { observer.disconnect(); window.removeEventListener('resize', draw); };
  }, [draw]);

  const updateLjTooltip = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { series } = argsRef.current;
    const dates = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.date)))).sort();
    if (!dates.length) { setLjHover(null); return; }
    const rect = canvas.getBoundingClientRect();
    const dateIndex = new Map(dates.map((date, index) => [date, index]));
    const { x, clampY } = geometry(rect.width, rect.height, dates.length, 0, 1);
    const px = event.clientX - rect.left, py = event.clientY - rect.top;
    const candidates = series.flatMap((item) => item.points.flatMap((point) => {
      const index = dateIndex.get(point.date);
      if (index == null || !Number.isFinite(point.z)) return [];
      return [{ point, level: item.level, distance: Math.hypot(px - x(index), py - clampY(point.z)) }];
    }));
    const hit = candidates.reduce<{ point: QcChartPoint; level: number; distance: number } | null>(
      (closest, candidate) => candidate.distance <= 14 && (!closest || candidate.distance < closest.distance) ? candidate : closest,
      null,
    );
    if (!hit) { setLjHover(null); return; }
    const left = Math.min(window.innerWidth - 248, event.clientX + 14);
    const top = Math.min(window.innerHeight - 142, event.clientY + 14);
    setLjHover({ left: Math.max(12, left), top: Math.max(12, top), level: hit.level, lot: series.find((item) => item.level === hit.level)?.lot, point: hit.point });
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} className={className} onPointerMove={updateLjTooltip} onPointerLeave={() => setLjHover(null)}
        style={{ width: '100%', height: responsiveHeight ? 'auto' : height, display: 'block' }} />
      <LjTooltip hit={ljHover} />
    </div>
  );
}

function drawMulti(ctx: CanvasRenderingContext2D, width: number, height: number, series: QcMultiLevelSeries[]) {
  const dates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort();
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

  ctx.font = '800 11.5px Manrope,system-ui,sans-serif';
  ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Levey-Jennings tổng hợp', padL + cw / 2, padT - 8);

  ctx.font = '800 12.5px Manrope,system-ui,sans-serif'; ctx.textBaseline = 'middle';
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
    const pts = s.points.filter((p) => dateIndex.has(p.date));
    if (pts.length > 1) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
      ctx.beginPath();
      pts.forEach((p, j) => { const px = x(dateIndex.get(p.date)!), py = clampY(p.z); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
    pts.forEach((p) => {
      const px = x(dateIndex.get(p.date)!), py = clampY(p.z);
      ctx.fillStyle = p.verdict === 'rej' ? LJ.rejectPoint : p.verdict === 'warn' ? LJ.warnPoint : color;
      ctx.beginPath(); ctx.arc(px, py, p.verdict === 'ok' ? 4 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
    });
  });
  ctx.restore();

  ctx.fillStyle = '#536772'; ctx.font = '700 11.5px Manrope,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const maxTicks = 5, total = Math.min(maxTicks, n);
  const tickIdx = total === 1 ? [0] : [...new Set(Array.from({ length: total }, (_, i) => Math.round((i * (n - 1)) / (total - 1))))];
  for (const i of tickIdx) { const raw = dates[i]; const label = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw.slice(8, 10)}/${raw.slice(5, 7)}` : raw.slice(0, 5); ctx.fillText(label, x(i), padT + ch + 10); }

  // Chú giải màu theo mức — `leveyJenningsLegendLayout` app cũ.
  let lx = padL + 8; const ly = 10;
  ctx.font = '800 11.5px Manrope,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  series.forEach((s, li) => {
    const color = MULTI_COLORS[li % MULTI_COLORS.length];
    const label = `Mức ${s.level}`;
    ctx.fillStyle = color; ctx.fillRect(lx, ly - 2, 18, 4);
    ctx.fillStyle = '#17212b'; ctx.fillText(label, lx + 25, ly);
    lx += 25 + ctx.measureText(label).width + 18;
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
  ctx.font = '800 11.5px Manrope,system-ui,sans-serif';
  ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`CUSUM xu hướng (k=${k.toFixed(2)}, h=${h.toFixed(2)})`, padL + cw / 2, padT - 8);

  ctx.font = '800 12.5px Manrope,system-ui,sans-serif'; ctx.textBaseline = 'middle';
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
  // vượt ngưỡng; cùng nguyên tắc display-plan của app cũ.
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
      ctx.beginPath(); ctx.arc(x(i), clampY(value), exceeds ? 5 : 3, 0, Math.PI * 2); ctx.fill();
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const argsRef = useRef({ series, height, responsiveHeight });
  argsRef.current = { series, height, responsiveHeight };
  const draw = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { series, height, responsiveHeight } = argsRef.current;
    const width = wrap.clientWidth || 600;
    const renderHeight = responsiveHeight ? Math.round(Math.max(height, Math.min(height * 1.2, (width / 1180) * height))) : height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(renderHeight * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, renderHeight);
    drawMultiCusum(ctx, width, renderHeight, series);
  }, []);
  useEffect(() => { draw(); }, [series, height, responsiveHeight, draw]);
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const observer = new ResizeObserver(draw); observer.observe(wrap);
    window.addEventListener('resize', draw);
    return () => { observer.disconnect(); window.removeEventListener('resize', draw); };
  }, [draw]);
  return <div ref={wrapRef} style={{ width: '100%' }}><canvas ref={canvasRef} className={className} style={{ width: '100%', height: responsiveHeight ? 'auto' : height, display: 'block' }} /></div>;
}

function drawMultiCusum(ctx: CanvasRenderingContext2D, width: number, height: number, series: QcMultiCusumSeries[]) {
  const padL = 56, padR = 78, padT = 34, padB = 48, markPad = 10;
  const cw = width - padL - padR, ch = height - padT - padB;
  const keyOf = (p: QcChartPoint) => `${p.date}\u0000${p.runId}`;
  const runKeys = Array.from(new Set(series.flatMap((s) => s.points.map(keyOf)))).sort();
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
  ctx.font = '800 11.5px Manrope,system-ui,sans-serif'; ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`CUSUM tổng hợp theo mức (k=${k.toFixed(2)}, h=${h.toFixed(2)})`, padL + cw / 2, padT - 8);
  ctx.font = '800 12.5px Manrope,system-ui,sans-serif'; ctx.textBaseline = 'middle';
  for (const value of [h, 0, -h]) {
    const yy = y(value); ctx.strokeStyle = value === 0 ? LJ.mean : '#e2a8a2'; ctx.lineWidth = value === 0 ? 1.8 : 1.15;
    ctx.setLineDash(value === 0 ? [] : [4, 3]); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + cw, yy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#17212b'; ctx.textAlign = 'right'; ctx.fillText(value === 0 ? '0' : `h=${value > 0 ? '+' : ''}${value}`, padL - 9, yy);
  }
  if (!runKeys.length) { ctx.fillStyle = '#7b838e'; ctx.font = '600 14px Manrope,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Chưa có dữ liệu CUSUM', padL + cw / 2, padT + ch / 2); return; }

  ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
  if (allBranchesAtZero) {
    ctx.fillStyle = '#536772'; ctx.font = '700 12px Manrope,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
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
        ctx.fillStyle = reject ? CUSUM_COLORS.rej : color; ctx.beginPath(); ctx.arc(point.x, clampY(value), reject ? 5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    });
  });
  ctx.restore();
  ctx.fillStyle = '#536772'; ctx.font = '700 11.5px Manrope,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const ticks = Math.min(5, runKeys.length);
  const tickIndices = ticks === 1 ? [0] : [...new Set(Array.from({ length: ticks }, (_, i) => Math.round((i * (runKeys.length - 1)) / (ticks - 1))))];
  for (const index of tickIndices) { const date = runKeys[index].split('\u0000')[0]; ctx.fillText(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : date.slice(0, 5), x(index), padT + ch + 10); }
  let lx = padL + 8; const ly = 10; ctx.font = '800 11.5px Manrope,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  series.forEach((item, index) => {
    const [positive, negative] = MULTI_CUSUM_COLORS[index % MULTI_CUSUM_COLORS.length];
    for (const [label, color] of [[`M${item.level}+`, positive], [`M${item.level}−`, negative]] as const) { ctx.fillStyle = color; ctx.fillRect(lx, ly - 2, 14, 4); ctx.fillStyle = '#17212b'; ctx.fillText(label, lx + 20, ly); lx += 20 + ctx.measureText(label).width + 12; }
  });
}
