'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('assets/modules/manage-routes.js');
const bridge = read('src/compat/modular-pilot.global.ts');
for (const name of ['targetMatrixRowPresentation', 'targetMatrixTablePresentation', 'targetMatrixActionsPresentation']) {
  assert.match(route, new RegExp(`globalThis\\.${name}`));
  assert.match(bridge, new RegExp(`root\\.${name}=`));
}
console.log('Target matrix bridge tests passed');
