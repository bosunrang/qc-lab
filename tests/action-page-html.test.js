const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','nce','action-page-html.ts')).href;
const program=`import { createActionPageHtml } from ${JSON.stringify(source)};console.log(createActionPageHtml()({headHtml:'<head>',issuesHtml:'<issues>',formHtml:'<form>',logHtml:'<log>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.equal(output.stdout,'<head><issues><form><log>\n');
