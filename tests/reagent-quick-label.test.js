'use strict';
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path'),{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','reagent','reagent-quick-label.ts')).href;
const r=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',`import { reagentQuickLabel } from ${JSON.stringify(source)}; console.log(JSON.stringify([reagentQuickLabel('sampleType'),reagentQuickLabel('operator')]));`],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),['loại mẫu','người thực hiện']);console.log('Reagent quick-label TypeScript tests passed');
