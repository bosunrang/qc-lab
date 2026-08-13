const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-add-run-button-html.ts')).href;
const program=`import { createEntryAddRunButtonHtml } from ${JSON.stringify(source)};const render=createEntryAddRunButtonHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({action:"entryUnlockExtraRun('T1')"}),render({action:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [button,none]=JSON.parse(output.stdout);
assert.match(button,/qc-add-run-btn/);
assert.match(button,/onclick="E:entryUnlockExtraRun\('T1'\)"/);
assert.match(button,/Thêm/);
assert.equal(none,'');
