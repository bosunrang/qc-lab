const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-machine-html.ts')).href;
const program=`import { createEntryTreeMachineHtml } from ${JSON.stringify(source)};const render=createEntryTreeMachineHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({key:'m:M1',open:true,name:'Máy 1',toggleAction:"treeToggle('m:M1')"}),render({key:'m:M2',open:false,name:'Máy 2',toggleAction:"treeToggle('m:M2')"})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [open,closed]=JSON.parse(output.stdout);
assert.match(open,/data-key="E:m:M1"/);
assert.match(open,/aria-expanded="true"/);
assert.match(open,/onclick="E:treeToggle\('m:M1'\)"/);
assert.match(open,/Máy 1/);
assert.match(closed,/aria-expanded="false"/);
assert.match(closed,/>\+<\/span>/);
