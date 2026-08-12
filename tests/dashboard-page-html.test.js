const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','dashboard','dashboard-page-html.ts')).href;
const program=`import { createDashboardPageHtml } from ${JSON.stringify(source)};console.log(createDashboardPageHtml()({headHtml:'<head>',todayText:'12/08/2026',mood:'Đạt',moodText:'Ổn định',progressHtml:'<progress>',kpisHtml:'<kpis>',followHtml:'<follow>',expiringLotsHtml:'<lots>',testsPanelHtml:'<tests>'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const html=output.stdout;
assert.match(html,/^<head>/);
assert.match(html,/Trạng thái trực ca · 12\/08\/2026/);
assert.match(html,/<progress>\s*<\/div>\s*<kpis>/);
assert.match(html,/Cần xử lý \/ Theo dõi/);
assert.match(html,/<follow>/);
assert.match(html,/Lô & hạn dùng/);
assert.match(html,/<lots>\s*<\/div>/);
assert.match(html,/<tests>/);
