const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-staff-cell-html.ts')).href;
const program=`import { createEntryStaffCellHtml } from ${JSON.stringify(source)};const render=createEntryStaffCellHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render([{code:'NV01',name:'Nguyễn A'},{code:'NV02',name:'Trần B'}]),render([])]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [staff,none]=JSON.parse(output.stdout);
assert.match(staff,/title="E:Nguyễn A"/);
assert.match(staff,/E:NV01/);
assert.match(staff,/qc-staff-sep/);
assert.match(staff,/E:NV02/);
assert.equal(none,'—');
