const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-header-html.ts')).href;
const program=`import { createEntryTreeHeaderHtml } from ${JSON.stringify(source)};const render=createEntryTreeHeaderHtml({escape:value=>'E:'+value});console.log(render({toggleButtonHtml:'<button>Ẩn</button>',search:'Glucose',machineOptionsHtml:'<option>Máy A</option>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/entry-tree-head/);
assert.match(output.stdout,/<button>Ẩn<\/button>/);
assert.match(output.stdout,/value="E:Glucose"/);
assert.match(output.stdout,/oninput="entryFilter\(this.value\)"/);
assert.match(output.stdout,/<option>Máy A<\/option>/);
