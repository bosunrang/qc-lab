// Bundle component/CSS chung rồi chép main và khoá công khai theo danh sách.
// Không đọc hoặc chuyển khoá bí mật vào gói của công cụ.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, '.cache/license-issuer');
const { version } = require(path.join(root, 'package.json'));
(async () => {
  const { build } = await import('vite');
  await build({ configFile: path.join(root, 'app/license-issuer/vite.config.mjs') });
  for (const file of ['main.cjs', 'preload.cjs', 'license-core.cjs']) {
    fs.copyFileSync(path.join(root, 'app/license-issuer', file), path.join(target, file));
  }
  fs.copyFileSync(path.join(root, 'app/main/licensing/public-key.json'), path.join(target, 'public-key.json'));
  fs.copyFileSync(path.join(root, 'build/icon.png'), path.join(target, 'icon.png'));
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
    name: 'qc-lab-license-issuer', version, productName: 'QC Lab Cấp Key', main: 'main.cjs',
    description: 'Công cụ cấp mã kích hoạt offline QC Lab', author: 'QC Lab', license: 'UNLICENSED', private: true, dependencies: {},
  }, null, 2) + '\n');
  console.log(`Đã chuẩn bị công cụ cấp key ${version}.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
