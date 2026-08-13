const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-sheet-empty-row-html.ts')).href;
const program=`import { entrySheetEmptyRowHtml } from ${JSON.stringify(source)};console.log(entrySheetEmptyRowHtml({columnCount:9}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/<td colspan="9" class="empty-cell">/);
assert.match(output.stdout,/Chưa có điểm nào trong khoảng này/);
