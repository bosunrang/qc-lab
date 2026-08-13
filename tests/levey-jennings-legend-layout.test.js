'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-legend-layout.ts')).href;
const program = `
  import { createLeveyJenningsLegendLayout } from ${JSON.stringify(source)};
  const items=createLeveyJenningsLegendLayout(text=>text.length*10)([{level:1,label:'Mức 1'},{level:2,label:'Lô QC rất dài'}],['a','b'],64);
  if(items[0].x!==64||items[0].color!=='a'||items[1].x!==159||items[1].color!=='b'||items[1].label!=='Lô QC rất dài')throw new Error('must lay out legend by measured label width');
  console.log('Levey-Jennings legend layout TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings legend layout TypeScript');
console.log(result.stdout.trim());
