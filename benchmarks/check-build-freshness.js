'use strict';
/* Không có gate nào trong repo xác nhận 3 file build (assets/generated/modular-pilot.js,
   assets/core.js, assets/workers/westgard-worker.js) khớp với nguồn TypeScript hiện tại.
   `npm test`/pre-commit hook cố tình không cần `npm install` (chỉ dùng module lõi Node),
   nên KHÔNG rebuild trước khi chạy — chúng chỉ chạy đúng những gì đã COMMIT sẵn trong
   assets/. Hệ quả: sửa một file .ts rồi quên `npm run build:pilot` trước khi commit vẫn
   qua sạch pre-commit hook lẫn CI job `test`, vì cả hai đều test bản build CŨ. Đây là
   đúng loại lỗi mà cảnh báo gốc ở WG_RULE_REGISTRY (qc-core.ts) lo ngại, nhưng áp dụng
   cho TOÀN BỘ src/presentation + src/application + src/domain (mọi thứ modular-pilot.global.ts
   import), không riêng core.js — tests/qc-core-ts-parity.test.js chỉ đóng phần core.js.
   Vì vậy gate này CHỈ chạy trong benchmarks/verify-release.js (sau `npm ci`, môi trường
   chắc chắn có vite/tsc), không đưa vào npm test/pre-commit — giữ đúng ranh giới
   "cần cài đặt" / "không cần cài đặt" đã ghi trong CLAUDE.md. Build lại vào một thư mục
   tạm rồi so nội dung byte-for-byte với bản đã commit — không dùng mtime (checkout git
   làm mtime vô nghĩa), không tự động ghi đè bản đã commit (chỉ báo lệch, để người commit
   tự chạy đúng lệnh build và tự soát lại diff trước khi commit). */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
// Gọi thẳng entry .js của CLI qua process.execPath thay vì node_modules/.bin/*.cmd —
// tránh phải bật spawnSync({shell:true}) trên Windows, vốn không tự quote đường dẫn
// chứa khoảng trắng (repo này nằm trong "...\\QC Lab\\...") và Node cảnh báo là
// không an toàn khi có tham số không được escape.
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qclab-build-fresh-'));
const failures = [];

function compare(label, builtPath, trackedPath) {
  if (!fs.existsSync(builtPath)) { failures.push(`${label}: build lại không sinh ra file — xem log build ở trên.`); return; }
  if (!fs.existsSync(trackedPath)) { failures.push(`${label}: file đã commit không tồn tại (${trackedPath}).`); return; }
  const built = fs.readFileSync(builtPath, 'utf8'), tracked = fs.readFileSync(trackedPath, 'utf8');
  if (built !== tracked) failures.push(`${label}: bản đã commit LỆCH với bản build lại từ nguồn hiện tại — chạy lại lệnh build tương ứng rồi commit bản mới.`);
}

function runBuild(label, scriptPath, args, onOk) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${label}: build lại thất bại — xem log build ở trên.`);
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return;
  }
  onOk();
}

try {
  const pilotOut = path.join(tmpDir, 'pilot');
  runBuild('build:pilot', viteBin, ['build', '--outDir', pilotOut], () =>
    compare('assets/generated/modular-pilot.js', path.join(pilotOut, 'modular-pilot.js'), path.join(root, 'assets', 'generated', 'modular-pilot.js')));

  const coreOut = path.join(tmpDir, 'core');
  runBuild('build:core', viteBin, ['build', '--config', 'vite.core.config.mjs', '--outDir', coreOut], () =>
    compare('assets/core.js', path.join(coreOut, 'core.js'), path.join(root, 'assets', 'core.js')));

  const workerOut = path.join(tmpDir, 'worker');
  runBuild('build:worker', tscBin, ['-p', 'tsconfig.worker.json', '--outDir', workerOut], () =>
    compare('assets/workers/westgard-worker.js', path.join(workerOut, 'westgard-worker.js'), path.join(root, 'assets', 'workers', 'westgard-worker.js')));
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (failures.length) {
  process.stderr.write('Build đã commit KHÔNG khớp với mã nguồn TypeScript hiện tại:\n' + failures.map(f => '  - ' + f).join('\n') + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Build freshness: assets/generated/modular-pilot.js, assets/core.js, assets/workers/westgard-worker.js đều khớp với src/ hiện tại.\n');
}
