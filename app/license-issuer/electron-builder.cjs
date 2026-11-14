const path = require('node:path');
module.exports = {
  extends: null, appId: 'vn.qclab.licenseissuer', productName: 'QC Lab Cấp Key',
  directories: { app: path.resolve(__dirname, '../../.cache/license-issuer'), output: 'dist-issuer' },
  files: ['main.cjs', 'preload.cjs', 'index.html', 'assets/**/*', 'license-core.cjs', 'public-key.json', 'icon.png', 'package.json', '!node_modules{,/**/*}'],
  win: { icon: path.resolve(__dirname, '../../build/icon.ico'), executableName: 'QC-Lab-Cap-Key', target: [{ target: 'portable', arch: ['x64'] }], artifactName: 'QC-Lab-Cap-Key-${version}.${ext}' },
  portable: { requestExecutionLevel: 'user' },
  publish: null,
};
