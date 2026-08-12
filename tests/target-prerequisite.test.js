'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-prerequisite.ts')).href;
const program = `
  import { targetPrerequisite } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetPrerequisite({ tests: 0, panels: 1, lots: 1, groups: 1 }), targetPrerequisite({ tests: 1, panels: 0, lots: 1, groups: 1 }), targetPrerequisite({ tests: 1, panels: 1, lots: 0, groups: 1 }), targetPrerequisite({ tests: 1, panels: 1, lots: 1, groups: 0 }), targetPrerequisite({ tests: 1, panels: 1, lots: 1, groups: 1 })]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target prerequisite TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['tests', 'panels', 'lots', 'groups', null]);
console.log('Target prerequisite TypeScript tests passed');
