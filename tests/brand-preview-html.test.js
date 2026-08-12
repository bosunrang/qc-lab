'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'settings', 'brand-preview-html.ts')).href;
const program = `
  import { createBrandPreviewHtml } from ${JSON.stringify(source)};
  const render = createBrandPreviewHtml(value => '[' + value + ']', value => 'ATTR:' + value);
  console.log(JSON.stringify([render({markText:'QC',title:'QC Lab',subtitle:'Nội kiểm'}),render({logo:'data:x',markText:'QC',title:'Lab',subtitle:'Sub'})]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy TypeScript brand preview HTML');
const [fallback, image] = JSON.parse(result.stdout);
assert.match(fallback, /\[QC\]/);
assert.match(fallback, /\[QC Lab\]/);
assert.match(image, /src="ATTR:data:x"/);
assert.match(image, /\[Lab\]/);
console.log('Brand preview HTML TypeScript tests passed');
