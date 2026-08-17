'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const settings=fs.readFileSync(path.join(root,'assets','modules','settings.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(settings,/globalThis\.settingsBrandPreviewHtml\(\{logo,markText:brandMarkText\(\),title:brandTitle\(\),subtitle:brandSub\(\)\}\)/,'Preview thương hiệu phải dùng bridge TypeScript');
assert.match(settings,/globalThis\.SettingsProfileCommand\.saveLab\(input\)/,'Hồ sơ đơn vị phải dùng command TypeScript');
assert.match(settings,/globalThis\.settingsFirebaseRulesPanelHtml\(globalThis\.settingsFirebaseGuideHtml\(\),globalThis\.settingsFirebaseRulesText\(\)\)/,'Panel quy tắc Firebase phải dùng bridge TypeScript');
assert.match(bridge,/settingsBrandPreviewHtml: ReturnType<typeof createBrandPreviewHtml>;/,'Preview thương hiệu phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/const labProfileService=createLabProfileService\(/,'Hồ sơ đơn vị phải là dependency nội bộ của command Settings');
assert.doesNotMatch(bridge,/root\.labProfileService\s*=/,'Hồ sơ đơn vị không được công bố facade khi không có caller classic');
assert.match(bridge,/settingsFirebaseRulesPanelHtml: ReturnType<typeof createFirebaseRulesPanelHtml>;/,'Panel quy tắc Firebase phải là hợp đồng bridge bắt buộc');

console.log('Settings presentation TypeScript bridge tests passed');
