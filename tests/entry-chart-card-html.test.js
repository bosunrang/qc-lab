const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-chart-card-html.ts')).href;
const program=`import { createEntryChartCardHtml } from ${JSON.stringify(source)};
const render=createEntryChartCardHtml({escape:value=>'E:'+value});
console.log(render({active:true,parallel:true,level:2,lot:'L-02',previousLot:true,pointCount:15,headerActionHtml:'<action>',statsHtml:'<stats>',testId:'T-1',mean:'5',sd:'0.2',start:'2026-08-01',end:'2026-08-31'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/lj-mini on lj-mini-parallel/);
assert.match(output.stdout,/Mức 2 · Lô cũ E:L-02/);
assert.match(output.stdout,/Song song/);
assert.match(output.stdout,/<action>/);
assert.match(output.stdout,/data-test="E:T-1"/);
assert.match(output.stdout,/data-start="E:2026-08-01"/);
