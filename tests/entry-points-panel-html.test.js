const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-points-panel-html.ts')).href;
const program=`import { createEntryPointsPanelHtml } from ${JSON.stringify(source)};
const render=createEntryPointsPanelHtml({escape:value=>'E:'+value});
console.log(render({open:true,startText:'01/08',endText:'31/08',tableCardsHtml:'<cards>',voidedHtml:'<voided>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/qc-points-panel" open/);
assert.match(output.stdout,/từ E:01\/08 đến E:31\/08/);
assert.match(output.stdout,/<cards>/);
assert.match(output.stdout,/<voided>/);
