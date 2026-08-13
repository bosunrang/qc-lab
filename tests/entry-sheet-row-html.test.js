const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-sheet-row-html.ts')).href;
const program=`import { createEntrySheetRowHtml } from ${JSON.stringify(source)};const render=createEntrySheetRowHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({rowClass:'today has-data',date:'2026-08-13',day:'13',today:true,cellsHtml:'<cells>',staffHtml:'<staff>',warningRules:'1-2s',rejectionRules:'1-3s',statusHtml:'<status>',noteHtml:'<note>'}),render({rowClass:'missing',date:'2026-08-14',day:'14',today:false,cellsHtml:'',staffHtml:'—',warningRules:'—',rejectionRules:'—',statusHtml:'—',noteHtml:'—'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [today,normal]=JSON.parse(output.stdout);
assert.match(today,/class="E:today has-data"/);
assert.match(today,/data-date="E:2026-08-13"/);
assert.match(today,/<b>Hôm nay<\/b>/);
assert.match(today,/<cells>/);
assert.match(today,/E:1-2s/);
assert.doesNotMatch(normal,/Hôm nay/);
