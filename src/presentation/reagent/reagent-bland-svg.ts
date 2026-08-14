type BlandResult = { o: number[]; n: number[]; d: number[]; md: number; sdd: number };
type BlandPalette = { line: string; amber: string; red: string };
type BlandAxis = { g: string; px: (value: number) => number; py: (value: number) => number };

function minimum(values: number[]): number { return values.reduce((min, value) => value < min ? value : min, values[0]); }
function maximum(values: number[]): number { return values.reduce((max, value) => value > max ? value : max, values[0]); }

export function reagentBlandSvg(result: BlandResult, range: (min: number, max: number) => [number, number], axis: (width: number, height: number, xmin: number, xmax: number, ymin: number, ymax: number, xlab: string, ylab: string) => BlandAxis, palette: BlandPalette): string {
  const width = 460, height = 380, averages = result.o.map((value, index) => (value + result.n[index]) / 2), up = result.md + 1.96 * result.sdd, low = result.md - 1.96 * result.sdd;
  let xlo = minimum(averages), xhi = maximum(averages), ylo = minimum(result.d.concat(low)), yhi = maximum(result.d.concat(up));
  [xlo, xhi] = range(xlo, xhi); [ylo, yhi] = range(ylo, yhi);
  const chart = axis(width, height, xlo, xhi, ylo, yhi, 'Trung bình (cũ + mới)/2', 'Hiệu số (cũ − mới)');
  const line = (value: number, color: string, dash: boolean, label: string) => `<line x1="${chart.px(xlo)}" y1="${chart.py(value)}" x2="${chart.px(xhi)}" y2="${chart.py(value)}" stroke="${color}" stroke-width="1.6"${dash ? ' stroke-dasharray="5 4"' : ''}/><text x="${chart.px(xhi)}" y="${chart.py(value) - 4}" font-size="var(--type-overline)" fill="${color}" text-anchor="end">${label} ${+value.toFixed(3)}</text>`;
  let g = chart.g;
  g += `<line x1="${chart.px(xlo)}" y1="${chart.py(0)}" x2="${chart.px(xhi)}" y2="${chart.py(0)}" stroke="${palette.line}"/>`;
  g += line(result.md, palette.amber, false, 'Bias') + line(up, palette.red, true, '+1.96SD') + line(low, palette.red, true, '−1.96SD');
  averages.forEach((value, index) => { g += `<circle cx="${chart.px(value)}" cy="${chart.py(result.d[index])}" r="4.5" fill="${palette.amber}" fill-opacity="0.8" stroke="#fff" stroke-width="1.2"/>`; });
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}
