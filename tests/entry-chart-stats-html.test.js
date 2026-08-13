const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-chart-stats-html.ts')).href;
const program=`import { createEntryChartStatsHtml } from ${JSON.stringify(source)};
const render=createEntryChartStatsHtml({escape:value=>'E:'+value});console.log(render({mean:'5.1',sd:'0.2',cv:'4%',targetMean:'5',targetSd:'0.3'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/Mean thực/);
assert.match(output.stdout,/E:5.1/);
assert.match(output.stdout,/CV thực/);
assert.match(output.stdout,/lj-qc-stat control/);
assert.match(output.stdout,/SD mục tiêu/);
