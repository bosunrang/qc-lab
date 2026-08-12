'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'history-table-html.ts')).href;
const program = `
  import { historyTableHtml } from ${JSON.stringify(source)};
  console.log(JSON.stringify([historyTableHtml('<tr><td>M1</td></tr>', '<p>empty</p>'), historyTableHtml('', '<p>empty</p>')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy history table HTML TypeScript');
const [table, empty] = JSON.parse(result.stdout);
assert.match(table, /<table class="history-table">/);
assert.match(table, /<th>Hiệu lực<\/th>/);
assert.match(table, /<tr><td>M1<\/td><\/tr>/);
assert.equal(empty, '<div class="rcfg-list"><p>empty</p></div>');
console.log('History table HTML TypeScript tests passed');
