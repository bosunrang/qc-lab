// Ghi lệnh canvas thật của QcChart: kiểm tra trục, khoảng thiếu và giới hạn
// theo mẫu. Các ca này không tính lại xếp loại ngoại kiểm.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as marker from '../renderer/lib/qc-marker.ts';

function render(points, comparison) {
  const source = readFileSync(new URL('../renderer/components/QcChart.tsx', import.meta.url), 'utf8');
  const code = [
    source.slice(source.indexOf('function isRunCollateral('), source.indexOf('export interface QcChartCusum')),
    source.slice(source.indexOf('function geometry('), source.indexOf('const MULTI_COLORS')),
  ].join('\n');
  const LJ = { okBand: 'green', okMid: 'white', warnBand: 'amber', rejectBand: 'red', grid: 'grid', mean: 'zero', line: 'teal', okPoint: 'ok', warnPoint: 'warn', rejectPoint: 'rej' };
  const shapes = [], rectangles = [], paths = [], texts = [], placed = [];
  let currentPath = [], dash = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '' }, {
    get: (target, key) => {
      if (key in target) return target[key];
      if (key === 'beginPath') return () => { currentPath = []; };
      if (key === 'moveTo' || key === 'lineTo') return (...args) => { currentPath.push([key, ...args]); };
      if (key === 'setLineDash') return (value) => { dash = [...value]; };
      if (key === 'stroke') return () => paths.push({ color: target.strokeStyle, dash: [...dash], path: [...currentPath] });
      if (key === 'fillRect') return (...args) => rectangles.push({ color: target.fillStyle, box: args });
      if (key === 'fillText') return (text, x, y) => { texts.push(text); placed.push({ text, x, y }); };
      if (key === 'measureText') return (text) => ({ width: text.length * 6 });
      return () => {};
    },
  });
  const context = vm.createContext({
    LJ, BANDS: [], vnDayMonth: (d) => d, ...marker,
    traceMarker: (pen, shape, x, y, radius) => { shapes.push({ shape, x, y, radius }); pen.beginPath(); },
  });
  vm.runInContext(stripTypeScriptTypes(code), context);
  context.drawLJ(ctx, 1200, 340, points, undefined, undefined, 2, comparison);
  return { shapes, rectangles, paths, texts, placed, scale: context.comparisonScale(points, comparison) };
}

const point = (z, verdict = 'ok') => ({ date: '2026-09-20', runId: 'r', val: 10, z, verdict, rules: [] });
const profile = (over = {}) => ({ title: 'Ngoại kiểm', xTitle: 'Đợt / mẫu', unit: 'z', warning: 2, rejection: 3, labels: ['Đợt 1 · A', 'Đợt 2 · A', 'Đợt 3 · A'], selectedIndex: -1, ...over });

test('ngoại kiểm dùng hình điểm QC, không ép điểm vượt giới hạn về biên', () => {
  const { shapes, texts, scale } = render([point(0), point(2.5, 'warn'), point(4.2, 'rej')], profile());
  assert.deepEqual(shapes.map((p) => p.shape), ['circle', 'triangle', 'square']);
  assert.ok(scale.limit > 4.2);
  const expectedY = 34 + (scale.limit - 4.2) / (2 * scale.limit) * (340 - 34 - 48);
  assert.ok(Math.abs(shapes[2].y - expectedY) < 0.01);
  assert.ok(texts.includes('+3'));
  assert.ok(!texts.some((t) => t.startsWith('z ')), 'không lặp nhãn trục Y bên phải');
  assert.ok(!texts.some((t) => /SD|Levey-Jennings|Westgard/.test(t)), 'nhãn không giả thành nội kiểm');
});

test('dải ngoại kiểm theo ngưỡng được truyền, không viết cứng ±2/±3', () => {
  const { rectangles, texts, scale } = render([point(0)], profile({ warning: 1.5, rejection: 2.5 }));
  const amber = rectangles.find((r) => r.color === 'amber');
  const expectedTop = 34 + (scale.limit - 2.5) / (2 * scale.limit) * (340 - 34 - 48);
  assert.ok(Math.abs(amber.box[1] - expectedTop) < 0.01);
  assert.ok(texts.includes('+1.5'));
  assert.ok(texts.includes('+2.5'));
});

