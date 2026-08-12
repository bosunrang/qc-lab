'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'firebase-rules-panel-html.ts')).href;
const program = `import { createFirebaseRulesPanelHtml } from ${JSON.stringify(source)}; console.log(createFirebaseRulesPanelHtml({escape:value => '[' + value + ']',button:(label, action) => '<button>' + label + ':' + action + '</button>'})('<guide>', '{"rules":{}}'));`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript Firebase Rules panel HTML');
assert.match(result.stdout, /<guide>/);
assert.match(result.stdout, /\[\{"rules":\{\}\}\]/);
assert.match(result.stdout, /copyFirebaseRules\(\)/);
console.log('Firebase Rules panel HTML TypeScript tests passed');
