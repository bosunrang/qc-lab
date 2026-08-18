'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/presentation/settings/settings-page-controller.ts'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/compat/modular-pilot.global.ts'), 'utf8');

assert.match(route, /plan = deps\.firebaseSettingsService\.prepare\(input\)/, 'Lưu Firebase phải dùng command TypeScript');
assert.match(route, /if \(!plan\.ok\)/, 'Route phải xử lý lỗi xác thực do command trả về');
assert.match(route, /const code = plan\.labCode, email = plan\.email, password = plan\.password, cfg = plan\.config;/, 'Route phải dùng dữ liệu đã chuẩn hóa từ command');
assert.match(route, /deps\.html\.firebaseRulesText\(\)/, 'Firebase Rules phải dùng presentation TypeScript');
assert.match(route, /deps\.html\.firebaseGuideHtml\(\)/, 'Hướng dẫn Firebase phải dùng presentation TypeScript');
assert.doesNotMatch(route, /firebaseSettingsService\?globalThis\.firebaseSettingsService\.prepare/, 'Không giữ fallback classic cho command Firebase');
assert.match(bridge, /firebaseSettingsService: ReturnType<typeof createFirebaseSettingsService>;/, 'Command Firebase phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /settingsFirebaseRulesText: typeof firebaseRulesTextTs;/, 'Firebase Rules phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /settingsFirebaseGuideHtml: typeof firebaseGuideHtmlTs;/, 'Hướng dẫn Firebase phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /settingsPageLayoutHtml: ReturnType<typeof createSettingsPageLayoutHtml>;/, 'Layout Settings phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /settingsUnitProfileHtml: ReturnType<typeof createUnitProfileHtml>;/, 'Panel đơn vị phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /settingsFirebaseConnectionPanelHtml: ReturnType<typeof createFirebaseConnectionPanelHtml>;/, 'Panel Firebase phải là hợp đồng bridge bắt buộc');
assert.match(route, /return deps\.html\.pageLayoutHtml\(\{\s*profileHtml: deps\.html\.unitProfileHtml/, 'Route Settings phải gọi trực tiếp layout TypeScript');
assert.doesNotMatch(route, /if\s*\(globalThis\.settingsPageLayoutHtml/, 'Route Settings không được kiểm tra fallback cho layout TypeScript');
assert.doesNotMatch(route, /globalThis\.settingsUnitProfileHtml/, 'Settings must not retain the classic unit-profile HTML fallback');
assert.doesNotMatch(route, /globalThis\.settingsFirebaseConnectionPanelHtml/, 'Settings must not retain the classic Firebase-panel HTML fallback');

console.log('Settings Firebase command bridge tests passed');
