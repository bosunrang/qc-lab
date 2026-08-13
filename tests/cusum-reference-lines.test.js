'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'cusum-reference-lines.ts')).href;
const program = `
  import { cusumReferenceLines } from ${JSON.stringify(source)};
  const model=cusumReferenceLines({h:4,y:value=>100-value*10});
  if(model.thresholds.map(line=>line.value+':'+line.y).join(',')!=='4:60,-4:140'||model.zero.y!==100||model.labels.map(label=>label.value).join(',')!=='4,0,-4')throw new Error('must provide CUSUM threshold, zero and axis labels');
  console.log('CUSUM reference lines TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy CUSUM reference lines TypeScript');
console.log(result.stdout.trim());
