const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','reagent','reagent-pair-row-html.ts')).href;
const program=`import { createReagentPairRowHtml } from ${JSON.stringify(source)};const render=createReagentPairRowHtml();console.log(render({index:2,row:['1.2','0.8'],readOnly:false,pair:{avg:1,dif:.4},format:(v)=>String(v),escAttr:v=>'['+v+']'}));console.log('---');console.log(render({index:0,row:['1','2'],readOnly:true,pair:{avg:1.5,dif:-1},format:(v)=>String(v),escAttr:String}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [editable,locked]=output.stdout.split('---\n');
assert.match(editable,/data-rc-row="2"/);
assert.match(editable,/value="\[1\.2\]"/);
assert.match(editable,/rcCell\(2,0,this\.value\)/);
assert.match(editable,/rcRmRow\(2\)/);
assert.match(locked,/disabled/);
assert.match(locked,/class="rc-calc dif neg"/);
assert.doesNotMatch(locked,/rcRmRow/);
