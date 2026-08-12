const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','reagent','reagent-result-html.ts')).href;
const result={N:20,df:19,mO:101,mN:100,vO:4,vN:4,md:1,sdd:1,tStat:2,r:.99,alpha:.05,p2:.1,p1:.05,tc1:1.7,tc2:2.1,bias:1,biasT:6,mard:1,passP:true,passBias:true,passR2:true,passSlope:true,coverage:true,enoughN:true,level:'ok',fit:{a:0,b:1,r2:.98},pb:{a:0,b:1}};
const program=`import { createReagentResultHtml } from ${JSON.stringify(source)};const render=createReagentResultHtml();console.log(JSON.stringify([render(null,5,String,String),render(${JSON.stringify(result)},5,(value)=>String(value),String)]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [empty,complete]=JSON.parse(output.stdout);
assert.match(empty.statsHtml,/tối thiểu 5 cặp/);
assert.equal(empty.criteriaHtml,'');
assert.match(complete.statsHtml,/Pearson r/);
assert.match(complete.criteriaHtml,/ĐẠT/);
assert.match(complete.verdictHtml,/Đạt tiêu chí sàng lọc/);
