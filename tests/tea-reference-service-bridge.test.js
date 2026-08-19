'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bridge = fs.readFileSync(path.join(__dirname, '..', 'src', 'compat', 'modular-pilot.global.ts'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-page-controller.ts'), 'utf8');

assert.match(bridge, /declare const REFTESTS: readonly any\[\]\[\];/,
  'bridge TEa phải khai báo REFTESTS là global lexical do state.js tạo');
assert.match(bridge, /defaultReferences: \(\) => REFTESTS,/,
  'bridge TEa phải đọc REFTESTS trực tiếp để tab Bảng TEa render được');
assert.doesNotMatch(bridge, /defaultReferences: \(\) => \(globalThis as any\)\.REFTESTS/,
  'REFTESTS không phải property globalThis; cách đọc này làm tab Bảng TEa vỡ khi mở');
assert.match(route, /deps\.pres\.teaReferenceSortPresentation\(rows\);/,
  'bảng TEa phải truyền cả danh sách vào sorter TypeScript');
assert.doesNotMatch(route, /\.sort\(deps\.pres\.teaReferenceSortPresentation\)/,
  'sorter TypeScript không phải comparator; truyền sai làm tab Bảng TEa vỡ khi mở');

console.log('Tea reference service bridge tests passed');
