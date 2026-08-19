export interface QcChartRendererDeps {
  hiDpiCanvasSetup: (canvas: any) => { ctx: any; W: number; H: number };
  leveyJenningsGeometry: (input: { width: number; height: number; count: number; mean: number; sd: number }) => any;
  leveyJenningsColors: Record<string, string>;
  leveyJenningsBandRects: (input: { mean: number; sd: number; width: number; y: (value: number) => number }) => any[];
  findTest: (id: string) => any;
  leveyJenningsYAxisLabels: (test: any, mean: number, sd: number) => any[];
  leveyJenningsGridLines: (axis: any[], mean: number, sd: number, y: (value: number) => number) => any[];
  canvasFont: (weight: number, token: string, fallback: number) => string;
  leveyJenningsChartTitle: { single: string; multi: string };
  chartEmptyLabels: { leveyJennings: string; leveyJenningsMulti: string; cusum: string };
  leveyJenningsTooltipController: (canvas: any) => void;
  lvlCfg: (test: any, level: unknown) => any;
  westgard: (points: any[], mean: number, sd: number, scope: (rule: string) => boolean) => any;
  westgardRuleScope: { within: (test: any, rule: string) => boolean; across: (test: any, rule: string) => boolean };
  leveyJenningsPointRenderModel: (input: any) => any[];
  leveyJenningsTicks: (points: any[]) => any[];
  chartDataUrl: (input: { width: number; height: number; render: (canvas: any) => void }) => string;
  leveyJenningsMultiGeometry: (input: { width: number; height: number }) => any;
  leveyJenningsMultiSeries: (input: { views: any[]; padLeft: number; width: number; markPad: number }) => any;
  leveyJenningsMultiColors: string[];
  westgardMultiByPoint: (levels: any[], scope: (rule: string) => boolean) => any;
  westgardByPoint: (points: any[], mean: number, sd: number, scope: (rule: string) => boolean) => any;
  leveyJenningsMultiPointRenderModel: (input: any) => any[];
  leveyJenningsMultiDividers: (levels: any[], runs: string[], runIndex: Map<string, number>, xOfRun: (run: string) => number) => number[];
  leveyJenningsMultiRunTicks: (runs: string[], all: any[]) => any[];
  leveyJenningsLegendLayout: (levels: any[], colors: string[], startX: number, measure: (text: string) => { width: number }) => any[];
  leveyJenningsMultiYAxis: () => any[];
  cusumChartGeometry: (input: { width: number; height: number; count: number; h: number; cPos: number[]; cNeg: number[]; ma: number[] }) => any;
  cusumReferenceLines: (input: { h: number; y: (value: number) => number }) => any;
  cusumColors: Record<string, string>;
  cusumChartTitle: (k: number, h: number) => string;
  format: (value: unknown, decimals?: number) => string;
  cusumDisplayPlan: (input: { count: number; width: number; cPos: any[]; cNeg: any[]; ma: any[]; flags: any[] }) => number[];
  cusumLinePoints: (input: { indices: number[]; values: any[]; x: (index: number) => number; clampY: (value: number) => number }) => any[];
  cusumPointRenderModel: (input: any) => any[];
  cusumHoverModel: (input: { point: any; cPos: any; cNeg: any; rejected: boolean }) => string;
}

