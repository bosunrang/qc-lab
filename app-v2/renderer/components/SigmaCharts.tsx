// Biểu đồ trang Six Sigma (Giai đoạn D3.6) — 2 khối app cũ vẽ vào `#sgTrend`
// và `#sgMDC`:
//   • Xu hướng Sigma theo kỳ: đường Sigma của từng mức qua các kỳ, kèm 2
//     mốc tham chiếu 3σ (tối thiểu) và 4σ (mong đợi).
//   • Biểu đồ Quyết định Phương pháp (MDC): X = CV/TEa, Y = |Bias|/TEa; điểm
//     to nhất là kỳ gần nhất, các đường chéo là biên Sigma 3/4/5/6.
//
// Vẽ bằng canvas + ref chuẩn React (cùng cách `QcChart`/`ReagentChart` đã
// dùng), KHÔNG port hình học SVG của `sgTrendSVG`/`sgMDCSVG` — giống về NỘI
// DUNG (đại lượng, mốc tham chiếu, thứ tự kỳ), khác cách vẽ, đúng nguyên tắc
// đã chốt từ Giai đoạn A1.
import { useEffect, useRef } from 'react';
import type { SigmaPeriodView } from '../../shared/qc-api';

const LEVEL_COLORS = ['#0e8f8f', '#d1741f', '#5b6fd6', '#8f2f8f', '#2f8f4f', '#b03030'];

function useCanvas(draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void, deps: unknown[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(240, wrap.clientWidth);
    const height = 220;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { canvasRef, wrapRef };
}

function axes(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number) {
  ctx.strokeStyle = '#c9d9e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom);
  ctx.stroke();
}

/** Sắp kỳ theo thứ tự thời gian (chuỗi YYYY-MM so sánh trực tiếp được). */
function chronological(periods: SigmaPeriodView[]): SigmaPeriodView[] {
  return [...periods].sort((a, b) => a.period.localeCompare(b.period));
}

export function SigmaTrendChart({ periods }: { periods: SigmaPeriodView[] }) {
  const rows = chronological(periods);
  const { canvasRef, wrapRef } = useCanvas((ctx, width, height) => {
    const left = 34, right = width - 8, top = 12, bottom = height - 24;
    const levels = Array.from(new Set(rows.flatMap((p) => p.levels.map((l) => l.level)))).sort((a, b) => a - b);
    const maxSigma = Math.max(6, ...rows.flatMap((p) => p.levels.map((l) => l.sigma?.sigma ?? 0)));
    const y = (value: number) => bottom - (Math.max(0, value) / maxSigma) * (bottom - top);
    const x = (index: number) => rows.length <= 1 ? (left + right) / 2 : left + (index / (rows.length - 1)) * (right - left);

    // Mốc tham chiếu 3σ/4σ — cùng 2 ngưỡng app cũ vẽ.
    ctx.setLineDash([4, 3]);
    for (const [value, color] of [[3, '#c5221f'], [4, '#dd8b1f']] as const) {
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`${value}σ`, left - 22, y(value) + 3);
    }
    ctx.setLineDash([]);
    axes(ctx, left, top, right, bottom);

    levels.forEach((level, li) => {
      const color = LEVEL_COLORS[li % LEVEL_COLORS.length];
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      rows.forEach((period, i) => {
        const sigma = period.levels.find((l) => l.level === level)?.sigma?.sigma;
        if (sigma == null || !Number.isFinite(sigma)) return;
        const px = x(i), py = y(sigma);
        if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
      });
      ctx.stroke();
      rows.forEach((period, i) => {
        const sigma = period.levels.find((l) => l.level === level)?.sigma?.sigma;
        if (sigma == null || !Number.isFinite(sigma)) return;
        ctx.beginPath(); ctx.arc(x(i), y(sigma), 3.5, 0, Math.PI * 2); ctx.fill();
      });
    });

    ctx.fillStyle = '#506674';
    ctx.font = '10px system-ui, sans-serif';
    rows.forEach((period, i) => {
      const label = period.period.slice(5) + '/' + period.period.slice(2, 4);
      ctx.fillText(label, x(i) - 14, bottom + 14);
    });
  }, [rows.map((p) => p.period + ':' + p.levels.map((l) => l.sigma?.sigma ?? '').join('|')).join(',')]);

  return <div ref={wrapRef} style={{ width: '100%' }}><canvas ref={canvasRef} /></div>;
}

export function SigmaMdcChart({ periods }: { periods: SigmaPeriodView[] }) {
  const rows = chronological(periods);
  const { canvasRef, wrapRef } = useCanvas((ctx, width, height) => {
    const left = 34, right = width - 8, top = 12, bottom = height - 24;
    // Trục chuẩn hoá theo TEa: X = CV/TEa, Y = |Bias|/TEa, cả hai 0..0.5.
    const span = 0.5;
    const x = (value: number) => left + Math.min(span, Math.max(0, value)) / span * (right - left);
    const y = (value: number) => bottom - Math.min(span, Math.max(0, value)) / span * (bottom - top);

    // Biên Sigma: |bias|/TEa + k·(cv/TEa) = 1 với k = 3/4/5/6.
    for (const [k, color] of [[3, '#c5221f'], [4, '#dd8b1f'], [5, '#0e8f8f'], [6, '#1f7a4d']] as const) {
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x(0), y(1)); ctx.lineTo(x(1 / k), y(0));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`${k}σ`, x(1 / k) - 10, bottom - 4);
    }
    axes(ctx, left, top, right, bottom);

    const levels = Array.from(new Set(rows.flatMap((p) => p.levels.map((l) => l.level)))).sort((a, b) => a - b);
    rows.forEach((period, i) => {
      const newest = i === rows.length - 1;
      period.levels.forEach((lv) => {
        const tea = Number(period.tea ?? lv.sigma?.tea ?? 0);
        if (!(tea > 0) || lv.cv == null || lv.biasEqa == null) return;
        const color = LEVEL_COLORS[Math.max(0, levels.indexOf(lv.level)) % LEVEL_COLORS.length];
        ctx.fillStyle = color;
        ctx.globalAlpha = newest ? 1 : 0.45;
        ctx.beginPath();
        ctx.arc(x(Number(lv.cv) / tea), y(Math.abs(Number(lv.biasEqa)) / tea), newest ? 6 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    });
  }, [rows.map((p) => p.period + ':' + p.tea + ':' + p.levels.map((l) => `${l.cv ?? ''}/${l.biasEqa ?? ''}`).join('|')).join(',')]);

  return <div ref={wrapRef} style={{ width: '100%' }}><canvas ref={canvasRef} /></div>;
}
