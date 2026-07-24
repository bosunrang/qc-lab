const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const router=read('assets/modules/router-render.js');
const dashboard=read('assets/modules/dashboard-routes.js');
const entry=read('assets/modules/entry-routes.js');
const westgard=read('assets/modules/westgard-routes.js');
const modals=read('assets/modules/modals.js');
const actions=read('assets/modules/actions-routes.js');
const index=read('index.html');

assert.doesNotMatch(router,/function page(?:Dash|Entry|Westgard)\(/,'router-render chỉ giữ điều phối và UI primitives');
assert.match(dashboard,/function pageDash\(/);
assert.match(entry,/function pageEntry\(/);
assert.match(westgard,/function pageWestgard\(/);

const loadOrder=['router-render.js','dashboard-routes.js','entry-routes.js','westgard-routes.js'];
for(let i=1;i<loadOrder.length;i++)assert.ok(index.indexOf(loadOrder[i-1])<index.indexOf(loadOrder[i]),`${loadOrder[i]} phải tải sau ${loadOrder[i-1]}`);

assert.match(modals,/function modalTemplate\(/);
assert.match(modals,/function modalCloseButton\(/);
assert.doesNotMatch(modals,/function (?:syncActLevels|currentIssues|fillAction|addAction|delAction)\(/,'modals.js không chứa logic trang Actions');
for(const name of ['syncActLevels','currentIssues','fillAction','addAction','delAction'])assert.match(actions,new RegExp(`function ${name}\\(`));

console.log('UI route structure tests passed');
