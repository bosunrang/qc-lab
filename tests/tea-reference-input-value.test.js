'use strict';
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path'),{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','manage','tea-reference-input-value.ts')).href;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',`import { teaReferenceInputValue } from ${JSON.stringify(source)}; console.log(JSON.stringify([teaReferenceInputValue(null),teaReferenceInputValue(5.2)]));`],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),['','5.2']);console.log('Tea reference input value TypeScript tests passed');
