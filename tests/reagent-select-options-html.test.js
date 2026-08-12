const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','reagent','reagent-select-options-html.ts')).href;
const program=`import { createReagentSelectOptionsHtml } from ${JSON.stringify(source)};const render=createReagentSelectOptionsHtml();console.log(render([{id:'r1',name:'Glucose'},{id:'r2',name:'HbA1c'}],'r2',value=>'['+value+']',item=>item.name));`;
const result=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
assert.equal(result.stdout,'<option value="[r1]">Glucose</option><option value="[r2]" selected>HbA1c</option>\n');
