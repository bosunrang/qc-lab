const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-assay-html.ts')).href;
const program=`import { createEntryTreeAssayHtml } from ${JSON.stringify(source)};const render=createEntryTreeAssayHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({active:true,testId:'T1',search:'Glucose',visible:true,pickAction:"entryPick('T1',1)",name:'Glucose',state:'rej',stateLabel:'Loại bỏ'}),render({active:false,testId:'T2',search:'Urea',visible:false,pickAction:"entryPick('T2',2)",name:'Urea',state:'none',stateLabel:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [active,hidden]=JSON.parse(output.stdout);
assert.match(active,/class="tnode tn-config on"/);
assert.match(active,/data-test-id="E:T1"/);
assert.match(active,/aria-current="true"/);
assert.match(active,/onclick="E:entryPick\('T1',1\)"/);
assert.match(active,/class="state E:rej"/);
assert.match(hidden,/style="display:none"/);
assert.match(hidden,/aria-current="false"/);
