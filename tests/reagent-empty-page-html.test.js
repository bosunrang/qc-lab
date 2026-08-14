'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-empty-page-html.ts');
const program = `import { reagentEmptyPageHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentEmptyPageHtml({headHtml:'<header>So sánh</header>',emptyStateHtml:'<div class="empty">Trống</div>'}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /^<header>So sánh<\/header>/, 'Đầu trang phải đứng trước panel');
assert.match(html, /<div class="panel"><div class="empty">Trống<\/div><\/div>/, 'Empty state phải nằm trong panel');

console.log('Reagent empty page HTML tests passed');
