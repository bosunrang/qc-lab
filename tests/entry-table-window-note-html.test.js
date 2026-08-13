const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-table-window-note-html.ts')).href;
const program=`import { createEntryTableWindowNoteHtml } from ${JSON.stringify(source)};
const render=createEntryTableWindowNoteHtml({button:(label,action,variant)=>'<button>'+label+'|'+action+'|'+variant+'</button>'});
console.log(JSON.stringify([render({visible:180,total:200,limited:true,expanded:false,initialRows:180,toggleAction:'expand()'}),render({visible:200,total:200,limited:false,expanded:true,initialRows:180,toggleAction:'collapse()'}),render({visible:2,total:2,limited:false,expanded:false,initialRows:180,toggleAction:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [limited,expanded,none]=JSON.parse(output.stdout);
assert.match(limited,/180\/200 điểm gần nhất/);
assert.match(limited,/Hiện toàn bộ\|expand\(\)\|ghost sm/);
assert.match(expanded,/toàn bộ 200 điểm/);
assert.match(expanded,/Thu gọn\|collapse\(\)\|ghost sm/);
assert.equal(none,'');
