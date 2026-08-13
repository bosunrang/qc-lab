'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-point-style.ts')).href;
const program = `
  import { leveyJenningsPointStyle } from ${JSON.stringify(source)};
  const colors={okPoint:'ok',warnPoint:'warn',rejectPoint:'rej'};
  const ok=leveyJenningsPointStyle('ok',colors),warn=leveyJenningsPointStyle('warn',colors),rej=leveyJenningsPointStyle('rej',colors);
  if(ok.color!=='ok'||ok.radius!==4||warn.color!=='warn'||warn.radius!==5||rej.color!=='rej'||rej.radius!==5)throw new Error('must preserve verdict styles');
  console.log('Levey-Jennings point style TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings point style TypeScript');
console.log(result.stdout.trim());
