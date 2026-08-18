'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','settings','settings-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
for(const name of ['settingsStorageUsageText','settingsBrandProfile','settingsFirebaseAclHelp']){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Settings bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
}
// Controller tiêu thụ các helper qua deps.html.*/deps.brand.*; compat wiring nối
// deps đó về đúng root.settingsXxx (assert ở trên đã chốt root.X tồn tại).
assert.match(route,/deps\.html\.storageUsageText\(/,'Settings UI must consume the composed storage-usage helper');
assert.match(route,/deps\.brand\.profile\(/,'Settings UI must consume the brand-profile helper');
assert.match(route,/deps\.html\.firebaseAclHelp\(/,'Settings UI must consume the Firebase ACL helper');
assert.match(bridge,/storageUsageText:\(data,estimate\)=>root\.settingsStorageUsageText!\(data,estimate\)/,'compat phải nối storage-usage helper vào controller');
assert.match(bridge,/profile:lab=>root\.settingsBrandProfile!\(lab\)/,'compat phải nối brand-profile helper vào controller');
assert.match(bridge,/firebaseAclHelp:\(labCode,uid\)=>root\.settingsFirebaseAclHelp!\(labCode,uid\)/,'compat phải nối Firebase ACL helper vào controller');

console.log('Settings helper TypeScript bridge tests passed');
