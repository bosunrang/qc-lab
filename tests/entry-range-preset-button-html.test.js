const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-range-preset-button-html.ts')).href;
const program=`import { createEntryRangePresetButtonHtml } from ${JSON.stringify(source)};const render=createEntryRangePresetButtonHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({active:true,days:7,action:'entrySetDays(7)'}),render({active:false,days:30,action:'entrySetDays(30)'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [active,inactive]=JSON.parse(output.stdout);
assert.match(active,/class="on"/);
assert.match(active,/onclick="E:entrySetDays\(7\)"/);
assert.match(active,/>7 ngày<\/button>/);
assert.match(inactive,/class=""/);
assert.match(inactive,/>30 ngày<\/button>/);
