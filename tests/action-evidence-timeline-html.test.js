'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-evidence-timeline-html.ts')).href;
const program = `
  import { createActionEvidenceTimelineHtml } from ${JSON.stringify(source)};
  console.log(createActionEvidenceTimelineHtml({ escape: value => String(value).replaceAll('<', '&lt;') })([{ label: '<Mốc>', value: '<Giá trị>', note: '<Ghi chú>' }, { label: 'Kết thúc', value: 'Hôm nay' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action evidence timeline HTML TypeScript');
assert.match(result.stdout, /aria-label="Các mốc thời gian hồ sơ"/);
assert.match(result.stdout, /&lt;Mốc>/);
assert.match(result.stdout, /<small>&lt;Ghi chú><\/small>/);
assert.doesNotMatch(result.stdout, /<small>Hôm nay/);
console.log('Action evidence timeline HTML TypeScript tests passed');
