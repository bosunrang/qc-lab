'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-rows-control.ts')).href;
const program = `
  import { createWestgardRowsControl } from ${JSON.stringify(source)};
  const render = createWestgardRowsControl({ button: (label, action, variant) => '[' + label + '|' + (typeof action === 'string' ? action : JSON.stringify(action)) + '|' + variant + ']', quote: value => String(value).replaceAll("'", "\\\\'") });
  console.log(JSON.stringify([
    render({ total: 120, rows: Array(120), visibleCount: 120 }, 'a', 120),
    render({ total: 300, rows: Array(120), visibleCount: 120 }, "a'b", 120),
    render({ total: 300, rows: Array(240), visibleCount: 240 }, 'a', 120),
    render({ total: 300, rows: Array(300), visibleCount: 300 }, 'a', 120),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy Westgard rows control TypeScript');
const [limited, first, middle, full] = JSON.parse(result.stdout);
assert.equal(limited, '');
assert.match(first, /Đang hiển thị 120\/300 điểm mới nhất/);
assert.match(first, /Tải thêm 120 điểm\|\{"action":"wgLoadMoreRows","args":\["a'b",240\]\}\|ghost sm/);
assert.match(middle, /Đang hiển thị 240\/300 điểm mới nhất/);
assert.match(middle, /Tải thêm 60 điểm\|\{"action":"wgLoadMoreRows","args":\["a",300\]\}\|ghost sm/);
assert.match(full, /Đang hiển thị 300\/300 điểm/);
assert.doesNotMatch(full, /mới nhất/);
assert.match(full, /Thu gọn còn 120 điểm\|\{"action":"wgLoadMoreRows","args":\["a",120\]\}\|ghost sm/);
console.log('Westgard rows control TypeScript tests passed');
