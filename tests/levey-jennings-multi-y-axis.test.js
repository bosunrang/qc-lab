'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','chart','levey-jennings-multi-y-axis.ts')).href;
const program=`import { leveyJenningsMultiYAxis } from ${JSON.stringify(source)};const labels=leveyJenningsMultiYAxis();if(labels.length!==7||labels[0].left!=='< -3'||labels[0].right!=='-3s'||labels[6].left!=='> +3'||labels[6].right!=='+3s')throw new Error('must preserve multi-level Y-axis labels');console.log('Levey-Jennings multi Y-axis TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy Levey-Jennings multi Y-axis TypeScript');console.log(result.stdout.trim());
