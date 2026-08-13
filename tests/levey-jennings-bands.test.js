'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-bands.ts')).href;
const program = `
  import { leveyJenningsBandRects } from ${JSON.stringify(source)};
  const bands=leveyJenningsBandRects({mean:100,sd:10,width:200,y:value=>200-value});
  if(bands.length!==6||bands[0].color!=='rejectBand'||bands[0].top!==67.5||bands[0].height!==2.5||bands[2].height!==10||bands[5].color!=='okMid'||bands[5].width!==200)throw new Error('must preserve standard SD bands');
  console.log('Levey-Jennings bands TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings bands TypeScript');
console.log(result.stdout.trim());
