'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-y-axis.ts')).href;
const program = `
  import { createLeveyJenningsYAxisLabels } from ${JSON.stringify(source)};
  const rows=createLeveyJenningsYAxisLabels((test,value)=>test.unit+value.toFixed(1))({unit:'U'},100,2);
  if(rows.map(row=>row.z).join(',')!=='3,2,1,0,-1,-2,-3'||rows[0].label!=='> +3'||rows[6].label!=='< -3'||rows[0].value!=='U106.0'||rows[3].value!=='U100.0')throw new Error('must preserve SD labels and formatted values');
  console.log('Levey-Jennings Y axis TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings Y axis TypeScript');
console.log(result.stdout.trim());
