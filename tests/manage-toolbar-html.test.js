'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-toolbar-html.ts')).href;
const program = `
  import { createManageToolbarHtml } from ${JSON.stringify(source)};
  const render = createManageToolbarHtml({ escape: value => String(value).replaceAll('<', '&lt;'), escapeAttr: value => String(value).replaceAll('"', '&quot;'), button: (label, action, variant) => '[' + label + '|' + action + '|' + variant + ']' });
  console.log(JSON.stringify([render({ title: 'Máy <XN>', subtitle: 'Theo dõi', placeholder: 'Tìm "máy"', query: 'AU', action: 'openConfigInstrument()', actionLabel: 'Thêm máy' }), render({ title: 'TEa' })]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage toolbar HTML TypeScript');
const [full, minimal] = JSON.parse(result.stdout);
assert.match(full, /Máy &lt;XN>/);
assert.match(full, /placeholder="Tìm &quot;máy&quot;"/);
assert.match(full, /＋ Thêm máy\|openConfigInstrument\(\)\|teal/);
assert.doesNotMatch(minimal, /manageSearch/);
console.log('Manage toolbar HTML TypeScript tests passed');
