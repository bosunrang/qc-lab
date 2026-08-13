const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-group-html.ts')).href;
const program=`import { createEntryTreeGroupHtml } from ${JSON.stringify(source)};const render=createEntryTreeGroupHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({key:'lg:M1|G1',open:true,visible:true,search:'Nhom A',name:'Nhóm A',state:'warn',stateLabel:'Cảnh báo',toggleAction:"treeToggle('lg:M1|G1')"}),render({key:'lg:M2|G2',open:false,visible:false,search:'Nhom B',name:'Nhóm B',state:'none',stateLabel:'',toggleAction:"treeToggle('lg:M2|G2')"})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [open,closed]=JSON.parse(output.stdout);
assert.match(open,/class="tnode tn-test open"/);
assert.match(open,/data-search="E:Nhom A"/);
assert.match(open,/class="state E:warn"/);
assert.match(open,/aria-expanded="true"/);
assert.match(closed,/style="display:none"/);
assert.match(closed,/class="state E:"/);
