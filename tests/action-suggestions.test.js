const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','nce','action-suggestions.ts')).href;
const program=`import { createActionSuggestions } from ${JSON.stringify(source)};
const api=createActionSuggestions({escape:value=>'E:'+value,quote:value=>'Q:'+value});
api.configure({instrument:['Kim hút bẩn'],unknown:['Chưa rõ']},{SE:['Hiệu chuẩn'],RE:['Vệ sinh'],'':['Kiểm tra']});
console.log(JSON.stringify([api.causePhrases('missing'),api.actionPhrases('SE — sai số'),api.actionPhrases(''),api.row('aCause',['A<B'])]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.deepEqual(JSON.parse(output.stdout),[['Kim hút bẩn','Chưa rõ'],['Hiệu chuẩn'],['Kiểm tra'],`<div class="sugg-row" id="sugg-E:aCause"><button type="button" class="sugg-chip" onclick="actionInsertSuggestion('Q:aCause','Q:A<B')">E:A<B</button></div>`]);
