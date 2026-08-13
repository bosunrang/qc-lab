const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-tree-panel-icon-html.ts')).href;
const program=`import { entryTreePanelIconHtml } from ${JSON.stringify(source)};console.log(entryTreePanelIconHtml());`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/<svg viewBox="0 0 24 24"/);
assert.match(output.stdout,/aria-hidden="true"/);
assert.match(output.stdout,/<rect x="3" y="4" width="18" height="16"/);
