type ReagentChartAxisPalette = { grid: string; muted: string; ink: string };
type ReagentChartAxisPad = { l: number; r: number; t: number; b: number };

export function reagentChartAxis(width: number, height: number, xmin: number, xmax: number, ymin: number, ymax: number, xlab: string, ylab: string, palette: ReagentChartAxisPalette, pad: ReagentChartAxisPad, esc: (value: unknown) => string) {
  const px = (value: number) => pad.l + (value - xmin) / (xmax - xmin) * (width - pad.l - pad.r);
  const py = (value: number) => height - pad.b - (value - ymin) / (ymax - ymin) * (height - pad.t - pad.b);
  let g = '';
  for (let i = 0; i <= 5; i++) {
    const xv = xmin + (xmax - xmin) * i / 5, yv = ymin + (ymax - ymin) * i / 5;
    g += `<line x1="${px(xv)}" y1="${pad.t}" x2="${px(xv)}" y2="${height - pad.b}" stroke="${palette.grid}"/><line x1="${pad.l}" y1="${py(yv)}" x2="${width - pad.r}" y2="${py(yv)}" stroke="${palette.grid}"/>`;
    g += `<text x="${px(xv)}" y="${height - pad.b + 15}" font-size="var(--type-overline)" fill="${palette.muted}" text-anchor="middle">${+xv.toFixed(2)}</text>`;
    g += `<text x="${pad.l - 7}" y="${py(yv) + 3}" font-size="var(--type-overline)" fill="${palette.muted}" text-anchor="end">${+yv.toFixed(2)}</text>`;
  }
  g += `<line x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" stroke="${palette.ink}" stroke-width="1.3"/><line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="${palette.ink}" stroke-width="1.3"/>`;
  g += `<text x="${(pad.l + width - pad.r) / 2}" y="${height - 7}" font-size="var(--type-overline)" fill="${palette.ink}" text-anchor="middle" font-weight="600">${esc(xlab)}</text>`;
  g += `<text transform="translate(13,${(pad.t + height - pad.b) / 2}) rotate(-90)" font-size="var(--type-overline)" fill="${palette.ink}" text-anchor="middle" font-weight="600">${esc(ylab)}</text>`;
  return { g, px, py };
}
