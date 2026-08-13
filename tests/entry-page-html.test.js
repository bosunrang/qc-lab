const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-page-html.ts')).href;
const program=`import { createEntryPageHtml } from ${JSON.stringify(source)};
const render=createEntryPageHtml({head:(title,subtitle)=>'HEAD:'+title+'|'+subtitle});
console.log(render({treeCollapsed:true,treeHeadHtml:'<tree-head>',treeHtml:'<tree>',rightHtml:'<right>',treeToggleButtonHtml:'<tree-toggle>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/HEAD:Nhập QC/);
assert.match(output.stdout,/entrygrid tree-collapsed/);
assert.match(output.stdout,/<tree-toggle>/);
assert.match(output.stdout,/<tree-head><div role="tree" aria-label="Danh mục nội kiểm"><tree><\/div>/);
assert.match(output.stdout,/<div class="entry-main"><right><\/div>/);
