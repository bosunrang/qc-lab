const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-chart-panel-html.ts')).href;
const program=`import { createEntryChartPanelHtml } from ${JSON.stringify(source)};
const render=createEntryChartPanelHtml({escape:value=>'E:'+value});
console.log(render({startDateInputHtml:'<start>',endDateInputHtml:'<end>',rangeButtonsHtml:'<buttons>',startText:'01/08',endText:'31/08',levelCount:2,chartStackHtml:'<charts>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/<start>/);
assert.match(output.stdout,/<end>/);
assert.match(output.stdout,/<buttons>/);
assert.match(output.stdout,/Khoảng xem: E:01\/08 – E:31\/08 · 2 mức QC/);
assert.match(output.stdout,/<charts>/);
assert.match(output.stdout,/Cảnh báo 2–3SD/);
