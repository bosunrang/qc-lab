const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','auth','users-page-html.ts')).href;
const program=`import { createUsersPageHtml } from ${JSON.stringify(source)};console.log(createUsersPageHtml()({head:'<header>',rows:'<tr><td>Lan</td></tr>',roleOptions:'<option>KTV</option>',permissionChecks:'<input type="checkbox">',addButton:'<button>Thêm</button>'}));`;
const result=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const html=result.stdout;
assert.match(html,/^<header>/);
assert.match(html,/id="uUser"/);
assert.match(html,/<option>KTV<\/option>/);
assert.match(html,/<input type="checkbox">/);
assert.match(html,/<button>Thêm<\/button>/);
assert.match(html,/<tbody><tr><td>Lan<\/td><\/tr><\/tbody>/);
