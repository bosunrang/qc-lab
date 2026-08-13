const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-machine-options-html.ts')).href;
const program=`import { createEntryMachineOptionsHtml } from ${JSON.stringify(source)};const render=createEntryMachineOptionsHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({machines:['Máy A','Máy B'],selected:'Máy B'}),render({machines:[],selected:'all'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [selected,empty]=JSON.parse(output.stdout);
assert.match(selected,/value="all">Tất cả máy/);
assert.match(selected,/value="E:Máy B" selected>E:Máy B/);
assert.doesNotMatch(selected,/value="E:Máy A" selected/);
assert.equal(empty,'<option value="all">Tất cả máy</option>');
