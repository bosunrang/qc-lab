'use strict';
const assert=require('node:assert/strict');
const{spawnSync}=require('node:child_process');
const path=require('node:path');
const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','dashboard','dashboard-test-items.ts')).href;
const program=`
  import { createDashboardTestItems } from ${JSON.stringify(source)};
  const marked=[];
  const items=createDashboardTestItems({
    activeWestgard:test=>({views:['view:'+test.id],byPoint:'verdict:'+test.id}),
    summarize:input=>({status:'warn',todayCount:1,totalPoints:3,lastPoints:[{id:'old'},{id:'new'}],alerts:['alert'],input}),
    levelData:(views,today)=>[{l:{level:'L1'},views,today}],latestPoint:points=>points.at(-1),searchText:(test,levels)=>test.name+'/'+levels[0].l.level,markStatus:(id,status)=>marked.push(id+'/'+status)
  });
  const result=items([{id:'t1',name:'Glucose'}],'2026-08-13');
  console.log(JSON.stringify({result,marked}));
`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy dashboard test items TypeScript');
assert.deepEqual(JSON.parse(result.stdout),{result:[{t:{id:'t1',name:'Glucose'},s:'warn',levelData:[{l:{level:'L1'},views:['view:t1'],today:'2026-08-13'}],todayCount:1,totalPoints:3,latest:{id:'new'},search:'Glucose/L1',alerts:['alert'],missingToday:false}],marked:['t1/warn']});
console.log('Dashboard test items TypeScript tests passed');
