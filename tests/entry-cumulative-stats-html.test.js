const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-cumulative-stats-html.ts')).href;
const program=`import { createEntryCumulativeStatsHtml } from ${JSON.stringify(source)};const render=createEntryCumulativeStatsHtml({escape:value=>'E:'+value});console.log(render({endDate:'13/08/2026',count:25,mean:'10.20',sd:'0.40',cv:'3.92%'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/qc-cumulative/);
assert.match(output.stdout,/Mean tích lũy<\/span><b>E:10.20<\/b>/);
assert.match(output.stdout,/CV tích lũy<\/span><b>E:3.92%<\/b>/);
