'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-toolbar-html.ts');
const program = `import { reagentToolbarHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentToolbarHtml({selectOptionsHtml:'<option value="r1">Glucose</option>',primaryActionsHtml:'<button>Thêm</button>',secondaryActionsHtml:'<button>In</button>'}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /id="rcSel"/, 'Selector phải giữ ID');
assert.match(html, /data-action="rcSwitch" data-action-on="change"/, 'Selector phải giữ handler');
assert.match(html, /<option value="r1">Glucose<\/option>/, 'Các lựa chọn phải được ghép vào toolbar');
assert.match(html, /rc-toolbar-primary/, 'Hành động ghi dữ liệu phải có vùng riêng');
assert.match(html, /<button>Thêm<\/button>/);
assert.match(html, /rc-toolbar-secondary/, 'Hành động phụ phải có vùng riêng');
assert.match(html, /<button>In<\/button>/);

const readOnlyProgram = `import { reagentToolbarHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentToolbarHtml({selectOptionsHtml:'',primaryActionsHtml:'',secondaryActionsHtml:''}));`;
const readOnlyHtml = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', readOnlyProgram], { encoding: 'utf8' });
assert.doesNotMatch(readOnlyHtml, /rc-toolbar-primary/, 'Không có hành động ghi thì không dựng vùng primary');

console.log('Reagent toolbar HTML tests passed');
