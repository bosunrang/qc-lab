const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-empty-run-html.ts')).href;
const program=`import { createEntryEmptyRunHtml } from ${JSON.stringify(source)};const render=createEntryEmptyRunHtml({escape:value=>'E:'+value});const base={dateLabel:'13/08',level:1,lot:'L-01',runNumber:2,focusDate:'2026-08-13',focusLevel:0,runId:'R2',testId:'T1',saveLot:''};console.log(JSON.stringify([render({...base,canWrite:true}),render({...base,canWrite:false})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [editable,readonly]=JSON.parse(output.stdout);
assert.match(editable,/qc-inline-input empty/);
assert.match(editable,/data-focus-date="E:2026-08-13"/);
assert.match(editable,/entryInlineSave\('E:T1',1,'E:2026-08-13',this.value,'E:R2','E:'\)/);
assert.match(readonly,/qc-run-slot muted/);
