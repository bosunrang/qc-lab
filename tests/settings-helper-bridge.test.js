'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','settings.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
for(const name of ['settingsStorageBytesText','settingsStorageUsageText','settingsBrandProfile','settingsFirebaseAclHelp']){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Settings bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
}
assert.match(route,/globalThis\.settingsStorageUsageText/,'Settings UI must consume the composed storage-usage helper');
assert.match(route,/globalThis\.settingsBrandProfile/,'Settings UI must consume the brand-profile helper');
assert.match(route,/globalThis\.settingsFirebaseAclHelp/,'Settings UI must consume the Firebase ACL helper');

console.log('Settings helper TypeScript bridge tests passed');
