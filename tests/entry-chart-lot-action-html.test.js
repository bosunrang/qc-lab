const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-chart-lot-action-html.ts')).href;
const program=`import { createEntryChartLotActionHtml } from ${JSON.stringify(source)};const render=createEntryChartLotActionHtml({button:(label,action,variant)=>'<button>'+label+'|'+action+'|'+variant+'</button>',rangeSource:input=>'<range>'+input.applied+'</range>'});const base={level:2,previousLot:'L-01',applied:'lab'};console.log(JSON.stringify([render({...base,parallel:true,hasPreviousLots:true,showingPreviousLot:false}),render({...base,parallel:false,hasPreviousLots:true,showingPreviousLot:false}),render({...base,parallel:false,hasPreviousLots:true,showingPreviousLot:true}),render({...base,parallel:false,hasPreviousLots:false,showingPreviousLot:false}),render({...base,parallel:false,hasPreviousLots:false,showingPreviousLot:false,applied:'manufacturer'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [parallel,oldLot,newLot,lab,manufacturer]=JSON.parse(output.stdout);
assert.match(parallel,/Đang đánh giá/);
assert.match(oldLot,/Xem lô cũ\|event\.stopPropagation\(\);entryShowPrevLot\(2,'L-01'\)\|ghost sm/);
assert.match(newLot,/Xem lô mới\|event\.stopPropagation\(\);entryShowCurrentLot\(2\)\|teal sm/);
assert.equal(lab,'<range>lab</range>');
assert.equal(manufacturer,'<range>manufacturer</range>');
