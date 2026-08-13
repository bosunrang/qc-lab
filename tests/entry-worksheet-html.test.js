const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-worksheet-html.ts')).href;
const program=`import { createEntryWorksheetHtml } from ${JSON.stringify(source)};
const render=createEntryWorksheetHtml({escape:value=>'E:'+value,button:(label,action,variant)=>'<button>'+label+'|'+action+'|'+variant+'</button>'});
console.log(render({testName:'Glucose',lotLabel:'L-01',monthOptionsHtml:'<month>',yearOptionsHtml:'<year>',levelHeadHtml:'<level>',rowsHtml:'',columnCount:2,messageHtml:'<msg>',navigationButtonsHtml:'<nav-buttons>',emptyRowHtml:'<empty-row>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/E:Glucose/);
assert.match(output.stdout,/E:L-01/);
assert.match(output.stdout,/<month><\/select>/);
assert.match(output.stdout,/<nav-buttons>/);
assert.match(output.stdout,/<empty-row>/);
assert.match(output.stdout,/<msg>/);