export function createQcChartRenderer(deps: QcChartRendererDeps) {
  function drawLJ(canvas: any, points: any[], mean: number, sd: number): void {
    const { ctx, W, H } = deps.hiDpiCanvasSetup(canvas);
    canvas._ljCssW = W; canvas._ljCssH = H;
    const n = points.length, { padL, padT, cw, ch, markPad, y, clampY, x } = deps.leveyJenningsGeometry({ width: W, height: H, count: n, mean, sd });

    ctx.clearRect(0, 0, W, H);
    const ljColors = deps.leveyJenningsColors;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ljColors.okBand; ctx.fillRect(padL, padT, cw, ch);
    ctx.save(); ctx.beginPath(); ctx.rect(padL - markPad, padT, cw + markPad * 2, ch); ctx.clip();

    deps.leveyJenningsBandRects({ mean, sd, width: cw, y }).forEach((band: any) => { ctx.fillStyle = (ljColors as any)[band.color]; ctx.fillRect(padL, band.top, band.width, band.height); });

    const test = deps.findTest(canvas.dataset.test), yAxis = deps.leveyJenningsYAxisLabels(test, mean, sd), rows = yAxis.map((row: any) => row.z);
    void rows;
    deps.leveyJenningsGridLines(yAxis, mean, sd, y).forEach((line: any) => {
      ctx.strokeStyle = line.major ? ljColors.mean : ljColors.grid;
      ctx.lineWidth = line.major ? 1.8 : 1.15; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(padL, line.y); ctx.lineTo(padL + cw, line.y); ctx.stroke();
    });
    ctx.restore();

    ctx.font = deps.canvasFont(800, 'type-caption', 11.5); ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(deps.leveyJenningsChartTitle.single, padL + cw / 2, padT - 8);
    ctx.font = deps.canvasFont(800, 'type-meta', 12.5); ctx.textBaseline = 'middle';
    yAxis.forEach((row: any) => {
      const yy = y(mean + row.z * sd);
      ctx.fillStyle = '#17212b'; ctx.textAlign = 'right'; ctx.fillText(row.label, padL - 9, yy);
      ctx.fillStyle = '#17212b'; ctx.textAlign = 'left'; ctx.fillText(row.value, padL + cw + 10, yy);
    });

    if (!n) {
      ctx.fillStyle = '#7b838e'; ctx.font = deps.canvasFont(600, 'type-subhead', 14); ctx.textAlign = 'center'; ctx.fillText(deps.chartEmptyLabels.leveyJennings, padL + cw / 2, padT + ch / 2);
      canvas._ljHover = []; deps.leveyJenningsTooltipController(canvas);
      return;
    }

    const level = parseInt(canvas.dataset.level), lot = canvas.dataset.lot || (test && deps.lvlCfg(test, level) || {}).lot || '?';
    const { F, zs } = deps.westgard(points, mean, sd, (rule: string) => deps.westgardRuleScope.within(test, rule));
    const levelText = level ? `Mức ${level}` : 'Mức QC';
    const pointModels = deps.leveyJenningsPointRenderModel({ points, results: F, zs, width: cw, x, y: clampY, test, lot, levelText });
    canvas._ljHover = [];
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
    if (points.length > 1) {
      ctx.strokeStyle = ljColors.line; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
      ctx.beginPath();
      pointModels.forEach((model: any, j: number) => { if (j) ctx.lineTo(model.x, model.y); else ctx.moveTo(model.x, model.y); });
      ctx.stroke();
    }
    pointModels.forEach((model: any) => {
      ctx.fillStyle = model.style.color; ctx.beginPath(); ctx.arc(model.x, model.y, model.style.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
      canvas._ljHover.push({ x: model.x, y: model.y, hit: 12, html: model.hover });
    });
    ctx.restore();
    const ticks = deps.leveyJenningsTicks(points);
    ctx.fillStyle = '#536772'; ctx.font = deps.canvasFont(700, 'type-caption', 11.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ticks.forEach((tick: any) => ctx.fillText(tick.label, x(tick.index), padT + ch + 10));
    deps.leveyJenningsTooltipController(canvas);
  }

  function ljDataURL(points: any[], mean: number, sd: number): string {
    return deps.chartDataUrl({ width: 1400, height: 430, render: canvas => drawLJ(canvas, points, mean, sd) });
  }

  function drawLJMultiZ(canvas: any, levelViews: any[], test: any, opts?: { divider?: boolean }): void {
    const { ctx, W, H } = deps.hiDpiCanvasSetup(canvas);
    canvas._ljCssW = W; canvas._ljCssH = H; canvas._ljHover = [];
    const { padL, padT, cw, ch, markPad, y, clampY } = deps.leveyJenningsMultiGeometry({ width: W, height: H });
    const { levels, all, runs, runIndex, xOfRun } = deps.leveyJenningsMultiSeries({ views: levelViews, padLeft: padL, width: cw, markPad });
    const colors = deps.leveyJenningsMultiColors;
    const ljColors = deps.leveyJenningsColors;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ljColors.okBand; ctx.fillRect(padL, padT, cw, ch);
    ctx.save(); ctx.beginPath(); ctx.rect(padL - markPad, padT, cw + markPad * 2, ch); ctx.clip();
    deps.leveyJenningsBandRects({ mean: 0, sd: 1, width: cw, y }).forEach((band: any) => { ctx.fillStyle = (ljColors as any)[band.color]; ctx.fillRect(padL, band.top, band.width, band.height); });
    deps.leveyJenningsGridLines([3, 2, 1, 0, -1, -2, -3].map(z => ({ z })), 0, 1, y).forEach((line: any) => {
      ctx.strokeStyle = line.major ? ljColors.mean : ljColors.grid; ctx.lineWidth = line.major ? 1.8 : 1.15; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(padL, line.y); ctx.lineTo(padL + cw, line.y); ctx.stroke();
    });
    ctx.restore();

    ctx.font = deps.canvasFont(800, 'type-caption', 11.5); ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(deps.leveyJenningsChartTitle.multi, padL + cw / 2, padT - 8);
    ctx.font = deps.canvasFont(800, 'type-meta', 12.5); ctx.textBaseline = 'middle';
    deps.leveyJenningsMultiYAxis().forEach((label: any) => { const yy = y(label.z); ctx.fillStyle = '#17212b'; ctx.textAlign = 'right'; ctx.fillText(label.left, padL - 9, yy); ctx.textAlign = 'left'; ctx.fillText(label.right, padL + cw + 10, yy); });
    if (!all.length) {
      ctx.fillStyle = '#7b838e'; ctx.font = deps.canvasFont(600, 'type-subhead', 14); ctx.textAlign = 'center'; ctx.fillText(deps.chartEmptyLabels.leveyJenningsMulti, padL + cw / 2, padT + ch / 2);
      deps.leveyJenningsTooltipController(canvas); return;
    }

    const cross = deps.westgardMultiByPoint(levels.map((v: any) => ({ level: v.level, pts: v.pts, mean: v.mean, sd: v.sd })), (rule: string) => deps.westgardRuleScope.across(test, rule));
    if (opts && opts.divider && levels.length > 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
      ctx.strokeStyle = '#9aa7b0'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
      deps.leveyJenningsMultiDividers(levels, runs, runIndex, xOfRun).forEach((xDiv: number) => { ctx.beginPath(); ctx.moveTo(xDiv, padT); ctx.lineTo(xDiv, padT + ch); ctx.stroke(); });
      ctx.setLineDash([]); ctx.restore();
    }
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
    levels.forEach((v: any, li: number) => {
      const color = colors[li % colors.length], single = deps.westgardByPoint(v.pts, v.mean, v.sd, (rule: string) => deps.westgardRuleScope.within(test, rule));
      const pointModels = deps.leveyJenningsMultiPointRenderModel({ points: v.pts, single, cross, width: cw, levelCount: levels.length, x: xOfRun, y: clampY, test, view: v, color });
      if (v.pts.length > 1) {
        ctx.strokeStyle = color; ctx.lineWidth = 2.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
        ctx.beginPath();
        pointModels.forEach((model: any, j: number) => { if (j) ctx.lineTo(model.x, model.y); else ctx.moveTo(model.x, model.y); });
        ctx.stroke();
      }
      pointModels.forEach((model: any) => {
        ctx.fillStyle = model.color; ctx.beginPath(); ctx.arc(model.x, model.y, model.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke();
        canvas._ljHover.push({ x: model.x, y: model.y, hit: 13, html: model.hover });
      });
    });
    ctx.restore();
    if (runs.length) {
      const ticks = deps.leveyJenningsMultiRunTicks(runs, all);
      ctx.fillStyle = '#536772'; ctx.font = deps.canvasFont(700, 'type-caption', 11.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ticks.forEach((tick: any) => ctx.fillText(tick.label, xOfRun(tick.run), padT + ch + 10));
    }
    {
      const y0 = 10; ctx.font = deps.canvasFont(800, 'type-caption', 11.5); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      deps.leveyJenningsLegendLayout(levels, colors, padL + 8, ctx.measureText.bind(ctx)).forEach((item: any) => {
        ctx.fillStyle = item.color; ctx.fillRect(item.x, y0, 18, 4);
        ctx.fillStyle = '#17212b'; ctx.fillText(item.label, item.x + 25, y0 + 2);
      });
    }
    deps.leveyJenningsTooltipController(canvas);
  }

  function ljMultiDataURL(levelViews: any[], test: any, opts?: { divider?: boolean }): string {
    return deps.chartDataUrl({ width: 1400, height: 430, render: canvas => drawLJMultiZ(canvas, levelViews, test, opts) });
  }

  function drawCUSUM(canvas: any, points: any[], series: any): void {
    const { ctx, W, H } = deps.hiDpiCanvasSetup(canvas);
    canvas._ljCssW = W; canvas._ljCssH = H;
    const n = points.length, h = (series && series.h) || 4, k = (series && series.k) || 0.5;
    const cPos = (series && series.cPos) || [], cNeg = (series && series.cNeg) || [], ma = (series && series.ma) || [], flags = (series && series.flags) || [];
    const { padL, padT, cw, ch, markPad, y, clampY, x } = deps.cusumChartGeometry({ width: W, height: H, count: n, h, cPos, cNeg, ma });
    const refs = deps.cusumReferenceLines({ h, y });
    const cc = deps.cusumColors;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.beginPath(); ctx.rect(padL - markPad, padT, cw + markPad * 2, ch); ctx.clip();
    ctx.strokeStyle = cc.threshold; ctx.lineWidth = 1.3; ctx.setLineDash([6, 4]);
    refs.thresholds.forEach((line: any) => { ctx.beginPath(); ctx.moveTo(padL, line.y); ctx.lineTo(padL + cw, line.y); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.strokeStyle = cc.zero; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(padL, refs.zero.y); ctx.lineTo(padL + cw, refs.zero.y); ctx.stroke();
    ctx.restore();

    ctx.font = deps.canvasFont(800, 'type-caption', 11.5); ctx.fillStyle = '#17212b'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(deps.cusumChartTitle(k, h), padL + cw / 2, padT - 8);
    ctx.font = deps.canvasFont(800, 'type-meta', 12.5); ctx.textBaseline = 'middle';
    refs.labels.forEach((label: any) => { ctx.fillStyle = '#17212b'; ctx.textAlign = 'right'; ctx.fillText(deps.format(label.value, 2), padL - 9, label.y); });

    if (!n) {
      ctx.fillStyle = '#7b838e'; ctx.font = deps.canvasFont(600, 'type-subhead', 14); ctx.textAlign = 'center'; ctx.fillText(deps.chartEmptyLabels.cusum, padL + cw / 2, padT + ch / 2);
      canvas._ljHover = []; deps.leveyJenningsTooltipController(canvas);
      return;
    }

    canvas._ljHover = [];
    const drawIndices = deps.cusumDisplayPlan({ count: n, width: cw, cPos, cNeg, ma, flags });
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw, ch); ctx.clip();
    const line = (arr: any[], color: string, dash?: number[]) => {
      if (n <= 1) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash || []);
      ctx.beginPath();
      deps.cusumLinePoints({ indices: drawIndices, values: arr, x, clampY }).forEach((point: any, index: number) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
      ctx.stroke();
    };
    line(ma, cc.ma, [3, 3]);
    line(cNeg, cc.cneg);
    line(cPos, cc.cpos);
    ctx.setLineDash([]);
    deps.cusumPointRenderModel({ indices: drawIndices, points, cPos, cNeg, flags, h, x, clampY, colors: cc }).forEach((model: any) => {
      model.circles.forEach((circle: any) => {
        ctx.fillStyle = circle.color;
        ctx.beginPath(); ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      });
      canvas._ljHover.push({ x: model.x, y: model.hoverY, hit: 12, html: deps.cusumHoverModel({ point: model.point, cPos: model.positive, cNeg: model.negative, rejected: model.rejected }) });
    });
    ctx.restore();
    deps.leveyJenningsTooltipController(canvas);
  }

  return { drawLJ, ljDataURL, drawLJMultiZ, ljMultiDataURL, drawCUSUM };
}
