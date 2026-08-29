'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const actions=fs.readFileSync(path.join(root,'src','presentation','actions','actions-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

// users-auth.js đã retire vào src/compat/modular-pilot.global.ts (2026-08-20, Pha G nhóm C
// lát 2) — dòng dưới giờ tự tiêu thụ (root.X(...)) trong CHÍNH bridge, không còn UI route
// classic riêng nào gọi globalThis.X nữa.
for(const [name,type,source,consumedAs] of [
  ['actionGuideContent','ReturnType<typeof createActionGuideContent>',actions,'deps\\.pres\\.actionGuideContent'],
]){
  const escaped=type.replace(/[<>()[\]{}?+*.$^|\\]/g,'\\$&');
  assert.match(bridge,new RegExp(`${name}: ${escaped};`),`${name} must be a required administrative UI bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(source,new RegExp(consumedAs||`globalThis\\.${name}`),`${name} must be consumed by its UI route`);
}

console.log('Administrative renderer TypeScript bridge tests passed');
