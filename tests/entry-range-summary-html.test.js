const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-range-summary-html.ts')).href;
const program=`import { createEntryRangeSummaryHtml } from ${JSON.stringify(source)};
const render=createEntryRangeSummaryHtml({escape:value=>'E:'+value});
console.log(JSON.stringify([render({open:true,summary:'N=20',source:'PXN',mean:'5',sd:'0.2',eligible:true,candidateCount:20,candidateDays:21,candidateMean:'5.1',candidateSd:'0.3',candidateCv:'6',actionsHtml:'<actions>'}),render({open:false,summary:'N=2',source:'NSX',mean:'5',sd:'0.2',eligible:false,candidateCount:2,candidateDays:1,candidateMean:'',candidateSd:'',candidateCv:'',actionsHtml:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [eligible,pending]=JSON.parse(output.stdout);
assert.match(eligible,/range-summary-panel" open/);
assert.match(eligible,/Đủ điều kiện lập dải mới \(20 kết quả \/ 21 ngày độc lập\)/);
assert.match(eligible,/<actions>/);
assert.match(pending,/Cần ≥20 kết quả trên ≥20 ngày độc lập/);
assert.match(pending,/hiện 2 kết quả \/ 1 ngày/);
