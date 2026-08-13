const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-range-buttons-html.ts')).href;
const program=`import { createEntryRangeButtonsHtml } from ${JSON.stringify(source)};const render=createEntryRangeButtonsHtml({presetButton:input=>'<button class="'+(input.active?'on':'')+'" onclick="'+input.action+'">'+input.days+' ngày</button>'});console.log(JSON.stringify([render({activeDays:30,hasCustomStart:false,days:[7,30,90]}),render({activeDays:30,hasCustomStart:true,days:[30]})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [active,custom]=JSON.parse(output.stdout);
assert.match(active,/entrySetDays\(7\)/);
assert.match(active,/class="on" onclick="entrySetDays\(30\)"/);
assert.match(active,/90 ngày/);
assert.doesNotMatch(custom,/class="on"/);
