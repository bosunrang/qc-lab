'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-panel-options-html.ts')).href;
const program = `
  import { targetPanelOptionsHtml } from ${JSON.stringify(source)};
  console.log(targetPanelOptionsHtml([{ id: 'P1', name: 'Hóa & sinh', instrumentId: 'I1' }, { id: 'P2', name: 'Miễn dịch' }], 'P2', id => id === 'I1' ? 'AU <680>' : 'Chưa gán máy', value => String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char])));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target panel options HTML TypeScript');
assert.equal(result.stdout.trim(), '<option value="P1" >Hóa &amp; sinh · AU &lt;680&gt;</option><option value="P2" selected>Miễn dịch · Chưa gán máy</option>');
console.log('Target panel options HTML TypeScript tests passed');
