const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-empty-page-html.ts')).href;
const program=`import { createEntryEmptyPageHtml } from ${JSON.stringify(source)};const render=createEntryEmptyPageHtml({head:(title,subtitle)=>'HEAD:'+title+'|'+subtitle});console.log(JSON.stringify([render({title:'Chưa có xét nghiệm',description:'Cần khai báo',actionHtml:'<button>Thêm</button>'}),render({title:'Chưa sẵn sàng',description:'Cần cấu hình',actionHtml:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [withAction,withoutAction]=JSON.parse(output.stdout);
assert.match(withAction,/HEAD:Nhập QC\|/);
assert.match(withAction,/class="empty"/);
assert.match(withAction,/class="empty-title">Chưa có xét nghiệm/);
assert.match(withAction,/<button>Thêm<\/button>/);
assert.match(withoutAction,/<div>Cần cấu hình<\/div>/);
