const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-sheet-navigation-buttons-html.ts')).href;
const program=`import { createEntrySheetNavigationButtonsHtml } from ${JSON.stringify(source)};const render=createEntrySheetNavigationButtonsHtml({button:(label,action,variant)=>'<button>'+label+'|'+action+'|'+variant+'</button>'});console.log(render());`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/Tháng hiện tại\|entrySetSheetMonth\(isoMonth\(\)\)\|ghost sm qc-current-month/);
assert.match(output.stdout,/Tới hôm nay\|entryGoToday\(\)\|teal sm qc-today-jump/);
