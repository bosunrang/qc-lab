const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-run-cell-html.ts')).href;
const program=`import { createEntryRunCellHtml } from ${JSON.stringify(source)};const render=createEntryRunCellHtml();console.log(JSON.stringify([render({parallel:true,runInputsHtml:'<inputs>',addRunButtonHtml:'<add>'}),render({parallel:false,runInputsHtml:'',addRunButtonHtml:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [parallel,standard]=JSON.parse(output.stdout);
assert.match(parallel,/qc-parallel-cell/);
assert.match(parallel,/qc-run-grid has-add-btn/);
assert.match(parallel,/<inputs>/);
assert.match(parallel,/<add>/);
assert.doesNotMatch(standard,/qc-parallel-cell|has-add-btn/);
