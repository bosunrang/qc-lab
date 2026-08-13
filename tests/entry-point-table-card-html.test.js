const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-point-table-card-html.ts')).href;
const program=`import { createEntryPointTableCardHtml } from ${JSON.stringify(source)};
const render=createEntryPointTableCardHtml({escape:value=>'E:'+value});
console.log(JSON.stringify([render({level:1,lot:'L-01',previousLot:true,parallel:true,total:3,cumulativeHtml:'<cumulative>',rowsHtml:'<row>',rowControlHtml:'<control>'}),render({level:2,lot:'',previousLot:false,parallel:false,total:0,cumulativeHtml:'',rowsHtml:'',rowControlHtml:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [filled,empty]=JSON.parse(output.stdout);
assert.match(filled,/qc-parallel-card/);
assert.match(filled,/Mức 1 · Lô cũ E:L-01/);
assert.match(filled,/Song song/);
assert.match(filled,/<cumulative>/);
assert.match(filled,/<tbody><row><\/tbody>/);
assert.match(empty,/Chưa có điểm nào trong khoảng này/);
