// Biểu đồ scatter + Bland-Altman cho So sánh hóa chất — viết lại bằng canvas
// ref chuẩn React (không dùng SVG string như `reagent-bland-svg.ts`/
// `reagent-scatter-svg.ts` bản cũ), cùng công thức Limits of Agreement
// (md ± 1.96·SD) mà `ReagentComparisonResult.loaLower/loaUpper` đã tính.
import { useEffect, useRef } from 'react';
import type { ReagentComparisonResult } from '../../shared/qc-api';

const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function ReagentChart({ mode, result, height = 260 }: { mode: 'scatter' | 'bland'; result: ReagentComparisonResult; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth || 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    if (mode === 'scatter') drawScatter(ctx, width, height, result);
    else drawBland(ctx, width, height, result);
  }, [mode, result, height]);

  return <div ref={wrapRef} style={{ width: '100%' }}><canvas ref={canvasRef} /></div>;
}

function niceRange(values: number[]): [number, number] {
  const min = Math.min(...values), max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.1;
  return [min - pad, max + pad];
}

function drawScatter(ctx: CanvasRenderingContext2D, width: number, height: number, R: ReagentComparisonResult) {
  const innerW = width - PAD.left - PAD.right, innerH = height - PAD.top - PAD.bottom;
  const [xMin, xMax] = niceRange(R.o), [yMin, yMax] = niceRange(R.n);
  const px = (v: number) => PAD.left + (innerW * (v - xMin)) / (xMax - xMin);
  const py = (v: number) => PAD.top + innerH * (1 - (v - yMin) / (yMax - yMin));

  ctx.strokeStyle = '#dde4e8'; ctx.strokeRect(PAD.left, PAD.top, innerW, innerH);
  ctx.fillStyle = '#506674'; ctx.font = '11px Manrope,sans-serif';
  ctx.fillText('Lô cũ →', PAD.left, height - 6);
  ctx.save(); ctx.translate(12, PAD.top + innerH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Lô mới', 0, 0); ctx.restore();

  // y = x tham chieu
  ctx.strokeStyle = '#c7d2d8'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(px(Math.max(xMin, yMin)), py(Math.max(xMin, yMin))); ctx.lineTo(px(Math.min(xMax, yMax)), py(Math.min(xMax, yMax))); ctx.stroke();
  ctx.setLineDash([]);

  // Hoi quy OLS
  ctx.strokeStyle = '#0b747d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px(xMin), py(R.fit.a + R.fit.b * xMin)); ctx.lineTo(px(xMax), py(R.fit.a + R.fit.b * xMax)); ctx.stroke();

  R.o.forEach((x, i) => {
    ctx.beginPath(); ctx.fillStyle = '#14242e';
    ctx.arc(px(x), py(R.n[i]), 3, 0, Math.PI * 2); ctx.fill();
  });
}

function drawBland(ctx: CanvasRenderingContext2D, width: number, height: number, R: ReagentComparisonResult) {
  const innerW = width - PAD.left - PAD.right, innerH = height - PAD.top - PAD.bottom;
  const averages = R.o.map((v, i) => (v + R.n[i]) / 2);
  const [xMin, xMax] = niceRange(averages);
  const [yMin, yMax] = niceRange([...R.d, R.loaLower, R.loaUpper]);
  const px = (v: number) => PAD.left + (innerW * (v - xMin)) / (xMax - xMin);
  const py = (v: number) => PAD.top + innerH * (1 - (v - yMin) / (yMax - yMin));

  ctx.strokeStyle = '#dde4e8'; ctx.strokeRect(PAD.left, PAD.top, innerW, innerH);
  ctx.fillStyle = '#506674'; ctx.font = '11px Manrope,sans-serif';
  ctx.fillText('Trung bình (lô cũ, lô mới) →', PAD.left, height - 6);

  function hLine(v: number, color: string, label: string, dashed: boolean) {
    ctx.strokeStyle = color; ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath(); ctx.moveTo(PAD.left, py(v)); ctx.lineTo(width - PAD.right, py(v)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = color; ctx.fillText(label, width - PAD.right - 60, py(v) - 3);
  }
  hLine(R.md, '#dd8b1f', 'Bias', false);
  hLine(R.loaUpper, '#b93a32', '+1.96SD', true);
  hLine(R.loaLower, '#b93a32', '−1.96SD', true);

  averages.forEach((x, i) => {
    ctx.beginPath(); ctx.fillStyle = '#14242e';
    ctx.arc(px(x), py(R.d[i]), 3, 0, Math.PI * 2); ctx.fill();
  });
}
