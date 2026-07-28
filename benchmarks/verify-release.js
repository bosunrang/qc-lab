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
  const runAudit=args=>fs.existsSync(bundledNpm)
    ?spawnSync(process.execPath,[bundledNpm,'audit',...args],{cwd:root,encoding:'utf8'})
    :spawnSync(npm,['audit',...args],{cwd:root,encoding:'utf8'});
  // Chặn phát hành: chỉ nhánh dependency thực sự đi vào bản cài (electron-updater
  // và cây con của nó). `build.files` chỉ đóng gói index.html/assets/electron/
  // package.json, nên devDependencies không bao giờ tới tay người dùng.
  const prodAudit=runAudit(['--omit=dev','--audit-level=high']);
  process.stdout.write(prodAudit.stdout||'');process.stderr.write(prodAudit.stderr||'');
  if(prodAudit.error)process.stderr.write(String(prodAudit.error)+'\n');
  if(prodAudit.status!==0)process.stderr.write('Runtime dependency audit FAILED — chặn phát hành.\n');
  // Báo cáo (không chặn): cây đầy đủ gồm chuỗi công cụ build. CVE ở đây chỉ đe dọa
  // máy chạy `npm run dist`, và thường không có đường vá vì upstream chưa phát hành
  // bản sửa — xử lý bằng đánh giá rủi ro (RISK-ASSESSMENT.md R-12), không phải bằng
  // override làm hỏng build. Không được để nó bỏ qua performance gate như trước.
  const devAudit=runAudit(['--audit-level=high','--json']);
  let devCounts=null;
  try{devCounts=JSON.parse(devAudit.stdout||'{}').metadata.vulnerabilities;}catch(e){}
  if(devCounts&&(devCounts.high||devCounts.critical))
    process.stdout.write(`Build tooling audit: ${devCounts.critical} critical / ${devCounts.high} high trong devDependencies — không chặn, phải có dòng rủi ro tương ứng trong docs/validation/RISK-ASSESSMENT.md.\n`);
  else process.stdout.write('Build tooling audit: không có lỗ hổng high/critical.\n');
  const gate = spawnSync(process.execPath, [path.join(__dirname, 'performance-regression.js')], { cwd:root,encoding:'utf8' });
  process.stdout.write(gate.stdout||'');process.stderr.write(gate.stderr||'');
  process.exitCode=prodAudit.status||gate.status||0;
}
