// Resolve the npm bundled next to the current node (same logic as
// benchmarks/verify-release.js) and forward CLI args to it.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const bundled = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
if (!fs.existsSync(bundled)) { console.error('bundled npm not found at ' + bundled); process.exit(1); }
const r = spawnSync(process.execPath, [bundled, ...process.argv.slice(2)], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status || 0);
