'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-matrix-actions-html.ts')).href;
const program = `
  import { targetMatrixActionsHtml } from ${JSON.stringify(source)};
  console.log(targetMatrixActionsHtml('<button>Clear</button>', '<button>Select</button>', '<button>Save</button>'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target matrix actions HTML TypeScript');
assert.equal(result.stdout.trim(), '<div class="modal-f target-actions"><button>Clear</button><button>Select</button><button>Save</button></div>');
console.log('Target matrix actions HTML TypeScript tests passed');
