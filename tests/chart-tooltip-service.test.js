'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'chart-tooltip-service.ts')).href;
const program = `
  import { createChartTooltipService } from ${JSON.stringify(source)};
  let current=null,created=0,appended=0;
  const tooltip=createChartTooltipService({find:()=>current,create:()=>{created++;return{};},append:element=>{appended++;current=element;}});
  const first=tooltip(),second=tooltip();
  if(first!==second||created!==1||appended!==1)throw new Error('tooltip must be created and appended once');
  if(first.id!=='qcTooltip'||first.className!=='qc-tooltip')throw new Error('tooltip identity must remain compatible');
  console.log('Chart tooltip service TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy chart tooltip service TypeScript');
console.log(result.stdout.trim());
