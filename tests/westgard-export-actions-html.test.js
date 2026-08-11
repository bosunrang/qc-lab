'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-export-actions-html.ts')).href;
const program = `
  import { createWestgardExportActionsHtml } from ${JSON.stringify(source)};
  const render = createWestgardExportActionsHtml({ button: (label, action, variant, title) => '[' + label + '|' + action + '|' + variant + '|' + title + ']', downloadIcon: () => '<down/>', printIcon: () => '<print/>' });
  console.log(JSON.stringify([render('lj'), render('cusum')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy Westgard export actions HTML TypeScript');
const [lj, cusum] = JSON.parse(result.stdout);
assert.match(lj, /<down\/>Xuất Excel\|exportWestgardXLSX\(\)\|teal wg-excel-btn/);
assert.match(lj, /<print\/>In PDF\|printWestgard\(\)\|teal wg-print-btn/);
assert.equal(cusum, '');
console.log('Westgard export actions HTML TypeScript tests passed');
