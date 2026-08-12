'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'lis', 'lis-queue-presentation.ts')).href;
const program = `
  import { createLisQueuePresentation } from ${JSON.stringify(source)};
  const view = createLisQueuePresentation({
    test:id => id === 't1' ? {id} : null, formatTestValue:(_, value) => 'T:' + value, format:(value, decimals) => 'F:' + value + ':' + decimals,
    escape:value => '[' + value + ']', escapeAttribute:value => 'ATTR:' + value, quoteJs:value => 'Q' + value,
    formatDateTime:value => value === 'when' ? '12/08/2026' : '', testDisplayName:test => test ? 'Glucose' : '',
    button:(label, action, variant) => '<button data-v="' + variant + '" data-a="' + action + '">' + label + '</button>',
    emptyState:(title, message) => '<empty>' + title + ':' + message + '</empty>', modalCloseButton:action => '<close>' + action + '</close>'
  });
  const ready = {message:{messageId:'m1',measuredAt:'when',value:5,unit:'mmol/L',runId:'r1',operator:'NV'},resolved:{ok:true,qclabTestId:'t1',level:2,lot:'L1'}};
  const unresolved = {message:{messageId:'m2',value:4,analyzerId:'A1',testCode:'C1'},resolved:{ok:false,reason:'Không có mapping'}};
  console.log(JSON.stringify([view.valueText(ready), view.rowHtml(ready), view.rowHtml(unresolved), view.sectionHtml('Sẵn sàng', [], 'Trống'), view.modalHtml([], [])]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript LIS queue presentation');
const [value, ready, unresolved, empty, modal] = JSON.parse(result.stdout);
assert.equal(value, 'T:5 [mmol/L]');
assert.match(ready, /\[Glucose\]/);
assert.match(ready, /ATTR:lisQueueImport\('Qm1'\)/);
assert.match(unresolved, /\[A1\]\/\[C1\]/);
assert.match(unresolved, /F:4:3/);
assert.match(empty, /\[Trống\]/);
assert.match(modal, /<empty>Hàng chờ trống/);
assert.match(modal, /<close>closeModal\(\)<\/close>/);
console.log('LIS queue presentation TypeScript tests passed');
