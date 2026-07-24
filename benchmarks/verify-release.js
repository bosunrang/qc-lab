const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..'),testsDir = path.join(root, 'tests');
const tests = fs.readdirSync(testsDir).filter(name => name.endsWith('.test.js')).sort();
const failures = [];

for (const name of tests) {
  const result = spawnSync(process.execPath, [path.join(testsDir, name)], { cwd:root,encoding:'utf8' });
  if (result.status !== 0) {
    failures.push(name);
    process.stderr.write(result.stdout||'');process.stderr.write(result.stderr||'');
  }
}

process.stdout.write(`Functional tests: ${tests.length-failures.length}/${tests.length} passed\n`);
if (failures.length) {
  process.stderr.write(`Failed tests: ${failures.join(', ')}\n`);process.exitCode=1;
} else {
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const bundledNpm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
  const audit=fs.existsSync(bundledNpm)
    ?spawnSync(process.execPath,[bundledNpm,'audit','--audit-level=high'],{cwd:root,encoding:'utf8'})
    :spawnSync(npm,['audit','--audit-level=high'],{cwd:root,encoding:'utf8'});
  process.stdout.write(audit.stdout||'');process.stderr.write(audit.stderr||'');
  if(audit.status!==0){
    if(audit.error)process.stderr.write(String(audit.error)+'\n');
    process.stderr.write('Dependency audit failed; performance gate skipped.\n');
    process.exitCode=audit.status||1;
  }else{
    const gate = spawnSync(process.execPath, [path.join(__dirname, 'performance-regression.js')], { cwd:root,encoding:'utf8' });
    process.stdout.write(gate.stdout||'');process.stderr.write(gate.stderr||'');
    if (gate.status !== 0)process.exitCode=gate.status||1;
  }
}
