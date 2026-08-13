const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','nce','action-form-shell.ts')).href;
const program=`import { createActionFormShell } from ${JSON.stringify(source)};
const api=createActionFormShell({emptyState:(title,description,action)=>'EMPTY:'+title+'|'+description+'|'+action,button:(label,action,variant)=>'BUTTON:'+label+'|'+action+'|'+variant,escape:value=>'E:'+value});
console.log(JSON.stringify([api.closed(2,true),api.closed(0,false),api.incidentBanner({editing:true,nceId:'NCE-1',details:['Glucose','01/08/2026']}),api.incidentBanner({editing:false,details:[]})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [issues,empty,banner,none]=JSON.parse(output.stdout);
assert.match(issues,/EMPTY:Chọn một sự cố để lập hồ sơ/);
assert.match(issues,/BUTTON:Lập hồ sơ từ nguồn khác\|beginActionManual\(\)\|ghost/);
assert.match(empty,/EMPTY:Không có vi phạm nào cần lập hồ sơ/);
assert.equal(banner,'<div class="action-incident-banner"><b>E:Đang tiếp tục hồ sơ NCE-1</b><div>E:Glucose · E:01/08/2026</div></div>');
assert.equal(none,'');
