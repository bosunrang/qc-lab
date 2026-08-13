const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-sheet-month-options-html.ts')).href;
const program=`import { createEntrySheetMonthOptionsHtml } from ${JSON.stringify(source)};console.log(JSON.stringify(createEntrySheetMonthOptionsHtml()({month:8,year:2026,yearMin:2025,yearMax:2027})));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const options=JSON.parse(output.stdout);
assert.match(options.months,/value="8" selected>Tháng 8/);
assert.match(options.months,/value="12"/);
assert.match(options.years,/value="2026" selected>2026/);
assert.match(options.years,/value="2027"/);