test('phần trăm giữ trục thật, ngắt đường tại mẫu thiếu và TEa riêng từng mẫu', () => {
  const { shapes, paths, texts, rectangles } = render([point(-20, 'rej'), point(NaN, 'none'), point(35)], profile({
    unit: '%', warning: null, rejection: null, limits: [10, null, 40],
  }));
  assert.equal(shapes.length, 2, 'không vẽ số 0 cho mẫu thiếu');
  const line = paths.find((p) => p.color === 'teal');
  assert.deepEqual(line.path.map((p) => p[0]), ['moveTo', 'moveTo'], 'không nối xuyên khoảng thiếu');
  const limits = paths.filter((p) => p.color === 'rej' && p.dash.join(',') === '6,4');
  assert.equal(limits.length, 4, 'chỉ hai cặp ±TEa của hai mẫu đã có giới hạn');
  assert.equal(rectangles.filter((r) => r.color === 'green').length, 2);
  assert.ok(texts.some((t) => t.endsWith('%')));
  assert.ok(!texts.some((t) => t.includes('SD')));
});

test('một mẫu nằm giữa trục, giữ đủ nhãn đợt/mẫu và viền chọn', () => {
  const { shapes, texts } = render([point(-0.01)], profile({ selectedIndex: 0, labels: ['Đợt 9 · 09-01'] }));
  assert.equal(shapes.length, 2, 'viền chọn và điểm được vẽ trên cùng tâm');
  assert.equal(shapes[0].x, shapes[1].x);
  assert.equal(shapes[1].x, 56 + (1200 - 56 - 24) / 2);
  assert.ok(texts.includes('Đợt 9 · 09-01'));
});

test('nhãn điểm không chấp nhận ở cuối trục nằm trong vùng vẽ, điểm không sát mép trên', () => {
  const rej = { ...point(3.4, 'rej'), rules: ['Không chấp nhận'] };
  const { placed, shapes, scale } = render([point(1), point(1.2), rej], profile({ selectedIndex: 2 }));
  const label = placed.find((t) => t.text === 'Không chấp nhận');
  const width = 'Không chấp nhận'.length * 6;
  assert.ok(label.x + width / 2 <= 1200 - 24, 'không tràn khỏi vùng vẽ bên phải');
  assert.ok(scale.limit >= 3.9, 'chừa ít nhất 0,5 z trên điểm cao nhất');
  const ring = shapes.find((p) => p.radius > shapes.at(-1).radius);
  assert.ok(ring.y - ring.radius >= 34, 'viền chọn nằm trọn trong vùng vẽ');
});

test('gom theo đợt: mẫu cùng đợt đứng sát nhau, chỉ nối mẫu cùng thứ tự giữa các đợt, có vạch năm', () => {
  // Hai đợt năm 2025 và một đợt năm 2026, mỗi đợt hai mẫu A, B.
  const points = [point(1), point(-1), point(1.2), point(-1.2), point(0.5), point(-0.5)];
  const { shapes, paths, texts } = render(points, profile({
    labels: ['Đ1 · A', 'Đ1 · B', 'Đ2 · A', 'Đ2 · B', 'Đ1 · A', 'Đ1 · B'],
    groups: [0, 0, 1, 1, 2, 2], groupLabels: ['Đ1 / 2025', 'Đ2 / 2025', 'Đ1 / 2026'], groupBreaks: [2],
  }));
  const xs = shapes.map((p) => p.x);
  assert.ok(xs[1] - xs[0] < 30 && xs[2] - xs[1] > 100, 'khoảng trong đợt hẹp hơn hẳn khoảng giữa các đợt');
  const line = paths.find((p) => p.color === 'teal');
  const moves = line.path.filter((p) => p[0] === 'moveTo').map((p) => p[1]);
  assert.deepEqual(moves, [xs[0], xs[1]], 'hai đường: một cho mẫu A, một cho mẫu B');
  assert.ok(!line.path.some((p, i) => i && p[0] === 'lineTo' && p[1] === xs[1] && line.path[i - 1][1] === xs[0]), 'không nối A với B trong cùng đợt');
  const yearLine = paths.find((p) => p.color === 'zero' && p.dash.join(',') === '3,4');
  assert.ok(yearLine && yearLine.path[0][1] > xs[3] && yearLine.path[0][1] < xs[4], 'vạch năm nằm giữa đợt 2/2025 và đợt 1/2026');
  assert.ok(texts.includes('Đ1 / 2025') && texts.includes('Đ1 / 2026'), 'nhãn trục X theo đợt');
});
