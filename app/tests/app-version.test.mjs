// Số phiên bản hiển thị phải đến TỪ `package.json`, không viết cứng.
//
// Vì sao cần một bài test cho một chuỗi: bump `package.json` lên 1.0.2 rồi
// `npm run dist` cho ra `QC-Lab-Setup-1.0.2.exe`, nhưng chân thanh điều hướng
// và trang đăng nhập vẫn khoe "1.0.1" vì ba chỗ đó viết cứng. Người dùng
// không có cách nào biết mình đang chạy bản nào — mà đó là thông tin đầu tiên
// cần hỏi khi có báo lỗi. Không test nào bắt được, vì không test nào đọc tới
// chuỗi hiển thị.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../../package.json'));

test('VER01: Vite bơm phiên bản từ package.json, có khai báo kiểu đi kèm', () => {
  const config = read('../../vite.app-renderer.config.mjs');
  assert.match(config, /readFileSync\(new URL\('\.\/package\.json'/, 'đọc thẳng package.json');
  assert.match(config, /define: \{ 'import\.meta\.env\.VITE_APP_VERSION': JSON\.stringify\(APP_VERSION\) \}/);
  // Thiếu khai báo thì `tsc` của renderer gãy; để đây cho lỗi nói đúng nguyên nhân.
  assert.match(read('../renderer/vite-env.d.ts'), /readonly VITE_APP_VERSION: string;/);
});

test('VER02: không còn chuỗi phiên bản viết cứng nào trong giao diện', () => {
  const surfaces = {
    'AppShell.tsx': read('../renderer/components/AppShell.tsx'),
    'LoginPage.tsx': read('../renderer/pages/LoginPage.tsx'),
  };
  // Bất kỳ `x.y.z` nào trong hai tệp này đều là một con số sẽ mốc meo.
  for (const [name, source] of Object.entries(surfaces)) {
    const literals = source.match(/\d+\.\d+\.\d+/g) || [];
    assert.deepEqual(literals, [], `${name} còn viết cứng phiên bản: ${literals.join(', ')}`);
    assert.match(source, /import\.meta\.env\.VITE_APP_VERSION/, `${name} phải đọc phiên bản từ môi trường build`);
  }
});

test('VER03: tên tệp cài và phiên bản hiển thị dùng CÙNG một nguồn', () => {
  // electron-builder đặt tên tệp theo `${version}` của chính package.json này,
  // nên cả hai đầu ra chỉ lệch được khi ai đó viết cứng lại một trong hai.
  assert.match(pkg.build.win.artifactName, /\$\{version\}/);
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});


