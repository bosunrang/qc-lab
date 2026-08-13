const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-toggle-button-html.ts')).href;
const program=`import { createEntryTreeToggleButtonHtml } from ${JSON.stringify(source)};const render=createEntryTreeToggleButtonHtml({button:(label,action,variant,title,options)=>JSON.stringify({label,action,variant,title,expanded:options.attrs['aria-expanded']})});console.log(JSON.stringify([render({iconHtml:'<svg>',collapsed:false}),render({iconHtml:'<svg>',collapsed:true})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [open,collapsed]=JSON.parse(output.stdout).map(JSON.parse);
assert.deepEqual(open,{label:'<svg>',action:'toggleEntryTree()',variant:'ghost icon entry-tree-toggle',title:'Ẩn danh mục nội kiểm',expanded:'true'});
assert.deepEqual(collapsed,{label:'<svg>',action:'toggleEntryTree()',variant:'teal icon entry-tree-expand',title:'Hiện danh mục nội kiểm',expanded:'false'});
