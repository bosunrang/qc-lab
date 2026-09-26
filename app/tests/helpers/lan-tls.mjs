// Chứng chỉ HTTPS cho test máy chủ LAN: một CA tạo mới cho mỗi tệp test,
// và tiến trình test tin CA đó (`fetch` dùng kho CA mặc định của Node) — như
// máy nhân viên đã cài chứng chỉ gốc.
import { setDefaultCACertificates } from 'node:tls';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLanCa, issueServerCredentials } = require('../../../app-dist/main/lan/tls-certs.js');

export function trustedTestTls(ips = ['127.0.0.1']) {
  const ca = createLanCa();
  let credentials = issueServerCredentials(ca, ips);
  setDefaultCACertificates([ca.certPem]);
  return {
    ca,
    source: { credentials: () => credentials, caCertificate: () => ca.certDer },
    reissue(nextIps) { credentials = issueServerCredentials(ca, nextIps); return credentials; },
  };
}
