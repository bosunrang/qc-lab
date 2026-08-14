type ScatterResult = { o: number[]; n: number[]; pb: { a: number; b: number } };
type ScatterPalette = { muted: string; teal: string };
type ScatterAxis = { g: string; px: (value: number) => number; py: (value: number) => number };

export function reagentScatterSvg(result: ScatterResult, test: { lotOld?: string; lotNew?: string }, range: (min: number, max: number) => [number, number], axis: (width: number, height: number, xmin: number, xmax: number, ymin: number, ymax: number, xlab: string, ylab: string) => ScatterAxis, palette: ScatterPalette): string {
  const width = 460, height = 380, values = result.o.concat(result.n);
  let lo = values.reduce((min, value) => value < min ? value : min, values[0]), hi = values.reduce((max, value) => value > max ? value : max, values[0]);
  [lo, hi] = range(lo, hi);
  const chart = axis(width, height, lo, hi, lo, hi, `Lô cũ (${test.lotOld || 'cũ'})`, `Lô mới (${test.lotNew || 'mới'})`);
  let g = chart.g;
  g += `<line x1="${chart.px(lo)}" y1="${chart.py(lo)}" x2="${chart.px(hi)}" y2="${chart.py(hi)}" stroke="${palette.muted}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  g += `<line x1="${chart.px(lo)}" y1="${chart.py(result.pb.a + result.pb.b * lo)}" x2="${chart.px(hi)}" y2="${chart.py(result.pb.a + result.pb.b * hi)}" stroke="${palette.teal}" stroke-width="2"/>`;
  result.o.forEach((value, index) => { g += `<circle cx="${chart.px(value)}" cy="${chart.py(result.n[index])}" r="4.5" fill="${palette.teal}" fill-opacity="0.78" stroke="#fff" stroke-width="1.2"/>`; });
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}
