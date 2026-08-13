const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-empty-html.ts')).href;
const program=`import { entryTreeEmptyHtml } from ${JSON.stringify(source)};console.log(entryTreeEmptyHtml());`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/class="tree-empty"/);
assert.match(output.stdout,/role="presentation"/);
assert.match(output.stdout,/Không có xét nghiệm phù hợp/);
