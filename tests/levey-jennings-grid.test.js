'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-grid.ts')).href;
const program = `
  import { leveyJenningsGridLines } from ${JSON.stringify(source)};
  const lines=leveyJenningsGridLines([{z:3},{z:0},{z:-3}],100,2,value=>200-value);
  if(lines.map(line=>line.y).join(',')!=='94,100,106'||lines.map(line=>line.major).join(',')!=='false,true,false')throw new Error('must preserve SD grid geometry and mean emphasis');
  console.log('Levey-Jennings grid TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings grid TypeScript');
console.log(result.stdout.trim());
