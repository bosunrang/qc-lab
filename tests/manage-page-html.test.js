const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','manage','manage-page-html.ts')).href;
const program=`import { createManagePageHtml } from ${JSON.stringify(source)};console.log(createManagePageHtml()('<head>','<shell>'));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.equal(output.stdout,'<head><shell>\n');
