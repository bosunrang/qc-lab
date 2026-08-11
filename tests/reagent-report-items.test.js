'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-report-items.ts')).href;
const program = `
  import { reagentReportItemPresentation as p } from ${JSON.stringify(source)};
  const input = [{ id: 'a' }, { id: 'b' }], calls = [];
  const items = p.items(input, item => { calls.push(item.id); return item.id.toUpperCase(); });
  console.log(JSON.stringify({ items, calls, empty: p.items(null, () => 'x') }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript muc bao cao hoa chat');
assert.deepEqual(JSON.parse(result.stdout), { items: [{ ds: { id: 'a' }, R: 'A' }, { ds: { id: 'b' }, R: 'B' }], calls: ['a', 'b'], empty: [] });

console.log('Reagent report-items TypeScript tests passed');
