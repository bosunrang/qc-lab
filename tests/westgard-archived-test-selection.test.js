'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-archived-test-selection.ts')).href;
const program = `
  import { westgardArchivedTestSelection } from ${JSON.stringify(source)};
  const entries = [
    { t: { id: 'glu', name: 'Glucose', instrumentId: 'AU', machine: 'AU480' } },
    { t: { id: 'ure', name: 'Ure', instrumentId: 'DX', machine: 'DXC' } },
  ];
  const deps = { searchText: value => String(value || '').toLowerCase(), testDisplayName: test => test.name, instrumentName: (_, machine) => machine };
  const byName = westgardArchivedTestSelection(entries, 'glu', 'ure', deps);
  const noMatch = westgardArchivedTestSelection(entries, 'khong co', '', deps);
  const retained = westgardArchivedTestSelection(entries, '', 'ure', deps);
  console.log(JSON.stringify({ byName: { ids: byName.list.map(item => item.t.id), selected: byName.selected, entry: byName.entry.t.id }, noMatch: { ids: noMatch.list.map(item => item.t.id), selected: noMatch.selected }, retained: retained.selected }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript chon xet nghiem Westgard da luu tru');
assert.deepEqual(JSON.parse(result.stdout), { byName: { ids: ['glu'], selected: 'glu', entry: 'glu' }, noMatch: { ids: ['glu', 'ure'], selected: 'glu' }, retained: 'ure' });

console.log('Westgard archived test-selection TypeScript tests passed');
