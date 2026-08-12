const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','settings','settings-page-layout-html.ts')).href;
const program=`import { createSettingsPageLayoutHtml } from ${JSON.stringify(source)};const render=createSettingsPageLayoutHtml((title,subtitle)=>'<head>'+title+':'+subtitle+'</head>');console.log(render({profileHtml:'<profile>',adminHtml:'<admin>',firebaseHtml:'<firebase>',lisHtml:'<lis>',rulesHtml:'<rules>'}));`;
const result=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const html=result.stdout;
assert.match(html,/<head>Cài đặt & Đồng bộ:Thông tin đơn vị, backup và kết nối Firebase<\/head>/);
assert.match(html,/<div class="settings-profile-grid"><profile><\/div><admin>/);
assert.match(html,/<div class="settings-cloud-grid"><firebase><lis><\/div><rules>/);
