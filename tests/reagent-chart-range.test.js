'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-chart-range.ts')).href;
const program = `
  import { reagentChartPresentation as p } from ${JSON.stringify(source)};
  console.log(JSON.stringify({ normal: p.range([10, 20]), flat: p.range([10, 10]), zero: p.range([0, 0]), custom: p.range([10, 20], 0.1) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript mien truc bieu do hoa chat');
assert.deepEqual(JSON.parse(result.stdout), { normal: [9.2, 20.8], flat: [9.2, 10.8], zero: [-0.08, 0.08], custom: [9, 21] });

console.log('Reagent chart-range TypeScript tests passed');
