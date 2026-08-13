const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-level-header-html.ts')).href;
const program=`import { createEntryLevelHeaderHtml } from ${JSON.stringify(source)};
const render=createEntryLevelHeaderHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({level:1,lot:'L-01',parallel:true,tooltip:'Mean 5'}),render({level:2,lot:'',parallel:false,tooltip:'SD 0.2'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [parallel,standard]=JSON.parse(output.stdout);
assert.match(parallel,/data-qc-tooltip="E:Mean 5"/);
assert.match(parallel,/Mức 1 · Lô E:L-01/);
assert.match(parallel,/Song song/);
assert.match(standard,/Mức 2 · Lô E:\?/);
