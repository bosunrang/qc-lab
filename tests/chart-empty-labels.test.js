'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','chart','chart-empty-labels.ts')).href;
const program=`import { CHART_EMPTY_LABELS } from ${JSON.stringify(source)};if(CHART_EMPTY_LABELS.leveyJennings!=='Chưa có điểm QC'||CHART_EMPTY_LABELS.leveyJenningsMulti!=='Chưa có điểm QC để vẽ tích hợp'||CHART_EMPTY_LABELS.cusum!=='Chưa có điểm QC'||!Object.isFrozen(CHART_EMPTY_LABELS))throw new Error('must preserve chart empty labels');console.log('Chart empty labels TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy chart empty labels TypeScript');console.log(result.stdout.trim());
