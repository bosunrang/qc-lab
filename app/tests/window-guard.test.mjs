// Chặn điều hướng cho mọi cửa sổ của app (`main/window-guard.ts`): chỉ hiện
// trang của app, `https:` ra ngoài mở bằng trình duyệt hệ thống, còn lại chặn.
// Main áp chặn cho mọi cửa sổ và khai sandbox: kiểm trên app thật ở
// `e2e/window-shell.e2e.mjs` và `e2e/external-link.e2e.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { classifyNavigation } = require('../../app-dist/main/window-guard.js');

const PACKAGED = 'file:///C:/Program%20Files/QC%20Lab/resources/app.asar/app-dist/renderer/index.html';
const DEV = 'http://localhost:5174/';

test('bản đóng gói: chỉ trang HTML cùng thư mục với trang chính là của app', () => {
  assert.equal(classifyNavigation(PACKAGED + '#/entry', PACKAGED), 'app', 'đổi route bằng hash');
  assert.equal(classifyNavigation('file:///C:/Program%20Files/QC%20Lab/resources/app.asar/app-dist/renderer/firebase-guide.html', PACKAGED), 'app');
  assert.equal(classifyNavigation('file:///c:/program%20files/qc%20lab/resources/app.asar/app-dist/renderer/index.html', PACKAGED), 'app', 'Windows không phân biệt hoa thường');
  for (const url of [
    'file:///C:/Windows/System32/drivers/etc/hosts',
    'file:///C:/Users/x/Desktop/trap.html',
    'file:///C:/Program%20Files/QC%20Lab/resources/app.asar/app-dist/renderer/../main/evil.html',
    'file:///C:/Program%20Files/QC%20Lab/resources/app.asar/app-dist/renderer/assets/app.js',
    'file://evil-host/share/index.html',
  ]) assert.equal(classifyNavigation(url, PACKAGED), 'deny', url);
});

test('dev server: cùng origin là của app', () => {
  assert.equal(classifyNavigation('http://localhost:5174/#/sigma', DEV), 'app');
  assert.equal(classifyNavigation('http://localhost:5174/firebase-guide.html', DEV), 'app');
  assert.equal(classifyNavigation('http://localhost:5175/', DEV), 'deny', 'khác cổng');
});

test('https ra ngoài mở bằng trình duyệt hệ thống, giao thức khác bị chặn', () => {
  assert.equal(classifyNavigation('https://biologicalvariation.eu/', PACKAGED), 'external');
  assert.equal(classifyNavigation('https://www.ecfr.gov/current/title-42', DEV), 'external');
  for (const url of ['http://example.com/', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'ms-settings:', 'smb://server/share', 'không phải url']) {
    assert.equal(classifyNavigation(url, PACKAGED), 'deny', url);
  }
});
