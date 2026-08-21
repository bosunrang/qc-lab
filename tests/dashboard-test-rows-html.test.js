'use strict';
const assert=require('node:assert/strict');
const{spawnSync}=require('node:child_process');
const path=require('node:path');
const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','dashboard','dashboard-test-rows-html.ts')).href;
const program=`
  import { createDashboardTestRowsHtml } from ${JSON.stringify(source)};
  const rows=createDashboardTestRowsHtml({
    statusTag:s=>'status:'+s,todayTag:(count,total)=>'today:'+count+'/'+total,levelsHtml:levels=>'levels:'+levels.map(x=>x.l.level).join(','),latestText:(point,test)=>'latest:'+point.id+'/'+test.id,rank:s=>({rej:0,ok:3})[s],rowHtml:input=>JSON.stringify(input),actionHtml:(testId,level)=>'action:'+testId+'/'+level,testDisplayName:test=>'display:'+test.id
  });
  console.log(JSON.stringify(rows([
    {t:{id:'b',name:'Beta',machine:'M2'},s:'ok',levelData:[{l:{level:'L2'}}],todayCount:1,totalPoints:4,latest:{id:'p2'},search:'beta'},
    {t:{id:'a',name:'Alpha',machine:'M1'},s:'rej',levelData:[{l:{level:'L1'}},{l:{level:'L3'}}],todayCount:1,totalPoints:8,latest:{id:'p1'},search:'alpha'}
  ])));
`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy dashboard test rows TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output,'{"status":"rej","search":"alpha","name":"display:a","machine":"M1","levelsHtml":"levels:L1,L3","todayTag":"today:1/2","totalPoints":8,"statusTag":"status:rej","latestText":"latest:p1/a","actionHtml":"action:a/L1"}{"status":"ok","search":"beta","name":"display:b","machine":"M2","levelsHtml":"levels:L2","todayTag":"today:1/1","totalPoints":4,"statusTag":"status:ok","latestText":"latest:p2/b","actionHtml":"action:b/L2"}');
console.log('Dashboard test rows HTML TypeScript tests passed');
