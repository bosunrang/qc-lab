'use strict';
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path'),{pathToFileURL}=require('node:url');
const u=pathToFileURL(path.join(__dirname,'..','src','presentation','reagent','reagent-tool-icon.ts')).href,r=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',`import { reagentToolIcon } from ${JSON.stringify(u)};console.log(JSON.stringify([reagentToolIcon('search'),reagentToolIcon('x')]))`],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(r.status,0,r.stderr);const[a,b]=JSON.parse(r.stdout);assert.match(a,/<circle/);assert.doesNotMatch(b,/<circle/);console.log('Reagent tool-icon TypeScript tests passed');
