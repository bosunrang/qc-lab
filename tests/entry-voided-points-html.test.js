const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-voided-points-html.ts')).href;
const program=`import { createEntryVoidedPointsHtml } from ${JSON.stringify(source)};
const render=createEntryVoidedPointsHtml();console.log(JSON.stringify([render({rowsHtml:'<row>'}),render({rowsHtml:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [filled,empty]=JSON.parse(output.stdout);
assert.match(filled,/Điểm đã hủy trong khoảng/);
assert.match(filled,/<tbody><row><\/tbody>/);
assert.equal(empty,'');
